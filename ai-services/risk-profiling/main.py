"""
Patient Risk Profiling Service

Classifies patients into low / medium / high risk categories based on
historical medical features using a Random Forest classifier.

The model is trained at startup on a synthetic dataset that mimics
realistic campus dispensary patterns. In production this would be
replaced by training on real historical MedicalRecords.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

RISK_LEVELS = ["low", "medium", "high"]
SEED = 42


class PatientFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: int = Field(..., ge=10, le=100)
    visit_count_6mo: int = Field(..., ge=0, le=50)
    avg_symptoms_per_visit: float = Field(..., ge=0, le=10)
    chronic_condition_count: int = Field(..., ge=0, le=10)
    avg_temperature: float = Field(..., ge=95, le=110)
    recent_antibiotic_courses: int = Field(..., ge=0, le=10)


class RiskResponse(BaseModel):
    risk_level: Literal["low", "medium", "high"]
    probability: float
    probabilities: dict[str, float]
    model_version: str
    generated_at: datetime


def generate_synthetic_dataset(n_samples: int = 2000, seed: int = SEED):
    """Generate a synthetic but realistic training set."""
    rng = np.random.default_rng(seed)

    age = rng.integers(17, 70, size=n_samples)
    visits = rng.poisson(lam=2, size=n_samples)
    avg_symptoms = rng.uniform(1, 6, size=n_samples)
    chronic = rng.poisson(lam=0.4, size=n_samples).clip(0, 5)
    temp = rng.normal(98.6, 1.2, size=n_samples).clip(95, 106)
    antibiotics = rng.poisson(lam=0.5, size=n_samples).clip(0, 5)

    score = (
        0.04 * (age - 20)
        + 0.35 * visits
        + 0.18 * avg_symptoms
        + 0.7 * chronic
        + 0.5 * np.maximum(0, temp - 99)
        + 0.4 * antibiotics
        + rng.normal(0, 0.6, size=n_samples)
    )

    labels = np.where(score < 2.0, 0, np.where(score < 4.5, 1, 2))

    X = np.column_stack([age, visits, avg_symptoms, chronic, temp, antibiotics])
    return X, labels


class RiskModel:
    FEATURE_ORDER = [
        "age",
        "visit_count_6mo",
        "avg_symptoms_per_visit",
        "chronic_condition_count",
        "avg_temperature",
        "recent_antibiotic_courses",
    ]

    def __init__(self):
        self.clf: RandomForestClassifier | None = None
        self.accuracy: float | None = None
        self.version: str = "rf-v1"

    def train(self):
        X, y = generate_synthetic_dataset()
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=SEED, stratify=y
        )
        self.clf = RandomForestClassifier(
            n_estimators=160,
            max_depth=10,
            min_samples_leaf=3,
            random_state=SEED,
            n_jobs=-1,
            class_weight="balanced",
        )
        self.clf.fit(X_train, y_train)
        self.accuracy = float(accuracy_score(y_test, self.clf.predict(X_test)))

    def predict(self, features: PatientFeatures) -> RiskResponse:
        if self.clf is None:
            raise RuntimeError("Model not trained")

        arr = np.array(
            [[getattr(features, name) for name in self.FEATURE_ORDER]],
            dtype=float,
        )
        proba = self.clf.predict_proba(arr)[0]
        idx = int(np.argmax(proba))

        return RiskResponse(
            risk_level=RISK_LEVELS[idx],
            probability=float(proba[idx]),
            probabilities={RISK_LEVELS[i]: float(proba[i]) for i in range(3)},
            model_version=self.version,
            generated_at=datetime.utcnow(),
        )


model = RiskModel()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    model.train()
    yield


app = FastAPI(
    title="Risk Profiling Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model.clf is not None,
        "model_version": model.version,
        "training_accuracy": model.accuracy,
    }


@app.post("/predict", response_model=RiskResponse)
def predict(payload: PatientFeatures):
    try:
        return model.predict(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/predict/batch")
def predict_batch(items: list[PatientFeatures]):
    return [model.predict(item) for item in items]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
