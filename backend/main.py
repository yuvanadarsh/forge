"""Forge backend — FastAPI entry point.

Serves the REST API under /api, a health check at /health, and the
per-pipeline-run WebSocket stream at /ws/pipeline/{pipeline_run_id}.
"""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from db.connection import dispose_engine, init_engine  # noqa: E402
from routers import (  # noqa: E402
    agents,
    conversations,
    notifications,
    pipelines,
    settings,
    tasks,
)
from services.streaming import streaming_manager  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create the async engine and verify connectivity.
    # A missing/down database logs a loud warning instead of crashing so
    # /health stays available while the DB is being provisioned.
    await init_engine()
    yield
    await dispose_engine()


app = FastAPI(title="Forge API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
