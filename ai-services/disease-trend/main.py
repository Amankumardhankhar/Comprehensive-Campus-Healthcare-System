"""
Disease Trend & Anomaly Detection Service

Accepts a time series of diagnosis/symptom counts and returns:
- Rolling moving average (trend line)
- Z-scores for anomaly detection
- Flagged anomaly dates where abnormal spikes occurred
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

app = FastAPI(
    title="Disease Trend Detection Service",
    version="1.0.0",
)


class TimeSeriesPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    count: int = Field(..., ge=0)


class TrendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(..., min_length=1, max_length=120)
    series: list[TimeSeriesPoint] = Field(..., min_length=3)
    window: int = Field(7, ge=2, le=60, description="Rolling window size in days")
    z_threshold: float = Field(2.0, ge=1.0, le=5.0)

    @field_validator("series")
    @classmethod
    def series_ordered(cls, v: list[TimeSeriesPoint]):
        dates = [p.date for p in v]
        if len(set(dates)) != len(dates):
            raise ValueError("Series contains duplicate dates")
        return sorted(v, key=lambda p: p.date)


class Anomaly(BaseModel):
    date: date
    count: int
    z_score: float
    severity: Literal["mild", "moderate", "severe"]


class TrendPoint(BaseModel):
    date: date
    count: int
    moving_avg: float | None
    z_score: float | None


class TrendResponse(BaseModel):
    label: str
    window: int
    z_threshold: float
    trend: list[TrendPoint]
    anomalies: list[Anomaly]
    summary: dict
    generated_at: datetime


def _severity(z: float) -> str:
    az = abs(z)
    if az >= 3.0:
        return "severe"
    if az >= 2.5:
        return "moderate"
    return "mild"


@app.get("/health")
def health():
    return {"status": "ok", "service": "disease-trend"}


@app.post("/analyze", response_model=TrendResponse)
def analyze(payload: TrendRequest):
    try:
        df = pd.DataFrame(
            [{"date": p.date, "count": p.count} for p in payload.series]
        )
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").asfreq("D", fill_value=0).reset_index()

        df["moving_avg"] = df["count"].rolling(window=payload.window, min_periods=1).mean()
        prior_mean = df["count"].shift(1).rolling(window=payload.window, min_periods=2).mean()
        prior_std = df["count"].shift(1).rolling(window=payload.window, min_periods=2).std()
        df["z_score"] = (df["count"] - prior_mean) / prior_std.replace(0, np.nan)

        anomalies: list[Anomaly] = []
        for _, row in df.iterrows():
            z = row["z_score"]
            if pd.notna(z) and abs(z) >= payload.z_threshold:
                anomalies.append(
                    Anomaly(
                        date=row["date"].date(),
                        count=int(row["count"]),
                        z_score=float(z),
                        severity=_severity(float(z)),
                    )
                )

        trend = [
            TrendPoint(
                date=row["date"].date(),
                count=int(row["count"]),
                moving_avg=(
                    float(row["moving_avg"]) if pd.notna(row["moving_avg"]) else None
                ),
                z_score=(float(row["z_score"]) if pd.notna(row["z_score"]) else None),
            )
            for _, row in df.iterrows()
        ]

        summary = {
            "total_observations": int(df["count"].sum()),
            "days_covered": int(len(df)),
            "mean_daily_count": float(df["count"].mean()),
            "peak_count": int(df["count"].max()),
            "peak_date": str(df.loc[df["count"].idxmax(), "date"].date()),
            "anomaly_count": len(anomalies),
        }

        return TrendResponse(
            label=payload.label,
            window=payload.window,
            z_threshold=payload.z_threshold,
            trend=trend,
            anomalies=anomalies,
            summary=summary,
            generated_at=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
