#!/usr/bin/env python3
"""Standalone XGBoost training script for GAVAI AVM.

Usage: python scripts/train.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

import joblib
import pandas as pd
import psycopg2
import xgboost as xgb
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


def fetch_approved_records() -> pd.DataFrame:
    url = os.environ["DATABASE_URL"]
    if "?" in url:
        url = url.split("?")[0]

    conn = psycopg2.connect(url)
    df = pd.read_sql(
        """
        SELECT * FROM "Property"
        WHERE "approved" = true
        AND "askingPricePhp" IS NOT NULL
        AND ("lotAreaSqm" IS NOT NULL OR "floorAreaSqm" IS NOT NULL)
        AND "listingType" = 'standard'
    """,
        conn,
    )
    conn.close()
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    X = df.copy()

    X = pd.get_dummies(X, columns=["propertyType"], prefix="type")

    le_barangay = LabelEncoder()
    le_city = LabelEncoder()
    X["barangay_encoded"] = le_barangay.fit_transform(X["barangay"].fillna("UNKNOWN"))
    X["city_encoded"] = le_city.fit_transform(X["city"].fillna("UNKNOWN"))

    X["floor_area_sqm"] = X["floorAreaSqm"].fillna(0)
    X["bedrooms"] = X["bedrooms"].fillna(0)
    X["bathrooms"] = X["bathrooms"].fillna(0)
    X["building_age_years"] = X["buildingAgeYears"].fillna(
        X["buildingAgeYears"].median() if "buildingAgeYears" in X.columns else 10
    )

    if "proximityScores" in X.columns:
        for cat in ["schools", "hospitals", "malls", "transport"]:
            col = f"score_{cat}"
            X[col] = X["proximityScores"].apply(
                lambda x: (x or {}).get(cat, 0.5) if isinstance(x, dict) else 0.5
            )

    y = X["pricePerSqmPhp"]

    feature_cols = [
        "lotAreaSqm",
        "floor_area_sqm",
        "bedrooms",
        "bathrooms",
        "building_age_years",
        "barangay_encoded",
        "city_encoded",
    ]

    type_cols = [
        "type_residential_lot",
        "type_house_and_lot",
        "type_condo",
        "type_commercial",
    ]
    for col in type_cols:
        if col in X.columns:
            feature_cols.append(col)

    prox_cols = [
        "score_schools",
        "score_hospitals",
        "score_malls",
        "score_transport",
    ]
    for col in prox_cols:
        if col in X.columns:
            feature_cols.append(col)

    risk_cols = ["phivolcsRisk", "floodRisk", "zonalValuePhp"]
    for col in risk_cols:
        if col in X.columns:
            feature_cols.append(col)

    if "crepPhp" in X.columns:
        feature_cols.append("crepPhp")

    return X[feature_cols], y


def train() -> tuple[str, str, float, int]:
    df = fetch_approved_records()
    print(f"Fetched {len(df)} approved records")

    if len(df) < 20:
        print("Insufficient data for training (minimum 20 records)")
        sys.exit(1)

    X, y = prepare_features(df)

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

    mape = mean_absolute_percentage_error(y_test, model.predict(X_test))
    print(f"MAPE: {mape:.2%} | Records: {len(df)}")

    version = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    path = f"models/avm-{version}.pkl"
    os.makedirs("models", exist_ok=True)
    joblib.dump({"model": model, "version": version}, path)

    latest_path = "models/avm-latest.pkl"
    if os.path.exists(latest_path):
        os.remove(latest_path)
    os.symlink(os.path.basename(path), latest_path)

    print(f"Model saved: {path}")
    return version, path, mape, len(df)


if __name__ == "__main__":
    version, path, mape, count = train()
    print(f"Version: {version}")
    print(f"Path: {path}")
    print(f"MAPE: {mape:.4f}")
    print(f"Records: {count}")
