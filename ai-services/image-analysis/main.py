"""Image Analysis Service.

Runs two passes on a base64-encoded image from the kiosk camera:

1. MobileNetV2 (torchvision, ImageNet pretrained) — generic feature/
   top-class extraction. Used as a sanity gate (is the image well-lit
   and reasonably in-focus?) and for audit trail.

2. Classical CV screening heuristics (numpy/PIL) on color channels:
   redness, pallor, jaundice-hint, low-light, blur score.

IMPORTANT: output is strictly *screening*, not diagnostic. Any positive
flag must be treated as a hint, not a finding. The decision engine uses
these flags to bias risk classification upward, not to name a condition.
"""
from __future__ import annotations

import base64
import io
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field
from torchvision import models, transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("image_analysis")

# ---------------------------------------------------------------------------
# Model + preprocessing
# ---------------------------------------------------------------------------

state: dict[str, Any] = {"model": None, "transform": None, "classes": None}


def _load_model() -> None:
    logger.info("Loading MobileNetV2 (ImageNet weights) ...")
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V1
    model = models.mobilenet_v2(weights=weights)
    model.eval()

    state["model"] = model
    state["transform"] = weights.transforms()
    state["classes"] = weights.meta["categories"]
    logger.info("MobileNetV2 ready. %d classes.", len(state["classes"]))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _load_model()
    yield


app = FastAPI(title="Image Analysis Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Decoders + screening heuristics
# ---------------------------------------------------------------------------

def _decode(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",", 1)[1]  # strip data URL prefix if present
    try:
        raw = base64.b64decode(b64, validate=False)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(400, f"Invalid image payload: {exc}") from exc
    return img


def _blur_score(gray: np.ndarray) -> float:
    """Laplacian-variance approximation — higher = sharper."""
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    h, w = gray.shape
    # manual 2-D convolution via slicing (avoids scipy dep)
    out = (
        gray[:-2, 1:-1] + gray[2:, 1:-1]
        + gray[1:-1, :-2] + gray[1:-1, 2:]
        - 4 * gray[1:-1, 1:-1]
    )
    return float(out.var())


def _screen_colors(img: Image.Image) -> dict[str, Any]:
    # Resize for faster CV stats
    small = img.resize((224, 224))
    arr = np.asarray(small, dtype=np.float32) / 255.0  # HxWx3

    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    brightness = float(arr.mean())
    gray = arr.mean(axis=2)

    # redness: channel dominance
    red_mask = (r > g + 0.05) & (r > b + 0.05)
    redness_ratio = float(red_mask.mean())
    redness_intensity = float(r[red_mask].mean() - arr[red_mask].mean()) if red_mask.any() else 0.0

    # pallor: bright + low saturation
    max_c = arr.max(axis=2)
    min_c = arr.min(axis=2)
    saturation = np.where(max_c > 0, (max_c - min_c) / (max_c + 1e-6), 0.0)
    pallor_mask = (brightness > 0.55) & (saturation < 0.15)
    pallor_ratio = float(pallor_mask.mean())

    # jaundice hint: high R+G, low B, in skin-tone band
    yellow_mask = (r > 0.5) & (g > 0.45) & (b < 0.4) & (r - b > 0.15)
    yellow_ratio = float(yellow_mask.mean())

    blur = _blur_score(gray)
    low_light = brightness < 0.25
    over_exposed = brightness > 0.9

    flags: list[str] = []
    if redness_ratio > 0.30 and redness_intensity > 0.08:
        flags.append("skin_redness_possible")
    if pallor_ratio > 0.35:
        flags.append("pallor_possible")
    if yellow_ratio > 0.25:
        flags.append("yellowish_tint_possible")
    if low_light:
        flags.append("low_light")
    if over_exposed:
        flags.append("overexposed")
    if blur < 8.0:
        flags.append("blurry")

    return {
        "brightness": round(brightness, 4),
        "redness_ratio": round(redness_ratio, 4),
        "redness_intensity": round(redness_intensity, 4),
        "pallor_ratio": round(pallor_ratio, 4),
        "yellow_ratio": round(yellow_ratio, 4),
        "blur_variance": round(blur, 2),
        "flags": flags,
    }


def _classify(img: Image.Image, top_k: int = 3) -> list[dict[str, Any]]:
    tfm = state["transform"]
    model = state["model"]
    classes = state["classes"]
    if model is None or tfm is None:
        return []
    with torch.inference_mode():
        batch = tfm(img).unsqueeze(0)
        logits = model(batch)
        probs = torch.softmax(logits, dim=1)[0]
        top = torch.topk(probs, k=top_k)
    return [
        {"label": classes[int(idx)], "confidence": round(float(conf), 4)}
        for conf, idx in zip(top.values, top.indices)
    ]


# ---------------------------------------------------------------------------
# Pydantic contracts
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded PNG/JPEG, with or without data URL prefix")
    top_k: int = Field(3, ge=1, le=5)


class AnalyzeResponse(BaseModel):
    usable: bool
    quality_issues: list[str]
    screening_flags: list[str]
    metrics: dict[str, Any]
    top_imagenet_classes: list[dict[str, Any]]
    disclaimer: str
    model: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "image-analysis",
        "model": "mobilenet_v2 (ImageNet) + CV heuristics",
        "classes_loaded": state["classes"] is not None,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    img = _decode(req.image_base64)
    cv = _screen_colors(img)
    top = _classify(img, top_k=req.top_k)

    quality_issues = [f for f in cv["flags"] if f in {"low_light", "overexposed", "blurry"}]
    screening_flags = [f for f in cv["flags"] if f not in quality_issues]
    usable = len(quality_issues) == 0

    metrics = {k: v for k, v in cv.items() if k != "flags"}

    return AnalyzeResponse(
        usable=usable,
        quality_issues=quality_issues,
        screening_flags=screening_flags,
        metrics=metrics,
        top_imagenet_classes=top,
        disclaimer="Screening only — not a medical diagnosis.",
        model="mobilenet_v2+cv-heuristics-v1",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8104))
    uvicorn.run(app, host="0.0.0.0", port=port)
