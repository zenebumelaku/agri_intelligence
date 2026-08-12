import sys
import os
import time
import json
import random

from kafka import KafkaProducer

# Add project root to Python path
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from config.kafka_config import (
    KAFKA_BOOTSTRAP_SERVERS,
    WEATHER_TOPIC,
    MARKET_TOPIC,
    CROP_TOPIC,
    PRODUCTION_TOPIC,
)

from data_ingestion.real_sources import (
    fetch_weather,
    fetch_market_prices,
    fetch_crop_signal,
    fetch_production,
    REGION_COORDS,
)


def create_kafka_producer():
    """
    Create and return a KafkaProducer configured
    to serialize Python dictionaries as JSON.
    """

    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,

            # Convert Python dictionary -> JSON -> bytes
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),

            # Reliability settings
            acks="all",
            retries=3,
        )

        print(
            f"[PRODUCER INFO] Connected to Kafka at "
            f"{KAFKA_BOOTSTRAP_SERVERS}"
        )

        return producer

    except Exception as e:
        print(f"[PRODUCER ERROR] Failed to connect to Kafka: {e}")
        sys.exit(1)


def build_event(event_type, region, payload):
    """Wrap a payload in the standard event envelope."""
    prefixes = {
        "WEATHER_TELEMETRY": "WX",
        "MARKET_PRICE": "MKT",
        "CROP_SIGNAL": "RSK",
        "PRODUCTION": "PRD",
    }
    return {
        "event_id": f"{prefixes[event_type]}-{int(time.time() * 1000)}-{random.randint(100, 999)}",
        "event_type": event_type,
        "timestamp": time.time(),
        "region": region,
        "payload": payload,
    }


def run_agri_stream_producer(events_per_second=0.5):
    """
    Continuously publish real agricultural events to Kafka.

    Weather comes from Open-Meteo; crop risk and production are
    derived from NASA POWER agro-climate data. Market prices use
    baseline ETB values (FEWS NET API is unreliable from WSL).
    """

    producer = create_kafka_producer()

    print("[PRODUCER INFO] Agricultural stream started (real data).")
    print("[PRODUCER INFO] Press Ctrl+C to stop.\n")

    regions = list(REGION_COORDS.keys())
    market_records = fetch_market_prices()
    market_index = 0

    event_count = 0

    try:
        while True:

            # Randomly choose a region for this event
            region = random.choice(regions)

            # Randomly choose an agricultural event type
            event_type = random.choice(
                ["WEATHER_TELEMETRY", "MARKET_PRICE", "CROP_SIGNAL", "PRODUCTION"]
            )

            if event_type == "WEATHER_TELEMETRY":
                payload = fetch_weather(region)
                topic = WEATHER_TOPIC

            elif event_type == "MARKET_PRICE":
                record = market_records[market_index % len(market_records)]
                market_index += 1
                payload = {
                    "crop": record["crop"],
                    "price_per_quintal_etb": record["price_per_quintal_etb"],
                    "volume_traded_tons": round(random.uniform(10.0, 500.0), 2),
                }
                region = "Oromia"
                topic = MARKET_TOPIC

            elif event_type == "CROP_SIGNAL":
                payload = fetch_crop_signal(region)
                topic = CROP_TOPIC

            else:
                payload = fetch_production(region)
                topic = PRODUCTION_TOPIC

            event_data = build_event(event_type, region, payload)

            # Send event to the correct Kafka topic
            future = producer.send(topic, value=event_data)

            # Wait for Kafka confirmation
            record_metadata = future.get(timeout=10)

            event_count += 1

            print(
                f"[SENT #{event_count:04d}] "
                f"Type: {event_type:<20} | "
                f"Region: {region:<10} | "
                f"Topic: {topic:<18} | "
                f"Payload: {json.dumps(payload)}"
            )

            # Control event generation speed
            time.sleep(1.0 / events_per_second)

    except KeyboardInterrupt:
        print("\n[PRODUCER INFO] Stream stopped by user.")

    except Exception as e:
        print(
            f"\n[PRODUCER ERROR] "
            f"Unexpected error: {e}"
        )

    finally:
        print(
            "[PRODUCER INFO] "
            "Flushing remaining messages..."
        )

        producer.flush()
        producer.close()

        print("[PRODUCER INFO] Producer shutdown complete.")


if __name__ == "__main__":
    run_agri_stream_producer(events_per_second=0.5)
