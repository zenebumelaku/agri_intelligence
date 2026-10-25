"""Transparent rule-based crop suitability recommendations."""

from datetime import datetime, timezone


_CROP_PROFILES = {
    "Teff": {
        "soil_fit": {"sandy": 0.45, "loamy": 1.0, "clay": 0.9, "volcanic": 0.8, "unknown": 0.5},
        "water_fit": {"none": 0.25, "limited": 1.0, "moderate": 0.9, "abundant": 0.45},
        "season_fit": {"Meher": 1.0, "Belg": 0.8, "Bega": 0.1, "unknown": 0.5},
        "reason": "Often grown in Ethiopia's main rainy season and can fit lower-to-moderate water availability.",
        "limitations": "Local variety, planting date, drainage, and altitude can change suitability.",
    },
    "Maize": {
        "soil_fit": {"sandy": 0.5, "loamy": 1.0, "clay": 0.85, "volcanic": 0.8, "unknown": 0.5},
        "water_fit": {"none": 0.0, "limited": 0.45, "moderate": 0.9, "abundant": 1.0},
        "season_fit": {"Meher": 1.0, "Belg": 0.8, "Bega": 0.0, "unknown": 0.5},
        "reason": "A warm-season cereal that generally benefits from fertile soil and reliable moisture.",
        "limitations": "Water stress during flowering can reduce harvest; verify local seed and rainfall calendars.",
    },
    "Wheat": {
        "soil_fit": {"sandy": 0.4, "loamy": 1.0, "clay": 0.9, "volcanic": 0.8, "unknown": 0.5},
        "water_fit": {"none": 0.0, "limited": 0.85, "moderate": 1.0, "abundant": 0.5},
        "season_fit": {"Meher": 1.0, "Belg": 0.25, "Bega": 0.0, "unknown": 0.5},
        "reason": "A cool-season cereal commonly associated with Ethiopia's highland production systems.",
        "limitations": "Altitude, temperature, disease pressure, and locally adapted varieties are not measured here.",
    },
    "Sorghum": {
        "soil_fit": {"sandy": 1.0, "loamy": 0.9, "clay": 0.55, "volcanic": 0.7, "unknown": 0.5},
        "water_fit": {"none": 0.8, "limited": 1.0, "moderate": 0.9, "abundant": 0.55},
        "season_fit": {"Meher": 1.0, "Belg": 0.8, "Bega": 0.1, "unknown": 0.5},
        "reason": "A drought-tolerant cereal that can be a useful option where water is limited.",
        "limitations": "Variety maturity and the timing of effective rainfall are not available to this assessment.",
    },
    "Coffee": {
        "soil_fit": {"sandy": 0.25, "loamy": 1.0, "clay": 0.7, "volcanic": 0.8, "unknown": 0.5},
        "water_fit": {"none": 0.1, "limited": 0.45, "moderate": 0.8, "abundant": 1.0},
        "season_fit": {"Meher": 0.8, "Belg": 0.8, "Bega": 0.4, "unknown": 0.65},
        "reason": "A perennial crop that may suit suitable Ethiopian coffee-growing environments.",
        "limitations": "This tool does not assess elevation, shade, perennial crop establishment, or time to first harvest.",
    },
}

_SUPPORTED_REGIONS = {"Amhara", "Oromia", "SNNPR", "Tigray", "Sidama"}
_SOILS = {"sandy", "loamy", "clay", "volcanic", "unknown"}
_WATER_LEVELS = {"none", "limited", "moderate", "abundant"}
_SEASONS = {"Meher", "Belg", "Bega", "unknown"}
_MISSING_DATA = [
    "Soil pH, nutrient levels, drainage, and field-specific soil test results",
    "Farm elevation, exact location, and local long-term rainfall forecast",
    "Seed variety, planting date, pest pressure, labor, and input availability",
    "Crop-specific yield history and local market access",
]


def recommend_crops(region, season, soil_type, water_availability, farm_size_ha):
    """Rank supported crops using explicit suitability rules, not a trained model."""
    if region not in _SUPPORTED_REGIONS:
        raise ValueError("Unsupported region.")
    if season not in _SEASONS:
        raise ValueError("Unsupported season.")
    if soil_type not in _SOILS:
        raise ValueError("Unsupported soil type.")
    if water_availability not in _WATER_LEVELS:
        raise ValueError("Unsupported water availability.")
    if not 0 < farm_size_ha <= 100000:
        raise ValueError("Farm size must be greater than 0 and no more than 100,000 hectares.")

    rankings = []
    for crop, profile in _CROP_PROFILES.items():
        reasons = [profile["reason"]]
        season_fit = profile["season_fit"][season]
        soil_fit = profile["soil_fit"][soil_type]
        water_fit = profile["water_fit"][water_availability]
        score = round((season_fit * 35 + soil_fit * 35 + water_fit * 30))

        if season == "unknown":
            reasons.append("Season was not specified; the seasonal part of the score is neutral.")
        else:
            reasons.append(f"{season} season fit: {round(season_fit * 100)}% of the seasonal weighting.")

        if soil_type == "unknown":
            reasons.append("Soil type is unknown; its score contribution is neutral pending a field soil test.")
        elif soil_type == "volcanic":
            reasons.append("Volcanic soil received a provisional broad fit; confirm drainage and soil test results.")
        else:
            reasons.append(f"{soil_type.capitalize()} soil fit: {round(soil_fit * 100)}% of the soil weighting.")

        reasons.append(f"{water_availability.capitalize()} water fit: {round(water_fit * 100)}% of the water weighting.")

        if farm_size_ha < 0.5:
            reasons.append("Small farm size noted; confirm that seed, labor, and equipment requirements fit. Farm size is not included in the suitability score.")
        elif farm_size_ha >= 10:
            reasons.append("Larger farm size noted; confirm access to suitable machinery and storage. Farm size is not included in the suitability score.")
        else:
            reasons.append("Farm size is recorded for context but is not included in the suitability score.")

        rankings.append({
            "crop": crop,
            "suitability_score": score,
            "score_label": "Rule-based suitability (not a yield probability)",
            "reasons": reasons,
            "limitations": profile["limitations"],
        })

    rankings.sort(key=lambda item: (-item["suitability_score"], item["crop"]))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "region": region,
        "season": season,
        "soil_type": soil_type,
        "water_availability": water_availability,
        "farm_size_ha": farm_size_ha,
        "method": "Transparent heuristic score: 35% broad season fit, 35% broad soil fit, and 30% broad water fit. Region and farm size are recorded for context but are not scored because this project has no validated region-specific crop trials or farm economics. This is not a trained or locally validated yield model.",
        "recommendations": rankings,
        "missing_information": _MISSING_DATA,
    }
