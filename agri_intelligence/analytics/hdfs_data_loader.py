
# analytics/hdfs_data_loader.py

import sys
import os
import json
import subprocess
import pandas as pd


# ============================================================
# PROJECT PATH
# ============================================================

# Add project root directory to sys.path
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)


# ============================================================
# CONFIGURATION
# ============================================================

from config.hdfs_config import HDFS_RAW_DATA_DIR


# ============================================================
# HDFS HELPERS
# ============================================================

def run_hdfs_command(command):
    """
    Execute an HDFS command and return its stdout.

    Example:
        hdfs dfs -ls /agri/raw
    """

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        return result.stdout

    except FileNotFoundError:
        print(
            "[HDFS ERROR] 'hdfs' command was not found.\n"
            "Make sure Hadoop is installed and HDFS is available in PATH."
        )
        return None

    except subprocess.CalledProcessError as e:
        print(
            f"[HDFS ERROR] Command failed:\n"
            f"{' '.join(command)}\n"
            f"Error: {e.stderr}"
        )
        return None


# ============================================================
# FIND HDFS BATCH FILES
# ============================================================

def fetch_hdfs_file_list(hdfs_dir):
    """
    Get all .jsonl batch files stored inside an HDFS directory.

    Returns:
        list[str]: HDFS file paths
    """

    command = [
        "hdfs",
        "dfs",
        "-ls",
        hdfs_dir
    ]

    output = run_hdfs_command(command)

    if output is None:
        return []

    files = []

    for line in output.strip().splitlines():

        parts = line.split()

        # HDFS listing normally contains:
        #
        # permissions
        # replication
        # owner
        # group
        # size
        # date
        # time
        # path
        #
        # Therefore path is normally parts[-1].

        if len(parts) >= 8:

            file_path = parts[-1]

            if file_path.endswith(".jsonl"):
                files.append(file_path)

    return files


# ============================================================
# LOAD RAW EVENTS FROM HDFS
# ============================================================

def load_raw_events_from_hdfs(
    hdfs_dir=HDFS_RAW_DATA_DIR
):
    """
    Read all JSONL batch files from HDFS.

    Each line represents one agricultural event.

    Returns:
        list[dict]: Raw agricultural events
    """

    hdfs_files = fetch_hdfs_file_list(hdfs_dir)

    if not hdfs_files:

        print(
            f"[LOADER WARNING] "
            f"No .jsonl files found in {hdfs_dir}"
        )

        return []

    print(
        f"[LOADER INFO] Found "
        f"{len(hdfs_files)} batch file(s) in HDFS."
    )

    events = []

    # Read files one by one.
    #
    # This is safer than loading everything through one
    # massive stdout string because the HDFS dataset can
    # become very large.

    for file_path in hdfs_files:

        print(
            f"[LOADER INFO] Reading: {file_path}"
        )

        command = [
            "hdfs",
            "dfs",
            "-cat",
            file_path
        ]

        output = run_hdfs_command(command)

        if output is None:
            continue

        for line_number, line in enumerate(
            output.splitlines(),
            start=1
        ):

            line = line.strip()

            if not line:
                continue

            try:

                event = json.loads(line)

                if isinstance(event, dict):
                    events.append(event)

            except json.JSONDecodeError:

                print(
                    f"[LOADER WARNING] "
                    f"Invalid JSON in {file_path} "
                    f"at line {line_number}. Skipping."
                )

    print(
        f"[LOADER SUCCESS] "
        f"Loaded {len(events)} total events from HDFS."
    )

    return events


# ============================================================
# PROCESS RAW EVENTS
# ============================================================

def process_historical_events_to_df(events):
    """
    Convert heterogeneous agricultural events into
    separate Pandas DataFrames.

    Returns:
        df_weather
        df_market
        df_crop
    """

    if not events:

        return (
            pd.DataFrame(),
            pd.DataFrame(),
            pd.DataFrame()
        )

    weather_records = []
    market_records = []
    crop_records = []

    for event in events:

        event_type = event.get("event_type")
        event_id = event.get("event_id")
        timestamp = event.get("timestamp")
        region = event.get("region")

        payload = event.get("payload", {})

        # ----------------------------------------------------
        # WEATHER
        # ----------------------------------------------------

        if event_type == "WEATHER_TELEMETRY":

            weather_records.append({
                "event_id": event_id,
                "timestamp": timestamp,
                "region": region,

                "temperature_c":
                    payload.get("temperature_c"),

                "rainfall_mm":
                    payload.get("rainfall_mm"),

                "humidity_pct":
                    payload.get("humidity_pct"),

                "soil_moisture_pct":
                    payload.get("soil_moisture_pct")
            })

        # ----------------------------------------------------
        # MARKET
        # ----------------------------------------------------

        elif event_type == "MARKET_PRICE":

            market_records.append({
                "event_id": event_id,
                "timestamp": timestamp,
                "region": region,

                "crop":
                    payload.get("crop"),

                "price_per_quintal_etb":
                    payload.get("price_per_quintal_etb"),

                "volume_traded_tons":
                    payload.get("volume_traded_tons")
            })

        # ----------------------------------------------------
        # CROP SIGNAL
        # ----------------------------------------------------

        elif event_type == "CROP_SIGNAL":

            crop_records.append({
                "event_id": event_id,
                "timestamp": timestamp,
                "region": region,

                "crop":
                    payload.get("crop"),

                "pest_threat_index":
                    payload.get("pest_threat_index"),

                "vegetation_health_index":
                    payload.get("vegetation_health_index")
            })

    # Convert lists into DataFrames

    df_weather = pd.DataFrame(weather_records)
    df_market = pd.DataFrame(market_records)
    df_crop = pd.DataFrame(crop_records)

    print(
        f"[PROCESS INFO] "
        f"Weather events: {len(df_weather)}"
    )

    print(
        f"[PROCESS INFO] "
        f"Market events: {len(df_market)}"
    )

    print(
        f"[PROCESS INFO] "
        f"Crop events: {len(df_crop)}"
    )

    return (
        df_weather,
        df_market,
        df_crop
    )


# ============================================================
# PREPARE TIMESTAMPS
# ============================================================

def prepare_timestamps(
    df_weather,
    df_market,
    df_crop
):
    """
    Convert Unix timestamps into datetime values
    and create a daily time window.

    The day is important because we don't want to
    combine all historical data into one record per region.
    """

    dataframes = [
        df_weather,
        df_market,
        df_crop
    ]

    for df in dataframes:

        if df.empty:
            continue

        df["timestamp"] = pd.to_datetime(
            df["timestamp"],
            unit="s",
            errors="coerce"
        )

        # Remove invalid timestamps

        df.dropna(
            subset=["timestamp"],
            inplace=True
        )

        # Create daily time window

        df["date"] = (
            df["timestamp"]
            .dt.date
        )

    return (
        df_weather,
        df_market,
        df_crop
    )


# ============================================================
# BUILD WEATHER FEATURES
# ============================================================

def aggregate_weather(df_weather):
    """
    Aggregate weather observations by region and date.
    """

    if df_weather.empty:
        return pd.DataFrame()

    weather_agg = (
        df_weather
        .groupby(
            ["region", "date"],
            as_index=False
        )
        .agg({
            "temperature_c": [
                "mean",
                "max",
                "min"
            ],

            "rainfall_mm": [
                "mean",
                "sum"
            ],

            "humidity_pct": [
                "mean"
            ],

            "soil_moisture_pct": [
                "mean",
                "min"
            ]
        })
    )

    # Flatten multi-level columns

    weather_agg.columns = [
        "region",
        "date",
        "avg_temp",
        "max_temp",
        "min_temp",
        "avg_rainfall",
        "total_rainfall",
        "avg_humidity",
        "avg_soil_moisture",
        "min_soil_moisture"
    ]

    return weather_agg


# ============================================================
# BUILD MARKET FEATURES
# ============================================================

def aggregate_market(df_market):
    """
    Aggregate market observations by region, crop and date.
    """

    if df_market.empty:
        return pd.DataFrame()

    market_agg = (
        df_market
        .groupby(
            ["region", "crop", "date"],
            as_index=False
        )
        .agg({
            "price_per_quintal_etb": [
                "mean",
                "max",
                "min",
                "std"
            ],

            "volume_traded_tons":
                "sum"
        })
    )

    market_agg.columns = [
        "region",
        "crop",
        "date",
        "avg_price",
        "max_price",
        "min_price",
        "price_volatility",
        "total_volume"
    ]

    # If only one market observation exists,
    # standard deviation becomes NaN.

    market_agg["price_volatility"] = (
        market_agg["price_volatility"]
        .fillna(0.0)
    )

    return market_agg


# ============================================================
# BUILD CROP FEATURES
# ============================================================

def aggregate_crop(df_crop):
    """
    Aggregate crop signals by region, crop and date.
    """

    if df_crop.empty:
        return pd.DataFrame()

    crop_agg = (
        df_crop
        .groupby(
            ["region", "crop", "date"],
            as_index=False
        )
        .agg({
            "pest_threat_index":
                "mean",

            "vegetation_health_index":
                "mean"
        })
    )

    crop_agg.columns = [
        "region",
        "crop",
        "date",
        "avg_pest_threat",
        "avg_veg_health"
    ]

    return crop_agg


# ============================================================
# MERGE AGRICULTURAL DATA
# ============================================================

def get_merged_agri_dataset():
    """
    Main function.

    Pipeline:

        HDFS
          ↓
        Raw events
          ↓
        Separate event types
          ↓
        Daily aggregation
          ↓
        Merge weather + market + crop
          ↓
        ML feature dataset

    Returns:
        pandas.DataFrame
    """

    print("\n==============================================")
    print(" AGRICULTURAL HDFS DATA LOADER")
    print("==============================================\n")

    # --------------------------------------------------------
    # 1. Load events from HDFS
    # --------------------------------------------------------

    raw_events = load_raw_events_from_hdfs()

    if not raw_events:

        print(
            "[LOADER ERROR] "
            "No historical events available."
        )

        return pd.DataFrame()

    # --------------------------------------------------------
    # 2. Convert events into DataFrames
    # --------------------------------------------------------

    (
        df_weather,
        df_market,
        df_crop
    ) = process_historical_events_to_df(
        raw_events
    )

    # --------------------------------------------------------
    # 3. Prepare timestamps
    # --------------------------------------------------------

    (
        df_weather,
        df_market,
        df_crop
    ) = prepare_timestamps(
        df_weather,
        df_market,
        df_crop
    )

    # --------------------------------------------------------
    # 4. Aggregate individual datasets
    # --------------------------------------------------------

    weather_agg = aggregate_weather(
        df_weather
    )

    market_agg = aggregate_market(
        df_market
    )

    crop_agg = aggregate_crop(
        df_crop
    )

    # --------------------------------------------------------
    # 5. Check availability
    # --------------------------------------------------------

    if (
        weather_agg.empty
        or market_agg.empty
        or crop_agg.empty
    ):

        print(
            "[LOADER WARNING] "
            "One or more required datasets are empty."
        )

        print(
            "Collect more heterogeneous agricultural "
            "events before creating the merged dataset."
        )

        return pd.DataFrame()

    # --------------------------------------------------------
    # 6. Merge market + crop
    # --------------------------------------------------------

    merged_df = pd.merge(
        market_agg,
        crop_agg,
        on=[
            "region",
            "crop",
            "date"
        ],
        how="inner"
    )

    # --------------------------------------------------------
    # 7. Add weather information
    # --------------------------------------------------------

    merged_df = pd.merge(
        merged_df,
        weather_agg,
        on=[
            "region",
            "date"
        ],
        how="inner"
    )

    # --------------------------------------------------------
    # 8. Sort chronologically
    # --------------------------------------------------------

    merged_df = merged_df.sort_values(
        by=[
            "region",
            "crop",
            "date"
        ]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # 9. Handle numerical missing values
    # --------------------------------------------------------

    numeric_columns = merged_df.select_dtypes(
        include=["number"]
    ).columns

    merged_df[numeric_columns] = (
        merged_df[numeric_columns]
        .fillna(0.0)
    )

    # --------------------------------------------------------
    # 10. Display summary
    # --------------------------------------------------------

    print(
        f"\n[LOADER SUCCESS] "
        f"Final merged dataset contains "
        f"{len(merged_df)} records."
    )

    print(
        f"[LOADER INFO] "
        f"Columns: {len(merged_df.columns)}"
    )

    return merged_df


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":

    print(
        "\n--- Testing HDFS Data Loader ---\n"
    )

    df = get_merged_agri_dataset()

    if not df.empty:

        print(
            "\n--- Dataset Columns ---"
        )

        print(
            df.columns.tolist()
        )

        print(
            "\n--- Dataset Shape ---"
        )

        print(
            df.shape
        )

        print(
            "\n--- Dataset Preview ---"
        )

        print(
            df.head(10).to_string(
                index=False
            )
        )

        print(
            "\n--- Dataset Information ---"
        )

        print(
            df.info()
        )

    else:

        print(
            "\n[TEST RESULT] "
            "No merged dataset was created."
        )

