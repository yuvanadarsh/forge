"""Pipelines router — CRUD, approval, gate resume, and run management."""

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Agent, Conversation, Message, Pipeline, PipelineRun, Settings
from services.orchestrator import start_pipeline_run
from services.planner import generate_execution_plan, suggest_and_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

ACTIVE_RUN_STATUSES = ("running", "paused_for_approval", "approved")

# Strong references so background jobs (runs, plan generation) aren't
# garbage-collected mid-flight.
_running_pipelines: set[asyncio.Task] = set()


def _spawn_background(coro) -> None:
    job = asyncio.create_task(coro)
    _running_pipelines.add(job)
    job.add_done_callback(_running_pipelines.discard)


class PipelineCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    # Empty is allowed only with auto_suggest — auto-plan fills the sequence.
    agent_sequence: list[uuid.UUID] = Field(default_factory=list)
    plan_md: str = ""
    workspace_path: str | None = None  # None -> settings.workspace_root/<folder_name or slug>
    folder_name: str | None = None  # workspace folder name; falls back to a slug of title
    created_by: uuid.UUID | None = None
    auto_suggest: bool = False
    # None = use global Settings; 'full_auto' | 'supervised' | 'strict' overrides
    # terminal_execution/strict_mode for this pipeline only (see orchestrator.py).
    execution_mode: str | None = None


class PipelineOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str
    status: str
    agent_sequence: list[uuid.UUID]
    created_by: uuid.UUID | None
    plan_md: str
    suggestion_reasoning: str | None = None
    workspace_path: str
    execution_mode: str | None = None
    approved_at: datetime | None
    archived_at: datetime | None = None
    created_at: datetime


class RunOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    pipeline_id: uuid.UUID
    status: str
    langgraph_thread_id: str
    current_agent_id: uuid.UUID | None
    current_agent_index: int
    error: str | None
    started_at: datetime
    completed_at: datetime | None


class PipelineDetailOut(PipelineOut):
    current_run: RunOut | None = None


class PipelineUpdate(BaseModel):
    status: str | None = None


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "pipeline"


async def _get_pipeline_or_404(pipeline_id: uuid.UUID, db: AsyncSession) -> Pipeline:
    pipeline = await db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.get("", response_model=list[PipelineOut])
async def list_pipelines(db: AsyncSession = Depends(get_db)) -> list[Pipeline]:
    rows = await db.execute(select(Pipeline).order_by(Pipeline.created_at.desc()))
    return list(rows.scalars().all())


VALID_EXECUTION_MODES = {"full_auto", "supervised", "strict"}


@router.post("", response_model=PipelineOut, status_code=201)
async def create_pipeline(body: PipelineCreate, db: AsyncSession = Depends(get_db)) -> Pipeline:
    if body.execution_mode is not None and body.execution_mode not in VALID_EXECUTION_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"execution_mode must be one of {sorted(VALID_EXECUTION_MODES)} or omitted",
        )
    if body.auto_suggest:
        agent_sequence: list[uuid.UUID] = []  # auto-plan fills this in the background
    else:
        if not body.agent_sequence:
            raise HTTPException(
                status_code=400,
                detail="agent_sequence must have at least one agent unless auto_suggest is set",
            )
        known = (
            await db.execute(select(Agent.id).where(Agent.id.in_(body.agent_sequence)))
        ).scalars().all()
        missing = set(body.agent_sequence) - set(known)
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Unknown agent ids: {sorted(map(str, missing))}"
            )
        agent_sequence = body.agent_sequence

    workspace_path = body.workspace_path
    if not workspace_path:
        settings = (await db.execute(select(Settings))).scalar_one_or_none()
        root = settings.workspace_root if settings else "~/forge-workspace"
        folder = _slug(body.folder_name) if body.folder_name else _slug(body.title)
        workspace_path = os.path.join(os.path.expanduser(root), folder)
    else:
        workspace_path = os.path.expanduser(workspace_path)
    os.makedirs(workspace_path, exist_ok=True)

    pipeline = Pipeline(
        title=body.title,
        description=body.description,
        agent_sequence=agent_sequence,
        created_by=body.created_by,
        plan_md=body.plan_md,
        workspace_path=workspace_path,
        execution_mode=body.execution_mode,
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)

    # Background follow-ups; the frontend polls GET /api/pipelines/{id} until
    # plan_md is populated, and both flows always terminate in a non-empty plan.
    # auto_suggest: the planner picks the sequence (Atlas creates gaps), then
    # plans. Otherwise, an empty plan gets drafted by the best available agent.
    if body.auto_suggest:
        _spawn_background(suggest_and_plan(pipeline.id))
    elif not pipeline.plan_md.strip():
        _spawn_background(generate_execution_plan(pipeline.id))
    return pipeline


@router.get("/{pipeline_id}", response_model=PipelineDetailOut)
async def get_pipeline(
    pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> PipelineDetailOut:
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    latest_run = (
        await db.execute(
            select(PipelineRun)
            .where(PipelineRun.pipeline_id == pipeline_id)
            .order_by(PipelineRun.started_at.desc())
            .limit(1)
        )
    ).scalars().first()
    detail = PipelineDetailOut.model_validate(pipeline)
    detail.current_run = RunOut.model_validate(latest_run) if latest_run else None
    return detail


@router.post("/{pipeline_id}/approve", response_model=RunOut, status_code=201)
async def approve_pipeline(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> RunOut:
    """Approve a pending pipeline and start executing it in the background."""
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    if pipeline.status not in ("pending_approval", "failed", "completed"):
        raise HTTPException(
            status_code=409, detail=f"Pipeline is {pipeline.status} — cannot start a new run"
        )
    if not pipeline.agent_sequence or not pipeline.plan_md.strip():
        raise HTTPException(
            status_code=409,
            detail="Cannot approve — the execution plan is still generating. Wait for planning to finish before approving.",
        )

    pipeline.status = "approved"
    pipeline.approved_at = datetime.now(timezone.utc)
    run = PipelineRun(
        pipeline_id=pipeline.id,
        status="running",
        langgraph_thread_id=str(uuid.uuid4()),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    _spawn_background(start_pipeline_run(run.id))
    return RunOut.model_validate(run)


@router.post("/{pipeline_id}/runs/{run_id}/approve-gate", response_model=RunOut)
async def approve_gate(
    pipeline_id: uuid.UUID, run_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> RunOut:
    """Resume a run paused at an approval gate (phase boundary or command)."""
    run = await db.get(PipelineRun, run_id)
    if run is None or run.pipeline_id != pipeline_id:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    if run.status != "paused_for_approval":
        raise HTTPException(status_code=409, detail=f"Run is {run.status}, not awaiting approval")

    # 'approved' is the transient resume signal the orchestrator/executor
    # pollers watch for; they flip it back to 'running'. Pending gate
    # messages in the pipeline conversation are marked approved here so the
    # chat UI updates immediately.
    run.status = "approved"
    conversation_ids = select(Conversation.id).where(Conversation.pipeline_id == pipeline_id)
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id.in_(conversation_ids),
            Message.role == "approval_gate",
            Message.gate_status == "pending",
        )
        .values(gate_status="approved")
    )
    await db.commit()
    await db.refresh(run)
    logger.info(
        "Gate: approve-gate flipped run %s to 'approved' (pipeline %s)", run.id, pipeline_id
    )
    return RunOut.model_validate(run)


async def _active_run_count(pipeline_id: uuid.UUID, db: AsyncSession) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(PipelineRun)
            .where(
                PipelineRun.pipeline_id == pipeline_id,
                PipelineRun.status.in_(ACTIVE_RUN_STATUSES),
            )
        )
    ).scalar_one()


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a pipeline and (via FK cascades) its runs, conversations and
    messages. Tasks and token_usage survive with their pipeline refs nulled."""
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    if await _active_run_count(pipeline_id, db):
        raise HTTPException(
            status_code=409, detail="Cannot delete a running pipeline. Stop it first."
        )
    await db.delete(pipeline)
    await db.commit()


@router.patch("/{pipeline_id}/archive", response_model=PipelineOut)
async def archive_pipeline(
    pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Pipeline:
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    if await _active_run_count(pipeline_id, db):
        raise HTTPException(
            status_code=409, detail="Cannot archive a running pipeline. Stop it first."
        )
    pipeline.status = "archived"
    pipeline.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.patch("/{pipeline_id}", response_model=PipelineOut)
async def update_pipeline(
    pipeline_id: uuid.UUID, body: PipelineUpdate, db: AsyncSession = Depends(get_db)
) -> Pipeline:
    """Generic status transitions. Today only used to restore an archived
    pipeline back to pending_approval."""
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    if body.status is None:
        return pipeline
    if body.status == "pending_approval":
        if pipeline.status != "archived":
            raise HTTPException(
                status_code=409, detail="Only archived pipelines can be restored"
            )
        pipeline.status = "pending_approval"
        pipeline.archived_at = None
    else:
        raise HTTPException(
            status_code=400, detail=f"Unsupported status transition to {body.status!r}"
        )
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.patch("/{pipeline_id}/stop", response_model=PipelineOut)
async def stop_pipeline(
    pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Pipeline:
    """Force-stop a pipeline stuck in an active run — a safety valve, not for
    normal use. Marks the current run and the pipeline itself as failed."""
    pipeline = await _get_pipeline_or_404(pipeline_id, db)
    if pipeline.status not in ACTIVE_RUN_STATUSES:
        raise HTTPException(
            status_code=409, detail=f"Pipeline is {pipeline.status}, not running"
        )

    run = (
        await db.execute(
            select(PipelineRun)
            .where(
                PipelineRun.pipeline_id == pipeline_id,
                PipelineRun.status.in_(ACTIVE_RUN_STATUSES),
            )
            .order_by(PipelineRun.started_at.desc())
            .limit(1)
        )
    ).scalars().first()
    if run is not None:
        run.status = "failed"
        run.error = "Manually stopped by user"
        run.completed_at = datetime.now(timezone.utc)

    pipeline.status = "failed"
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.get("/{pipeline_id}/runs", response_model=list[RunOut])
async def list_runs(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[PipelineRun]:
    await _get_pipeline_or_404(pipeline_id, db)
    rows = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.pipeline_id == pipeline_id)
        .order_by(PipelineRun.started_at.desc())
    )
    return list(rows.scalars().all())
