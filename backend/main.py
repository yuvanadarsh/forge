"""Forge backend — FastAPI entry point.

Serves the REST API under /api, a health check at /health, and the
per-pipeline-run WebSocket stream at /ws/pipeline/{pipeline_run_id}.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

load_dotenv()

# Uvicorn configures its OWN loggers ("uvicorn", "uvicorn.access", ...) — it
# never touches the root logger. Every app module calls
# logging.getLogger(__name__) but nothing ever configured a handler on the
# root logger, so INFO/DEBUG records were silently dropped (below the
# level Python's handler-less "last resort" fallback emits) and even
# WARNING/ERROR only reached stderr by accident. This must run before the
# app modules below are imported, since some log at import time.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)

from db.connection import dispose_engine, get_session_factory, init_engine  # noqa: E402
from routers import (  # noqa: E402
    agents,
    analytics,
    conversations,
    notifications,
    pipelines,
    settings,
    tasks,
)
from services.streaming import streaming_manager  # noqa: E402

logger = logging.getLogger(__name__)

# Resolved against this file so the seed runs regardless of the process CWD
# (uvicorn from repo root, Docker WORKDIR, etc).
SEEDS_DIR = Path(__file__).resolve().parent / "db" / "seeds"


async def run_seeds() -> None:
    """Apply idempotent seed files (eternal agents) on every startup.

    Each seed file must hold exactly one statement — asyncpg rejects
    multi-statement strings in a single execute.
    """
    factory = get_session_factory()
    async with factory() as db:
        for seed_file in sorted(SEEDS_DIR.glob("*.sql")):
            await db.execute(text(seed_file.read_text()))
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create the async engine and verify connectivity.
    # A missing/down database logs a loud warning instead of crashing so
    # /health stays available while the DB is being provisioned.
    await init_engine()
    try:
        await run_seeds()
    except Exception as exc:
        # Non-fatal, same philosophy as init_engine: keep /health up. The
        # usual cause is unapplied migrations (is_eternal column missing).
        logger.warning(
            "Startup seeds failed (%s). Apply backend/db/migrations/ in order "
            "and restart to seed the eternal agents.",
            exc,
        )
    yield
    await dispose_engine()


app = FastAPI(title="Forge API", version="0.1.0", lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "http://localhost:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api")
app.include_router(pipelines.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/pipeline/{pipeline_run_id}")
async def pipeline_ws(websocket: WebSocket, pipeline_run_id: str) -> None:
    """One connection per active pipeline run; server → client push only."""
    await streaming_manager.connect(pipeline_run_id, websocket)
    try:
        while True:
            # Client → server frames are ignored (keepalive only); all data
            # flows outward through streaming_manager.
            await websocket.receive_text()
    except WebSocketDisconnect:
        streaming_manager.disconnect(pipeline_run_id)
