from __future__ import annotations

import contextlib
import logging
import os
import threading
from datetime import datetime
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .exceptions import register_exception_handlers
from .features import FEATURE_ORDER, FeaturePayload
from .formulas import FormulaResult, formula_infer
from .models import ApiResponse

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GAVAI ML Sidecar",
    description="AI-powered Automated Valuation Model for Philippine real estate",
    version="1.0.0",
    docs_url="/v1/docs",
    openapi_url="/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

_model_lock = threading.Lock()
_current_model: Any = None
_current_model_path: str | None = None
_current_model_version: str | None = None


def _load_model(path: str) -> Any:
    return joblib.load(path)


def _try_load_latest() -> None:
    global _current_model, _current_model_path, _current_model_version
    latest_path = os.path.join("models", "avm-latest.pkl")
    if os.path.exists(latest_path):
        try:
            _current_model = _load_model(latest_path)
            _current_model_path = latest_path
            _current_model_version = _current_model.get(
                "version", os.path.basename(latest_path)
            )
            logger.info("Loaded model: %s", latest_path)
        except Exception as e:
            logger.warning("Failed to load model: %s", e)
            _current_model = None


@app.on_event("startup")
def load_model_on_startup() -> None:
    _try_load_latest()


@app.get("/api/v1/health")
async def health() -> ApiResponse[dict[str, str]]:
    return ApiResponse(data={"status": "ok"})


@app.post("/api/v1/infer")
def infer(payload: FeaturePayload) -> dict[str, Any]:
    with _model_lock:
        model = _current_model

    if model is None:
        logger.info("No model loaded, using formula fallback")
        result: FormulaResult = formula_infer(
            lot_area_sqm=payload.lot_area_sqm,
            floor_area_sqm=payload.floor_area_sqm,
            property_type=_infer_property_type(payload),
            zonal_value_php=payload.zonal_value_php,
            crep_php=payload.crep_php,
            building_age_years=payload.building_age_years,
            proximity_score=_avg_proximity(payload),
        )
        return {
            "price_per_sqm_php": result.price_per_sqm_php,
            "point_estimate_php": result.point_estimate_php,
            "confidence_low_php": result.confidence_low_php,
            "confidence_high_php": result.confidence_high_php,
            "confidence_score": result.confidence_score,
            "method": result.method,
            "model_version": "formula_fallback",
        }

    X = np.array([[getattr(payload, f) for f in FEATURE_ORDER]], dtype=np.float64)
    raw_model = model.get("model", model)
    price_per_sqm = float(raw_model.predict(X)[0])

    total_area = max(payload.lot_area_sqm, payload.floor_area_sqm, 1.0)
    point_estimate = price_per_sqm * total_area

    dense_data_score = min(
        payload.score_schools, payload.score_hospitals, payload.score_malls
    )
    ci_pct = 0.15 if dense_data_score > 0.6 else 0.25

    return {
        "price_per_sqm_php": round(price_per_sqm, 2),
        "point_estimate_php": round(point_estimate, 2),
        "confidence_low_php": round(point_estimate * (1 - ci_pct), 2),
        "confidence_high_php": round(point_estimate * (1 + ci_pct), 2),
        "confidence_score": round(1 - ci_pct, 2),
        "method": "xgboost",
        "model_version": _current_model_version,
    }


@app.get("/api/v1/model/info")
def model_info() -> dict[str, Any]:
    with _model_lock:
        version = _current_model_version
        path = _current_model_path
    if version is None:
        return {"version": None, "status": "no_model_loaded", "model_path": None}
    return {"version": version, "status": "ready", "model_path": path}


class RetrainRequest(BaseModel):
    nestjs_callback_url: str | None = None
    records: list[dict[str, Any]] | None = None


@app.post("/api/v1/admin/retrain")
def retrain(request: RetrainRequest | None = None) -> dict[str, Any]:
    if request is None:
        request = RetrainRequest()

    if request.records:
        records = request.records
    else:
        import httpx

        nest_url = os.environ.get("NESTJS_INTERNAL_URL", "http://localhost:3000/api/v1")

        try:
            resp = httpx.get(f"{nest_url}/admin/train/records", timeout=30)
            resp.raise_for_status()
            records = resp.json()
            if isinstance(records, dict):
                records = records.get("data", records.get("records", []))
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail={
                    "code": "VALUATION.ML_SIDECAR_ERROR",
                    "message": f"Failed to fetch training records: {e}",
                },
            ) from e

    if len(records) == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALUATION.INSUFFICIENT_DATA",
                "message": "No approved training records available",
            },
        )

    from .train_utils import train_from_records

    model_obj, mape, record_count = train_from_records(records)

    version = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    model_path = f"models/avm-{version}.pkl"
    os.makedirs("models", exist_ok=True)
    joblib.dump({"model": model_obj, "version": version}, model_path)

    latest_path = "models/avm-latest.pkl"
    if os.path.exists(latest_path):
        os.remove(latest_path)
    os.symlink(os.path.basename(model_path), latest_path)

    global _current_model, _current_model_path, _current_model_version
    with _model_lock:
        _current_model = {"model": model_obj, "version": version}
        _current_model_path = model_path
        _current_model_version = version

    if request.nestjs_callback_url:
        with contextlib.suppress(Exception):
            httpx.post(
                request.nestjs_callback_url,
                json={
                    "version": version,
                    "modelPath": model_path,
                    "mape": mape,
                    "trainingRecords": record_count,
                },
                timeout=10,
            )

    return {
        "version": version,
        "mape": round(mape, 4),
        "trainingRecords": record_count,
    }


class LoadModelRequest(BaseModel):
    model_path: str


@app.post("/api/v1/admin/load")
def load_model_endpoint(request: LoadModelRequest) -> dict[str, Any]:
    if not os.path.exists(request.model_path):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND.MODEL_VERSION",
                "message": f"Model file not found: {request.model_path}",
            },
        )

    new_model = _load_model(request.model_path)
    version = new_model.get("version", os.path.basename(request.model_path))

    global _current_model, _current_model_path, _current_model_version
    with _model_lock:
        _current_model = new_model
        _current_model_path = request.model_path
        _current_model_version = version

    logger.info("Model hot-swapped to: %s", request.model_path)
    return {"status": "swapped", "version": version, "path": request.model_path}


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "GAVAI ML Sidecar"}


def _infer_property_type(payload: FeaturePayload) -> str:
    if payload.type_condo:
        return "condo"
    if payload.type_commercial:
        return "commercial"
    if payload.type_house_and_lot:
        return "house_and_lot"
    if payload.type_residential_lot:
        return "residential_lot"
    return "residential_lot"


def _avg_proximity(payload: FeaturePayload) -> float:
    scores = [
        payload.score_schools,
        payload.score_hospitals,
        payload.score_malls,
        payload.score_transport,
    ]
    return sum(scores) / len(scores)
