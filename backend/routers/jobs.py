"""
SSE (Server-Sent Events) router for real-time job progress.

GET /jobs/{dataset_id}/stream
  — Opens a persistent HTTP connection and streams events until the job
    completes or the client disconnects.  The frontend subscribes once
    after uploading a file and receives exactly one terminal event
    (job_done or job_failed), then the stream closes.

Event format (text/event-stream):
  data: {"event": "status", "status": "processing", "progress": 42}
  data: {"event": "job_done",   "analysis_id": "...", "duration_seconds": 3.2}
  data: {"event": "job_failed", "error": "..."}
  data: {"event": "heartbeat"}    <- keepalive every 15s

GET /jobs/{dataset_id}
  — Simple JSON poll (no streaming) for clients that can't do SSE.
"""

import asyncio
import json
import time
import uuid
from typing import AsyncGenerator

from auth import AUTH_ENABLED, _decode_supabase_token, _get_demo_user, get_optional_user, validate_org_access
from cache import cache
from db import get_db
from db.models import Dataset, User
import defaults
from defaults import resolve_org_id
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/jobs", tags=["jobs"])

HEARTBEAT_INTERVAL = 15  # seconds between keepalive pings
JOB_TIMEOUT = 360  # 6 minutes max stream duration


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


async def _resolve_stream_user(
    token: str | None,
    db: AsyncSession,
) -> User | None:
    # In demo mode every other endpoint resolves to the shared "system" user
    # via get_optional_user/get_current_user, and _authorize_job_access's
    # ownership check below only runs when current_user is not None. This
    # function previously always returned None when the query-string token
    # was absent (the normal case here — EventSource can't send an
    # Authorization header, and demo mode has no authenticated session to draw a
    # token from), silently skipping that check and letting anyone stream
    # job status — including the analysis_id — for any dataset_id in the
    # shared default org, bypassing per-user dataset privacy entirely.
    if not AUTH_ENABLED:
        return await _get_demo_user(db)
    if not token:
        return None

    payload = _decode_supabase_token(token)
    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.clerk_id == auth_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user


async def _authorize_job_access(
    dataset_id: str,
    org_id: str,
    current_user: User | None,
    db: AsyncSession,
) -> Dataset:
    # Parse to uuid.UUID — SQLite's UUID type rejects raw strings (Postgres coerces).
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid dataset_id") from exc

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_uuid))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset_org_id = str(dataset.org_id)
    requested_org_id = (
        dataset_org_id if org_id == "default" else str(resolve_org_id(org_id))
    )
    if dataset_org_id != requested_org_id:
        raise HTTPException(status_code=403, detail="Dataset not in requested org")

    # Shared default org: datasets are private to their creator.
    if (
        current_user is not None
        and defaults.DEFAULT_ORG_ID
        and dataset_org_id == defaults.DEFAULT_ORG_ID
        and dataset.created_by != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Dataset not found")

    if current_user is None:
        if org_id != "default":
            raise HTTPException(status_code=401, detail="Authentication required")
        return dataset

    if org_id == "default":
        return dataset

    await validate_org_access(dataset_org_id, current_user, db)
    return dataset


async def _job_event_stream(dataset_id: str, org_id: str) -> AsyncGenerator[str, None]:
    """
    Generator that yields SSE-formatted strings.

    Strategy:
      1. Emit the current status immediately (so client gets instant feedback).
      2. Subscribe to the Redis pub/sub channel for this org.
      3. Poll the channel in a non-blocking loop, yielding heartbeats to keep
         the connection alive. Exit when a terminal event arrives or timeout.
    """
    # Send current status right away
    current = await asyncio.to_thread(cache.get_job_status, dataset_id)
    if current is None:
        yield _sse({"event": "error", "detail": "Job not found"})
        return

    yield _sse({"event": "status", **current})

    # If already terminal, we're done
    if current.get("status") in ("done", "failed"):
        return

    # Subscribe to Redis channel for this org
    pubsub = cache.subscribe_org_jobs(org_id)
    deadline = time.monotonic() + JOB_TIMEOUT
    last_heartbeat = time.monotonic()

    try:
        while time.monotonic() < deadline:
            # Non-blocking check for a pub/sub message
            message = await asyncio.to_thread(pubsub.get_message, timeout=0.1)

            if message and message["type"] == "message":
                payload = json.loads(message["data"])
                # Only forward events for this specific dataset
                if payload.get("dataset_id") == dataset_id:
                    yield _sse(payload)
                    if payload.get("event") in ("job_done", "job_failed"):
                        return

            # Heartbeat
            if time.monotonic() - last_heartbeat > HEARTBEAT_INTERVAL:
                yield _sse({"event": "heartbeat"})
                last_heartbeat = time.monotonic()

                # Also re-check Redis in case we missed the pub/sub message
                refreshed = await asyncio.to_thread(cache.get_job_status, dataset_id)
                if refreshed and refreshed.get("status") in ("done", "failed"):
                    yield _sse(
                        {
                            "event": "job_done"
                            if refreshed["status"] == "done"
                            else "job_failed",
                            **refreshed,
                        }
                    )
                    return

            await asyncio.sleep(0.05)

        # Timeout
        yield _sse({"event": "timeout", "detail": "Job is taking longer than expected"})

    finally:
        try:
            pubsub.close()
        except Exception:
            pass


@router.get("/{dataset_id}/stream")
async def stream_job(
    dataset_id: str,
    request: Request,
    org_id: str = "default",
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE stream for a specific analysis job.
    Closes automatically when the job finishes or after 6 minutes.

    Since EventSource cannot send Authorization headers, an optional
    ``token`` query parameter is accepted for Clerk JWT authentication.
    """
    current_user = await _resolve_stream_user(token, db)
    await _authorize_job_access(dataset_id, org_id, current_user, db)

    logger.info(f"SSE stream opened: dataset={dataset_id} org={org_id}")

    async def event_gen():
        async for chunk in _job_event_stream(dataset_id, org_id):
            # Stop if client disconnected
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected: dataset={dataset_id}")
                break
            yield chunk

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/{dataset_id}")
async def get_job_status(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll-based job status (alternative to SSE for simpler clients)."""
    await _authorize_job_access(dataset_id, org_id, current_user, db)
    status_data = cache.get_job_status(dataset_id)
    if status_data is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return {"dataset_id": dataset_id, **status_data}
