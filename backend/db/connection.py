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

# NullPool is recommended for serverless / short-lived processes.
if DATABASE_URL:
    engine_kwargs = {
        "echo": False,
        "future": True,
    }
    if not DATABASE_URL.startswith("sqlite+"):
        engine_kwargs["poolclass"] = NullPool
    engine = create_async_engine(
        DATABASE_URL,
        **engine_kwargs,
    )
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )
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
