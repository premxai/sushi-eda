"""Engine tests: run the analysis pipeline against every sample_data file."""

import os

import pytest

from conftest import SAMPLE_DATA_DIR
from analyzer import EDAAnalyzer
from polars_loader import parse_to_polars

SAMPLE_FILES = [
    "sales_data.csv",
    "customer_data.csv",
    "test_complete.csv",
    "test_complete.json",
    "test_complete.xlsx",
    "test_data.json",
]

REQUIRED_REPORT_KEYS = {
    "basic_info",
    "column_analysis",
    "correlation_matrix",
    "outliers",
    "quality_score",
    "type_suggestions",
}


def _load(filename: str):
    path = os.path.join(SAMPLE_DATA_DIR, filename)
    with open(path, "rb") as f:
        data = f.read()
    ext = filename.rsplit(".", 1)[-1].lower()
    return parse_to_polars(data, ext)


@pytest.mark.parametrize("filename", SAMPLE_FILES)
def test_full_report_structure(filename):
    df = _load(filename)
    assert df.height > 0, f"{filename} parsed to an empty frame"

    report = EDAAnalyzer(df).generate_full_report()

    assert REQUIRED_REPORT_KEYS.issubset(report.keys())

    bi = report["basic_info"]
    assert bi["rows"] == df.height
    assert bi["columns"] == df.width
    assert bi["column_names"] == df.columns

    assert len(report["column_analysis"]) == df.width
    for col in report["column_analysis"]:
        assert 0 <= col["missing_percent"] <= 100

    qs = report["quality_score"]
    assert 0 <= qs["overall_score"] <= 100
    assert qs["grade"] in {"A", "B", "C", "D", "F"}


@pytest.mark.parametrize("filename", SAMPLE_FILES)
def test_report_is_json_safe(filename):
    """The sanitized report must serialize to JSON without NaN/Inf."""
    import json

    from analysis_runner import sanitize_json

    df = _load(filename)
    report = sanitize_json(EDAAnalyzer(df).generate_full_report())
    encoded = json.dumps(report, allow_nan=False)  # raises on NaN/Inf
    assert isinstance(encoded, str)


def test_unsupported_format_raises():
    with pytest.raises(ValueError):
        parse_to_polars(b"garbage", "exe")


def test_pandas_dataframe_accepted():
    import pandas as pd

    pdf = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    report = EDAAnalyzer(pdf).generate_full_report()
    assert report["basic_info"]["rows"] == 3
