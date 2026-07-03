"""
End-to-end API test: upload → background analysis → job status → analysis
report → share link → public shared report.

Runs entirely on fallbacks: SQLite database, local filesystem storage,
in-process cache, demo-mode auth, AI narrative mocked.
"""

import os

import pytest
from fastapi.testclient import TestClient

import ai_narrative
import main


FAKE_NARRATIVE = "## Executive Summary\nThis is a test narrative."


@pytest.fixture(scope="module")
def client():
    # Mock the AI narrative so tests don't need an API key
    original = ai_narrative.generate_narrative
    ai_narrative.generate_narrative = lambda report, dataset_name="": FAKE_NARRATIVE
    # TestClient as context manager runs the startup event (default org/user)
    with TestClient(main.app) as c:
        yield c
    ai_narrative.generate_narrative = original


def _upload_sample(client, sample_csv_path) -> str:
    with open(sample_csv_path, "rb") as f:
        response = client.post(
            "/datasets/upload",
            files={"file": ("sales_data.csv", f, "text/csv")},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "pending"
    return body["dataset_id"]


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_example_dataset_seeded(client):
    """Startup seeds a pre-analyzed example; it must become available and open instantly."""
    import time

    deadline = time.time() + 60
    body = None
    while time.time() < deadline:
        response = client.get("/example")
        if response.status_code == 200:
            body = response.json()
            break
        time.sleep(1)
    assert body is not None, "example dataset never became ready"

    analysis = client.get(f"/datasets/{body['dataset_id']}/analysis").json()
    assert analysis["report"]["basic_info"]["rows"] > 0


def test_upload_to_shared_report_flow(client, sample_csv_path):
    dataset_id = _upload_sample(client, sample_csv_path)

    # Background task runs before TestClient returns → job should be done
    job = client.get(f"/jobs/{dataset_id}").json()
    assert job["status"] == "done", job
    analysis_id = job["analysis_id"]

    # Fetch analysis by id
    analysis = client.get(f"/analyses/{analysis_id}").json()
    assert analysis["report"]["basic_info"]["rows"] > 0
    assert analysis["ai_narrative"] == FAKE_NARRATIVE

    # Dataset listing includes it as ready
    datasets = client.get("/datasets").json()
    match = [d for d in datasets if d["id"] == dataset_id]
    assert match and match[0]["status"] == "ready"

    # Latest analysis via dataset endpoint
    latest = client.get(f"/datasets/{dataset_id}/analysis").json()
    assert latest["analysis_id"] == analysis_id

    # Create a share link and fetch it without auth
    share = client.post(f"/datasets/{dataset_id}/share", json={"ttl_hours": 24})
    assert share.status_code == 200, share.text
    token = share.json()["token"]

    shared = client.get(f"/share/{token}")
    assert shared.status_code == 200, shared.text
    shared_body = shared.json()
    assert shared_body["analysis"]["report"]["basic_info"]["rows"] > 0
    assert shared_body["analysis"]["ai_narrative"] == FAKE_NARRATIVE


def test_upload_rejects_empty_file(client):
    response = client.post(
        "/datasets/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert response.status_code == 400


def test_upload_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 10)
    response = client.post(
        "/datasets/upload",
        files={"file": ("big.csv", b"a,b\n" * 10, "text/csv")},
    )
    assert response.status_code == 413


def test_compare_endpoint(client, sample_csv_path):
    other = os.path.join(os.path.dirname(sample_csv_path), "customer_data.csv")
    with open(sample_csv_path, "rb") as f1, open(other, "rb") as f2:
        response = client.post(
            "/compare",
            files={
                "file1": ("sales_data.csv", f1, "text/csv"),
                "file2": ("customer_data.csv", f2, "text/csv"),
            },
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["file1"]["report"]["basic_info"]["rows"] > 0
    assert body["file2"]["report"]["basic_info"]["rows"] > 0
    assert "schema_diff" in body["comparison"]


def test_feedback_endpoint(client):
    response = client.post("/feedback", json={"message": "Love the quality score!"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    too_short = client.post("/feedback", json={"message": "hi"})
    assert too_short.status_code == 422


def test_retention_sweep_deletes_old_datasets(client, sample_csv_path):
    """A dataset older than the retention window is removed; fresh ones stay."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    import uuid as _uuid

    from retention import sweep_expired_datasets

    dataset_id = _upload_sample(client, sample_csv_path)

    async def _age_dataset() -> None:
        from db.connection import AsyncSessionLocal
        from db.models import Dataset
        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Dataset)
                .where(Dataset.id == _uuid.UUID(dataset_id))
                .values(created_at=datetime.now(timezone.utc) - timedelta(days=30))
            )
            await db.commit()

    asyncio.run(_age_dataset())
    deleted = asyncio.run(sweep_expired_datasets(retention_days=7))
    assert deleted >= 1

    # The aged dataset is gone; a 404 (or non-ready) proves the row was removed
    gone = client.get(f"/datasets/{dataset_id}")
    assert gone.status_code == 404


def test_ai_daily_limit_fires(client, sample_csv_path, monkeypatch):
    """Per-IP daily AI cap returns 429 once exceeded."""
    import ai_limits

    monkeypatch.setattr(ai_limits, "AI_DAILY_LIMIT_PER_IP", 2)
    ai_limits._local_counts.clear()

    dataset_id = _upload_sample(client, sample_csv_path)

    statuses = []
    for _ in range(4):
        r = client.post(
            f"/datasets/{dataset_id}/ai/chat",
            json={"question": "How many rows?"},
        )
        statuses.append(r.status_code)

    assert 429 in statuses, statuses
    # The first calls (within the cap) were not rejected by the limiter
    assert statuses[0] != 429
    ai_limits._local_counts.clear()


def test_sql_query_on_dataset(client, sample_csv_path):
    dataset_id = _upload_sample(client, sample_csv_path)

    schema = client.get(f"/datasets/{dataset_id}/query/schema").json()
    assert len(schema["schema"]) > 0

    result = client.post(
        f"/datasets/{dataset_id}/query",
        json={"sql": "SELECT COUNT(*) AS n FROM df", "limit": 10},
    )
    assert result.status_code == 200, result.text
    assert result.json()["rows"][0][0] > 0
