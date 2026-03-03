"""
Fast file I/O using Polars.

CSV, TSV, and Parquet are read natively by Polars (Rust-threaded, 3-10x
faster than pandas).  Excel, JSON, and SQLite fall back to pandas and are
converted to a Polars DataFrame before returning.

Usage:
    from polars_loader import parse_to_polars
    df: pl.DataFrame = parse_to_polars(file_bytes, "csv")
    pdf = df.to_pandas()   # only when scipy / plotly need it
"""
import io
import json
import os
import sqlite3
import tempfile

import pandas as pd
import polars as pl


def parse_to_polars(data: bytes, file_format: str) -> pl.DataFrame:
    """
    Parse raw bytes into a Polars DataFrame.

    Args:
        data:        Raw file bytes.
        file_format: One of csv | tsv | parquet | xls | xlsx | json | db | sqlite | sqlite3

    Returns:
        pl.DataFrame — callers convert to pandas only when needed.
    """
    buf = io.BytesIO(data)

    if file_format == "csv":
        return pl.read_csv(
            buf,
            infer_schema_length=10_000,
            ignore_errors=True,        # skip rows that don't match inferred schema
        )

    elif file_format == "tsv":
        return pl.read_csv(
            buf,
            separator="\t",
            infer_schema_length=10_000,
            ignore_errors=True,
        )

    elif file_format == "parquet":
        return pl.read_parquet(buf)

    elif file_format in ("xls", "xlsx"):
        # Polars' read_excel requires fastexcel/xlsx2csv; fall back to pandas
        pdf = pd.read_excel(buf, engine="openpyxl")
        return pl.from_pandas(pdf)

    elif file_format == "json":
        raw = json.loads(data.decode("utf-8"))
        if not isinstance(raw, list):
            raw = [raw]
        # Flatten nested dicts/lists to strings
        for row in raw:
            if isinstance(row, dict):
                for key, val in row.items():
                    if isinstance(val, (dict, list)):
                        row[key] = json.dumps(val)
        if not raw:
            return pl.DataFrame()
        pdf = pd.json_normalize(raw, max_level=1)
        return pl.from_pandas(pdf)

    elif file_format in ("db", "sqlite", "sqlite3"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            conn = sqlite3.connect(tmp_path)
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table'", conn
            )
            if tables.empty:
                raise ValueError("No tables found in SQLite database")
            pdf = pd.read_sql_query(
                f"SELECT * FROM {tables.iloc[0]['name']}", conn
            )
            conn.close()
        finally:
            os.unlink(tmp_path)
        return pl.from_pandas(pdf)

    else:
        raise ValueError(f"Unsupported format: {file_format}")
