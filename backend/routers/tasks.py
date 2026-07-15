"""Tasks CRUD router."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Task

router = APIRouter(prefix="/tasks", tags=["tasks"])

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


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
