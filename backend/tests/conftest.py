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
# main.py loads backend/.env during import. Set explicit blank values rather
# than removing them, so python-dotenv does not reintroduce a developer's
# production credentials into this isolated demo-mode test process.
os.environ["ANTHROPIC_API_KEY"] = ""        # AI disabled by default in tests
os.environ["R2_ACCOUNT_ID"] = ""            # force local storage
os.environ["REDIS_URL"] = ""                # keep rate/cache state isolated
os.environ["CLERK_SECRET_KEY"] = ""         # compatibility with old local envs
os.environ["SUPABASE_URL"] = ""             # force demo mode
os.environ["SUPABASE_PUBLISHABLE_KEY"] = ""

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
