"""
Test configuration — must set env vars BEFORE any app module is imported,
because db/connection.py and storage.py read them at import time.
"""

import os
import tempfile

_TEST_DIR = tempfile.mkdtemp(prefix="sushi_test_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.path.join(_TEST_DIR, 'test.db')}"
os.environ["LOCAL_STORAGE_DIR"] = os.path.join(_TEST_DIR, "storage")
os.environ["ENVIRONMENT"] = "development"
os.environ.pop("ANTHROPIC_API_KEY", None)  # AI disabled by default in tests
os.environ.pop("R2_ACCOUNT_ID", None)      # force local storage
os.environ.pop("CLERK_SECRET_KEY", None)   # force demo mode

import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest


SAMPLE_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "sample_data",
)


@pytest.fixture(scope="session")
def sample_csv_path() -> str:
    return os.path.join(SAMPLE_DATA_DIR, "sales_data.csv")
