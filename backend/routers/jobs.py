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
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from loguru import logger

from cache import cache

router = APIRouter(prefix="/jobs", tags=["jobs"])

HEARTBEAT_INTERVAL = 15   # seconds between keepalive pings
JOB_TIMEOUT        = 360  # 6 minutes max stream duration


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


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
    current = cache.get_job_status(dataset_id)
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
            message = pubsub.get_message(timeout=0.1)

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
                refreshed = cache.get_job_status(dataset_id)
                if refreshed and refreshed.get("status") in ("done", "failed"):
                    yield _sse({"event": "job_done" if refreshed["status"] == "done" else "job_failed", **refreshed})
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
    org_id: str = "default",   # replaced by Clerk auth in Task 7
):
    """
    SSE stream for a specific analysis job.
    Closes automatically when the job finishes or after 6 minutes.
    """
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
            "X-Accel-Buffering": "no",   # disable nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/{dataset_id}")
async def get_job_status(dataset_id: str):
    """Poll-based job status (alternative to SSE for simpler clients)."""
    status_data = cache.get_job_status(dataset_id)
    if status_data is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return {"dataset_id": dataset_id, **status_data}
