"""Anomaly Detection Service.

Two-layer anomaly check on vitals:

1. IsolationForest — multivariate outlier detection trained on 5000
   synthetic "healthy" vitals samples. Catches unusual *combinations*
   of readings that individually look benign.

2. Per-feature Z-score against a healthy-population mean/std. Catches
   single extreme readings that IsolationForest may smooth over.

A session is flagged as anomalous if EITHER layer trips. This biases the
decision engine toward conservative handling (escalate to doctor).
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("anomaly_detection")

FEATURES = ["temperature", "heart_rate", "spO2", "respiration_rate"]

# Healthy-population parameters (°F, bpm, %, breaths/min)
HEALTHY_MEAN = np.array([98.4, 73.0, 98.0, 15.0], dtype=np.float32)
HEALTHY_STD = np.array([0.55, 9.0, 1.1, 2.0], dtype=np.float32)

Z_STRICT = 3.0   # |z| > 3 → strong outlier
Z_WATCH = 2.3    # |z| > 2.3 → watch list


# ---------------------------------------------------------------------------
# Training data + model
# ---------------------------------------------------------------------------

def _generate_healthy(n: int = 5000, seed: int = 17) -> np.ndarray:
    rng = np.random.default_rng(seed)
    temp = rng.normal(HEALTHY_MEAN[0], HEALTHY_STD[0], n)
    hr = rng.normal(HEALTHY_MEAN[1], HEALTHY_STD[1], n)
    spo2 = rng.normal(HEALTHY_MEAN[2], HEALTHY_STD[2], n).clip(max=100.0)
    rr = rng.normal(HEALTHY_MEAN[3], HEALTHY_STD[3], n)
    X = np.stack([temp, hr, spo2, rr], axis=1).astype(np.float32)
    return X


state: dict[str, Any] = {"model": None, "contamination": 0.02}


def _train() -> None:
    X = _generate_healthy()
    clf = IsolationForest(
        n_estimators=200,
        contamination=state["contamination"],
        max_samples="auto",
        random_state=17,
    )
    clf.fit(X)
    state["model"] = clf
    logger.info("IsolationForest trained on %d healthy samples.", len(X))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _train()
    yield


app = FastAPI(title="Anomaly Detection Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class Vitals(BaseModel):
    temperature: float = Field(..., description="°F")
    heart_rate: float
    spO2: float = Field(..., ge=0, le=100)
    respiration_rate: float


class DetectRequest(BaseModel):
    vitals: Vitals


class ZScoreEntry(BaseModel):
    feature: str
    value: float
    z: float
    severity: str  # "normal" | "watch" | "strong"


class DetectResponse(BaseModel):
    anomaly: bool
    isolation_forest_outlier: bool
    isolation_forest_score: float
    z_scores: list[ZScoreEntry]
    outlier_features: list[str]
    reasons: list[str]
    model: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "anomaly-detection",
        "model": "isolation-forest + z-score",
        "features": FEATURES,
        "healthy_mean": HEALTHY_MEAN.tolist(),
        "healthy_std": HEALTHY_STD.tolist(),
    }


@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest) -> DetectResponse:
    clf = state["model"]
    if clf is None:
        raise HTTPException(503, "Model not ready")

    v = req.vitals
    x = np.array([[v.temperature, v.heart_rate, v.spO2, v.respiration_rate]], dtype=np.float32)

    # IsolationForest: -1 = outlier, +1 = inlier; decision_function: higher = more normal
    if_pred = int(clf.predict(x)[0])
    if_score = float(clf.decision_function(x)[0])
    if_outlier = if_pred == -1

    z_raw = (x[0] - HEALTHY_MEAN) / HEALTHY_STD
    z_entries: list[ZScoreEntry] = []
    outlier_features: list[str] = []
    reasons: list[str] = []

    for feat, val, z in zip(FEATURES, x[0], z_raw):
        absz = abs(float(z))
        if absz >= Z_STRICT:
            sev = "strong"
            outlier_features.append(feat)
            reasons.append(f"{feat} z={z:+.2f} (>|{Z_STRICT}|)")
        elif absz >= Z_WATCH:
            sev = "watch"
        else:
            sev = "normal"
        z_entries.append(ZScoreEntry(
            feature=feat,
            value=round(float(val), 3),
            z=round(float(z), 3),
            severity=sev,
        ))

    if if_outlier and "isolation_forest" not in reasons:
        reasons.append(f"isolation_forest flagged combination (score={if_score:.3f})")

    anomaly = if_outlier or bool(outlier_features)

    return DetectResponse(
        anomaly=anomaly,
        isolation_forest_outlier=if_outlier,
        isolation_forest_score=round(if_score, 4),
        z_scores=z_entries,
        outlier_features=outlier_features,
        reasons=reasons,
        model="iforest-v1+zscore",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8105))
    uvicorn.run(app, host="0.0.0.0", port=port)
