from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from .features import FEATURE_ORDER

logger = logging.getLogger(__name__)


def train_from_records(records: list[dict[str, Any]]) -> tuple[Any, float, int]:
    df = pd.DataFrame(records)

    column_map = {
        "lotAreaSqm": "lot_area_sqm",
        "floorAreaSqm": "floor_area_sqm",
        "buildingAgeYears": "building_age_years",
        "propertyType": "property_type",
        "phivolcsRisk": "phivolcs_risk",
        "floodRisk": "flood_risk",
        "zonalValuePhp": "zonal_value_php",
        "pricePerSqmPhp": "price_per_sqm_php",
        "crepPhp": "crep_php",
        "askingPricePhp": "asking_price_php",
    }
    df.rename(columns={k: v for k, v in column_map.items() if k in df.columns}, inplace=True)

    if "proximityScores" in df.columns:
        for cat in ["schools", "hospitals", "malls", "transport"]:
            col = f"score_{cat}"
            if col not in df.columns:
                df[col] = df["proximityScores"].apply(
                    lambda x: (x or {}).get(cat, 0.5)
                )
        df.drop(columns=["proximityScores"], inplace=True)

    for col in FEATURE_ORDER:
        if col not in df.columns:
            df[col] = 0.0

    if "property_type" in df.columns:
        df["type_residential_lot"] = (df["property_type"] == "residential_lot").astype(int)
        df["type_house_and_lot"] = (df["property_type"] == "house_and_lot").astype(int)
        df["type_condo"] = (df["property_type"] == "condo").astype(int)
        df["type_commercial"] = (df["property_type"] == "commercial").astype(int)
        df.drop(columns=["property_type"], inplace=True)

    for col in ["lot_area_sqm", "floor_area_sqm", "bedrooms", "bathrooms",
                 "building_age_years", "barangay_encoded", "city_encoded"]:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    if "price_per_sqm_php" not in df.columns and "asking_price_php" in df.columns:
        area = df["lot_area_sqm"].where(df["lot_area_sqm"] > 0, df["floor_area_sqm"])
        area = area.replace(0, 1)
        df["price_per_sqm_php"] = df["asking_price_php"] / area

    y = df["price_per_sqm_php"].fillna(0)
    X = df[[c for c in FEATURE_ORDER if c in df.columns]]

    if len(X) < 20:
        logger.warning("Insufficient training data: %d records", len(X))
        raise ValueError(f"Insufficient training data: {len(X)} records (minimum 20)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        early_stopping_rounds=20,
        verbose=False,
    )

    mape = float(mean_absolute_percentage_error(y_test, model.predict(X_test)))
    record_count = len(df)

    logger.info("Training complete: MAPE=%.4f, Records=%d", mape, record_count)
    return model, mape, record_count
