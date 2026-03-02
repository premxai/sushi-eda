"""
Async SQLAlchemy engine + session factory for Supabase (PostgreSQL).

Usage in FastAPI:
    from db import get_db
    async def my_route(db: AsyncSession = Depends(get_db)):
        ...
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Supabase provides a connection pooler URL (port 6543) and a direct URL (port 5432).
# For async/migration work use the direct URL with asyncpg driver.
# Convert postgres:// -> postgresql+asyncpg:// if needed.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# NullPool is recommended for serverless / short-lived processes.
# Switch to AsyncConnectionPool (asyncpg) for long-running servers.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # Set True to log all SQL (dev only)
    future=True,
    poolclass=NullPool,  # Safe default; override in production with pool settings
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
