"""Async SQLAlchemy engine lifecycle.

Session factory and the get_db() FastAPI dependency are added with the
database models group of this session.
"""

import logging
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://localhost:5432/forge"
)

engine: AsyncEngine | None = None


async def init_engine() -> AsyncEngine:
    """Create the global async engine and verify connectivity."""
    global engine
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
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
    global engine
    if engine is not None:
        await engine.dispose()
        engine = None
