import math
from datetime import datetime, timezone


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _mean(values):
    if not values:
        return 0.0
    return sum(values) / len(values)


def _region_summary(events):
    regions = {}

    for event in events or []:
        region = event.get("region") or "Unknown"
        bucket = regions.setdefault(region, {
            "weather": [],
            "market": [],
            "crop_risk": [],
            "production": [],
        })

        event_type = event.get("event_type")
        payload = event.get("payload") or {}

        if event_type == "WEATHER_TELEMETRY":
            bucket["weather"].append(payload)
        elif event_type == "MARKET_PRICE":
            bucket["market"].append(payload)
        elif event_type == "CROP_SIGNAL":
            bucket["crop_risk"].append(payload)
        elif event_type == "PRODUCTION":
            bucket["production"].append(payload)

    return regions


def build_ml_insights(events=None):
    """Build a lightweight ML-style crop intelligence summary.

    This intentionally avoids a heavy model dependency and instead creates a
    deterministic scoring model based on real agricultural signals already
    present in the stream: soil moisture, pest stress, rainfall, market price,
    and crop production.
    """

    events = events or []
    regions = _region_summary(events)

    generated_at = datetime.now(timezone.utc).isoformat()

    if not regions:
        return {
            "generated_at": generated_at,
            "overall_risk": 0,
            "overall_label": "No data",
            "best_region": "N/A",
            "regions": [],
            "recommendations": [
                "Connect Kafka or HDFS to generate predictive agricultural insights."
            ],
        }

    region_insights = []
    recommendations = []

    for region, metrics in sorted(regions.items()):
        weather = metrics["weather"]
        market = metrics["market"]
        crop_risk = metrics["crop_risk"]
        production = metrics["production"]

        avg_temp = _mean([_safe_float(item.get("temperature_c"), 0) for item in weather])
        avg_rain = _mean([_safe_float(item.get("rainfall_mm"), 0) for item in weather])
        soil_moisture = _mean([_safe_float(item.get("soil_moisture_pct"), 50) for item in weather])

        avg_price = _mean([
            _safe_float(item.get("price_per_quintal_etb"), 0) for item in market
        ])
        avg_pest = _mean([
            _safe_float(item.get("pest_threat_index"), 0) for item in crop_risk
        ])
        avg_health = _mean([
            _safe_float(item.get("vegetation_health_index"), 0.5) for item in crop_risk
        ])
        avg_production = _mean([
            _safe_float(item.get("production_tons"), 0) for item in production
        ])

        moisture_penalty = max(0.0, (45.0 - soil_moisture) / 45.0)
        pest_penalty = max(0.0, avg_pest - 0.35) / 0.65
        rainfall_penalty = max(0.0, (30.0 - avg_rain) / 30.0)
        price_penalty = max(0.0, (avg_price - 7000.0) / 7000.0)
        health_bonus = max(0.0, (avg_health - 0.5) / 0.5)

        risk_score = round(
            min(
                100.0,
                (pest_penalty * 45.0)
                + (moisture_penalty * 25.0)
                + (rainfall_penalty * 15.0)
                + (price_penalty * 10.0)
                + (max(0.0, 0.5 - avg_health) * 30.0)
            )
            * 100
            / 100,
            1,
        )

        yield_score = max(0.0, min(100.0, (avg_health * 55.0) + (soil_moisture / 1.2) + (avg_rain / 1.8) - (avg_pest * 40.0)))
        yield_forecast = round(avg_production * (0.7 + (yield_score / 100.0)), 2)

        if risk_score >= 70:
            alert = "High intervention needed"
        elif risk_score >= 45:
            alert = "Moderate watch"
        else:
            alert = "Stable outlook"

        if soil_moisture < 30:
            action = "Increase irrigation planning and soil moisture monitoring."
        elif avg_pest > 0.6:
            action = "Schedule crop protection and pest scouting in high-risk fields."
        elif avg_price > 8000:
            action = "Consider early marketing and inventory optimization for higher prices."
        else:
            action = "Continue current agronomic monitoring and maintain regular crop checks."

        region_insights.append({
            "region": region,
            "risk_score": risk_score,
            "yield_forecast_tons": yield_forecast,
            "confidence": round(max(0.5, min(0.96, 0.65 + (yield_score / 100.0) * 0.3)), 2),
            "alert": alert,
            "summary": {
                "temperature_c": round(avg_temp, 1),
                "rainfall_mm": round(avg_rain, 1),
                "soil_moisture_pct": round(soil_moisture, 1),
                "avg_price_etb": round(avg_price, 0),
                "pest_threat_index": round(avg_pest, 2),
                "vegetation_health": round(avg_health, 2),
                "production_tons": round(avg_production, 1),
            },
            "recommendation": action,
        })

        recommendations.append(f"{region}: {action}")

    if region_insights:
        best_region = max(region_insights, key=lambda item: item["yield_forecast_tons"])
        overall_risk = round(sum(item["risk_score"] for item in region_insights) / len(region_insights), 1)
        if overall_risk >= 70:
            overall_label = "High risk"
        elif overall_risk >= 45:
            overall_label = "Moderate risk"
        else:
            overall_label = "Stable"
    else:
        best_region = None
        overall_risk = 0
        overall_label = "No data"

    return {
        "generated_at": generated_at,
        "overall_risk": overall_risk,
        "overall_label": overall_label,
        "best_region": best_region["region"] if best_region else "N/A",
        "regions": region_insights,
        "recommendations": recommendations[:5],
    }
