from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FormulaResult:
    price_per_sqm_php: float
    point_estimate_php: float
    confidence_low_php: float
    confidence_high_php: float
    confidence_score: float
    method: str


DEPRECIATION_TABLE = [
    (0, 5, 1.00),
    (6, 10, 0.90),
    (11, 20, 0.80),
    (21, 35, 0.65),
    (36, 50, 0.45),
    (51, 999, 0.30),
]


def get_depreciation_factor(age_years: int) -> float:
    for lo, hi, factor in DEPRECIATION_TABLE:
        if lo <= age_years <= hi:
            return factor
    return 0.30


def value_residential_lot(
    lot_area_sqm: float,
    zonal_value_php: float,
    barangay_multiplier: float = 1.0,
    proximity_score: float = 1.0,
    price_trend: float = 0.0,
) -> FormulaResult:
    p_base = zonal_value_php * 0.85 if zonal_value_php > 0 else 15000.0
    a_adj = 0.95 if lot_area_sqm > 1000 else 1.0
    m_loc = max(0.7, min(1.3, barangay_multiplier))
    c_trend = 1.0 + price_trend

    price_per_sqm = p_base * a_adj * m_loc * proximity_score * c_trend
    point_estimate = price_per_sqm * lot_area_sqm
    ci = 0.25

    return FormulaResult(
        price_per_sqm_php=round(price_per_sqm, 2),
        point_estimate_php=round(point_estimate, 2),
        confidence_low_php=round(point_estimate * (1 - ci), 2),
        confidence_high_php=round(point_estimate * (1 + ci), 2),
        confidence_score=0.55,
        method="formula_residential_lot",
    )


def value_house_and_lot(
    lot_area_sqm: float,
    floor_area_sqm: float,
    zonal_value_php: float,
    crep_php: float,
    building_age_years: float,
    proximity_score: float = 1.0,
) -> FormulaResult:
    p_base = zonal_value_php * 0.85 if zonal_value_php > 0 else 15000.0
    v_land = p_base * lot_area_sqm

    d_age = get_depreciation_factor(int(building_age_years))
    q_adj = 1.0
    v_imp = crep_php * floor_area_sqm * d_age * q_adj

    v_total = v_land + v_imp
    total_area = lot_area_sqm + floor_area_sqm
    if total_area <= 0:
        total_area = 1.0

    price_per_sqm = v_total / total_area
    ci = 0.25

    return FormulaResult(
        price_per_sqm_php=round(price_per_sqm, 2),
        point_estimate_php=round(v_total, 2),
        confidence_low_php=round(v_total * (1 - ci), 2),
        confidence_high_php=round(v_total * (1 + ci), 2),
        confidence_score=0.50,
        method="formula_house_and_lot",
    )


def value_condominium(
    floor_area_sqm: float,
    zonal_value_php: float,
    building_age_years: float,
    floor_level: int = 5,
) -> FormulaResult:
    p_sqm = zonal_value_php if zonal_value_php > 0 else 35000.0
    m_floor = 0.96 if floor_level <= 1 else (1.10 if floor_level >= 20 else 1.0)
    m_age = get_depreciation_factor(int(building_age_years))
    m_amenity = 1.05

    price_per_sqm = p_sqm * m_floor * m_age * m_amenity
    point_estimate = price_per_sqm * floor_area_sqm
    ci = 0.25

    return FormulaResult(
        price_per_sqm_php=round(price_per_sqm, 2),
        point_estimate_php=round(point_estimate, 2),
        confidence_low_php=round(point_estimate * (1 - ci), 2),
        confidence_high_php=round(point_estimate * (1 + ci), 2),
        confidence_score=0.50,
        method="formula_condominium",
    )


def value_commercial_lot(
    lot_area_sqm: float,
    zonal_value_php: float,
    far_multiplier: float = 1.0,
) -> FormulaResult:
    p_com_base = zonal_value_php * 1.2 if zonal_value_php > 0 else 25000.0
    m_frontage = 1.0
    m_traffic = 1.0
    m_far = far_multiplier

    price_per_sqm = p_com_base * m_frontage * m_traffic * m_far
    point_estimate = price_per_sqm * lot_area_sqm
    ci = 0.3

    return FormulaResult(
        price_per_sqm_php=round(price_per_sqm, 2),
        point_estimate_php=round(point_estimate, 2),
        confidence_low_php=round(point_estimate * (1 - ci), 2),
        confidence_high_php=round(point_estimate * (1 + ci), 2),
        confidence_score=0.40,
        method="formula_commercial",
    )


def formula_infer(
    lot_area_sqm: float,
    floor_area_sqm: float,
    property_type: str,
    zonal_value_php: float,
    crep_php: float,
    building_age_years: float,
    proximity_score: float = 1.0,
) -> FormulaResult:
    if property_type == "residential_lot":
        return value_residential_lot(
            lot_area_sqm, zonal_value_php, proximity_score=proximity_score
        )
    elif property_type == "house_and_lot":
        return value_house_and_lot(
            lot_area_sqm,
            floor_area_sqm,
            zonal_value_php,
            crep_php,
            building_age_years,
            proximity_score,
        )
    elif property_type == "condo":
        return value_condominium(floor_area_sqm, zonal_value_php, building_age_years)
    elif property_type == "commercial":
        return value_commercial_lot(lot_area_sqm, zonal_value_php)
    else:
        return formula_infer(
            lot_area_sqm,
            floor_area_sqm,
            "residential_lot",
            zonal_value_php,
            crep_php,
            building_age_years,
            proximity_score,
        )
