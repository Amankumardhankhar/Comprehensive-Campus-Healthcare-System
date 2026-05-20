"""
Medicine Demand Forecasting Service

Accepts a daily demand time series for a medicine and predicts
future consumption using a SARIMA model. Falls back to a simple
exponential-smoothing method when the series is too short for SARIMA.
"""

from __future__ import annotations

import warnings
from datetime import date, datetime, timedelta
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator
from statsmodels.tsa.holtwinters import SimpleExpSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

warnings.filterwarnings("ignore")

app = FastAPI(
    title="Medicine Demand Forecasting Service",
    version="1.0.0",
)


class DemandPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    quantity: int = Field(..., ge=0)


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    medicine_name: str = Field(..., min_length=1, max_length=200)
    history: list[DemandPoint] = Field(..., min_length=7)
    horizon_days: int = Field(14, ge=1, le=90)
    current_stock: int | None = Field(None, ge=0)
    min_stock_level: int | None = Field(None, ge=0)

    @field_validator("history")
    @classmethod
    def unique_sorted(cls, v: list[DemandPoint]):
        dates = [p.date for p in v]
        if len(set(dates)) != len(dates):
            raise ValueError("History contains duplicate dates")
        return sorted(v, key=lambda p: p.date)


class ForecastPoint(BaseModel):
    date: date
    predicted_demand: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    medicine_name: str
    horizon_days: int
    method: Literal["sarima", "exp_smoothing"]
    forecast: list[ForecastPoint]
    total_predicted_demand: float
    reorder_recommendation: dict
    generated_at: datetime


def _fit_sarima(series: pd.Series, steps: int):
    order = (1, 1, 1)
    seasonal_order = (1, 1, 1, 7) if len(series) >= 14 else (0, 0, 0, 0)
    model = SARIMAX(
        series,
        order=order,
        seasonal_order=seasonal_order,
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    fitted = model.fit(disp=False, maxiter=100)
    result = fitted.get_forecast(steps=steps)
    mean = result.predicted_mean
    ci = result.conf_int(alpha=0.2)
    return (
        np.maximum(0, mean.to_numpy()),
        np.maximum(0, ci.iloc[:, 0].to_numpy()),
        np.maximum(0, ci.iloc[:, 1].to_numpy()),
    )


def _fit_exp_smoothing(series: pd.Series, steps: int):
    model = SimpleExpSmoothing(series, initialization_method="estimated").fit(
        smoothing_level=0.4, optimized=False
    )
    mean = np.maximum(0, model.forecast(steps).to_numpy())
    std = float(series.std()) if series.std() > 0 else 1.0
    lower = np.maximum(0, mean - 1.28 * std)
    upper = mean + 1.28 * std
    return mean, lower, upper


@app.get("/health")
def health():
    return {"status": "ok", "service": "forecasting"}


@app.post("/forecast", response_model=ForecastResponse)
def forecast(payload: ForecastRequest):
    try:
        df = pd.DataFrame(
            [{"date": p.date, "quantity": p.quantity} for p in payload.history]
        )
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").asfreq("D", fill_value=0)
        series = df["quantity"].astype(float)

        use_sarima = len(series) >= 14 and series.nunique() > 1
        try:
            if use_sarima:
                mean, lower, upper = _fit_sarima(series, payload.horizon_days)
                method = "sarima"
            else:
                mean, lower, upper = _fit_exp_smoothing(series, payload.horizon_days)
                method = "exp_smoothing"
        except Exception:
            mean, lower, upper = _fit_exp_smoothing(series, payload.horizon_days)
            method = "exp_smoothing"

        start = series.index[-1].date() + timedelta(days=1)
        forecast_points = [
            ForecastPoint(
                date=start + timedelta(days=i),
                predicted_demand=float(round(mean[i], 2)),
                lower_bound=float(round(lower[i], 2)),
                upper_bound=float(round(upper[i], 2)),
            )
            for i in range(payload.horizon_days)
        ]

        total_demand = float(round(mean.sum(), 2))

        reorder = {"needs_reorder": False, "suggested_order_quantity": 0}
        if payload.current_stock is not None:
            projected_end_stock = payload.current_stock - total_demand
            if payload.min_stock_level is not None:
                needs = projected_end_stock <= payload.min_stock_level
            else:
                needs = projected_end_stock <= 0
            reorder["needs_reorder"] = bool(needs)
            reorder["projected_end_stock"] = float(round(projected_end_stock, 2))
            if needs:
                target_buffer = (payload.min_stock_level or 0) * 2
                reorder["suggested_order_quantity"] = int(
                    max(0, round(total_demand + target_buffer - payload.current_stock))
                )

        return ForecastResponse(
            medicine_name=payload.medicine_name,
            horizon_days=payload.horizon_days,
            method=method,
            forecast=forecast_points,
            total_predicted_demand=total_demand,
            reorder_recommendation=reorder,
            generated_at=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
