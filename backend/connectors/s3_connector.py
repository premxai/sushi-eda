"""
S3-compatible object storage connector (AWS S3, Cloudflare R2, MinIO).

Lists CSV / Parquet / TSV objects in a bucket and downloads them
for import into the Sushi dataset pipeline.
"""
from __future__ import annotations

import io
from typing import Any

import polars as pl
from loguru import logger

_IMPORTABLE_EXTENSIONS = {".csv", ".tsv", ".parquet", ".json"}
_MAX_IMPORT_BYTES = 100 * 1024 * 1024  # 100 MB


def _make_client(params: dict[str, Any]):
    import boto3
    kwargs: dict[str, Any] = {
        "aws_access_key_id": params["access_key_id"],
        "aws_secret_access_key": params["secret_access_key"],
        "region_name": params.get("region", "us-east-1"),
    }
    if params.get("endpoint_url"):
        kwargs["endpoint_url"] = params["endpoint_url"]
    return boto3.client("s3", **kwargs)


def test_connection(params: dict[str, Any]) -> bool:
    """Return True if we can list the bucket."""
    try:
        client = _make_client(params)
        client.head_bucket(Bucket=params["bucket"])
        return True
    except Exception as exc:
        logger.warning(f"S3 test_connection failed: {exc}")
        return False


def list_objects(
    params: dict[str, Any],
    prefix: str = "",
    max_keys: int = 500,
) -> list[dict[str, Any]]:
    """
    Return importable objects in the bucket matching `prefix`.

    Each entry: {key, size_bytes, last_modified, extension}
    """
    client = _make_client(params)
    paginator = client.get_paginator("list_objects_v2")
    results = []
    for page in paginator.paginate(
        Bucket=params["bucket"],
        Prefix=prefix,
        PaginationConfig={"MaxItems": max_keys},
    ):
        for obj in page.get("Contents", []):
            key: str = obj["Key"]
            ext = "." + key.rsplit(".", 1)[-1].lower() if "." in key else ""
            if ext in _IMPORTABLE_EXTENSIONS:
                results.append({
                    "key": key,
                    "size_bytes": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "extension": ext,
                })
    return results


def download_object(params: dict[str, Any], key: str) -> bytes:
    """Download an object and return raw bytes. Enforces 100 MB limit."""
    client = _make_client(params)
    head = client.head_object(Bucket=params["bucket"], Key=key)
    size = head["ContentLength"]
    if size > _MAX_IMPORT_BYTES:
        raise ValueError(f"Object {key!r} is {size / 1e6:.1f} MB — exceeds 100 MB import limit")
    response = client.get_object(Bucket=params["bucket"], Key=key)
    return response["Body"].read()


def fetch_object_as_polars(params: dict[str, Any], key: str) -> tuple[pl.DataFrame, str]:
    """
    Download an S3 object and parse it into a Polars DataFrame.

    Returns (dataframe, file_format) where file_format is csv | tsv | parquet | json.
    """
    from polars_loader import parse_to_polars

    data = download_object(params, key)
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else "csv"
    fmt_map = {"csv": "csv", "tsv": "tsv", "parquet": "parquet", "json": "json"}
    file_format = fmt_map.get(ext, "csv")
    df = parse_to_polars(data, file_format)
    return df, file_format
