"""Pipelines router — CRUD, approval, gate resume, and run management."""

import asyncio
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

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

# Strong references so background pipeline runs aren't garbage-collected.
_running_pipelines: set[asyncio.Task] = set()


class PipelineCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    agent_sequence: list[uuid.UUID] = Field(min_length=1)
    plan_md: str = ""
    workspace_path: str | None = None  # None -> settings.workspace_root/<slug>
    created_by: uuid.UUID | None = None


class PipelineOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str
    status: str
    agent_sequence: list[uuid.UUID]
    created_by: uuid.UUID | None
    plan_md: str
    workspace_path: str
    approved_at: datetime | None
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


@router.post("", response_model=PipelineOut, status_code=201)
async def create_pipeline(body: PipelineCreate, db: AsyncSession = Depends(get_db)) -> Pipeline:
    known = (
        await db.execute(select(Agent.id).where(Agent.id.in_(body.agent_sequence)))
    ).scalars().all()
    missing = set(body.agent_sequence) - set(known)
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown agent ids: {sorted(map(str, missing))}")

    workspace_path = body.workspace_path
    if not workspace_path:
        settings = (await db.execute(select(Settings))).scalar_one_or_none()
        root = settings.workspace_root if settings else "~/forge-workspace"
        workspace_path = os.path.join(os.path.expanduser(root), _slug(body.title))
    else:
        workspace_path = os.path.expanduser(workspace_path)
    os.makedirs(workspace_path, exist_ok=True)

    pipeline = Pipeline(
        title=body.title,
        description=body.description,
        agent_sequence=body.agent_sequence,
        created_by=body.created_by,
        plan_md=body.plan_md,
        workspace_path=workspace_path,
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
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

    task = asyncio.create_task(start_pipeline_run(run.id))
    _running_pipelines.add(task)
    task.add_done_callback(_running_pipelines.discard)
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
    return RunOut.model_validate(run)


@router.get("/{pipeline_id}/runs", response_model=list[RunOut])
async def list_runs(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[PipelineRun]:
    await _get_pipeline_or_404(pipeline_id, db)
    rows = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.pipeline_id == pipeline_id)
        .order_by(PipelineRun.started_at.desc())
    )
    return list(rows.scalars().all())
