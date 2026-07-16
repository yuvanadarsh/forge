"""Tasks CRUD router + single-agent task execution."""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Agent, Conversation, Message, Task
from services.agent_executor import run_task_agent

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Strong references so background task runs aren't garbage-collected
# (same pattern as the pipelines router), plus the ids currently executing
# so a double-click can't start the same task twice.
_running_task_jobs: set[asyncio.Task] = set()
_active_task_ids: set[uuid.UUID] = set()

TaskStatus = Literal["backlog", "in_progress", "review", "completed"]
TaskPriority = Literal["low", "med", "high", "urgent"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    assigned_to: uuid.UUID | None = None
    priority: TaskPriority = "med"
    status: TaskStatus = "backlog"
    pipeline_id: uuid.UUID | None = None
    created_from_chat: bool = False


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assigned_to: uuid.UUID | None = None


class TaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str
    assigned_to: uuid.UUID | None
    priority: str
    status: str
    pipeline_id: uuid.UUID | None
    created_from_chat: bool
    created_at: datetime


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status: TaskStatus | None = Query(default=None),
    agent_id: uuid.UUID | None = Query(default=None),
    pipeline_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[Task]:
    query = select(Task).order_by(Task.created_at.desc())
    if status is not None:
        query = query.where(Task.status == status)
    if agent_id is not None:
        query = query.where(Task.assigned_to == agent_id)
    if pipeline_id is not None:
        query = query.where(Task.pipeline_id == pipeline_id)
    rows = await db.execute(query)
    return list(rows.scalars().all())


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(body: TaskCreate, db: AsyncSession = Depends(get_db)) -> Task:
    task = Task(**body.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID, body: TaskUpdate, db: AsyncSession = Depends(get_db)
) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    return task


class TaskRunOut(BaseModel):
    conversation_id: uuid.UUID
    task_id: uuid.UUID
    status: Literal["running"] = "running"


@router.post("/{task_id}/run", response_model=TaskRunOut, status_code=202)
async def run_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> TaskRunOut:
    """Execute the task's assigned agent in the background.

    Returns immediately; the caller watches progress in the task's
    conversation. Reuses the task's existing conversation with that agent,
    creating one when none exists.
    """
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to is None:
        raise HTTPException(status_code=400, detail="Task has no assigned agent — assign one before running")
    agent = await db.get(Agent, task.assigned_to)
    if agent is None:
        raise HTTPException(status_code=400, detail="Assigned agent no longer exists")
    if task_id in _active_task_ids:
        raise HTTPException(status_code=409, detail="This task is already running")

    conversation = (
        await db.execute(
            select(Conversation)
            .where(Conversation.task_id == task_id, Conversation.agent_id == agent.id)
            .order_by(Conversation.created_at)
        )
    ).scalars().first()
    if conversation is None:
        conversation = Conversation(agent_id=agent.id, task_id=task.id, title=task.title)
        db.add(conversation)
        await db.flush()

    prompt = task.description.strip() or task.title
    db.add(Message(conversation_id=conversation.id, role="user", content=prompt))
    conversation.last_message = prompt[:300]
    conversation.last_active = datetime.now(timezone.utc)
    task.status = "in_progress"
    await db.commit()

    _active_task_ids.add(task_id)
    job = asyncio.create_task(run_task_agent(task_id, conversation.id))
    _running_task_jobs.add(job)

    def _cleanup(finished: asyncio.Task, tid: uuid.UUID = task_id) -> None:
        _running_task_jobs.discard(finished)
        _active_task_ids.discard(tid)

    job.add_done_callback(_cleanup)
    return TaskRunOut(conversation_id=conversation.id, task_id=task_id)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
