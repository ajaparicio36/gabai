# 05 — AVM Engine

## Overview

The AVM uses a **single XGBoost regression model** with property type as a one-hot encoded categorical feature. A Python FastAPI sidecar serves inference, retraining, and hot-swap endpoints. For property types with fewer than 50 training records, formula-based heuristics provide fallback estimates.

---

## Feature Set

```python
# apps/gavai/sidecar/src/sidecar/features.py
FEATURES = [
    # Physical
    'lot_area_sqm',
    'floor_area_sqm',
    'bedrooms',
    'bathrooms',
    'building_age_years',

    # Property type (one-hot encoded)
    'type_residential_lot',
    'type_house_and_lot',
    'type_condo',
    'type_commercial',

    # Location (label-encoded: barangay → integer)
    'barangay_encoded',
    'city_encoded',

    # Build quality (inferred from neighborhood + developer)
    'crep_php',             # Replacement cost per sqm

    # Proximity scores (0–1, derived from travel time)
    'score_schools',
    'score_hospitals',
    'score_malls',
    'score_transport',

    # Risk (0–1, higher = more risk → depresses value)
    'phivolcs_risk',
    'flood_risk',

    # Government baseline
    'zonal_value_php',      # BIR — used as a feature, not a cap

    # Market signals
    'listing_velocity_30d',     # Listings/week within 1km in past 30 days
    'median_price_movement_90d', # % change in median sqm price, same barangay
]

TARGET = 'price_per_sqm_php'  # Per-sqm value
```

---

## Cold Start Strategy

When training data is insufficient (<50 records for a property type), fall back to **formula-based heuristics**:

### Residential Lot

```
V_land = P_base × A_adj × M_loc × M_prox × C_trend
```

Where:

- `P_base` = median comparable price per sqm × 0.85 (asking → transaction discount)
- `A_adj` = area adjustment (5% discount for lots >1000 sqm)
- `M_loc` = barangay multiplier from `GovernmentReference`
- `M_prox` = proximity score (Section 3d of pipeline doc)
- `C_trend` = 6-month price momentum

### House & Lot

```
V_total = V_land + V_imp
V_imp = C_rep × A_floor × D_age × Q_adj
```

Where:

- `C_rep` = replacement cost per sqm (inferred from neighborhood + developer)
- `A_floor` = floor area
- `D_age` = depreciation factor:
  - 0–5yrs: 1.00, 6–10: 0.90, 11–20: 0.80, 21–35: 0.65, 36–50: 0.45, 51+: 0.30
- `Q_adj` = quality adjustment from C_rep tier

### Condominium

```
V_condo = P_sqm × A_unit × M_floor × M_age × M_amenity
```

Where:

- `P_sqm` = median comparable within same building or 200m cluster
- `M_floor` = floor level premium (ground: 0.96, penthouse: 1.10)
- `M_age` = building age factor
- `M_amenity` = parking (+0.05), balcony (+0.03)

### Commercial (hackathon fallback)

```
V_commercial = P_com_base × A_lot × M_frontage × M_traffic × M_far
```

Income capitalization skipped for hackathon — NOI data unavailable. See future issue: `income-capitalization`.

---

## Training Pipeline

### Script: `scripts/train.py`

```python
import pandas as pd
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_percentage_error
import psycopg2
from datetime import datetime

def fetch_approved_records():
    """Fetch approved training records from the database."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    df = pd.read_sql("""
        SELECT * FROM "PendingTrainingRecord"
        WHERE status = 'approved'
        AND "askingPricePhp" IS NOT NULL
        AND ("lotAreaSqm" IS NOT NULL OR "floorAreaSqm" IS NOT NULL)
    """, conn)
    conn.close()
    return df

def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()

    # One-hot encode property type
    X = pd.get_dummies(X, columns=['propertyType'], prefix='type')

    # Label encode barangay and city
    le_barangay = LabelEncoder()
    le_city = LabelEncoder()
    X['barangay_encoded'] = le_barangay.fit_transform(X['barangay'].fillna('UNKNOWN'))
    X['city_encoded'] = le_city.fit_transform(X['city'].fillna('UNKNOWN'))

    # Null-fill physical fields
    X['floor_area_sqm'] = X['floorAreaSqm'].fillna(0)
    X['bedrooms'] = X['bedrooms'].fillna(0)
    X['bathrooms'] = X['bathrooms'].fillna(0)
    X['building_age_years'] = X['buildingAgeYears'].fillna(X['buildingAgeYears'].median())

    # Target
    y = X['pricePerSqmPhp']

    feature_cols = [
        'lotAreaSqm', 'floor_area_sqm', 'bedrooms', 'bathrooms', 'building_age_years',
        'type_residential_lot', 'type_house_and_lot', 'type_condo', 'type_commercial',
        'barangay_encoded', 'city_encoded',
        'score_schools', 'score_hospitals', 'score_malls', 'score_transport',
        'phivolcsRisk', 'floodRisk', 'zonalValuePhp',
        'listing_velocity_30d', 'median_price_movement_90d',
    ]

    # Add crep_php if available
    if 'crepPhp' in X.columns:
        feature_cols.append('crepPhp')

    return X[feature_cols], y

def train():
    df = fetch_approved_records()
    X, y = prepare_features(df)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective='reg:squarederror',
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], early_stopping_rounds=20, verbose=False)

    mape = mean_absolute_percentage_error(y_test, model.predict(X_test))
    print(f'MAPE: {mape:.2%} | Records: {len(df)}')

    version = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    path = f'models/avm-{version}.pkl'
    joblib.dump(model, path)

    return version, path, mape, len(df)

if __name__ == '__main__':
    version, path, mape, count = train()
    print(f'Model saved: {path}')
```

---

## FastAPI Sidecar

### `POST /infer`

```python
# apps/gavai/sidecar/src/sidecar/main.py
from fastapi import FastAPI
import joblib
import numpy as np
from pydantic import BaseModel
import threading

app = FastAPI()

_model_lock = threading.Lock()
_current_model = None

class FeaturePayload(BaseModel):
    lot_area_sqm: float = 0
    floor_area_sqm: float = 0
    bedrooms: int = 0
    bathrooms: int = 0
    building_age_years: float = 10
    type_residential_lot: int = 0
    type_house_and_lot: int = 0
    type_condo: int = 0
    type_commercial: int = 0
    barangay_encoded: int = 0
    city_encoded: int = 0
    crep_php: float = 23000
    score_schools: float = 0.5
    score_hospitals: float = 0.5
    score_malls: float = 0.5
    score_transport: float = 0.5
    phivolcs_risk: float = 0.0
    flood_risk: float = 0.0
    zonal_value_php: float = 0.0
    listing_velocity_30d: float = 0.0
    median_price_movement_90d: float = 0.0

FEATURE_ORDER = [
    'lot_area_sqm', 'floor_area_sqm', 'bedrooms', 'bathrooms', 'building_age_years',
    'type_residential_lot', 'type_house_and_lot', 'type_condo', 'type_commercial',
    'barangay_encoded', 'city_encoded', 'crep_php',
    'score_schools', 'score_hospitals', 'score_malls', 'score_transport',
    'phivolcs_risk', 'flood_risk', 'zonal_value_php',
    'listing_velocity_30d', 'median_price_movement_90d',
]

@app.on_event('startup')
def load_model():
    global _current_model
    try:
        _current_model = joblib.load('models/avm-latest.pkl')
    except FileNotFoundError:
        _current_model = None  # Will use formula fallback

@app.post('/infer')
def infer(payload: FeaturePayload):
    with _model_lock:
        model = _current_model

    if model is None:
        return {'error': 'no_model_loaded', 'price_per_sqm_php': None}

    X = np.array([[getattr(payload, f) for f in FEATURE_ORDER]])
    price_per_sqm = float(model.predict(X)[0])

    total_area = max(payload.lot_area_sqm, payload.floor_area_sqm, 1)
    point_estimate = price_per_sqm * total_area

    # Confidence heuristic
    dense_data_score = min(payload.score_schools, payload.score_hospitals, payload.score_malls)
    ci_pct = 0.15 if dense_data_score > 0.6 else 0.25

    return {
        'price_per_sqm_php': round(price_per_sqm, 2),
        'point_estimate_php': round(point_estimate, 2),
        'confidence_low_php': round(point_estimate * (1 - ci_pct), 2),
        'confidence_high_php': round(point_estimate * (1 + ci_pct), 2),
        'confidence_score': round(1 - ci_pct, 2),
    }

@app.get('/model/info')
def model_info():
    with _model_lock:
        model = _current_model
    if model is None:
        return {'version': None, 'status': 'no_model_loaded'}
    return {
        'version': model.get('version', 'unknown'),
        'status': 'ready',
    }
```

### `POST /admin/retrain`

Triggered by the NestJS train controller. Fetches approved records, trains model, saves to disk, and calls back to NestJS.

```python
@app.post('/admin/retrain')
def retrain():
    df = fetch_approved_records()
    model, mape = train_xgboost(df)

    version = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    path = f'models/avm-{version}.pkl'
    joblib.dump({'model': model, 'version': version}, path)

    requests.post(f'{NESTJS_INTERNAL_URL}/admin/train/complete', json={
        'version': version,
        'modelPath': path,
        'mape': mape,
        'trainingRecords': len(df),
    })

    return {'version': version, 'mape': mape, 'trainingRecords': len(df)}
```

### `POST /admin/load`

Hot-swap the live model without downtime:

```python
@app.post('/admin/load')
def load_model(request: dict):
    new_model = joblib.load(request['modelPath'])

    with _model_lock:
        global _current_model
        _current_model = new_model

    return {'status': 'swapped', 'path': request['modelPath']}
```

The lock ensures in-flight inference calls finish before the model pointer is swapped — zero downtime.

---

## Confidence Scoring

For the hackathon, confidence is computed as:

```typescript
function computeConfidence(params: {
  numComparables: number;
  dataCompleteness: number; // 0–1
  proximityDensity: number; // avg proximity score across amenity categories
}): { confidenceScore: number; ciPercent: number } {
  const densityBonus = Math.min(params.numComparables / 10, 1); // Saturates at 10 comparables
  const rawScore =
    0.4 * densityBonus +
    0.4 * params.dataCompleteness +
    0.2 * params.proximityDensity;

  const confidenceScore = Math.round(rawScore * 100) / 100;
  const ciPercent = 0.3 - rawScore * 0.15; // 15% at perfect, 30% at worst
  const clampedCi = Math.max(0.12, Math.min(0.3, ciPercent));

  return { confidenceScore, ciPercent: clampedCi };
}
```

Future: [GitHub issue] `quantile-regression` — proper prediction intervals via XGBoost quantile regression or conformal prediction.

---

## Model Version Lifecycle

```
training  →  ready  →  deployed  →  archived
                ↑                      │
                └──────────────────────┘ (re-promote)
```

- `training`: BullMQ job running, model being fitted
- `ready`: Training complete, model saved to disk, available for sandbox preview
- `deployed`: Live in the sidecar, serving production inference
- `archived`: Previously deployed, available for rollback

Any `ready` or `archived` version can be promoted to `deployed`. The previously deployed version is automatically archived.

---

## NestJS ↔ ML Sidecar Communication

The NestJS `ValuationService` assembles features from the `Property` record (or user input for on-demand valuations) and POSTs to the sidecar:

```typescript
// apps/gavai/nest/src/modules/valuation/valuation.service.ts
async getValuation(input: ValuationInput): Promise<ValuationResult> {
  const features = await this.assembleFeatures(input);
  const response = await this.httpService.post(`${ML_SIDECAR_URL}/infer`, features).toPromise();

  if (response.data.error === 'no_model_loaded') {
    return this.formulaFallback(input);
  }

  return {
    ...response.data,
    comparablesUsed: features.comparables,
    proximityBreakdown: features.proximityBreakdown,
    modelVersion: (await this.getModelInfo())?.version,
  };
}

private async formulaFallback(input: ValuationInput): Promise<ValuationResult> {
  // Use Section 12 formulas from architecture doc
  switch (input.propertyType) {
    case 'residential_lot': return this.valueResidentialLot(input);
    case 'house_and_lot':  return this.valueHouseAndLot(input);
    case 'condo':          return this.valueCondominium(input);
    case 'commercial':     return this.valueCommercialLot(input);
    default:               throw new BadRequestException('Unknown property type');
  }
}
```
