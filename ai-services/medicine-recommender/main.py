"""Medicine Recommender Service.

Rule-based OTC mapping for the vending kiosk. Intentionally NOT ML-driven:
dispensing medicine is safety-critical and must be fully auditable. Every
recommendation traces back to an explicit symptom→drug rule with confidence
and dosage.

Inputs:  symptoms, optional disease prediction, risk_level, age, flags.
Outputs: ranked list of OTC candidates + `requires_doctor` gate.

Catalog mirrors the 8 seeded OTC medicines in the backend. The backend will
reconcile against real-time inventory before dispensing.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("medicine_recommender")

# ---------------------------------------------------------------------------
# OTC catalog — must stay in sync with seedOtcMedicines.js on the backend
# ---------------------------------------------------------------------------

CATALOG: dict[str, dict[str, Any]] = {
    "paracetamol": {
        "name": "Paracetamol",
        "generic": "Acetaminophen 500mg",
        "form": "tablet",
        "max_per_session": 4,
        "default_dose": "1 tablet every 6 hours, max 4/day",
        "min_age": 12,
        "warnings": ["Do not exceed 4 tablets in 24 hours", "Avoid with alcohol"],
    },
    "ibuprofen": {
        "name": "Ibuprofen",
        "generic": "Ibuprofen 400mg",
        "form": "tablet",
        "max_per_session": 4,
        "default_dose": "1 tablet every 8 hours with food",
        "min_age": 16,
        "warnings": ["Take with food", "Avoid if stomach ulcer or kidney disease"],
    },
    "cetirizine": {
        "name": "Cetirizine",
        "generic": "Cetirizine HCl 10mg",
        "form": "tablet",
        "max_per_session": 2,
        "default_dose": "1 tablet at night",
        "min_age": 12,
        "warnings": ["May cause drowsiness"],
    },
    "antacid_gel": {
        "name": "Antacid Gel",
        "generic": "Aluminium Hydroxide + Magnesium Hydroxide",
        "form": "sachet",
        "max_per_session": 3,
        "default_dose": "1 sachet after meals, up to 3/day",
        "min_age": 14,
        "warnings": ["Do not use with other antacids"],
    },
    "ors": {
        "name": "ORS Sachet",
        "generic": "Oral Rehydration Salts",
        "form": "sachet",
        "max_per_session": 3,
        "default_dose": "Mix 1 sachet in 200ml clean water, sip over 1 hour",
        "min_age": 0,
        "warnings": [],
    },
    "cough_syrup": {
        "name": "Cough Syrup",
        "generic": "Dextromethorphan + Chlorpheniramine",
        "form": "bottle",
        "max_per_session": 1,
        "default_dose": "10ml three times a day",
        "min_age": 16,
        "warnings": ["May cause drowsiness", "Do not drive after use"],
    },
    "vitamin_c": {
        "name": "Vitamin C",
        "generic": "Ascorbic Acid 500mg",
        "form": "tablet",
        "max_per_session": 4,
        "default_dose": "1 tablet daily",
        "min_age": 8,
        "warnings": [],
    },
    "adhesive_bandage": {
        "name": "Adhesive Bandage",
        "generic": "Sterile wound dressing",
        "form": "pack",
        "max_per_session": 2,
        "default_dose": "Apply to clean, dry wound",
        "min_age": 0,
        "warnings": ["Replace daily or if soiled"],
    },
}


# ---------------------------------------------------------------------------
# Rule map: symptom → [ (medicine_id, base_confidence, reason) ]
# Confidence is a seed value; we aggregate and clip to [0,1] across rules.
# ---------------------------------------------------------------------------

RULES: dict[str, list[tuple[str, float, str]]] = {
    # Fever family
    "fever": [("paracetamol", 0.85, "Antipyretic — reduces fever")],
    "mild_fever": [("paracetamol", 0.80, "Antipyretic for low-grade fever")],
    "high_fever": [("paracetamol", 0.85, "Antipyretic for high fever"),
                   ("ors", 0.50, "Rehydration during fever")],
    # Pain family
    "headache": [("paracetamol", 0.80, "Analgesic for headache"),
                 ("ibuprofen", 0.60, "Anti-inflammatory if throbbing")],
    "mild_headache": [("paracetamol", 0.75, "Analgesic for mild headache")],
    "body_ache": [("paracetamol", 0.70, "Analgesic for body ache"),
                  ("ibuprofen", 0.65, "Anti-inflammatory for muscle ache")],
    "muscle_pain": [("ibuprofen", 0.80, "NSAID for musculoskeletal pain")],
    "back_pain": [("ibuprofen", 0.75, "NSAID for back pain")],
    "menstrual_pain": [("ibuprofen", 0.85, "Effective for dysmenorrhea"),
                       ("paracetamol", 0.60, "Alternative analgesic")],
    "toothache": [("paracetamol", 0.70, "Analgesic for toothache"),
                  ("ibuprofen", 0.70, "Anti-inflammatory for dental pain")],

    # Cold / allergy family
    "common_cold": [("cetirizine", 0.65, "Antihistamine for cold symptoms"),
                    ("vitamin_c", 0.45, "Immune support")],
    "cold": [("cetirizine", 0.65, "Antihistamine"),
             ("vitamin_c", 0.45, "Immune support")],
    "runny_nose": [("cetirizine", 0.80, "Antihistamine for rhinorrhea")],
    "sneezing": [("cetirizine", 0.80, "Antihistamine for sneezing")],
    "nasal_congestion": [("cetirizine", 0.65, "Reduces congestion")],
    "allergy": [("cetirizine", 0.90, "Antihistamine for allergic reaction")],
    "itching": [("cetirizine", 0.75, "Antihistamine for pruritus")],
    "mild_rash": [("cetirizine", 0.70, "Antihistamine for allergic rash")],
    "watery_eyes": [("cetirizine", 0.70, "Antihistamine for allergic conjunctivitis")],

    # Cough / throat family
    "cough": [("cough_syrup", 0.80, "Cough suppressant"),
              ("vitamin_c", 0.40, "Immune support")],
    "dry_cough": [("cough_syrup", 0.85, "Suppressant for dry cough")],
    "sore_throat": [("paracetamol", 0.60, "Analgesic for throat pain"),
                    ("vitamin_c", 0.50, "Immune support")],
    "throat_irritation": [("cough_syrup", 0.65, "Soothes throat irritation")],

    # GI family
    "upset_stomach": [("antacid_gel", 0.80, "Neutralizes stomach acid")],
    "heartburn": [("antacid_gel", 0.90, "Relieves heartburn")],
    "acidity": [("antacid_gel", 0.90, "Reduces acid reflux")],
    "indigestion": [("antacid_gel", 0.80, "Eases indigestion")],
    "stomach_ache": [("antacid_gel", 0.60, "May relieve acid-related pain")],
    "gas": [("antacid_gel", 0.55, "Helps with bloating and gas")],
    "nausea": [("ors", 0.45, "Rehydration if vomiting follows")],
    "mild_diarrhea": [("ors", 0.90, "Rehydration for fluid loss")],
    "dehydration": [("ors", 0.95, "Standard rehydration therapy")],
    "loose_motions": [("ors", 0.85, "Rehydration for loose stools")],

    # Wound family
    "minor_cut": [("adhesive_bandage", 0.95, "Protects small wound")],
    "scrape": [("adhesive_bandage", 0.90, "Protects abrasion")],
    "blister": [("adhesive_bandage", 0.75, "Protects blister from friction")],
    "small_wound": [("adhesive_bandage", 0.90, "Sterile cover for minor wound")],

    # General
    "fatigue": [("vitamin_c", 0.50, "General immune / energy support")],
    "weakness": [("vitamin_c", 0.45, "Supportive care")],
    "low_immunity": [("vitamin_c", 0.70, "Immune support supplement")],
}


# Synonym → canonical mapping. Keeps the recommender liberal in what it
# accepts: UI chips, orchestrator-normalized strings, and NLP free-text all
# land on the same RULES keys regardless of phrasing.
SYNONYMS: dict[str, str] = {
    "stomach_pain": "stomach_ache",
    "tummy_ache": "stomach_ache",
    "belly_ache": "stomach_ache",
    "abdominal_pain": "stomach_ache",
    "diarrhea": "mild_diarrhea",
    "diarrhoea": "mild_diarrhea",
    "loose_motion": "loose_motions",
    "loose_stools": "loose_motions",
    "body_aches": "body_ache",
    "muscle_ache": "muscle_pain",
    "back_ache": "back_pain",
    "stuffy_nose": "nasal_congestion",
    "blocked_nose": "nasal_congestion",
}


# Disease-to-drug hints: when we have a confident disease prediction,
# reinforce the primary recommended OTC.
DISEASE_HINTS: dict[str, list[tuple[str, float, str]]] = {
    "common_cold": [("cetirizine", 0.20, "Primary OTC for common cold"),
                    ("vitamin_c", 0.15, "Immune support")],
    "influenza": [("paracetamol", 0.20, "Symptomatic relief for flu"),
                  ("ors", 0.10, "Prevent dehydration")],
    "migraine": [("ibuprofen", 0.20, "Preferred NSAID for migraine"),
                 ("paracetamol", 0.10, "Alternative analgesic")],
    "tension_headache": [("paracetamol", 0.20, "First-line for tension headache")],
    "allergic_rhinitis": [("cetirizine", 0.25, "First-line antihistamine")],
    "gastritis": [("antacid_gel", 0.25, "First-line acid neutralizer")],
    "gastroenteritis": [("ors", 0.30, "Critical for rehydration")],
    "viral_fever": [("paracetamol", 0.20, "Antipyretic"),
                    ("ors", 0.10, "Hydration")],
}


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class RecommendRequest(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    disease: str | None = Field(None, description="Top predicted disease (optional)")
    disease_confidence: float = Field(0.0, ge=0.0, le=1.0)
    risk_level: str = Field("LOW", description="LOW | MEDIUM | HIGH")
    flags: list[str] = Field(default_factory=list)
    age: float | None = Field(None, ge=0, le=120)
    max_recommendations: int = Field(4, ge=1, le=8)

    @field_validator("symptoms", "flags")
    @classmethod
    def _lower(cls, v: list[str]) -> list[str]:
        return [s.strip().lower().replace(" ", "_") for s in v if s.strip()]

    @field_validator("disease")
    @classmethod
    def _lower_disease(cls, v: str | None) -> str | None:
        return v.strip().lower().replace(" ", "_") if v else None

    @field_validator("risk_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        v = v.strip().upper()
        return v if v in {"LOW", "MEDIUM", "HIGH"} else "LOW"


class Recommendation(BaseModel):
    medicine_id: str
    name: str
    generic: str
    form: str
    dose: str
    max_per_session: int
    confidence: float
    reasons: list[str]
    warnings: list[str]


class RecommendResponse(BaseModel):
    requires_doctor: bool
    doctor_reason: str | None
    recommendations: list[Recommendation]
    notes: list[str]
    model: str


# ---------------------------------------------------------------------------
# Recommender logic
# ---------------------------------------------------------------------------

def _score(
    symptoms: list[str],
    disease: str | None,
    disease_conf: float,
) -> dict[str, dict[str, Any]]:
    """Aggregate scores per medicine_id with supporting reasons."""
    bucket: dict[str, dict[str, Any]] = {}

    def bump(med_id: str, base: float, reason: str) -> None:
        if med_id not in CATALOG:
            return
        entry = bucket.setdefault(med_id, {"score": 0.0, "reasons": []})
        # use soft accumulation so repeated hits don't blow past 1.0 trivially
        entry["score"] = 1.0 - (1.0 - entry["score"]) * (1.0 - base)
        if reason not in entry["reasons"]:
            entry["reasons"].append(reason)

    for s in symptoms:
        key = SYNONYMS.get(s, s)
        for med_id, base, reason in RULES.get(key, []):
            bump(med_id, base, reason)

    if disease and disease in DISEASE_HINTS:
        weight = max(0.2, min(1.0, disease_conf))
        for med_id, base, reason in DISEASE_HINTS[disease]:
            bump(med_id, base * weight, f"{reason} (predicted: {disease})")

    return bucket


def _filter_contraindications(
    bucket: dict[str, dict[str, Any]],
    age: float | None,
    flags: list[str],
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    notes: list[str] = []
    kept: dict[str, dict[str, Any]] = {}

    for med_id, entry in bucket.items():
        meta = CATALOG[med_id]
        min_age = meta["min_age"]
        if age is not None and age < min_age:
            notes.append(f"Skipped {meta['name']} — age {int(age)} below min {min_age}")
            continue
        # GI flag excludes ibuprofen
        if med_id == "ibuprofen" and any(f in flags for f in ["gastric_issue", "ulcer_history", "kidney_issue"]):
            notes.append("Skipped Ibuprofen — GI/kidney contraindication flag")
            continue
        kept[med_id] = entry

    return kept, notes


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Medicine Recommender Service")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "medicine-recommender",
        "model": "rule-based-v1",
        "catalog_size": len(CATALOG),
        "symptom_rules": len(RULES),
        "disease_hints": len(DISEASE_HINTS),
    }


@app.get("/catalog")
async def catalog() -> dict[str, Any]:
    return {"items": CATALOG}


@app.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest) -> RecommendResponse:
    # Safety gate: high risk → no OTC, refer to doctor immediately
    if req.risk_level == "HIGH":
        return RecommendResponse(
            requires_doctor=True,
            doctor_reason="High-risk signals detected — in-person medical evaluation required.",
            recommendations=[],
            notes=["OTC dispensing blocked for HIGH risk sessions."],
            model="rule-based-v1",
        )

    bucket = _score(req.symptoms, req.disease, req.disease_confidence)
    if not bucket:
        return RecommendResponse(
            requires_doctor=True,
            doctor_reason="No symptom matches a dispensable OTC medicine in our catalog.",
            recommendations=[],
            notes=["Consult campus infirmary for further evaluation."],
            model="rule-based-v1",
        )

    bucket, filter_notes = _filter_contraindications(bucket, req.age, req.flags)

    ranked = sorted(bucket.items(), key=lambda kv: kv[1]["score"], reverse=True)
    ranked = ranked[: req.max_recommendations]

    recs: list[Recommendation] = []
    for med_id, entry in ranked:
        meta = CATALOG[med_id]
        recs.append(Recommendation(
            medicine_id=med_id,
            name=meta["name"],
            generic=meta["generic"],
            form=meta["form"],
            dose=meta["default_dose"],
            max_per_session=meta["max_per_session"],
            confidence=round(float(entry["score"]), 4),
            reasons=entry["reasons"],
            warnings=meta["warnings"],
        ))

    notes = filter_notes.copy()
    if req.risk_level == "MEDIUM":
        notes.append("Medium risk — dispense with caution and suggest follow-up if symptoms persist.")
    if not recs:
        return RecommendResponse(
            requires_doctor=True,
            doctor_reason="All candidate medicines were filtered by contraindications.",
            recommendations=[],
            notes=notes or ["Consult campus infirmary."],
            model="rule-based-v1",
        )

    return RecommendResponse(
        requires_doctor=False,
        doctor_reason=None,
        recommendations=recs,
        notes=notes,
        model="rule-based-v1",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8103))
    uvicorn.run(app, host="0.0.0.0", port=port)
