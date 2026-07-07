"""
Async SQLAlchemy engine + session factory for Supabase (PostgreSQL).

Usage in FastAPI:
    from db import get_db
    async def my_route(db: AsyncSession = Depends(get_db)):
        ...
"""
import os
import tempfile
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Render and most serverless platforms have a read-only filesystem outside /tmp,
# so the dev-fallback SQLite file must live in the system temp dir.
_DEFAULT_SQLITE_PATH = os.path.join(tempfile.gettempdir(), "sushi", "sushi.db")
DEFAULT_SQLITE_URL = f"sqlite+aiosqlite:///{_DEFAULT_SQLITE_PATH}"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Supabase provides a connection pooler URL (port 6543) and a direct URL (port 5432).
# For async/migration work use the direct URL with asyncpg driver.
# Convert postgres:// -> postgresql+asyncpg:// if needed.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif not DATABASE_URL:
    DATABASE_URL = DEFAULT_SQLITE_URL

if DATABASE_URL.startswith("sqlite+aiosqlite:///"):
    sqlite_path = DATABASE_URL[len("sqlite+aiosqlite:///"):]
    if sqlite_path.startswith("./"):
        sqlite_path = sqlite_path[2:]
    sqlite_dir = os.path.dirname(sqlite_path)
    if sqlite_dir:
        try:
            os.makedirs(sqlite_dir, exist_ok=True)
        except OSError:
            pass

# NullPool everywhere: async connections are event-loop-bound, and background
# tasks / tests may run on a different loop than the request handlers. Fresh
# connections per checkout avoid cross-loop reuse bugs; the cost is negligible
# for SQLite and Postgres alike (Postgres deployments should use a pooler URL).
if DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
        poolclass=NullPool,
    )
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    if DATABASE_URL.startswith("sqlite"):
        # SQLite's default rollback-journal mode takes an exclusive lock for
        # the whole duration of a write, so two requests writing at once
        # (e.g. two concurrent analyses updating their Dataset rows) throw
        # "database is locked" instead of one just waiting briefly. WAL lets
        # readers and a writer coexist, and busy_timeout makes writer-vs-writer
        # contention retry for a few seconds instead of failing immediately.
        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()
else:
    engine = None  # type: ignore[assignment]
    AsyncSessionLocal = None  # type: ignore[assignment]


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session and closes it after the request."""
    if AsyncSessionLocal is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database not configured")
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
