# pipeline_api/kafka_client.py
"""
Thin wrapper around confluent_kafka.Consumer.

Returns up/down status safely so endpoints never crash
when Kafka is unavailable.
"""

from __future__ import annotations

import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.kafka_config import (
    KAFKA_BOOTSTRAP_SERVERS,
    WEATHER_TOPIC,
    MARKET_TOPIC,
    CROP_TOPIC,
    PRODUCTION_TOPIC,
)

ALL_TOPICS = [WEATHER_TOPIC, MARKET_TOPIC, CROP_TOPIC, PRODUCTION_TOPIC]

import uuid
try:
    from kafka import KafkaConsumer
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False


def check_kafka_health() -> dict:
    """
    Try to connect to Kafka and list topics.

    Returns:
        {"up": bool, "topics": list[str], "error": str | None}
    """

    if not _KAFKA_AVAILABLE:
        return {"up": False, "topics": [], "error": "kafka-python not installed"}

    try:
        consumer = KafkaConsumer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
        topics = list(consumer.topics())
        # Filter out internal topics like __consumer_offsets
        topics = [t for t in topics if not t.startswith("__")]
        consumer.close()
        return {"up": True, "topics": topics, "error": None}
    except Exception as exc:
        return {"up": False, "topics": [], "error": str(exc)}


def make_consumer(group_id: str = None):
    """
    Create a Kafka consumer subscribed to all agri topics.

    Returns None if Kafka is unavailable.
    """

    if not _KAFKA_AVAILABLE:
        return None

    if group_id is None:
        group_id = f"pipeline-api-sse-{uuid.uuid4().hex}"

    try:
        consumer = KafkaConsumer(
            *ALL_TOPICS,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=group_id,
            auto_offset_reset="latest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        return consumer
    except Exception:
        return None


def poll_event(consumer, timeout: float = 0.5) -> dict | None:
    """
    Poll one message from Kafka.

    Returns parsed dict or None.
    """

    try:
        records = consumer.poll(timeout_ms=int(timeout * 1000), max_records=1)
        for tp, msgs in records.items():
            if msgs:
                return msgs[0].value
        return None
    except Exception:
        return None
