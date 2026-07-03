"""
Data retention sweep — the "your file is deleted after N days" promise.

Deletes datasets (rows + stored files + analyses via ORM cascade) older
than RETENTION_DAYS. The seeded example dataset is exempt. RETENTION_DAYS=0
disables the sweep entirely (e.g. self-hosted installs that keep everything).

Started from main.py as a background asyncio loop; `sweep_expired_datasets`
is a plain coroutine so tests can call it directly.
"""

from __future__ import annotations

import asyncio
import os
import uuid as _uuid
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select

import defaults
from storage import storage

RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "7"))
SWEEP_INTERVAL_SECONDS = int(os.getenv("RETENTION_SWEEP_INTERVAL", str(6 * 3600)))


async def sweep_expired_datasets(retention_days: int | None = None) -> int:
    """Delete datasets older than the retention window. Returns count deleted."""
    days = RETENTION_DAYS if retention_days is None else retention_days
    if days <= 0:
        return 0

    from db.connection import AsyncSessionLocal
    from db.models import Dataset

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    deleted = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Dataset).where(Dataset.created_at < cutoff))
        expired = result.scalars().all()

        for dataset in expired:
            if defaults.EXAMPLE_DATASET_ID and dataset.id == _uuid.UUID(
                defaults.EXAMPLE_DATASET_ID
            ):
                continue
            try:
                storage.delete_prefix(f"uploads/{dataset.org_id}/{dataset.id}/")
            except Exception as e:
                logger.warning(f"Retention: file cleanup failed for {dataset.id}: {e}")
            await db.delete(dataset)  # analyses cascade
            deleted += 1

        await db.commit()

    if deleted:
        logger.info(f"Retention sweep deleted {deleted} dataset(s) older than {days}d")
    return deleted


async def retention_loop() -> None:
    """Run the sweep on startup and then every SWEEP_INTERVAL_SECONDS."""
    if RETENTION_DAYS <= 0:
        logger.info("RETENTION_DAYS=0 — retention sweep disabled")
        return
    while True:
        try:
            await sweep_expired_datasets()
        except Exception as e:
            logger.error(f"Retention sweep failed: {e}")
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
