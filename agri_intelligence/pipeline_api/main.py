# pipeline_api/main.py
"""
FastAPI demo API — live Kafka + HDFS view for the Agri Intelligence UI.

Endpoints
---------
GET /api/health                 Kafka + HDFS health check
GET /api/pipeline/overview      Topic names, batch file count, status
GET /api/events/stream          SSE stream of live Kafka events
"""

import sys
import os
import json
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from pipeline_api.kafka_client import check_kafka_health, make_consumer, poll_event
from pipeline_api.hdfs_client import check_hdfs_health, get_batch_count, get_dir_size_bytes
from analytics.hdfs_data_loader import load_raw_events_from_hdfs
from analytics.ml_insights import build_ml_insights
from analytics.crop_advisor import recommend_crops

from config.kafka_config import (
    WEATHER_TOPIC,
    MARKET_TOPIC,
    CROP_TOPIC,
    PRODUCTION_TOPIC,
    KAFKA_BOOTSTRAP_SERVERS,
)
from config.hdfs_config import HDFS_RAW_DATA_DIR



# APP


app = FastAPI(
    title="Agri Intelligence Pipeline API",
    description="Live Kafka + HDFS view for the agricultural data pipeline.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)



# HEALTH


@app.get("/api/health")
def health():
    """
    Return Kafka and HDFS health status.

    Never raises — reports up/down instead.
    """

    kafka = check_kafka_health()
    hdfs = check_hdfs_health()

    return {
        "kafka": {
            "up": kafka["up"],
            "bootstrap_servers": KAFKA_BOOTSTRAP_SERVERS,
            "topics_found": kafka["topics"],
            "error": kafka["error"],
        },
        "hdfs": {
            "up": hdfs["up"],
            "raw_dir": hdfs["raw_dir"],
            "error": hdfs["error"],
        },
    }



# PIPELINE OVERVIEW


@app.get("/api/pipeline/overview")
def pipeline_overview():
    """
    Return topic names, HDFS batch file count, and service status.

    Never raises — reports empty results if services are down.
    """

    kafka = check_kafka_health()
    hdfs = check_hdfs_health()
    batch_count = get_batch_count() if hdfs["up"] else 0
    total_bytes = get_dir_size_bytes() if hdfs["up"] else 0

    return {
        "kafka": {
            "up": kafka["up"],
            "topics": {
                "weather": WEATHER_TOPIC,
                "market": MARKET_TOPIC,
                "crop": CROP_TOPIC,
                "production": PRODUCTION_TOPIC,
            },
        },
        "hdfs": {
            "up": hdfs["up"],
            "raw_dir": HDFS_RAW_DATA_DIR,
            "batch_files": batch_count,
            "total_bytes": total_bytes,
            "estimated_events": total_bytes // 215 if total_bytes > 0 else 0
        },
    }



# SSE EVENT STREAM


@app.get("/api/ml/insights")
def ml_insights():
    """Return ML-style regional crop and risk intelligence."""
    try:
        events = load_raw_events_from_hdfs(HDFS_RAW_DATA_DIR)
    except Exception:
        events = []

    return build_ml_insights(events)


@app.get("/api/recommendations")
def recommendations():
    """Return actionable crop management recommendations."""
    insights = ml_insights()
    regions = insights.get("regions", [])
    best_region = insights.get("best_region")

    actions = []
    for index, region in enumerate(regions[:3], start=1):
        actions.append({
            "priority": index,
            "region": region["region"],
            "risk_score": region["risk_score"],
            "recommendation": region.get("recommendation", "Maintain standard monitoring."),
            "alert": region.get("alert", "Stable outlook"),
        })

    if not actions:
        actions.append({
            "priority": 1,
            "region": "N/A",
            "risk_score": 0,
            "recommendation": "Connect data sources to receive actionable agronomic guidance.",
            "alert": "No data",
        })

    return {
        "best_region": best_region,
        "actions": actions,
        "summary": f"Best-performing region is {best_region} based on the current predictive score." if best_region and best_region != 'N/A' else "No regional performance data available yet.",
    }


class CropRecommendationRequest(BaseModel):
    region: str = Field(min_length=1, max_length=40)
    season: str = Field(min_length=1, max_length=20)
    soil_type: str = Field(min_length=1, max_length=20)
    water_availability: str = Field(min_length=1, max_length=20)
    farm_size_ha: float = Field(gt=0, le=100000)


@app.post("/api/ml/crop-recommendations")
def crop_recommendations(request: CropRecommendationRequest):
    """Rank supported crops for the supplied farm conditions."""
    try:
        return recommend_crops(
            region=request.region,
            season=request.season,
            soil_type=request.soil_type,
            water_availability=request.water_availability,
            farm_size_ha=request.farm_size_ha,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/pipeline/summary")
def pipeline_summary():
    """Return a combined operational and predictive summary."""
    overview = pipeline_overview()
    insights = ml_insights()

    return {
        "pipeline": overview,
        "ml": insights,
    }


@app.get("/api/events/stream")
async def events_stream():
    """
    Server-Sent Events stream of live Kafka agricultural events.

    Each SSE message is a JSON-encoded agricultural event matching
    the schema defined in data_ingestion/event_schemas.py.

    If Kafka is unavailable the stream stays open and sends a
    keep-alive comment every 5 seconds so the client can detect
    the disconnected state.
    """

    async def generator():
        consumer = await asyncio.to_thread(make_consumer)
        kafka_up = consumer is not None

        try:
            if not kafka_up:
                # Notify client Kafka is down, then keep-alive
                yield f"data: {json.dumps({'error': 'kafka_unavailable'})}\n\n"

            while True:
                if kafka_up:
                    event = await asyncio.to_thread(poll_event, consumer)
                    if event:
                        yield f"data: {json.dumps(event)}\n\n"
                    else:
                        # No message yet — yield keep-alive comment
                        yield ": keep-alive\n\n"
                        await asyncio.sleep(0.2)
                else:
                    yield ": keep-alive\n\n"
                    await asyncio.sleep(5)
        finally:
            if consumer:
                consumer.close()

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
