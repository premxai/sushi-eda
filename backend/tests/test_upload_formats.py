"""Upload acceptance coverage for every format advertised in the UI."""

import io
import json
import os
import sqlite3
import tempfile

import pandas as pd
import polars as pl
import pytest
from fastapi.testclient import TestClient

import ai_narrative
import main


@pytest.fixture(scope="module")
def client():
    """Run uploads against the app's local, demo-mode test configuration."""
    original = ai_narrative.generate_narrative
    ai_narrative.generate_narrative = lambda report, dataset_name="": "Test narrative"
    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        ai_narrative.generate_narrative = original


def _xlsx() -> bytes:
    stream = io.BytesIO()
    pd.DataFrame({"region": ["East", "West"], "sales": [12, 19]}).to_excel(stream, index=False)
    return stream.getvalue()


def _parquet() -> bytes:
    stream = io.BytesIO()
    pl.DataFrame({"region": ["East", "West"], "sales": [12, 19]}).write_parquet(stream)
    return stream.getvalue()


def _sqlite() -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as file:
        path = file.name
    try:
        connection = sqlite3.connect(path)
        connection.execute("CREATE TABLE sales (region TEXT, sales INTEGER)")
        connection.executemany("INSERT INTO sales VALUES (?, ?)", [("East", 12), ("West", 19)])
        connection.commit()
        connection.close()
        with open(path, "rb") as file:
            return file.read()
    finally:
        os.remove(path)


CASES = [
    ("sales.csv", b"region,sales\nEast,12\nWest,19\n", "text/csv"),
    ("sales.tsv", b"region\tsales\nEast\t12\nWest\t19\n", "text/tab-separated-values"),
    ("sales.xlsx", _xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("sales.json", json.dumps([{"region": "East", "sales": 12}, {"region": "West", "sales": 19}]).encode(), "application/json"),
    ("sales.parquet", _parquet(), "application/vnd.apache.parquet"),
    ("sales.sqlite", _sqlite(), "application/x-sqlite3"),
]


@pytest.mark.parametrize(("filename", "contents", "content_type"), CASES)
def test_upload_accepts_every_advertised_format(client, filename, contents, content_type):
    response = client.post("/datasets/upload", files={"file": (filename, contents, content_type)})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dataset_id"]
    assert body["status"] in {"pending", "processing"}
