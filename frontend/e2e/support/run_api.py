"""Start the real API for browser E2E tests in a minimal local environment."""

import sys
import types
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "agri_intelligence"))

try:
    import pandas  # noqa: F401
except ImportError:
    # The crop-advisor route does not use pandas; other analytics routes do.
    sys.modules["pandas"] = types.ModuleType("pandas")

import uvicorn

uvicorn.run("pipeline_api.main:app", host="127.0.0.1", port=8001, log_level="warning")
