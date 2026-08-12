
import sys
import os
import time
import json
import subprocess

from kafka import KafkaConsumer


# Add project root to Python path


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)



# Project configuration


from config.kafka_config import (
    KAFKA_BOOTSTRAP_SERVERS,
    WEATHER_TOPIC,
    MARKET_TOPIC,
    CROP_TOPIC,
    PRODUCTION_TOPIC,
    CONSUMER_GROUP_HDFS_INGESTION,
)

from config.hdfs_config import (
    HDFS_RAW_DATA_DIR,
    BATCH_SIZE_THRESHOLD,
    BATCH_TIME_THRESHOLD_SEC,
    HDFS_COMMAND,
    HDFS_RAW_DATA_DIR,
)



# HDFS directory


def ensure_hdfs_directory_exists(hdfs_dir):
    """
    Create the HDFS directory if it does not already exist.
    """

    command = [
        HDFS_COMMAND,
        "dfs",
        "-mkdir",
        "-p",
        hdfs_dir,
    ]

    try:

        subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
        )

        print(
            f"[HDFS INIT] Target directory ready: "
            f"{hdfs_dir}"
        )

    except subprocess.CalledProcessError as e:

        print(
            f"[HDFS ERROR] Could not create "
            f"HDFS directory: {e.stderr}"
        )

        sys.exit(1)



# Write batch to HDFS


def write_batch_to_hdfs(buffer, hdfs_dir):
    """
    Write all buffered events into ONE JSONL file
    and upload that file to HDFS.
    """

    if not buffer:
        return True

    # Create unique filename
    timestamp = time.strftime(
        "%Y%m%d_%H%M%S"
    )

    filename = (
        f"agri_batch_"
        f"{timestamp}_"
        f"{int(time.time() * 1000)}"
        f".jsonl"
    )

    # Temporary local file
    local_temp_path = f"/tmp/{filename}"

    # Destination in HDFS
    hdfs_target_path = (
        f"{hdfs_dir}/{filename}"
    )

    try:

      
        # Write buffered events locally
      

        with open(
            local_temp_path,
            "w",
            encoding="utf-8"
        ) as file:

            for event in buffer:

                file.write(
                    json.dumps(event)
                    + "\n"
                )


        
        # Upload file to HDFS
      

        command = [
            HDFS_COMMAND,
            "dfs",
            "-put",
            local_temp_path,
            hdfs_target_path,
        ]

        subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
        )


        print(
            f"\n[HDFS FLUSH SUCCESS] "
            f"{len(buffer)} events → "
            f"{hdfs_target_path}"
        )


     
        # Remove temporary local file
      

        if os.path.exists(local_temp_path):
            os.remove(local_temp_path)


        return True


    except Exception as e:

        print(
            f"\n[HDFS FLUSH ERROR] "
            f"{e}"
        )

        return False



# Kafka → HDFS consumer


def run_hdfs_batch_consumer():

    """
    Consume agricultural events from Kafka,
    buffer them in memory, and periodically
    write batches to HDFS.
    """


   
    # Prepare HDFS
 

    ensure_hdfs_directory_exists(
        HDFS_RAW_DATA_DIR
    )


  
    # Kafka topics
 

    topics = [
        WEATHER_TOPIC,
        MARKET_TOPIC,
        CROP_TOPIC,
        PRODUCTION_TOPIC,
    ]


    print(
        f"[CONSUMER INIT] Connecting to Kafka "
        f"{KAFKA_BOOTSTRAP_SERVERS}..."
    )


   
    # Create Kafka consumer
   

    try:

        consumer = KafkaConsumer(

            *topics,

            bootstrap_servers=(
                KAFKA_BOOTSTRAP_SERVERS
            ),

            # Consumer group
            group_id=(
                CONSUMER_GROUP_HDFS_INGESTION
            ),

            # Convert JSON bytes → Python dictionary
            value_deserializer=lambda message:
                json.loads(
                    message.decode("utf-8") # type: ignore
                ),

            # Start from earliest available message
            auto_offset_reset="earliest",

            # Kafka automatically commits offsets
            enable_auto_commit=True,

        )

    except Exception as e:

        print(
            f"[CONSUMER ERROR] "
            f"Failed to initialize Kafka consumer: "
            f"{e}"
        )

        sys.exit(1)


    print(
        "[CONSUMER READY] "
        f"Subscribed to topics: {topics}"
    )

    print(
        "[CONSUMER READY] "
        f"Consumer group: "
        f"{CONSUMER_GROUP_HDFS_INGESTION}"
    )

    print(
        "[BATCH CONFIG] "
        f"Size = {BATCH_SIZE_THRESHOLD} records | "
        f"Time = {BATCH_TIME_THRESHOLD_SEC} seconds"
    )


   
    # In-memory buffer
    

    message_buffer = []

    last_flush_time = time.time()

    total_processed = 0

    # Consume messages

    try:

        while True:

            # Poll Kafka
            records = consumer.poll(
                timeout_ms=1000
            )


            
            # Process received messages
          

            for topic_partition, messages in records.items():

                for message in messages:

                    event_data = message.value

                    message_buffer.append(
                        event_data
                    )

                    total_processed += 1


                    print(
                        f"\r[BUFFERING] "
                        f"{len(message_buffer)}/"
                        f"{BATCH_SIZE_THRESHOLD} "
                        f"| Total: "
                        f"{total_processed}",
                        end="",
                        flush=True,
                    )


            
            # TRIGGER 1: Batch size
           

            if (
                len(message_buffer)
                >= BATCH_SIZE_THRESHOLD
            ):

                print(
                    f"\n\n[TRIGGER: SIZE] "
                    f"Buffer reached "
                    f"{BATCH_SIZE_THRESHOLD} records."
                )

                success = (
                    write_batch_to_hdfs(
                        message_buffer,
                        HDFS_RAW_DATA_DIR,
                    )
                )

                if success:

                    message_buffer.clear()

                    last_flush_time = (
                        time.time()
                    )


          
            # TRIGGER 2: Time
          

            elapsed_time = (
                time.time()
                - last_flush_time
            )


            if (
                message_buffer
                and elapsed_time
                >= BATCH_TIME_THRESHOLD_SEC
            ):

                print(
                    f"\n\n[TRIGGER: TIME] "
                    f"{elapsed_time:.1f}s elapsed."
                )

                success = (
                    write_batch_to_hdfs(
                        message_buffer,
                        HDFS_RAW_DATA_DIR,
                    )
                )

                if success:

                    message_buffer.clear()

                    last_flush_time = (
                        time.time()
                    )


    except KeyboardInterrupt:

        print(
            "\n\n[CONSUMER STOP] "
            "Stopping consumer..."
        )


    finally:

       
        # Final flush
     

        if message_buffer:

            print(
                f"[FINAL FLUSH] "
                f"Writing remaining "
                f"{len(message_buffer)} events..."
            )

            write_batch_to_hdfs(
                message_buffer,
                HDFS_RAW_DATA_DIR,
            )


        consumer.close()

        print(
            "[CONSUMER SHUTDOWN] "
            "Kafka consumer closed."
        )



# Program entry point


if __name__ == "__main__":

    run_hdfs_batch_consumer()

