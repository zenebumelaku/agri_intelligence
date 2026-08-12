# pipeline_api/hdfs_client.py
"""
Thin wrapper around HDFS CLI commands.

Returns up/down status safely so endpoints never crash
when HDFS is unavailable.
"""

import sys
import os
import subprocess

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.hdfs_config import HDFS_COMMAND, HDFS_RAW_DATA_DIR


def _run(cmd: list[str], timeout: int = 5) -> tuple[bool, str]:
    """
    Run an HDFS shell command.

    Returns:
        (success: bool, output: str)
    """

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode == 0:
            return True, result.stdout
        return False, result.stderr
    except Exception as exc:
        return False, str(exc)


def check_hdfs_health() -> dict:
    """
    Verify HDFS is reachable by listing the raw data directory.

    Returns:
        {"up": bool, "raw_dir": str, "error": str | None}
    """

    ok, out = _run([HDFS_COMMAND, "dfs", "-ls", HDFS_RAW_DATA_DIR])
    if ok:
        return {"up": True, "raw_dir": HDFS_RAW_DATA_DIR, "error": None}
    return {"up": False, "raw_dir": HDFS_RAW_DATA_DIR, "error": out.strip()}


def list_batch_files() -> list[str]:
    """
    Return all .jsonl batch file paths stored in HDFS.
    """

    ok, out = _run([HDFS_COMMAND, "dfs", "-ls", HDFS_RAW_DATA_DIR])
    if not ok:
        return []

    files = []
    for line in out.strip().splitlines():
        parts = line.split()
        if len(parts) >= 8 and parts[-1].endswith(".jsonl"):
            files.append(parts[-1])
    return files


def get_batch_count() -> int:
    """Return number of JSONL batch files in HDFS."""
    return len(list_batch_files())


def get_dir_size_bytes() -> int:
    """Return total bytes of the raw data directory."""
    ok, out = _run([HDFS_COMMAND, "dfs", "-du", "-s", HDFS_RAW_DATA_DIR])
    if not ok:
        return 0
    
    try:
        # Output format: '123456  123456  /agri/raw'
        parts = out.strip().split()
        if len(parts) >= 1:
            return int(parts[0])
    except Exception:
        pass
    return 0
