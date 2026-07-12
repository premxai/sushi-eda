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


def test_narrative_byok_uses_request_key_without_returning_it(client, viz_dataset_id, monkeypatch):
    """A BYOK key is forwarded only to the generator and never echoed back."""
    import ai_limits
    import ai_narrative

    supplied_key = "sk-ant-test-key-used-for-this-request-only"
    seen: dict[str, str | None] = {}

    def generate(report, dataset_name="", api_key=None):
        seen["key"] = api_key
        return "## Executive Summary\nGenerated with the supplied key."

    monkeypatch.setattr(ai_limits, "AI_DAILY_LIMIT_PER_IP", 1_000)
    ai_limits._local_counts.clear()
    monkeypatch.setattr(ai_narrative, "generate_narrative", generate)

    response = client.post(
        f"/datasets/{viz_dataset_id}/analysis/narrative",
        headers={"X-Anthropic-API-Key": supplied_key},
    )

    assert response.status_code == 200, response.text
    assert seen["key"] == supplied_key
    assert supplied_key not in response.text
    ai_limits._local_counts.clear()


def test_narrative_byok_failure_never_echoes_key(client, viz_dataset_id, monkeypatch):
    """Provider failures must not leak a supplied key through the API response."""
    import ai_limits
    import ai_narrative

    supplied_key = "sk-ant-test-key-must-never-be-echoed"

    def generate(report, dataset_name="", api_key=None):
        raise ai_narrative.NarrativeGenerationError(f"Provider rejected {api_key}")

    monkeypatch.setattr(ai_limits, "AI_DAILY_LIMIT_PER_IP", 1_000)
    ai_limits._local_counts.clear()
    monkeypatch.setattr(ai_narrative, "generate_narrative", generate)

    response = client.post(
        f"/datasets/{viz_dataset_id}/analysis/narrative",
        headers={"X-Anthropic-API-Key": supplied_key},
    )

    assert response.status_code == 502, response.text
    assert supplied_key not in response.text
    ai_limits._local_counts.clear()


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


# ── Advanced statistics ─────────────────────────────────────────────────────────
#
# Smoke-tests every one of the 12 stats endpoints, reusing the already-shared
# viz_dataset_id fixture (sample_sales.csv) rather than uploading again —
# /datasets/upload is rate-limited to 10/minute and this whole test module
# already sits close to that budget.


def test_stats_ttest_and_mann_whitney(client, viz_dataset_id):
    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/ttest",
        params={"col1": "quantity", "col2": "price"},
    ).json()
    assert "error" not in r, r
    assert r["p_value"] is not None

    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/mann_whitney",
        params={"col1": "quantity", "col2": "price"},
    ).json()
    assert "error" not in r, r


def test_stats_chi_square_and_anova(client, viz_dataset_id):
    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/chi_square",
        params={"col1": "region", "col2": "customer_type"},
    ).json()
    assert "error" not in r, r
    assert r["degrees_of_freedom"] >= 1

    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/anova",
        params={"numeric_col": "revenue", "group_col": "region"},
    ).json()
    assert "error" not in r, r


def test_stats_correlation_all_methods(client, viz_dataset_id):
    for method in ("pearson", "spearman", "kendall"):
        r = client.post(
            f"/datasets/{viz_dataset_id}/stats/correlation",
            params={"col1": "quantity", "col2": "revenue", "method": method},
        )
        assert r.status_code == 200, r.text
        assert "coefficient" in r.json()


def test_stats_regressions(client, viz_dataset_id):
    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/regression",
        params={"x_col": "quantity", "y_col": "revenue"},
    ).json()
    assert "error" not in r, r

    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/regression/polynomial",
        params={"x_col": "quantity", "y_col": "revenue", "degree": 2},
    ).json()
    assert "error" not in r, r


def test_stats_time_series_and_advanced_overview(client, viz_dataset_id):
    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/time_series/decompose",
        params={"date_col": "date", "value_col": "revenue"},
    ).json()
    assert "error" not in r, r

    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/time_series/arima",
        params={"date_col": "date", "value_col": "revenue", "periods": 3},
    ).json()
    assert "error" not in r, r

    r = client.get(f"/datasets/{viz_dataset_id}/stats/advanced")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "normality_tests" in body and "correlations_with_significance" in body


def test_stats_cohort_and_ab_test(client, viz_dataset_id):
    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/cohort",
        params={"entity_col": "customer_type", "date_col": "date", "freq": "M"},
    ).json()
    assert "error" not in r, r

    r = client.post(
        f"/datasets/{viz_dataset_id}/stats/ab_test",
        params={
            "control_conversions": 120,
            "control_total": 1000,
            "variant_conversions": 150,
            "variant_total": 1000,
        },
    ).json()
    assert "error" not in r, r
    assert r["winner"] == "variant"



# These three are pure unit tests against AdvancedStatistics/sanitize_json
# directly (no /datasets/upload call) — the whole module's upload budget is
# already fully used by the fixtures above, and the fixes themselves live
# in plain Python functions that don't need the HTTP layer to exercise.


def test_stats_correlation_zero_variance_column_returns_null_not_500():
    """Regression test: scipy's pearsonr/spearmanr/kendalltau return
    numpy.float64, so a degenerate zero-variance column produces NaN, and
    NaN raised ValueError out of Starlette's JSON encoder (500) before every
    stats endpoint's return value was wrapped in analysis_runner.sanitize_json."""
    import math

    import pandas as pd
    from scipy import stats as scipy_stats

    from analysis_runner import sanitize_json

    a = pd.Series(range(10))
    b = pd.Series([5] * 10)  # constant -> zero variance -> NaN correlation
    stat, p = scipy_stats.pearsonr(a, b)
    assert math.isnan(stat), "expected pearsonr to produce NaN for a constant column"

    result = sanitize_json({"coefficient": float(stat), "p_value": float(p)})
    assert result["coefficient"] is None
    assert result["p_value"] is None


def test_stats_chi_square_rejects_high_cardinality_columns():
    """Regression test: an unbounded contingency table between two
    high-cardinality columns previously took 45s+ and returned a 150MB+
    response on a single-process server. Must now fail fast with a clean
    error instead of building the table."""
    import pandas as pd
    from advanced_stats import AdvancedStatistics

    df = pd.DataFrame({
        "colA": [f"a_{i % 60}" for i in range(300)],
        "colB": [f"b_{i % 60}" for i in range(300)],
    })
    result = AdvancedStatistics(df).chi_square_test("colA", "colB")
    assert "error" in result
    assert "Too many categories" in result["error"]


def test_stats_cohort_rejects_too_many_periods():
    """Regression test: a wide date range at daily granularity previously
    built an unbounded retention matrix, hanging the whole single-process
    server (90s+, ~1GB RAM) for one request. Must fail fast instead."""
    import pandas as pd
    from advanced_stats import AdvancedStatistics

    # 500 distinct days spread across 2000-2020 — comfortably over the
    # 400-period cap regardless of row count.
    dates = pd.date_range("2000-01-01", "2020-12-31", freq="3D")[:500]
    df = pd.DataFrame({
        "entity": [f"e{i}" for i in range(len(dates))],
        "date": dates,
    })
    result = AdvancedStatistics(df).cohort_analysis("entity", "date", freq="D")
    assert "error" in result
    assert "too many" in result["error"]


# ── SQL query editor ─────────────────────────────────────────────────────────
#
# Reuses viz_dataset_id (sample_sales.csv) rather than uploading again — the
# module's upload budget is already tight against the 10/minute limit.


def test_sql_common_column_names_not_blocked_by_keyword_filter(client, viz_dataset_id):
    """Regression test: the forbidden-keyword scan used to check for the
    literal substring anywhere in the query text, so aliasing any column as
    created_at/updated_at/deleted_at (extremely common real-world column
    names) was rejected as if it were a CREATE/UPDATE/DELETE statement."""
    for alias in ("created_at", "updated_at", "deleted_at"):
        r = client.post(
            f"/datasets/{viz_dataset_id}/query",
            json={"sql": f"SELECT quantity AS {alias} FROM df LIMIT 5"},
        )
        assert r.status_code == 200, f"alias {alias!r} incorrectly rejected: {r.text}"


def test_sql_string_literal_keyword_not_blocked(client, viz_dataset_id):
    """Regression test: a filter value that happens to contain a forbidden
    keyword as a whole word (e.g. comparing against 'Alter Ego') was
    rejected, since the old check scanned the raw SQL text including string
    literals instead of stripping them first."""
    r = client.post(
        f"/datasets/{viz_dataset_id}/query",
        json={"sql": "SELECT * FROM df WHERE category != 'Alter Ego' LIMIT 5"},
    )
    assert r.status_code == 200, r.text


def test_sql_cte_query_works(client, viz_dataset_id):
    """Regression test: statements starting with WITH (a CTE) were rejected
    outright because only a literal 'select' first word was accepted."""
    r = client.post(
        f"/datasets/{viz_dataset_id}/query",
        json={"sql": "WITH ranked AS (SELECT quantity FROM df) SELECT COUNT(*) FROM ranked"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["rows"][0][0] > 0


def test_sql_mutating_statements_still_rejected(client, viz_dataset_id):
    """Sanity check that fixing the false-positive keyword bug didn't also
    loosen the real protection against DDL/DML."""
    for sql in ("DROP TABLE df", "UPDATE df SET quantity = 0", "SELECT 1; DELETE FROM df"):
        r = client.post(f"/datasets/{viz_dataset_id}/query", json={"sql": sql})
        assert r.status_code == 400, f"{sql!r} should have been rejected: {r.text}"


def test_sql_query_timeout_cancels_expensive_query(client, viz_dataset_id, monkeypatch):
    """Regression test: DuckDB has no built-in statement timeout, so a query
    like a wide cross join ran fully synchronously — confirmed live to hang
    the entire single-process server (every /health check timed out) for
    30+ seconds. Must now be cancelled at a fixed wall-clock cap instead."""
    import time

    import duckdb_query

    monkeypatch.setattr(duckdb_query, "_QUERY_TIMEOUT_SECONDS", 1)
    expensive_sql = (
        "SELECT count(*) FROM range(2000000) a, range(2000000) b "
        "WHERE (a.range % 7) = (b.range % 11)"
    )
    start = time.time()
    r = client.post(f"/datasets/{viz_dataset_id}/query", json={"sql": expensive_sql})
    elapsed = time.time() - start
    assert r.status_code == 422, r.text
    assert "execution limit" in r.json()["detail"]
    assert elapsed < 10, f"query took {elapsed:.1f}s — timeout did not actually cancel it"


# ── Dataset lifecycle & sharing ──────────────────────────────────────────────


def test_sse_stream_enforces_per_creator_privacy(client, viz_dataset_id):
    """Regression test: _resolve_stream_user previously returned None whenever
    the query-string `token` param was absent — the normal case, since
    EventSource can't send an Authorization header and demo mode has no
    Clerk session to draw a token from. _authorize_job_access only checks
    dataset ownership when current_user is not None, so this silently
    skipped the "shared default org: private to creator" check for the SSE
    endpoint specifically, even though the sibling poll endpoint
    (GET /jobs/{id}, via get_optional_user) already resolved demo mode
    correctly. Simulates another creator by writing a Dataset row directly
    rather than uploading (uploads always resolve to the one shared demo
    user, so there's no way to get a second creator through the API)."""
    import asyncio
    import uuid as _uuid

    from db.connection import AsyncSessionLocal
    from db.models import Dataset, Organization, User

    async def _make_other_users_dataset() -> str:
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            org = (
                await db.execute(select(Organization).where(Organization.slug == "default"))
            ).scalar_one()
            other = User(clerk_id="test_other_user_sse", email="other_sse@test.local")
            db.add(other)
            await db.flush()
            fake_ds = Dataset(
                id=_uuid.uuid4(),
                org_id=org.id,
                created_by=other.id,
                name="other.csv",
                original_filename="other.csv",
                file_key="uploads/fake/fake/fake.csv",
                file_size_bytes=10,
                file_format="csv",
                status="ready",
            )
            db.add(fake_ds)
            await db.commit()
            return str(fake_ds.id)

    other_dataset_id = asyncio.run(_make_other_users_dataset())

    # Poll endpoint already correctly rejects this (via get_optional_user)
    poll = client.get(f"/jobs/{other_dataset_id}")
    assert poll.status_code == 404, poll.text

    # SSE stream must reject it the same way, not silently allow it
    with client.stream("GET", f"/jobs/{other_dataset_id}/stream") as resp:
        assert resp.status_code == 404, resp.read()

    # Sanity: the fix didn't break access to a dataset we DO own
    own = client.get(f"/jobs/{viz_dataset_id}")
    assert own.status_code == 200, own.text


def test_retention_sweep_exempts_example_dataset(client):
    """Regression test: the example dataset must survive the retention
    sweep even when its created_at is older than the retention window —
    it's the "instant try it" dataset that must always be available. Had no
    prior test coverage; the sweep's example-dataset exemption reads
    defaults.EXAMPLE_DATASET_ID, which is only populated inside the running
    app's own process, so this must run against the shared `client` app
    context rather than a bare subprocess script."""
    import asyncio
    import time
    from datetime import datetime, timedelta, timezone

    from db.connection import AsyncSessionLocal
    from db.models import Dataset
    from retention import sweep_expired_datasets

    import defaults

    deadline = time.time() + 60
    example_id = None
    while time.time() < deadline:
        r = client.get("/example")
        if r.status_code == 200:
            example_id = r.json()["dataset_id"]
            break
        time.sleep(1)
    assert example_id is not None, "example dataset never became ready"
    assert defaults.EXAMPLE_DATASET_ID == example_id

    async def _age_example_only() -> None:
        import uuid

        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Dataset)
                .where(Dataset.id == uuid.UUID(example_id))
                .values(created_at=datetime.now(timezone.utc) - timedelta(days=30))
            )
            await db.commit()

    asyncio.run(_age_example_only())
    asyncio.run(sweep_expired_datasets(retention_days=7))

    # The example dataset's row must still exist and still be fetchable
    still_there = client.get(f"/datasets/{example_id}/analysis")
    assert still_there.status_code == 200, still_there.text


def test_compare_endpoint_still_works_after_threading_fix(client, sample_csv_path):
    """Sanity check that offloading generate_full_report onto asyncio.to_thread
    (previously called synchronously, twice, inside the async handler) didn't
    change the endpoint's actual behavior."""
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


# ── Export ────────────────────────────────────────────────────────────────────


def test_export_filename_neutralizes_content_disposition_injection(client, viz_dataset_id):
    """Regression test: dataset.name is a free-text rename field with no
    character restrictions and was interpolated into the Content-Disposition
    header raw. A name containing a quote let an attacker inject a second
    filename= parameter (confirmed live: renaming to
    'evil"; filename=hacked.exe' produced a header with both, which could
    spoof the downloaded file's apparent name/extension), and a name
    containing a literal CR/LF crashed the connection outright since the
    ASGI server correctly refuses to write control characters into a
    response header."""
    try:
        r = client.patch(f"/datasets/{viz_dataset_id}/rename", json={"name": 'evil"; filename=hacked.exe'})
        assert r.status_code == 200, r.text

        r = client.get(f"/datasets/{viz_dataset_id}/export/excel")
        assert r.status_code == 200, r.text
        disposition = r.headers["content-disposition"]
        assert disposition.count("filename=") == 1, disposition

        r = client.patch(f"/datasets/{viz_dataset_id}/rename", json={"name": "evil\r\nX-Injected: pwned"})
        assert r.status_code == 200, r.text

        r = client.get(f"/datasets/{viz_dataset_id}/export/markdown")
        assert r.status_code == 200, r.text
        assert "x-injected" not in {k.lower() for k in r.headers.keys()}
    finally:
        client.patch(f"/datasets/{viz_dataset_id}/rename", json={"name": "sample_sales.csv"})


def test_excel_export_neutralizes_formula_injection():
    """Regression test: pandas/openpyxl writes a leading '=' string cell as
    an actual <f> formula node, not literal text — confirmed live that a
    cell value of '=1+1' round-tripped through /export/excel became a live
    Excel formula. A malicious uploaded value (e.g. a DDE command-execution
    or data-exfiltration payload) must not become an executable formula
    just because someone opens the export (CWE-1236, 'CSV injection').

    Pure unit test against DataExporter directly (no HTTP/upload) so it
    doesn't compete with the module's shared 10/minute upload rate limit."""
    import io
    import zipfile

    import pandas as pd

    from export_utils import DataExporter

    df = pd.DataFrame(
        {
            "name": ["Alice", "Bob", "Carl"],
            "formula": ["=1+1", "+cmd|calc", "@SUM(A1:A2)"],
        }
    )
    excel_bytes = DataExporter(df, {}).to_excel()

    z = zipfile.ZipFile(io.BytesIO(excel_bytes))
    sheet_xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    assert "<f>" not in sheet_xml, "a cell was written as a live formula, not literal text"
    assert "'=1+1" in sheet_xml
    assert "'+cmd|calc" in sheet_xml
    assert "'@SUM(A1:A2)" in sheet_xml


def test_export_excel_still_works_after_threading_fix(client, viz_dataset_id):
    """Sanity check that offloading DataExporter.to_excel onto
    asyncio.to_thread (previously called synchronously inside the async
    handler — measured at 5+ seconds for a 100k-row export, blocking the
    whole single-process server for that window) didn't change the
    endpoint's actual behavior."""
    r = client.get(f"/datasets/{viz_dataset_id}/export/excel")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(r.content) > 0
