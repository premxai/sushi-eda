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
from typing import Any, Optional

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


class RedisCache:
    """Thin Redis wrapper. All methods are synchronous (use in Celery workers too)."""

    def __init__(self) -> None:
        self._client: Optional[redis.Redis] = None

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
        return self._client

    def ping(self) -> bool:
        """Check Redis connectivity. Returns True if reachable."""
        try:
            self.client.ping()
            return True
        except Exception:
            return False

    # ── Analysis Cache ─────────────────────────────────────────────────────────

    def _analysis_key(self, file_hash: str) -> str:
        return f"analysis:{file_hash}"

    def get_analysis(self, file_hash: str) -> Optional[dict]:
        """Return cached EDAReport dict or None if not found / expired."""
        try:
            raw = self.client.get(self._analysis_key(file_hash))
            if raw:
                logger.debug(f"Cache hit: analysis:{file_hash[:8]}")
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Redis get_analysis error: {e}")
        return None

    def set_analysis(self, file_hash: str, report: dict) -> None:
        """Cache an EDAReport. Overwrites any existing entry."""
        try:
            self.client.setex(
                self._analysis_key(file_hash),
                ANALYSIS_CACHE_TTL,
                json.dumps(report, default=str),
            )
            logger.debug(f"Cached analysis:{file_hash[:8]} (TTL={ANALYSIS_CACHE_TTL}s)")
        except Exception as e:
            logger.warning(f"Redis set_analysis error: {e}")

    def delete_analysis(self, file_hash: str) -> None:
        try:
            self.client.delete(self._analysis_key(file_hash))
        except Exception as e:
            logger.warning(f"Redis delete_analysis error: {e}")

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
        try:
            self.client.setex(
                self._job_key(dataset_id),
                JOB_STATUS_TTL,
                json.dumps(payload),
            )
        except Exception as e:
            logger.warning(f"Redis set_job_status error: {e}")

    def get_job_status(self, dataset_id: str) -> Optional[dict]:
        try:
            raw = self.client.get(self._job_key(dataset_id))
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.warning(f"Redis get_job_status error: {e}")
            return None

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
        try:
            self.client.publish(channel, message)
            logger.info(f"Published job_done to {channel}: dataset={dataset_id}")
        except Exception as e:
            logger.warning(f"Redis publish error: {e}")

    def publish_job_failed(self, org_id: str, dataset_id: str, error: str) -> None:
        channel = f"{JOB_CHANNEL_PREFIX}:{org_id}"
        message = json.dumps({
            "event": "job_failed",
            "dataset_id": dataset_id,
            "error": error,
        })
        try:
            self.client.publish(channel, message)
        except Exception as e:
            logger.warning(f"Redis publish error: {e}")

    def subscribe_org_jobs(self, org_id: str) -> "redis.client.PubSub":
        """Return a PubSub object subscribed to the org's job channel."""
        ps = self.client.pubsub(ignore_subscribe_messages=True)
        ps.subscribe(f"{JOB_CHANNEL_PREFIX}:{org_id}")
        return ps

    # ── Rate Limiting ──────────────────────────────────────────────────────────

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        Sliding-window rate limiter. Returns True if the request is allowed.
        key: e.g. "ratelimit:upload:{ip}" or "ratelimit:ai:{user_id}"
        """
        try:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            results = pipe.execute()
            count = results[0]
            allowed = count <= max_requests
            if not allowed:
                logger.warning(f"Rate limit hit: {key} ({count}/{max_requests})")
            return allowed
        except Exception as e:
            logger.warning(f"Redis rate_limit error: {e} — allowing request")
            return True  # fail open so Redis downtime doesn't break the app

    # ── Generic helpers ────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[Any]:
        try:
            raw = self.client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        try:
            serialized = json.dumps(value, default=str)
            if ttl:
                self.client.setex(key, ttl, serialized)
            else:
                self.client.set(key, serialized)
        except Exception as e:
            logger.warning(f"Redis set error for {key}: {e}")

    def delete(self, key: str) -> None:
        try:
            self.client.delete(key)
        except Exception as e:
            logger.warning(f"Redis delete error for {key}: {e}")

    def cache_size(self) -> int:
        """Rough count of analysis cache keys (for /health endpoint)."""
        try:
            return len(self.client.keys("analysis:*"))
        except Exception:
            return -1


# ── Singleton ─────────────────────────────────────────────────────────────────
cache = RedisCache()
