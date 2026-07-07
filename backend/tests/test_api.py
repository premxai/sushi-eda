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


def test_sql_query_cannot_read_local_files(client, sample_csv_path):
    """Regression test: DuckDB queries must not reach the filesystem.

    Previously `SELECT * FROM read_csv_auto('<any local path>')` returned
    the contents of arbitrary files on the server (see duckdb_query.py's
    enable_external_access=False fix). This must fail, not succeed.
    """
    dataset_id = _upload_sample(client, sample_csv_path)
    result = client.post(
        f"/datasets/{dataset_id}/query",
        json={
            "sql": "SELECT * FROM read_csv_auto('requirements.txt') LIMIT 5",
            "limit": 5,
        },
    )
    assert result.status_code != 200, "local file read should be blocked, not succeed"
    assert "requirements.txt" not in result.text


def test_upload_filename_path_traversal_is_contained(client, tmp_path):
    """Regression test: a crafted filename must not escape the storage root.

    Previously a filename like "../../../marker.txt" was embedded verbatim
    into the storage key and written outside LOCAL_STORAGE_DIR (see
    main.py's os.path.basename() fix and storage.py's containment check).
    """
    import storage as storage_mod

    marker_name = "PYTEST_TRAVERSAL_MARKER.txt"
    escape_target = os.path.join(os.path.dirname(storage_mod.LOCAL_STORAGE_DIR), marker_name)
    if os.path.exists(escape_target):
        os.remove(escape_target)

    response = client.post(
        "/datasets/upload",
        files={"file": ("../../../../../../" + marker_name, b"id,val\n1,2\n", "text/csv")},
    )
    assert response.status_code == 200, response.text

    assert not os.path.exists(escape_target), (
        "upload escaped LOCAL_STORAGE_DIR via a traversal filename"
    )


def test_storage_local_path_rejects_traversal_keys():
    """Direct unit test of the storage-layer containment check (defense in
    depth even if some future caller ever passes an unsanitized key)."""
    import storage as storage_mod

    with pytest.raises(ValueError):
        storage_mod.storage._local_path("uploads/org/id/../../../../etc/evil.txt")


def test_sqlite_upload_table_name_injection_is_contained(client, tmp_path):
    """Regression test for the SQLite table-name injection in polars_loader.py.

    A table whose name is itself a UNION-injection payload must be treated
    as a literal (quoted) identifier, not spliced into the query — so
    querying it returns that table's own (empty) contents, never
    sqlite_master metadata rows leaking through.
    """
    import sqlite3

    db_path = tmp_path / "injection.sqlite"
    con = sqlite3.connect(db_path)
    evil_name = "realtable UNION SELECT name,type FROM sqlite_master--"
    con.execute(f'CREATE TABLE "{evil_name}" (col1 TEXT, col2 TEXT)')
    con.execute("CREATE TABLE realtable (col1 TEXT, col2 TEXT)")
    con.execute("INSERT INTO realtable VALUES (?, ?)", ("legit_row", "x"))
    con.commit()
    con.close()

    with open(db_path, "rb") as f:
        response = client.post(
            "/datasets/upload",
            files={"file": ("injection.sqlite", f, "application/octet-stream")},
        )
    assert response.status_code == 200, response.text
    dataset_id = response.json()["dataset_id"]

    import time

    for _ in range(30):
        job = client.get(f"/jobs/{dataset_id}").json()
        if job.get("status") in ("done", "failed"):
            break
        time.sleep(1)
    assert job["status"] == "done", job

    analysis = client.get(f"/analyses/{job['analysis_id']}").json()
    preview = analysis["report"]["preview"]
    # The malicious table is genuinely empty — no sqlite_master rows,
    # no "realtable" data — must leak through via the injected UNION.
    assert preview == []


# ── New visualization endpoints (business charts, trend, scatter matrix, ──────
# ── quality radar, and the full-dataset /data endpoint for chart builder) ──────
#
# All of these tests only GET against an already-analyzed dataset, so they
# share one upload (module-scoped fixture) instead of each calling
# _upload_sample — /datasets/upload is rate-limited to 10/minute and this
# test module alone would otherwise blow through that budget.


@pytest.fixture(scope="module")
def viz_dataset_id(client, sample_csv_path) -> str:
    return _upload_sample(client, sample_csv_path)


def test_visualize_all_includes_new_chart_types(client, viz_dataset_id):
    """sample_sales.csv has date/category/numeric columns, so every new
    auto-generated chart type should show up in the combined /visualize
    response, not just the original heatmap/missing-matrix pair."""
    dataset_id = viz_dataset_id
    viz = client.get(f"/datasets/{dataset_id}/visualize").json()
    for key in ("quality_radar", "scatter_matrix", "pareto", "top_n", "waterfall", "trend"):
        assert key in viz, f"expected '{key}' in auto-generated visualizations"
        assert "error" not in viz[key], viz[key]
    assert "violin" in viz["columns"]["revenue"]


def test_visualize_business_pareto_top_n_waterfall(client, viz_dataset_id):
    dataset_id = viz_dataset_id

    pareto = client.get(
        f"/datasets/{dataset_id}/visualize/business/pareto",
        params={"category": "region", "value": "revenue"},
    ).json()
    assert "error" not in pareto, pareto
    bar, line = pareto["data"][0], pareto["data"][1]
    assert sum(bar["y"]) == pytest.approx(sum(bar["y"]))  # sanity: totals present
    assert line["y"][-1] == pytest.approx(100.0, abs=0.01)  # cumulative % ends at 100

    top_n = client.get(
        f"/datasets/{dataset_id}/visualize/business/top_n",
        params={"category": "product", "value": "revenue", "top_n": 3},
    ).json()
    assert "error" not in top_n, top_n
    assert len(top_n["data"][0]["y"]) <= 3

    waterfall = client.get(
        f"/datasets/{dataset_id}/visualize/business/waterfall",
        params={"category": "region", "value": "revenue"},
    ).json()
    assert "error" not in waterfall, waterfall
    assert waterfall["data"][0]["x"][-1] == "Total"


def test_visualize_business_waterfall_requires_value_column(client, viz_dataset_id):
    response = client.get(
        f"/datasets/{viz_dataset_id}/visualize/business/waterfall",
        params={"category": "region"},
    )
    assert response.status_code == 400


def test_visualize_business_top_n_caps_at_fifty(client, viz_dataset_id):
    """top_n is a bounded Query param — requests above the cap must be
    rejected outright, not silently truncated (resource-exhaustion guard)."""
    response = client.get(
        f"/datasets/{viz_dataset_id}/visualize/business/top_n",
        params={"category": "region", "top_n": 500},
    )
    assert response.status_code == 422


def test_visualize_trend(client, viz_dataset_id):
    trend = client.get(
        f"/datasets/{viz_dataset_id}/visualize/trend",
        params={"date_column": "date", "value_column": "revenue"},
    ).json()
    assert "error" not in trend, trend
    assert len(trend["data"][0]["x"]) > 0


def test_visualize_trend_rejects_numeric_column(client, viz_dataset_id):
    """Regression test: pd.to_datetime silently reinterprets plain numbers as
    nanosecond-epoch timestamps instead of failing, which previously produced
    a nonsensical single-bucket chart instead of a clean error."""
    trend = client.get(
        f"/datasets/{viz_dataset_id}/visualize/trend",
        params={"date_column": "quantity"},
    ).json()
    assert "error" in trend


def test_visualize_scatter_matrix(client, viz_dataset_id):
    result = client.get(f"/datasets/{viz_dataset_id}/visualize/scatter-matrix").json()
    assert "error" not in result, result
    assert len(result["data"][0]["dimensions"]) >= 2


def test_visualize_quality_radar_matches_canonical_score(client, viz_dataset_id):
    job = client.get(f"/jobs/{viz_dataset_id}").json()
    analysis = client.get(f"/analyses/{job['analysis_id']}").json()
    canonical = analysis["report"]["quality_score"]["breakdown"]

    radar = client.get(f"/datasets/{viz_dataset_id}/visualize/quality-radar").json()
    assert "error" not in radar, radar
    radar_scores = radar["data"][0]["r"][:-1]  # drop the closing duplicate point
    canonical_scores = [canonical[k]["score"] for k in canonical.keys()]
    assert radar_scores == canonical_scores


def test_visualize_routes_are_not_shadowed_by_column_wildcard(client, viz_dataset_id):
    """Regression test: '/{dataset_id}/visualize/{column_name}' is a
    single-segment wildcard that previously matched before the literal
    'trend' / 'scatter-matrix' / 'quality-radar' routes (declared after it in
    file order), treating those path segments as column names to look up."""
    for path, params in (
        ("trend", {"date_column": "date"}),
        ("scatter-matrix", {}),
        ("quality-radar", {}),
    ):
        response = client.get(f"/datasets/{viz_dataset_id}/visualize/{path}", params=params)
        assert response.status_code == 200, response.text
        assert response.json().get("error") != f"Column '{path}' not found"


def test_dataset_data_endpoint_returns_full_dataset(client, viz_dataset_id):
    """Regression test: the Chart Builder previously aggregated over
    report.preview, which analysis_runner caps at 50 rows, silently
    producing wrong totals for any dataset bigger than that. /data must
    return the real row count instead."""
    result = client.get(f"/datasets/{viz_dataset_id}/data").json()
    assert result["total_rows"] == 20
    assert result["row_count"] == 20
    assert result["truncated"] is False


def test_dataset_data_endpoint_column_filter_and_validation(client, viz_dataset_id):
    dataset_id = viz_dataset_id

    filtered = client.get(
        f"/datasets/{dataset_id}/data", params={"columns": "region,revenue", "limit": 5}
    ).json()
    assert filtered["row_count"] == 5
    assert set(filtered["rows"][0].keys()) == {"region", "revenue"}

    bad_column = client.get(f"/datasets/{dataset_id}/data", params={"columns": "nope"})
    assert bad_column.status_code == 400

    over_cap = client.get(f"/datasets/{dataset_id}/data", params={"limit": 999_999})
    assert over_cap.status_code == 422
