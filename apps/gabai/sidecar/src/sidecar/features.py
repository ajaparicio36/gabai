from __future__ import annotations

from pydantic import BaseModel, Field

FEATURE_ORDER = [
    "lot_area_sqm",
    "floor_area_sqm",
    "bedrooms",
    "bathrooms",
    "building_age_years",
    "type_residential_lot",
    "type_house_and_lot",
    "type_condo",
    "type_commercial",
    "barangay_encoded",
    "city_encoded",
    "crep_php",
    "score_schools",
    "score_hospitals",
    "score_malls",
    "score_transport",
    "phivolcs_risk",
    "flood_risk",
    "zonal_value_php",
    "listing_velocity_30d",
    "median_price_movement_90d",
]

FEATURES = [
    "lot_area_sqm",
    "floor_area_sqm",
    "bedrooms",
    "bathrooms",
    "building_age_years",
    "type_residential_lot",
    "type_house_and_lot",
    "type_condo",
    "type_commercial",
    "barangay_encoded",
    "city_encoded",
    "crep_php",
    "score_schools",
    "score_hospitals",
    "score_malls",
    "score_transport",
    "phivolcs_risk",
    "flood_risk",
    "zonal_value_php",
    "listing_velocity_30d",
    "median_price_movement_90d",
]


class FeaturePayload(BaseModel):
    lot_area_sqm: float = 0.0
    floor_area_sqm: float = 0.0
    bedrooms: int = 0
    bathrooms: int = 0
    building_age_years: float = 10.0
    type_residential_lot: int = 0
    type_house_and_lot: int = 0
    type_condo: int = 0
    type_commercial: int = 0
    barangay_encoded: int = 0
    city_encoded: int = 0
    crep_php: float = 23000.0
    score_schools: float = 0.5
    score_hospitals: float = 0.5
    score_malls: float = 0.5
    score_transport: float = 0.5
    phivolcs_risk: float = 0.0
    flood_risk: float = 0.0
    zonal_value_php: float = 0.0
    listing_velocity_30d: float = 0.0
    median_price_movement_90d: float = 0.0
