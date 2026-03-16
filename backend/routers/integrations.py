"""
Third-party integrations webhook endpoints.

Routes:
  POST /integrations/github/webhook  — GitHub push webhook (auto-analyze datasets)

GitHub Setup:
  1. Go to repo Settings → Webhooks → Add webhook
  2. Payload URL: https://your-api.com/integrations/github/webhook
  3. Content type: application/json
  4. Secret: value of GITHUB_WEBHOOK_SECRET env var
  5. Events: Just the push event

On each push, any CSV / TSV / Parquet / JSON files in the diff are
downloaded from GitHub's raw API and queued for Sushi analysis.
Results are visible in the dataset list for the configured org.

The org is identified by the repo full_name stored in the webhook secret header
OR by GITHUB_DEFAULT_ORG_ID env var (fallback: "default").
"""

from __future__ import annotations

import hashlib
import hmac
import io
import os
import uuid
from typing import Any

import defaults
import httpx
from cache import cache
from fastapi import APIRouter, Header, HTTPException, Request
from loguru import logger
from storage import storage
from worker import analyze_dataset

router = APIRouter(prefix="/integrations", tags=["integrations"])

_GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
_GITHUB_DEFAULT_ORG_ID = os.getenv("GITHUB_DEFAULT_ORG_ID", "default")
_DATABASE_URL = os.getenv("DATABASE_URL", "")

# File extensions we'll analyze automatically
_ANALYZABLE_EXTENSIONS = {".csv", ".tsv", ".parquet", ".json"}
_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def _verify_signature(body: bytes, signature: str) -> bool:
    """Verify GitHub's HMAC-SHA256 webhook signature."""
    if not _GITHUB_WEBHOOK_SECRET:
        if os.getenv("ENVIRONMENT") == "production":
            logger.error(
                "GITHUB_WEBHOOK_SECRET not set in production — rejecting request"
            )
            return False
        logger.warning(
            "GITHUB_WEBHOOK_SECRET not set — skipping signature verification"
        )
        return True
    expected = (
        "sha256="
        + hmac.new(
            _GITHUB_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
    )
    return hmac.compare_digest(expected, signature or "")


def _extract_data_files(commits: list[dict[str, Any]]) -> list[str]:
    """
    Return unique file paths (added or modified) that match our extensions.
    Deleted files are ignored.
    """
    seen: set[str] = set()
    result: list[str] = []
    for commit in commits:
        for path in commit.get("added", []) + commit.get("modified", []):
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
            if ext in _ANALYZABLE_EXTENSIONS and path not in seen:
                seen.add(path)
                result.append(path)
    return result


async def _download_file(raw_url: str) -> bytes | None:
    """Download a raw file from GitHub. Returns None if too large or not found."""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(raw_url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            content = resp.content
            if len(content) > _MAX_FILE_SIZE_BYTES:
                logger.warning(
                    f"GitHub file too large ({len(content) / 1e6:.1f} MB), skipping: {raw_url}"
                )
                return None
            return content
    except Exception as e:
        logger.warning(f"Failed to download {raw_url}: {e}")
        return None


def _build_raw_url(repo_full_name: str, ref: str, file_path: str) -> str:
    """Build GitHub raw content URL."""
    branch = ref.removeprefix("refs/heads/")
    return f"https://raw.githubusercontent.com/{repo_full_name}/{branch}/{file_path}"


@router.post("/github/webhook")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
    x_github_event: str = Header(default=""),
):
    """
    Receives GitHub push webhooks and auto-queues analysis for data files.

    Returns a summary of queued dataset IDs.
    """
    body = await request.body()

    if not _verify_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Only process push events
    if x_github_event != "push":
        return {"status": "ignored", "event": x_github_event}

    payload = await request.json()

    repo_full_name: str = payload.get("repository", {}).get("full_name", "unknown")
    ref: str = payload.get("ref", "refs/heads/main")
    commits: list[dict] = payload.get("commits", [])
    pusher: str = payload.get("pusher", {}).get("name", "github")

    logger.info(f"GitHub push: repo={repo_full_name} ref={ref} commits={len(commits)}")

    data_files = _extract_data_files(commits)
    if not data_files:
        return {"status": "no_data_files", "repo": repo_full_name}

    # Determine org from repo mapping (env var: GITHUB_ORG_MAP="owner/repo:org_id,...")
    org_id = _GITHUB_DEFAULT_ORG_ID
    org_map_env = os.getenv("GITHUB_ORG_MAP", "")
    if org_map_env:
        mapping = dict(
            pair.split(":") for pair in org_map_env.split(",") if ":" in pair
        )
        org_id = mapping.get(repo_full_name, org_id)

    queued: list[dict] = []

    for file_path in data_files:
        raw_url = _build_raw_url(repo_full_name, ref, file_path)
        file_bytes = await _download_file(raw_url)
        if file_bytes is None:
            logger.warning(f"Skipped {file_path} (download failed or too large)")
            continue

        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else "csv"
        filename = file_path.rsplit("/", 1)[-1]
        dataset_id = str(uuid.uuid4())
        file_key = f"uploads/{org_id}/{dataset_id}/{filename}"
        display_name = f"{repo_full_name}/{file_path}"

        # Upload to R2
        try:
            storage.upload(org_id, dataset_id, filename, file_bytes)
        except Exception as e:
            logger.error(f"R2 upload failed for {file_path}: {e}")
            continue

        # Persist Dataset row
        if _DATABASE_URL:
            try:
                import psycopg2

                db_url = _DATABASE_URL.replace(
                    "postgresql+asyncpg://", "postgresql://"
                ).replace("postgres://", "postgresql://")
                conn = psycopg2.connect(db_url)
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO datasets
                              (id, org_id, created_by, name, original_filename,
                               file_key, file_size_bytes, file_format, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                            """,
                            (
                                dataset_id,
                                defaults.resolve_org_id(org_id),
                                defaults.DEFAULT_USER_ID,
                                display_name,
                                filename,
                                file_key,
                                len(file_bytes),
                                ext,
                            ),
                        )
                conn.close()
            except Exception as e:
                logger.warning(f"Dataset row insert failed for {file_path}: {e}")

        # Enqueue Celery analysis
        cache.set_job_status(dataset_id, "pending")
        analyze_dataset.delay(
            dataset_id=dataset_id,
            org_id=org_id,
            file_key=file_key,
            file_format=ext,
            database_url=_DATABASE_URL,
        )

        queued.append({"dataset_id": dataset_id, "file": file_path})
        logger.info(f"GitHub webhook → queued dataset {dataset_id} for {file_path}")

    return {
        "status": "ok",
        "repo": repo_full_name,
        "ref": ref,
        "queued": queued,
        "total_files_detected": len(data_files),
    }
