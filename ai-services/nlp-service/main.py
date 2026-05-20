"""NLP Service.

Converts free-text (voice-transcribed or typed) user complaints into the
canonical symptom vocabulary used by the disease prediction, risk, and
recommender services. Three-layer extraction:

1. Keyword / synonym matching against a curated dictionary (~60 concepts,
   ~200 synonym variants incl. Hinglish forms like "bukhar", "sir dard").
2. Fuzzy matching (rapidfuzz) with token_set_ratio to absorb typos and
   word-order variants.
3. Lightweight biomedical-style NER: extracts body-part mentions,
   severity adjectives, duration cues, and NEGATION windows so that
   "no fever" doesn't falsely map to `fever`.

Output is structured: canonical symptoms, per-match evidence, detected
severity, duration, body parts, and negated spans.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator
from rapidfuzz import fuzz, process

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("nlp_service")

# ---------------------------------------------------------------------------
# Symptom vocabulary
# Each canonical term maps to a list of synonyms/paraphrases. The canonical
# key is what downstream services consume.
# ---------------------------------------------------------------------------

SYMPTOM_VOCAB: dict[str, list[str]] = {
    "fever": ["fever", "high temperature", "running a temperature", "feverish", "bukhar", "temperature"],
    "high_fever": ["high fever", "burning up", "very high temperature", "tez bukhar"],
    "mild_fever": ["mild fever", "slight fever", "low grade fever"],
    "chills": ["chills", "shivering", "shivers", "cold shivers", "thand lagna"],
    "sweating": ["sweating", "sweats", "night sweats", "perspiring"],

    "headache": ["headache", "head pain", "pounding head", "sir dard", "head is throbbing", "head aches"],
    "mild_headache": ["mild headache", "slight headache", "dull headache"],
    "severe_headache_sudden": ["thunderclap headache", "sudden worst headache", "worst headache of my life"],
    "migraine": ["migraine", "one-sided headache", "throbbing headache with light sensitivity"],

    "cough": ["cough", "coughing", "khasi", "khansi"],
    "dry_cough": ["dry cough", "non productive cough", "hacking cough"],
    "sore_throat": ["sore throat", "throat pain", "gala kharab", "painful swallow", "gala dard"],
    "throat_irritation": ["throat irritation", "scratchy throat", "itchy throat"],

    "runny_nose": ["runny nose", "nose running", "naak behna", "rhinorrhea"],
    "sneezing": ["sneezing", "cheenk", "chheenk"],
    "nasal_congestion": ["blocked nose", "stuffy nose", "nasal congestion", "naak band"],
    "common_cold": ["common cold", "cold", "zukam", "sardi", "caught a cold"],

    "chest_pain": ["chest pain", "pain in chest", "chest hurting", "seene mein dard"],
    "severe_chest_pain": ["crushing chest pain", "severe chest pain", "heavy chest pressure"],
    "shortness_of_breath": ["shortness of breath", "breathless", "hard to breathe", "sans phoolna"],
    "difficulty_breathing": ["difficulty breathing", "cant breathe", "can't breathe", "gasping"],
    "palpitations": ["palpitations", "heart racing", "heart pounding", "dil tez dhadakna"],

    "nausea": ["nausea", "feeling sick", "queasy", "ulti jaisa lagna"],
    "vomiting": ["vomiting", "throwing up", "puking", "ulti"],
    "persistent_vomiting": ["non-stop vomiting", "cant stop vomiting", "persistent vomiting"],
    "bloody_vomit": ["blood in vomit", "bloody vomit", "vomiting blood", "hematemesis"],
    "upset_stomach": ["upset stomach", "stomach upset", "pet kharab"],
    "heartburn": ["heartburn", "burning in chest after eating"],
    "acidity": ["acidity", "acid reflux", "acid back up", "ambal"],
    "indigestion": ["indigestion", "dyspepsia", "feel food stuck"],
    "stomach_ache": ["stomach ache", "stomach pain", "pet dard", "belly ache"],
    "severe_abdominal_pain": ["severe abdominal pain", "extreme belly pain", "crushing stomach pain"],
    "mild_diarrhea": ["mild diarrhea", "loose stools"],
    "persistent_diarrhea": ["persistent diarrhea", "non-stop diarrhea", "watery stools"],
    "loose_motions": ["loose motions", "loose motion", "dast"],
    "dehydration": ["dehydration", "dehydrated", "very thirsty", "dry mouth"],
    "bloody_stool": ["blood in stool", "bloody stool", "melena"],

    "body_ache": ["body ache", "body pain", "aching all over", "badan dard"],
    "muscle_pain": ["muscle pain", "muscles sore", "myalgia"],
    "back_pain": ["back pain", "lower back pain", "kamar dard"],
    "joint_pain": ["joint pain", "joints hurt", "arthralgia"],
    "menstrual_pain": ["menstrual pain", "period pain", "cramps", "mahwari ka dard"],
    "toothache": ["toothache", "tooth pain", "dant dard"],

    "fatigue": ["fatigue", "tired", "exhausted", "no energy", "thakavat"],
    "weakness": ["weakness", "weak", "kamzori"],
    "dizziness": ["dizziness", "lightheaded", "feel faint", "chakkar"],
    "fainting": ["fainting", "fainted", "passed out", "blacked out", "behosh"],
    "seizure": ["seizure", "fit", "convulsion", "mirgi"],
    "confusion": ["confusion", "disoriented", "cant think straight"],
    "unconscious": ["unconscious", "not responsive", "wont wake up"],

    "allergy": ["allergy", "allergic reaction", "allergies"],
    "itching": ["itching", "itchy", "khujli"],
    "mild_rash": ["mild rash", "small rash", "red spots"],
    "rash_spreading": ["rash spreading", "rash getting worse", "rash all over"],
    "watery_eyes": ["watery eyes", "teary eyes", "eyes watering"],
    "vision_loss": ["vision loss", "cant see", "blurry sudden", "blind spot sudden"],
    "stiff_neck": ["stiff neck", "neck stiff", "cant bend neck", "neck rigidity"],

    "minor_cut": ["cut", "small cut", "minor cut"],
    "scrape": ["scrape", "scraped", "graze"],
    "blister": ["blister", "fluid filled bump"],
    "small_wound": ["small wound", "minor wound"],
    "low_immunity": ["low immunity", "weak immune", "get sick often"],
}

# Flattened (synonym, canonical) list for fuzzy matching
SYNONYM_INDEX: list[tuple[str, str]] = [
    (syn.lower(), canon)
    for canon, syns in SYMPTOM_VOCAB.items()
    for syn in syns
]


# ---------------------------------------------------------------------------
# NER-ish extraction resources
# ---------------------------------------------------------------------------

SEVERITY_WORDS = {
    "mild": "mild",
    "slight": "mild",
    "little": "mild",
    "moderate": "moderate",
    "bad": "severe",
    "severe": "severe",
    "extreme": "severe",
    "very": "severe",
    "unbearable": "severe",
    "worst": "severe",
    "crushing": "severe",
    "sudden": "acute",
    "gradual": "chronic",
    "persistent": "chronic",
    "chronic": "chronic",
}

BODY_PARTS = {
    "head", "neck", "chest", "stomach", "abdomen", "back", "throat",
    "eye", "eyes", "ear", "ears", "nose", "leg", "arm", "knee", "tooth",
    "teeth", "joint", "joints", "heart", "lung", "lungs", "skin",
}

DURATION_RE = re.compile(
    r"\b(?:for|since|last|past)\s+(?:a|an|the)?\s*"
    r"(\d+\s*(?:hour|hours|hr|hrs|day|days|week|weeks|month|months)"
    r"|few\s*(?:hours|days|weeks)"
    r"|yesterday|morning|night|today)\b",
    re.IGNORECASE,
)

NEGATION_WORDS = {"no", "not", "without", "deny", "denies", "never", "none"}
NEGATION_WINDOW = 4  # how many tokens after a negation are considered negated


# ---------------------------------------------------------------------------
# Core matcher
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def _negated_indices(tokens: list[str]) -> set[int]:
    """Return indices of tokens that fall inside a negation window."""
    negated: set[int] = set()
    for i, t in enumerate(tokens):
        if t in NEGATION_WORDS:
            for j in range(i + 1, min(i + 1 + NEGATION_WINDOW, len(tokens))):
                negated.add(j)
    return negated


def _span_is_negated(text: str, span: tuple[int, int], tokens: list[str], neg: set[int]) -> bool:
    """Rough check: is any word in the matched span part of a negated window?"""
    start, end = span
    phrase = text[start:end].lower()
    phrase_tokens = _tokenize(phrase)
    if not phrase_tokens:
        return False
    # find first occurrence of first phrase_token at index >= start in tokenized tokens
    first = phrase_tokens[0]
    for i, t in enumerate(tokens):
        if t == first:
            # assume phrase occupies tokens[i : i+len(phrase_tokens)]
            window = tokens[i : i + len(phrase_tokens)]
            if window == phrase_tokens:
                return any(idx in neg for idx in range(i, i + len(phrase_tokens)))
    return False


def _match_keywords(text_lower: str) -> list[dict[str, Any]]:
    """Exact-substring matches; fastest + highest precision."""
    hits: list[dict[str, Any]] = []
    for syn, canon in SYNONYM_INDEX:
        start = text_lower.find(syn)
        if start != -1:
            hits.append({
                "canonical": canon,
                "matched_text": syn,
                "span": (start, start + len(syn)),
                "score": 1.0,
                "method": "keyword",
            })
    return hits


SINGLE_TOKEN_SYNONYMS: list[tuple[str, str]] = [
    (syn, canon) for syn, canon in SYNONYM_INDEX if " " not in syn and len(syn) >= 4
]
MULTI_TOKEN_SYNONYMS: list[tuple[str, str]] = [
    (syn, canon) for syn, canon in SYNONYM_INDEX if " " in syn
]


def _match_fuzzy(text_lower: str, threshold: int = 86) -> list[dict[str, Any]]:
    """Two-stage fuzzy match: single-token ratio + multi-token token_set_ratio."""
    hits: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    tokens = text_lower.split()

    # Stage 1 — single-token typo correction with fuzz.ratio
    single_syns = [s for s, _ in SINGLE_TOKEN_SYNONYMS]
    single_thresh = max(78, threshold - 8)
    for tok in tokens:
        clean = re.sub(r"[^a-z']", "", tok)
        if len(clean) < 4:
            continue
        m = process.extractOne(clean, single_syns, scorer=fuzz.ratio, score_cutoff=single_thresh)
        if m is None:
            continue
        syn, score, idx = m
        canon = SINGLE_TOKEN_SYNONYMS[idx][1]
        key = (clean, canon)
        if key in seen:
            continue
        seen.add(key)
        start = text_lower.find(clean)
        span = (start, start + len(clean)) if start != -1 else (0, 0)
        hits.append({
            "canonical": canon,
            "matched_text": clean,
            "span": span,
            "score": round(score / 100.0, 3),
            "method": "fuzzy",
        })

    # Stage 2 — rolling-window token_set_ratio for multi-word synonyms
    multi_syns = [s for s, _ in MULTI_TOKEN_SYNONYMS]
    if multi_syns:
        windows: list[str] = []
        for size in (2, 3, 4):
            for i in range(0, max(1, len(tokens) - size + 1)):
                windows.append(" ".join(tokens[i : i + size]))
        for w in windows:
            if len(w) < 5:
                continue
            matches = process.extract(
                w, multi_syns, scorer=fuzz.token_set_ratio, limit=2, score_cutoff=threshold
            )
            for syn, score, idx in matches:
                canon = MULTI_TOKEN_SYNONYMS[idx][1]
                key = (w, canon)
                if key in seen:
                    continue
                seen.add(key)
                start = text_lower.find(w)
                span = (start, start + len(w)) if start != -1 else (0, 0)
                hits.append({
                    "canonical": canon,
                    "matched_text": w,
                    "span": span,
                    "score": round(score / 100.0, 3),
                    "method": "fuzzy",
                })
    return hits


def _extract_entities(text: str, tokens: list[str]) -> dict[str, Any]:
    severity: list[str] = []
    for tok in tokens:
        if tok in SEVERITY_WORDS:
            tag = SEVERITY_WORDS[tok]
            if tag not in severity:
                severity.append(tag)

    body_parts = sorted({tok for tok in tokens if tok in BODY_PARTS})

    duration_match = DURATION_RE.search(text)
    duration = duration_match.group(0) if duration_match else None

    return {
        "severity": severity,
        "body_parts": body_parts,
        "duration": duration,
    }


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    fuzzy_threshold: int = Field(86, ge=60, le=100)

    @field_validator("text")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class Match(BaseModel):
    canonical: str
    matched_text: str
    score: float
    method: str
    negated: bool


class ParseResponse(BaseModel):
    symptoms: list[str]
    negated_symptoms: list[str]
    matches: list[Match]
    entities: dict[str, Any]
    model: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="NLP Service")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "nlp",
        "model": "keyword + rapidfuzz + light-ner",
        "vocab_size": len(SYMPTOM_VOCAB),
        "synonym_count": len(SYNONYM_INDEX),
    }


@app.get("/vocab")
async def vocab() -> dict[str, Any]:
    return {"vocab": SYMPTOM_VOCAB}


@app.post("/parse", response_model=ParseResponse)
async def parse(req: ParseRequest) -> ParseResponse:
    text = req.text
    text_lower = text.lower()
    tokens = _tokenize(text_lower)
    neg_indices = _negated_indices(tokens)

    raw_hits = _match_keywords(text_lower)
    raw_hits += _match_fuzzy(text_lower, threshold=req.fuzzy_threshold)

    # Merge by canonical — keep best score + mark negation
    merged: dict[str, dict[str, Any]] = {}
    for h in raw_hits:
        canon = h["canonical"]
        negated = _span_is_negated(text, h["span"], tokens, neg_indices)
        existing = merged.get(canon)
        if (not existing) or h["score"] > existing["score"]:
            merged[canon] = {**h, "negated": negated}
        elif h["score"] == existing["score"] and not negated and existing.get("negated"):
            merged[canon] = {**h, "negated": negated}

    symptoms: list[str] = []
    negated_symptoms: list[str] = []
    matches: list[Match] = []
    for canon, h in merged.items():
        matches.append(Match(
            canonical=canon,
            matched_text=h["matched_text"],
            score=h["score"],
            method=h["method"],
            negated=h["negated"],
        ))
        if h["negated"]:
            negated_symptoms.append(canon)
        else:
            symptoms.append(canon)

    entities = _extract_entities(text, tokens)

    # Sort for stable output
    matches.sort(key=lambda m: (-m.score, m.canonical))
    symptoms.sort()
    negated_symptoms.sort()

    return ParseResponse(
        symptoms=symptoms,
        negated_symptoms=negated_symptoms,
        matches=matches,
        entities=entities,
        model="nlp-v1(keyword+fuzzy+ner)",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8106))
    uvicorn.run(app, host="0.0.0.0", port=port)
