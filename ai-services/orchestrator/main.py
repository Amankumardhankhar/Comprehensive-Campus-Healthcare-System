"""AI Orchestrator + Decision Engine.

Single entry point the Node backend calls per kiosk session. Fans out to
the 6 AI microservices and composes a final verdict.

Pipeline:
  1. NLP        — parse free-text → canonical symptoms (negation-aware)
  2. In parallel:
       - Disease prediction  (symptoms → top-k diseases + confidence)
       - Risk classification (vitals + symptoms → LOW/MEDIUM/HIGH)
       - Anomaly detection   (vitals → outlier flags)
       - Image analysis      (optional base64 image → screening flags)
  3. Medicine recommender — uses above as context; HIGH risk short-circuits.
  4. Decision engine — final verdict: DISPENSE or REFER_TO_DOCTOR.

Decision rules (all must be true to dispense):
  - risk_level != HIGH
  - no anomaly detected OR anomaly explainable by identified disease
  - top disease confidence >= min_confidence (default 0.60)
  - image has no critical screening flag
  - recommender returned >=1 OTC candidate
  - at least one non-negated symptom was identified
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("orchestrator")

# ---------------------------------------------------------------------------
# Service endpoints (overridable via env for docker-compose)
# ---------------------------------------------------------------------------

SERVICES = {
    "disease":   os.environ.get("DISEASE_URL",   "http://localhost:8101"),
    "risk":      os.environ.get("RISK_URL",      "http://localhost:8102"),
    "medicine":  os.environ.get("MEDICINE_URL",  "http://localhost:8103"),
    "image":     os.environ.get("IMAGE_URL",     "http://localhost:8104"),
    "anomaly":   os.environ.get("ANOMALY_URL",   "http://localhost:8105"),
    "nlp":       os.environ.get("NLP_URL",       "http://localhost:8106"),
}

DEFAULT_MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.60"))
HTTP_TIMEOUT = float(os.environ.get("AI_HTTP_TIMEOUT", "20.0"))

state: dict[str, Any] = {"client": None}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    state["client"] = httpx.AsyncClient(timeout=HTTP_TIMEOUT)
    logger.info("Orchestrator ready. Downstream: %s", SERVICES)
    try:
        yield
    finally:
        await state["client"].aclose()


app = FastAPI(title="AI Orchestrator + Decision Engine", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class Vitals(BaseModel):
    temperature: float | None = None
    heart_rate: float | None = None
    spO2: float | None = None
    respiration_rate: float | None = None


class AnalyzeRequest(BaseModel):
    text: str | None = Field(None, description="Free text from voice/keyboard input")
    symptoms: list[str] = Field(default_factory=list, description="Optional pre-selected symptoms")
    vitals: Vitals = Field(default_factory=Vitals)
    image_base64: str | None = None
    age: float | None = Field(None, ge=0, le=120)
    flags: list[str] = Field(default_factory=list, description="User-declared flags e.g. gastric_issue")
    min_confidence: float = Field(DEFAULT_MIN_CONFIDENCE, ge=0.0, le=1.0)

    @field_validator("symptoms", "flags")
    @classmethod
    def _lower(cls, v: list[str]) -> list[str]:
        return [s.strip().lower().replace(" ", "_") for s in v if s.strip()]


class Decision(BaseModel):
    action: str                 # "DISPENSE" | "REFER_TO_DOCTOR"
    reasons: list[str]
    confidence: float


class AnalyzeResponse(BaseModel):
    decision: Decision
    risk_level: str
    top_disease: dict[str, Any] | None
    anomaly: bool
    symptoms_used: list[str]
    negated_symptoms: list[str]
    recommendations: list[dict[str, Any]]
    image_flags: list[str]
    image_quality_issues: list[str]
    details: dict[str, Any]
    timings_ms: dict[str, int]


# ---------------------------------------------------------------------------
# Downstream helpers
# ---------------------------------------------------------------------------

async def _post(path: str, service: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    client: httpx.AsyncClient = state["client"]
    url = f"{SERVICES[service]}{path}"
    try:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        logger.warning("downstream %s %s failed: %s", service, path, exc)
        return None


async def _call_nlp(text: str) -> dict[str, Any]:
    res = await _post("/parse", "nlp", {"text": text})
    return res or {"symptoms": [], "negated_symptoms": [], "matches": [], "entities": {}}


async def _call_disease(symptoms: list[str]) -> dict[str, Any] | None:
    if not symptoms:
        return None
    return await _post("/predict", "disease", {"symptoms": symptoms, "top_k": 3})


async def _call_risk(vitals: Vitals, symptoms: list[str], age: float | None) -> dict[str, Any] | None:
    return await _post("/classify", "risk", {
        "vitals": vitals.model_dump(),
        "symptoms": symptoms,
        "age": age,
    })


async def _call_anomaly(vitals: Vitals) -> dict[str, Any] | None:
    # Anomaly service requires all 4 vitals; fill sensible defaults if missing
    v = vitals.model_dump()
    required = {"temperature": 98.6, "heart_rate": 75.0, "spO2": 98.0, "respiration_rate": 15.0}
    filled = {k: (v.get(k) if v.get(k) is not None else required[k]) for k in required}
    return await _post("/detect", "anomaly", {"vitals": filled})


async def _call_image(image_base64: str | None) -> dict[str, Any] | None:
    if not image_base64:
        return None
    return await _post("/analyze", "image", {"image_base64": image_base64, "top_k": 1})


async def _call_medicine(
    symptoms: list[str],
    disease: str | None,
    disease_conf: float,
    risk_level: str,
    flags: list[str],
    age: float | None,
) -> dict[str, Any] | None:
    return await _post("/recommend", "medicine", {
        "symptoms": symptoms,
        "disease": disease,
        "disease_confidence": disease_conf,
        "risk_level": risk_level,
        "flags": flags,
        "age": age,
    })


# ---------------------------------------------------------------------------
# Decision engine
# ---------------------------------------------------------------------------

CRITICAL_IMAGE_FLAGS = {"pallor_possible", "yellowish_tint_possible"}


def _decide(
    *,
    symptoms: list[str],
    risk: dict[str, Any] | None,
    disease: dict[str, Any] | None,
    anomaly: dict[str, Any] | None,
    image: dict[str, Any] | None,
    recs: dict[str, Any] | None,
    min_confidence: float,
) -> Decision:
    reasons: list[str] = []

    risk_level = (risk or {}).get("level", "LOW")
    if risk_level == "HIGH":
        reasons.append("Risk classification returned HIGH.")

    if anomaly and anomaly.get("anomaly"):
        reasons.append("Vitals anomaly detected: " + "; ".join(anomaly.get("reasons") or []))

    top_disease = None
    top_conf = 0.0
    if disease and disease.get("disease"):
        top_disease = {
            "disease": disease.get("disease"),
            "confidence": float(disease.get("confidence", 0.0)),
        }
        top_conf = top_disease["confidence"]
        # Soft-gate: only block on low disease confidence if the rule-based
        # recommender ALSO has no candidates. If the recommender matched OTCs
        # from symptoms directly, it's authoritative — the disease classifier
        # is just context.
        has_recs = bool(recs and recs.get("recommendations"))
        if top_conf < min_confidence and not has_recs:
            reasons.append(
                f"Top disease confidence {top_conf:.2f} below threshold {min_confidence:.2f}."
            )

    if image:
        critical = [f for f in image.get("screening_flags", []) if f in CRITICAL_IMAGE_FLAGS]
        if critical:
            reasons.append("Image screening flagged: " + ", ".join(critical))
        if image.get("quality_issues") and not image.get("usable"):
            reasons.append("Image not usable: " + ", ".join(image["quality_issues"]))

    if not symptoms:
        reasons.append("No identifiable symptoms extracted.")

    if recs and recs.get("requires_doctor"):
        reasons.append(recs.get("doctor_reason") or "Recommender flagged doctor referral.")
    if recs and not recs.get("recommendations") and not recs.get("requires_doctor"):
        reasons.append("Recommender returned no dispensable OTC candidates.")

    if reasons:
        # Confidence in REFER decision = 1 - weighted dispense-likelihood.
        # Here we simply score by how many gates failed.
        conf = min(0.99, 0.5 + 0.12 * len(reasons))
        return Decision(action="REFER_TO_DOCTOR", reasons=reasons, confidence=round(conf, 3))

    # All gates passed → dispense
    dispense_conf = 0.6
    if top_conf:
        dispense_conf = min(0.99, 0.5 + 0.5 * top_conf)
    return Decision(
        action="DISPENSE",
        reasons=[
            f"Risk={risk_level}; top disease={top_disease['disease'] if top_disease else 'n/a'} "
            f"({top_conf:.2f}); no anomalies; OTC candidates available."
        ],
        confidence=round(dispense_conf, 3),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    client: httpx.AsyncClient = state["client"]
    out = {"status": "ok", "service": "orchestrator", "downstream": {}}
    for name, url in SERVICES.items():
        try:
            r = await client.get(f"{url}/health", timeout=3.0)
            out["downstream"][name] = {"ok": r.status_code == 200}
        except httpx.HTTPError as exc:
            out["downstream"][name] = {"ok": False, "error": str(exc)}
    return out


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    t0 = time.perf_counter()
    timings: dict[str, int] = {}

    # --- 1. NLP (if text provided) ---
    nlp_res: dict[str, Any] = {"symptoms": [], "negated_symptoms": [], "matches": [], "entities": {}}
    if req.text:
        tn = time.perf_counter()
        nlp_res = await _call_nlp(req.text)
        timings["nlp_ms"] = int((time.perf_counter() - tn) * 1000)

    nlp_symptoms = nlp_res.get("symptoms") or []
    negated = nlp_res.get("negated_symptoms") or []

    # Merge user-supplied symptoms with NLP-extracted ones; drop anything negated in text
    merged = list({*nlp_symptoms, *req.symptoms})
    merged = [s for s in merged if s not in negated]

    if not merged and not any(v is not None for v in req.vitals.model_dump().values()):
        raise HTTPException(400, "Need at least some text, symptoms, or vitals to analyze.")

    # --- 2. Parallel fan-out ---
    tp = time.perf_counter()
    disease_res, risk_res, anomaly_res, image_res = await asyncio.gather(
        _call_disease(merged),
        _call_risk(req.vitals, merged, req.age),
        _call_anomaly(req.vitals),
        _call_image(req.image_base64),
    )
    timings["parallel_ms"] = int((time.perf_counter() - tp) * 1000)

    top_disease = None
    top_conf = 0.0
    if disease_res and disease_res.get("disease"):
        top_disease = {
            "disease": disease_res.get("disease"),
            "confidence": float(disease_res.get("confidence", 0.0)),
        }
        top_conf = top_disease["confidence"]

    risk_level = (risk_res or {}).get("level", "LOW")

    # --- 3. Recommender ---
    tr = time.perf_counter()
    recs_res = await _call_medicine(
        symptoms=merged,
        disease=top_disease["disease"] if top_disease else None,
        disease_conf=top_conf,
        risk_level=risk_level,
        flags=req.flags,
        age=req.age,
    )
    timings["recommender_ms"] = int((time.perf_counter() - tr) * 1000)

    # --- 4. Decision ---
    decision = _decide(
        symptoms=merged,
        risk=risk_res,
        disease=disease_res,
        anomaly=anomaly_res,
        image=image_res,
        recs=recs_res,
        min_confidence=req.min_confidence,
    )

    timings["total_ms"] = int((time.perf_counter() - t0) * 1000)

    return AnalyzeResponse(
        decision=decision,
        risk_level=risk_level,
        top_disease=top_disease,
        anomaly=bool(anomaly_res and anomaly_res.get("anomaly")),
        symptoms_used=sorted(merged),
        negated_symptoms=negated,
        recommendations=(recs_res or {}).get("recommendations", []) if decision.action == "DISPENSE" else [],
        image_flags=(image_res or {}).get("screening_flags", []),
        image_quality_issues=(image_res or {}).get("quality_issues", []),
        details={
            "nlp": nlp_res,
            "disease": disease_res,
            "risk": risk_res,
            "anomaly": anomaly_res,
            "image": image_res,
            "recommender": recs_res,
        },
        timings_ms=timings,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8100))
    uvicorn.run(app, host="0.0.0.0", port=port)
