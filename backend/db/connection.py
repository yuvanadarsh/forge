"""Async SQLAlchemy engine, session factory, and FastAPI dependency."""

import logging
import os
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://localhost:5432/forge"
)

engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


async def init_engine() -> AsyncEngine:
    """Create the global async engine + session factory and verify connectivity."""
    global engine, _session_factory
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection verified: %s", engine.url.render_as_string(hide_password=True))
    except Exception as exc:  # pragma: no cover - depends on local env
        # Deliberate: keep the API (and /health) up while the DB is being
        # provisioned, but make the failure impossible to miss in logs.
        logger.warning("DATABASE UNAVAILABLE at startup (%s). API is up but DB-backed routes will fail until it is reachable.", exc)
    return engine


async def dispose_engine() -> None:
    global engine, _session_factory
    if engine is not None:
        await engine.dispose()
        engine = None
        _session_factory = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """For code that needs sessions outside a request scope (orchestrator, executor)."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized — init_engine() must run first")
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, committed by the route."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
