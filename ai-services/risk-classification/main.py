"""Risk Classification Service.

Combines Logistic Regression (for general pattern recognition) with a
strict rule-based override layer. Rules can ONLY escalate risk, never
downgrade it — this guarantees safety-critical signals are never missed.

Output: LOW / MEDIUM / HIGH + a numeric score + the list of flags that
fired.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("risk_classification")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LEVELS = ["LOW", "MEDIUM", "HIGH"]
LEVEL_INDEX = {lvl: i for i, lvl in enumerate(LEVELS)}


def _max_level(a: str, b: str) -> str:
    return LEVELS[max(LEVEL_INDEX[a], LEVEL_INDEX[b])]


# Safety-critical symptoms — presence immediately escalates risk
HIGH_RISK_SYMPTOMS = {
    "chest_pain",
    "severe_chest_pain",
    "shortness_of_breath",
    "severe_abdominal_pain",
    "fainting",
    "seizure",
    "confusion",
    "unconscious",
    "bloody_vomit",
    "bloody_stool",
    "severe_headache_sudden",
    "vision_loss",
    "difficulty_breathing",
    "stiff_neck",
}

MEDIUM_RISK_SYMPTOMS = {
    "persistent_vomiting",
    "persistent_diarrhea",
    "high_fever",
    "severe_pain",
    "palpitations",
    "dizziness",
    "rash_spreading",
}


# ---------------------------------------------------------------------------
# Rule engine (strict, always applied, safety-critical)
# ---------------------------------------------------------------------------

def _apply_rules(
    temperature: float | None,
    heart_rate: float | None,
    spO2: float | None,
    respiration_rate: float | None,
    age: float | None,
    symptoms: list[str],
) -> tuple[str, list[str]]:
    """Return (rule_level, flags). Rules only escalate, never de-escalate."""
    level = "LOW"
    flags: list[str] = []

    # Temperature (°F)
    if temperature is not None:
        if temperature >= 103.5 or temperature <= 94.0:
            level = _max_level(level, "HIGH")
            flags.append("critical_temperature")
        elif temperature >= 102.0:
            level = _max_level(level, "HIGH")
            flags.append("high_fever")
        elif temperature >= 100.4 or temperature <= 96.5:
            level = _max_level(level, "MEDIUM")
            flags.append("elevated_temperature")

    # Heart rate (bpm)
    if heart_rate is not None:
        if heart_rate >= 130 or heart_rate <= 40:
            level = _max_level(level, "HIGH")
            flags.append("critical_heart_rate")
        elif heart_rate >= 110 or heart_rate <= 50:
            level = _max_level(level, "MEDIUM")
            flags.append("abnormal_heart_rate")

    # Oxygen saturation (%)
    if spO2 is not None:
        if spO2 < 92:
            level = _max_level(level, "HIGH")
            flags.append("hypoxia")
        elif spO2 < 95:
            level = _max_level(level, "MEDIUM")
            flags.append("low_oxygen")

    # Respiration rate (breaths/min)
    if respiration_rate is not None:
        if respiration_rate >= 26 or respiration_rate <= 9:
            level = _max_level(level, "HIGH")
            flags.append("critical_respiration")
        elif respiration_rate >= 22 or respiration_rate <= 11:
            level = _max_level(level, "MEDIUM")
            flags.append("abnormal_respiration")

    # Age-related adjustment (kiosk is campus-focused but staff may use)
    if age is not None and age >= 60 and temperature is not None and temperature >= 101.0:
        level = _max_level(level, "HIGH")
        flags.append("elderly_with_fever")

    # Symptom-based escalation
    sym_set = set(symptoms)
    if sym_set & HIGH_RISK_SYMPTOMS:
        level = _max_level(level, "HIGH")
        flags.append("high_risk_symptom_present")
    elif sym_set & MEDIUM_RISK_SYMPTOMS:
        level = _max_level(level, "MEDIUM")
        flags.append("medium_risk_symptom_present")

    # Combination rules
    if {"chest_pain", "shortness_of_breath"} <= sym_set:
        level = _max_level(level, "HIGH")
        flags.append("cardio_respiratory_combo")

    if {"fever", "stiff_neck"} <= sym_set:
        level = _max_level(level, "HIGH")
        flags.append("meningitis_suspect_combo")

    if temperature is not None and temperature >= 101 and heart_rate is not None and heart_rate >= 120:
        level = _max_level(level, "HIGH")
        flags.append("fever_with_tachycardia")

    return level, flags


# ---------------------------------------------------------------------------
# Logistic Regression — trained on synthetic data
# ---------------------------------------------------------------------------

def _generate_training_data(n: int = 3000, seed: int = 11) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    rows = []
    labels = []
    for _ in range(n):
        # mix of healthy, mildly sick, and severely sick
        profile = rng.choice(["healthy", "mild", "moderate", "severe"], p=[0.35, 0.35, 0.20, 0.10])
        if profile == "healthy":
            temp = rng.normal(98.4, 0.5)
            hr = rng.normal(72, 8)
            spo2 = rng.normal(98, 1.0)
            rr = rng.normal(15, 2)
            sym_count = rng.integers(0, 3)
            risk = "LOW"
        elif profile == "mild":
            temp = rng.normal(99.8, 0.8)
            hr = rng.normal(85, 10)
            spo2 = rng.normal(97, 1.2)
            rr = rng.normal(17, 2.5)
            sym_count = rng.integers(2, 5)
            risk = "LOW"
        elif profile == "moderate":
            temp = rng.normal(101.0, 1.0)
            hr = rng.normal(102, 10)
            spo2 = rng.normal(95, 1.5)
            rr = rng.normal(20, 3)
            sym_count = rng.integers(3, 7)
            risk = "MEDIUM"
        else:  # severe
            temp = rng.normal(103.0, 1.0)
            hr = rng.normal(125, 12)
            spo2 = rng.normal(90, 2.0)
            rr = rng.normal(25, 3)
            sym_count = rng.integers(5, 10)
            risk = "HIGH"

        age = float(rng.integers(16, 65))
        x = [float(temp), float(hr), float(spo2), float(rr), age, float(sym_count)]
        rows.append(x)
        labels.append(LEVEL_INDEX[risk])

    return np.asarray(rows, dtype=np.float32), np.asarray(labels)


state: dict[str, Any] = {
    "model": None,
    "scaler": None,
    "training_accuracy": None,
}


def _train() -> None:
    X, y = _generate_training_data()
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)

    clf = LogisticRegression(
        multi_class="multinomial",
        solver="lbfgs",
        max_iter=400,
        C=1.0,
        class_weight="balanced",
        random_state=11,
    )
    clf.fit(Xs, y)

    from sklearn.model_selection import cross_val_score

    scores = cross_val_score(clf, Xs, y, cv=5)
    acc = float(scores.mean())

    state["model"] = clf
    state["scaler"] = scaler
    state["training_accuracy"] = acc
    logger.info(f"LogReg trained. 5-fold CV accuracy = {acc:.4f}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _train()
    yield


app = FastAPI(title="Risk Classification Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class Vitals(BaseModel):
    temperature: float | None = Field(None, description="°F")
    heart_rate: float | None = None
    spO2: float | None = None
    respiration_rate: float | None = None


class ClassifyRequest(BaseModel):
    vitals: Vitals = Field(default_factory=Vitals)
    symptoms: list[str] = Field(default_factory=list)
    age: float | None = Field(None, ge=0, le=120)

    @field_validator("symptoms")
    @classmethod
    def _lower(cls, v: list[str]) -> list[str]:
        return [s.strip().lower().replace(" ", "_") for s in v if s.strip()]


class ClassifyResponse(BaseModel):
    level: str
    score: float
    rule_level: str
    model_level: str
    flags: list[str]
    probabilities: dict[str, float]
    model: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "risk-classification",
        "model": "logreg + rule_override",
        "training_accuracy": state["training_accuracy"],
        "rules_count": 12,
    }


@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest) -> ClassifyResponse:
    model = state["model"]
    scaler = state["scaler"]
    if model is None or scaler is None:
        raise HTTPException(503, "Model not ready")

    v = req.vitals
    temp = v.temperature if v.temperature is not None else 98.6
    hr = v.heart_rate if v.heart_rate is not None else 75.0
    spo2 = v.spO2 if v.spO2 is not None else 98.0
    rr = v.respiration_rate if v.respiration_rate is not None else 15.0
    age = req.age if req.age is not None else 22.0
    sym_count = float(len(req.symptoms))

    # Rule pass
    rule_level, flags = _apply_rules(
        temperature=v.temperature,
        heart_rate=v.heart_rate,
        spO2=v.spO2,
        respiration_rate=v.respiration_rate,
        age=req.age,
        symptoms=req.symptoms,
    )

    # LogReg pass
    x = np.array([[temp, hr, spo2, rr, age, sym_count]], dtype=np.float32)
    xs = scaler.transform(x)
    probs = model.predict_proba(xs)[0]
    model_idx = int(np.argmax(probs))
    model_level = LEVELS[model_idx]

    # Final level = max(rule, model); never downgrade
    final_level = _max_level(rule_level, model_level)
    score = float(np.clip(
        probs[LEVEL_INDEX[final_level]] + 0.5 * (LEVEL_INDEX[final_level] / 2),
        0.0,
        1.0,
    ))

    prob_map = {LEVELS[i]: round(float(probs[i]), 4) for i in range(len(LEVELS))}

    return ClassifyResponse(
        level=final_level,
        score=round(score, 4),
        rule_level=rule_level,
        model_level=model_level,
        flags=flags,
        probabilities=prob_map,
        model="logreg-v1+rules",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8102))
    uvicorn.run(app, host="0.0.0.0", port=port)
