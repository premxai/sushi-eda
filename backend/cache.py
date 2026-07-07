"""
Redis client (Upstash) for caching, job state, and pub/sub.

Three responsibilities:
  1. Analysis cache  — store completed EDAReport JSON keyed by file hash
  2. Job state       — track Celery job status per dataset_id
  3. Pub/Sub channel — notify frontend when a job finishes (Task 6)

Usage:
    from cache import cache
    cache.set_analysis(file_hash, report_dict)
    report = cache.get_analysis(file_hash)
    cache.set_job_status(dataset_id, "processing")
    status = cache.get_job_status(dataset_id)
"""
import json
import os
import time
from typing import Any, Callable, Optional, TypeVar

import redis
from loguru import logger

# ── Config ─────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# TTLs (seconds)
ANALYSIS_CACHE_TTL = 60 * 60 * 24 * 7   # 7 days
JOB_STATUS_TTL     = 60 * 60 * 24        # 1 day
RATE_LIMIT_TTL     = 60                  # 1 minute window

# Pub/Sub channel name pattern: jobs:{org_id}
JOB_CHANNEL_PREFIX = "jobs"

# Circuit breaker: once Redis fails once, skip trying it for this long and go
# straight to the in-memory fallback. Without this, every call blocks the
# caller for the full socket timeout below — and since analysis_runner.py and
# main.py call these methods synchronously inside async handlers/background
# tasks, an unreachable Redis (the default with no REDIS_URL configured)
# would otherwise freeze the whole single-process event loop for seconds on
# every single call, serializing all concurrent requests behind it.
_BREAKER_COOLDOWN_SECONDS = 30
# Real timeout in the worst case — must stay well under a second so a single
# detection probe never itself becomes a user-visible stall.
_SOCKET_TIMEOUT_SECONDS = 0.75

T = TypeVar("T")


class RedisCache:
    """Thin Redis wrapper. All methods are synchronous (use in Celery workers too)."""

    def __init__(self) -> None:
        self._client: Optional[redis.Redis] = None
        self._analysis_memory: dict[str, dict] = {}
        self._job_memory: dict[str, dict] = {}
        self._kv_memory: dict[str, Any] = {}
        self._breaker_open_until: float = 0.0

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=_SOCKET_TIMEOUT_SECONDS,
                socket_timeout=_SOCKET_TIMEOUT_SECONDS,
                retry_on_timeout=False,
            )
        return self._client

    def _call(self, fn: Callable[[], T], fallback: Callable[[], T], op: str) -> T:
        """Run a Redis operation, short-circuiting to `fallback` when the
        breaker is open, and opening the breaker on any failure."""
        now = time.monotonic()
        if now < self._breaker_open_until:
            return fallback()
        try:
            return fn()
        except Exception as e:
            logger.warning(f"Redis {op} error: {e}")
            self._breaker_open_until = now + _BREAKER_COOLDOWN_SECONDS
            return fallback()

    def ping(self) -> bool:
        """Check Redis connectivity. Returns True if reachable."""
        return self._call(lambda: bool(self.client.ping()), lambda: False, "ping")

    # ── Analysis Cache ─────────────────────────────────────────────────────────

    def _analysis_key(self, file_hash: str) -> str:
        return f"analysis:{file_hash}"

    def get_analysis(self, file_hash: str) -> Optional[dict]:
        """Return cached EDAReport dict or None if not found / expired."""
        def _redis() -> Optional[dict]:
            raw = self.client.get(self._analysis_key(file_hash))
            if raw:
                logger.debug(f"Cache hit: analysis:{file_hash[:8]}")
                return json.loads(raw)
            return self._analysis_memory.get(file_hash)

        return self._call(
            _redis, lambda: self._analysis_memory.get(file_hash), "get_analysis"
        )

    def set_analysis(self, file_hash: str, report: dict) -> None:
        """Cache an EDAReport. Overwrites any existing entry."""
        def _redis() -> None:
            self.client.setex(
                self._analysis_key(file_hash),
                ANALYSIS_CACHE_TTL,
                json.dumps(report, default=str),
            )
            logger.debug(f"Cached analysis:{file_hash[:8]} (TTL={ANALYSIS_CACHE_TTL}s)")

        def _fallback() -> None:
            self._analysis_memory[file_hash] = report

        self._call(_redis, _fallback, "set_analysis")

    def delete_analysis(self, file_hash: str) -> None:
        def _redis() -> None:
            self.client.delete(self._analysis_key(file_hash))

        self._call(_redis, lambda: None, "delete_analysis")
        self._analysis_memory.pop(file_hash, None)

    # ── Job Status ─────────────────────────────────────────────────────────────

    def _job_key(self, dataset_id: str) -> str:
        return f"job:{dataset_id}"

    def set_job_status(self, dataset_id: str, status: str, extra: Optional[dict] = None) -> None:
        """
        Store job progress for a dataset.
        status: pending | processing | done | failed
        extra: optional dict (e.g. {"progress": 42, "error": "..."})
        """
        payload = {"status": status, **(extra or {})}
        # Always keep the in-memory copy current, independent of Redis outcome,
        # so a mid-session breaker trip never loses the latest known status.
        self._job_memory[dataset_id] = payload

        def _redis() -> None:
            self.client.setex(
                self._job_key(dataset_id),
                JOB_STATUS_TTL,
                json.dumps(payload),
            )

        self._call(_redis, lambda: None, "set_job_status")

    def get_job_status(self, dataset_id: str) -> Optional[dict]:
        def _redis() -> Optional[dict]:
            raw = self.client.get(self._job_key(dataset_id))
            return json.loads(raw) if raw else self._job_memory.get(dataset_id)

        return self._call(
            _redis, lambda: self._job_memory.get(dataset_id), "get_job_status"
        )

    # ── Pub/Sub (job completion notifications) ─────────────────────────────────

    def publish_job_done(self, org_id: str, dataset_id: str, analysis_id: str) -> None:
        """
        Publish a message to the org's job channel so the SSE endpoint can
        forward it to connected browser clients.
        """
        channel = f"{JOB_CHANNEL_PREFIX}:{org_id}"
        message = json.dumps({
            "event": "job_done",
            "dataset_id": dataset_id,
            "analysis_id": analysis_id,
        })
        def _redis() -> None:
            self.client.publish(channel, message)
            logger.info(f"Published job_done to {channel}: dataset={dataset_id}")

        self._call(_redis, lambda: None, "publish_job_done")

    def publish_job_failed(self, org_id: str, dataset_id: str, error: str) -> None:
        channel = f"{JOB_CHANNEL_PREFIX}:{org_id}"
        message = json.dumps({
            "event": "job_failed",
            "dataset_id": dataset_id,
            "error": error,
        })
        self._call(
            lambda: self.client.publish(channel, message), lambda: None, "publish_job_failed"
        )

    @staticmethod
    def _dummy_pubsub() -> "redis.client.PubSub":
        class DummyPubSub:
            def get_message(self, timeout=0.1):
                return None

            def close(self):
                return None

        return DummyPubSub()  # type: ignore[return-value]

    def subscribe_org_jobs(self, org_id: str) -> "redis.client.PubSub":
        """Return a PubSub object subscribed to the org's job channel."""
        def _redis() -> "redis.client.PubSub":
            ps = self.client.pubsub(ignore_subscribe_messages=True)
            ps.subscribe(f"{JOB_CHANNEL_PREFIX}:{org_id}")
            return ps

        return self._call(_redis, self._dummy_pubsub, "subscribe")

    # ── Rate Limiting ──────────────────────────────────────────────────────────

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        Sliding-window rate limiter. Returns True if the request is allowed.
        key: e.g. "ratelimit:upload:{ip}" or "ratelimit:ai:{user_id}"
        """
        def _redis() -> bool:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            results = pipe.execute()
            count = results[0]
            allowed = count <= max_requests
            if not allowed:
                logger.warning(f"Rate limit hit: {key} ({count}/{max_requests})")
            return allowed

        # Fail open so Redis downtime doesn't break the app.
        return self._call(_redis, lambda: True, "rate_limit")

    # ── Generic helpers ────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[Any]:
        def _redis() -> Optional[Any]:
            raw = self.client.get(key)
            return json.loads(raw) if raw else None

        return self._call(_redis, lambda: self._kv_memory.get(key), "get")

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        def _redis() -> None:
            serialized = json.dumps(value, default=str)
            if ttl:
                self.client.setex(key, ttl, serialized)
            else:
                self.client.set(key, serialized)

        def _fallback() -> None:
            # In-memory fallback has no TTL; callers that care about expiry
            # must check expiry timestamps stored inside the value.
            self._kv_memory[key] = value

        self._call(_redis, _fallback, "set")

    def delete(self, key: str) -> None:
        self._call(lambda: self.client.delete(key), lambda: None, "delete")
        self._kv_memory.pop(key, None)

    def cache_size(self) -> int:
        """Rough count of analysis cache keys (for /health endpoint)."""
        return self._call(
            lambda: len(self.client.keys("analysis:*")),
            lambda: len(self._analysis_memory),
            "cache_size",
        )


# ── Singleton ─────────────────────────────────────────────────────────────────
cache = RedisCache()
