# Agricultural Intelligence Data Pipeline

This project is a big data pipeline designed to ingest, process, and analyze agricultural data streams. It uses Apache Kafka for real-time event streaming and Hadoop HDFS for batch data storage. The pipeline generates and collects various agricultural events (weather, market prices, crop risks, and production data), which are then used by analytics and machine learning models.

## Project Structure

- `config/`: Contains configuration files for Kafka and HDFS connections.
- `data_ingestion/`: Contains the Kafka producer (`producer.py`) which generates simulated agricultural data streams and publishes them to Kafka topics.
- `hdfs_storage/`: Contains the Kafka consumer (`hdfs_batch_consumer.py`) which buffers incoming streams from Kafka and periodically flushes them into HDFS as JSONL batch files.
- `analytics/`: Contains modules for loading data from HDFS and performing exploratory/explainability analysis.
- `models/`: Contains machine learning models such as anomaly detectors, yield forecasters, and crop risk models.

## Prerequisites

Before running this project, ensure you have the following installed and configured on your system:
- **Python 3.8+**
- **Apache Zookeeper & Apache Kafka**
- **Apache Hadoop (HDFS)** 

## Setup Instructions

1. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Project Enhancements

This version adds a more polished dashboard experience for the agricultural data platform, including:

- region filters for focusing on a specific state or sub-region
- dashboard summary cards with operational KPIs
- priority alert cards for pest risk, soil moisture, and price spikes
- a crop planner that ranks teff, maize, wheat, sorghum, and coffee from farm conditions
- explanations, per-crop limitations, missing-data notes, and saved assessment comparisons
- improved visual styling and responsive layout for project presentations

The crop planner uses a transparent heuristic, not a trained or locally validated yield model. Region and farm size are captured as context but do not affect the score because the project does not currently contain validated regional trial or farm-economics data. Its scores should be treated as planning guidance, not probabilities or guarantees.

The backend accepts recommendations at `POST /api/ml/crop-recommendations`. Example:

```bash
curl -X POST http://localhost:8001/api/ml/crop-recommendations \
  -H 'Content-Type: application/json' \
  -d '{"region":"Amhara","season":"Meher","soil_type":"loamy","water_availability":"moderate","farm_size_ha":2.5}'
```

## How to Run

### 1. Start the Frontend Dashboard

From the `frontend/` directory, install dependencies and launch the dashboard:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

The dashboard will be available at `http://localhost:5173`.

### 2. Start Infrastructure Services

Make sure your Kafka and HDFS environments are up and running.

Start Zookeeper:
```bash
# Run from your Kafka installation directory
bin/zookeeper-server-start.sh config/zookeeper.properties
```

Start Kafka Server:
```bash
# Run from your Kafka installation directory
bin/kafka-server-start.sh config/server.properties
```

*(Optional) You can verify that your Java processes (Kafka, Zookeeper, HDFS NameNode/DataNode) are running using:*
```bash
jps
```

### 2. Start the Data Producer
Run the producer to start generating agricultural events and publishing them to Kafka:
```bash
# Run from the root directory of this project
python3 -m data_ingestion.producer
```

### 3. Start the HDFS Consumer
In a separate terminal, run the batch consumer to read from Kafka and store the data in HDFS:
```bash
# Run from the root directory of this project
python3 -m hdfs_storage.hdfs_batch_consumer

./.venv/bin/uvicorn pipeline_api.main:app --reload --port 8001

hdfs dfs -cat /agri/raw/*.jsonl | wc -l
hdfs dfs -ls -R /agri
hdfs dfs -cat /agri/raw/agri_batch_20260811_233242_1786480362506.jsonl | jq .
 /agri/raw/agri_batch_20260808_162911_1786195751024.jsonl

```

### 4. Verify Data in HDFS
Once the consumer processes enough events or reaches its time threshold, it will write a `.jsonl` file to HDFS. You can verify the stored raw data files in HDFS using a command like:
```bash
hdfs dfs -ls /agri/raw/
```
*Example output file: `/agri/raw/agri_batch_20260808_163500_1234567890.jsonl`*# agri_intelligence
