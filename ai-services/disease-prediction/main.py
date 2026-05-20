"""Disease Prediction Service.

Takes structured symptoms + optional vitals and returns the most likely
disease along with a calibrated confidence score. Uses an ensemble of
Random Forest and Gradient Boosting classifiers trained on synthetic
campus-healthcare data at startup.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("disease_prediction")

# ---------------------------------------------------------------------------
# Vocabularies
# ---------------------------------------------------------------------------

SYMPTOM_VOCAB: list[str] = [
    "fever", "cough", "sore_throat", "runny_nose", "headache", "body_ache",
    "fatigue", "nausea", "vomiting", "diarrhea", "abdominal_pain", "chills",
    "sneezing", "itchy_eyes", "watery_eyes", "chest_pain",
    "shortness_of_breath", "dizziness", "rash", "itching",
    "burning_sensation", "frequent_urination", "painful_urination",
    "back_pain", "loss_of_appetite", "weakness", "sweating",
    "sinus_pressure", "nasal_congestion", "insomnia", "palpitations",
    "muscle_ache", "joint_pain", "cut_wound", "bruise", "heartburn",
    "acidity", "bloating", "eye_discharge", "red_eye", "photophobia",
]

SYMPTOM_INDEX = {s: i for i, s in enumerate(SYMPTOM_VOCAB)}

# disease -> dict of symptom -> probability of appearing, plus vitals hints
DISEASE_PROFILES: dict[str, dict[str, Any]] = {
    "common_cold": {
        "symptoms": {"runny_nose": 0.9, "sneezing": 0.8, "sore_throat": 0.6,
                      "cough": 0.5, "headache": 0.3, "fatigue": 0.4,
                      "nasal_congestion": 0.8},
        "vitals": {"temp": (98.6, 0.6), "hr": (75, 8), "spo2": (98, 1.2)},
    },
    "influenza": {
        "symptoms": {"fever": 0.95, "body_ache": 0.9, "chills": 0.8,
                      "headache": 0.8, "cough": 0.7, "fatigue": 0.9,
                      "muscle_ache": 0.8, "sore_throat": 0.5},
        "vitals": {"temp": (101.5, 0.8), "hr": (95, 9), "spo2": (97, 1.5)},
    },
    "viral_fever": {
        "symptoms": {"fever": 0.95, "body_ache": 0.7, "fatigue": 0.7,
                      "headache": 0.5, "chills": 0.5, "sweating": 0.4,
                      "loss_of_appetite": 0.5},
        "vitals": {"temp": (101.0, 0.8), "hr": (92, 9), "spo2": (97, 1.5)},
    },
    "food_poisoning": {
        "symptoms": {"vomiting": 0.85, "diarrhea": 0.85, "abdominal_pain": 0.8,
                      "nausea": 0.9, "weakness": 0.7, "fever": 0.4,
                      "loss_of_appetite": 0.7},
        "vitals": {"temp": (99.5, 0.8), "hr": (92, 9), "spo2": (97, 1.5)},
    },
    "gastritis": {
        "symptoms": {"abdominal_pain": 0.9, "heartburn": 0.8, "acidity": 0.8,
                      "bloating": 0.7, "nausea": 0.6, "loss_of_appetite": 0.5},
        "vitals": {"temp": (98.4, 0.4), "hr": (78, 7), "spo2": (98, 1.2)},
    },
    "migraine": {
        "symptoms": {"headache": 0.95, "photophobia": 0.8, "nausea": 0.7,
                      "vomiting": 0.5, "dizziness": 0.4},
        "vitals": {"temp": (98.4, 0.4), "hr": (80, 8), "spo2": (98, 1.2)},
    },
    "tension_headache": {
        "symptoms": {"headache": 0.95, "muscle_ache": 0.4, "fatigue": 0.5,
                      "insomnia": 0.4},
        "vitals": {"temp": (98.4, 0.4), "hr": (78, 7), "spo2": (98, 1.2)},
    },
    "allergic_rhinitis": {
        "symptoms": {"sneezing": 0.95, "runny_nose": 0.9, "itchy_eyes": 0.8,
                      "watery_eyes": 0.7, "nasal_congestion": 0.7,
                      "itching": 0.4},
        "vitals": {"temp": (98.4, 0.4), "hr": (76, 7), "spo2": (98, 1.2)},
    },
    "uti": {
        "symptoms": {"painful_urination": 0.9, "frequent_urination": 0.9,
                      "burning_sensation": 0.8, "abdominal_pain": 0.5,
                      "back_pain": 0.4, "fever": 0.3},
        "vitals": {"temp": (99.4, 0.8), "hr": (85, 8), "spo2": (98, 1.2)},
    },
    "conjunctivitis": {
        "symptoms": {"red_eye": 0.95, "eye_discharge": 0.8, "itchy_eyes": 0.7,
                      "watery_eyes": 0.6, "photophobia": 0.4},
        "vitals": {"temp": (98.6, 0.4), "hr": (75, 7), "spo2": (98, 1.2)},
    },
    "sinusitis": {
        "symptoms": {"sinus_pressure": 0.9, "nasal_congestion": 0.9,
                      "headache": 0.7, "cough": 0.5, "sore_throat": 0.3,
                      "fatigue": 0.4},
        "vitals": {"temp": (99.0, 0.8), "hr": (80, 8), "spo2": (98, 1.2)},
    },
    "acute_bronchitis": {
        "symptoms": {"cough": 0.95, "chest_pain": 0.5, "fatigue": 0.7,
                      "shortness_of_breath": 0.5, "fever": 0.5,
                      "sore_throat": 0.4},
        "vitals": {"temp": (99.8, 0.8), "hr": (90, 9), "spo2": (96, 1.5)},
    },
    "dehydration": {
        "symptoms": {"weakness": 0.9, "dizziness": 0.8, "fatigue": 0.8,
                      "headache": 0.6, "loss_of_appetite": 0.5,
                      "palpitations": 0.4},
        "vitals": {"temp": (99.0, 0.6), "hr": (100, 10), "spo2": (97, 1.5)},
    },
    "gastroenteritis": {
        "symptoms": {"diarrhea": 0.9, "vomiting": 0.7, "abdominal_pain": 0.8,
                      "nausea": 0.8, "fever": 0.5, "weakness": 0.6,
                      "loss_of_appetite": 0.6},
        "vitals": {"temp": (100.2, 0.8), "hr": (92, 9), "spo2": (97, 1.5)},
    },
    "heat_exhaustion": {
        "symptoms": {"sweating": 0.9, "weakness": 0.8, "headache": 0.7,
                      "nausea": 0.5, "dizziness": 0.7, "palpitations": 0.4},
        "vitals": {"temp": (100.8, 0.8), "hr": (110, 10), "spo2": (97, 1.5)},
    },
    "skin_rash_mild": {
        "symptoms": {"rash": 0.95, "itching": 0.8, "burning_sensation": 0.4,
                      "sneezing": 0.2},
        "vitals": {"temp": (98.6, 0.4), "hr": (76, 7), "spo2": (98, 1.2)},
    },
    "minor_injury": {
        "symptoms": {"cut_wound": 0.9, "bruise": 0.6, "joint_pain": 0.3},
        "vitals": {"temp": (98.6, 0.4), "hr": (80, 8), "spo2": (98, 1.2)},
    },
    "anxiety_stress": {
        "symptoms": {"palpitations": 0.8, "insomnia": 0.7, "fatigue": 0.7,
                      "headache": 0.5, "dizziness": 0.5, "sweating": 0.5,
                      "chest_pain": 0.3},
        "vitals": {"temp": (98.4, 0.4), "hr": (95, 10), "spo2": (98, 1.2)},
    },
}

DISEASES = list(DISEASE_PROFILES.keys())
DISEASE_INDEX = {d: i for i, d in enumerate(DISEASES)}


# ---------------------------------------------------------------------------
# Synthetic training data
# ---------------------------------------------------------------------------

def _symptom_vector(symptoms: set[str]) -> np.ndarray:
    v = np.zeros(len(SYMPTOM_VOCAB), dtype=np.float32)
    for s in symptoms:
        i = SYMPTOM_INDEX.get(s)
        if i is not None:
            v[i] = 1.0
    return v


def _sample_case(disease: str, rng: np.random.Generator) -> tuple[np.ndarray, int]:
    prof = DISEASE_PROFILES[disease]
    symptoms: set[str] = set()
    for sym, p in prof["symptoms"].items():
        if rng.random() < p:
            symptoms.add(sym)
    # Add a little noise: 0-2 random unrelated symptoms
    noise_count = int(rng.integers(0, 3))
    for _ in range(noise_count):
        symptoms.add(SYMPTOM_VOCAB[int(rng.integers(0, len(SYMPTOM_VOCAB)))])

    vec = _symptom_vector(symptoms)

    vitals_hint = prof["vitals"]
    temp = float(rng.normal(*vitals_hint["temp"]))
    hr = float(rng.normal(*vitals_hint["hr"]))
    spo2 = float(rng.normal(*vitals_hint["spo2"]))

    # age 16-60 (campus population + staff)
    age = float(rng.integers(16, 60))

    features = np.concatenate([
        vec,
        np.array([temp, hr, spo2, age], dtype=np.float32),
    ])
    return features, DISEASE_INDEX[disease]


def _build_training_set(n_per_disease: int = 180, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    xs, ys = [], []
    for disease in DISEASES:
        for _ in range(n_per_disease):
            x, y = _sample_case(disease, rng)
            xs.append(x)
            ys.append(y)
    return np.vstack(xs), np.asarray(ys)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class Vitals(BaseModel):
    temperature: float | None = Field(None, description="Temperature in °F")
    heart_rate: float | None = Field(None, description="Heart rate bpm")
    spO2: float | None = Field(None, description="Oxygen saturation %")


class PredictRequest(BaseModel):
    symptoms: list[str] = Field(..., min_length=1)
    vitals: Vitals | None = None
    age: float | None = Field(None, ge=1, le=120)
    top_k: int = Field(3, ge=1, le=10)

    @field_validator("symptoms")
    @classmethod
    def _lower(cls, v: list[str]) -> list[str]:
        return [s.strip().lower().replace(" ", "_") for s in v if s.strip()]


class Alternative(BaseModel):
    disease: str
    confidence: float


class PredictResponse(BaseModel):
    disease: str
    confidence: float
    alternatives: list[Alternative]
    known_symptoms: list[str]
    unknown_symptoms: list[str]
    model: str


# ---------------------------------------------------------------------------
# Train at startup
# ---------------------------------------------------------------------------

state: dict[str, Any] = {
    "rf": None,
    "gbm": None,
    "feature_dim": len(SYMPTOM_VOCAB) + 4,
    "training_accuracy": None,
}


def _train_models() -> None:
    logger.info("Training disease prediction ensemble (RF + GBM)…")
    X, y = _build_training_set()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=7, stratify=y
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=14,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=7,
    )
    gbm = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.08,
        random_state=7,
    )
    rf.fit(X_train, y_train)
    gbm.fit(X_train, y_train)

    probs = 0.5 * rf.predict_proba(X_test) + 0.5 * gbm.predict_proba(X_test)
    preds = np.argmax(probs, axis=1)
    acc = float(np.mean(preds == y_test))

    state["rf"] = rf
    state["gbm"] = gbm
    state["training_accuracy"] = acc
    logger.info(f"Trained. Ensemble test accuracy = {acc:.4f} on {len(X_test)} samples")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _train_models()
    yield


app = FastAPI(title="Disease Prediction Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _featurize(req: PredictRequest) -> tuple[np.ndarray, list[str], list[str]]:
    known = [s for s in req.symptoms if s in SYMPTOM_INDEX]
    unknown = [s for s in req.symptoms if s not in SYMPTOM_INDEX]
    vec = _symptom_vector(set(known))

    temp = req.vitals.temperature if req.vitals and req.vitals.temperature is not None else 98.6
    hr = req.vitals.heart_rate if req.vitals and req.vitals.heart_rate is not None else 75.0
    spo2 = req.vitals.spO2 if req.vitals and req.vitals.spO2 is not None else 98.0
    age = req.age if req.age is not None else 22.0

    x = np.concatenate([vec, np.array([temp, hr, spo2, age], dtype=np.float32)])
    return x.reshape(1, -1), known, unknown


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "disease-prediction",
        "model": "rf+gbm ensemble",
        "training_accuracy": state["training_accuracy"],
        "n_diseases": len(DISEASES),
        "n_symptoms": len(SYMPTOM_VOCAB),
    }


@app.get("/vocab")
async def vocab() -> dict[str, Any]:
    return {"symptoms": SYMPTOM_VOCAB, "diseases": DISEASES}


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest) -> PredictResponse:
    rf = state["rf"]
    gbm = state["gbm"]
    if rf is None or gbm is None:
        raise HTTPException(503, "Model not ready")

    x, known, unknown = _featurize(req)
    probs = 0.5 * rf.predict_proba(x)[0] + 0.5 * gbm.predict_proba(x)[0]
    order = np.argsort(-probs)

    top = order[: req.top_k]
    top_disease = DISEASES[top[0]]
    alternatives = [
        Alternative(disease=DISEASES[i], confidence=round(float(probs[i]), 4))
        for i in top[1:]
    ]

    return PredictResponse(
        disease=top_disease,
        confidence=round(float(probs[top[0]]), 4),
        alternatives=alternatives,
        known_symptoms=known,
        unknown_symptoms=unknown,
        model="rf+gbm-ensemble-v1",
    )


@app.post("/predict/batch")
async def predict_batch(payload: list[PredictRequest]) -> list[PredictResponse]:
    return [await predict(p) for p in payload]


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8101))
    uvicorn.run(app, host="0.0.0.0", port=port)
