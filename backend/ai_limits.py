"""
AI usage limits for a public no-auth deployment.

Two layers, both counted per UTC day:
  1. Per-IP cap   — AI_DAILY_LIMIT_PER_IP calls/day (default 20)
  2. Global budget — AI_DAILY_BUDGET_CALLS calls/day across all users
                     (default 500) so a traffic spike can't burn the
                     Anthropic budget

Counters live in Redis when REDIS_URL works, otherwise in-process dicts
(fine for the single-worker deployment). Fail-open on storage errors so a
cache outage never blocks the product.

Usage (FastAPI dependency):
    @router.post("/datasets/{id}/ai/chat")
    async def ai_chat(..., _limit: None = Depends(enforce_ai_limit)):
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from loguru import logger

from cache import cache

AI_DAILY_LIMIT_PER_IP = int(os.getenv("AI_DAILY_LIMIT_PER_IP", "20"))
AI_DAILY_BUDGET_CALLS = int(os.getenv("AI_DAILY_BUDGET_CALLS", "500"))

# In-process fallback counters: {key: count}, pruned by day-key rotation
_local_counts: dict[str, int] = {}


def _day() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def _increment(key: str) -> int:
    """Increment a daily counter, preferring Redis, falling back in-process."""
    try:
        client = cache.client
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, 60 * 60 * 26)  # a bit over a day
        count = pipe.execute()[0]
        return int(count)
    except Exception:
        # Prune stale day keys so the dict doesn't grow forever
        prefix_today = _day()
        stale = [k for k in _local_counts if prefix_today not in k]
        for k in stale:
            _local_counts.pop(k, None)
        _local_counts[key] = _local_counts.get(key, 0) + 1
        return _local_counts[key]


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def ai_budget_exhausted() -> bool:
    """Non-raising check for optional AI work (e.g. auto-narrative in analysis)."""
    key = f"ai_budget:{_day()}"
    current = _local_counts.get(key, 0)
    try:
        raw = cache.client.get(key)
        current = int(raw) if raw else current
    except Exception:
        pass
    return current >= AI_DAILY_BUDGET_CALLS


def consume_ai_budget() -> None:
    """Count an AI call against the global daily budget (no exception)."""
    _increment(f"ai_budget:{_day()}")


async def enforce_ai_limit(request: Request) -> None:
    """FastAPI dependency: raise 429 when either daily AI limit is exceeded."""
    ip = _client_ip(request)
    ip_count = _increment(f"ai_ip:{_day()}:{ip}")
    if ip_count > AI_DAILY_LIMIT_PER_IP:
        logger.warning(f"AI per-IP daily limit hit: {ip} ({ip_count})")
        raise HTTPException(
            status_code=429,
            detail="You've reached today's limit for AI questions. It resets at midnight UTC.",
        )

    budget_count = _increment(f"ai_budget:{_day()}")
    if budget_count > AI_DAILY_BUDGET_CALLS:
        logger.error(f"Global AI daily budget exhausted ({budget_count})")
        raise HTTPException(
            status_code=429,
            detail="AI features are temporarily paused for today due to high demand. "
            "Everything else keeps working — please try again tomorrow.",
        )
