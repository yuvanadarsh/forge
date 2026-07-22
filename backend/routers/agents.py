"""Agents CRUD router.

tokens_used / cost_usd on responses are aggregated live from token_usage —
the time-series table is the single source of truth for spend analytics.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Agent, Pipeline, PipelineRun, TokenUsage

router = APIRouter(prefix="/agents", tags=["agents"])

ACTIVE_RUN_STATUSES = ("running", "paused_for_approval", "approved")


class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    role: str = Field(min_length=1)
    specialty: str = ""
    avatar_color: str = "#6366f1"
    model: str | None = None  # None -> DB default
    system_prompt: str = ""


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    role: str | None = Field(default=None, min_length=1)
    specialty: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    avatar_color: str | None = None


class AgentOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    role: str
    specialty: str
    avatar_color: str
    model: str
    system_prompt: str
    status: str
    is_eternal: bool = False
    last_active: datetime | None
    created_at: datetime
    tokens_used: int = 0
    cost_usd: float = 0.0


class UsageSummary(BaseModel):
    lifetime_tokens: int
    lifetime_cost_usd: float
    month_cost_usd: float
    avg_cost_per_day_usd: float


class AgentDetailOut(AgentOut):
    usage: UsageSummary


class AgentRunOut(BaseModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    pipeline_title: str
    status: str
    current_agent_index: int
    error: str | None
    started_at: datetime
    completed_at: datetime | None
    tokens: int = 0  # this agent's usage within the run
    cost_usd: float = 0.0


def _agent_out(agent: Agent, tokens: int | None, cost: float | None) -> AgentOut:
    out = AgentOut.model_validate(agent)
    out.tokens_used = int(tokens or 0)
    out.cost_usd = float(cost or 0)
    return out


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("", response_model=list[AgentOut])
async def list_agents(db: AsyncSession = Depends(get_db)) -> list[AgentOut]:
    usage = (
        select(
            TokenUsage.agent_id,
            func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens).label("tokens"),
            func.sum(TokenUsage.cost_usd).label("cost"),
        )
        .group_by(TokenUsage.agent_id)
        .subquery()
    )
    rows = await db.execute(
        select(Agent, usage.c.tokens, usage.c.cost)
        .outerjoin(usage, Agent.id == usage.c.agent_id)
        .order_by(Agent.created_at)
    )
    return [_agent_out(agent, tokens, cost) for agent, tokens, cost in rows.all()]


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(body: AgentCreate, db: AsyncSession = Depends(get_db)) -> AgentOut:
    agent = Agent(
        name=body.name,
        role=body.role,
        specialty=body.specialty,
        avatar_color=body.avatar_color,
        system_prompt=body.system_prompt,
    )
    if body.model is not None:
        agent.model = body.model
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return _agent_out(agent, 0, 0)


@router.get("/{agent_id}", response_model=AgentDetailOut)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> AgentDetailOut:
    agent = await _get_agent_or_404(agent_id, db)

    lifetime = (
        await db.execute(
            select(
                func.coalesce(func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens), 0),
                func.coalesce(func.sum(TokenUsage.cost_usd), 0),
            ).where(TokenUsage.agent_id == agent_id)
        )
    ).one()
    month_cost = (
        await db.execute(
            select(func.coalesce(func.sum(TokenUsage.cost_usd), 0)).where(
                TokenUsage.agent_id == agent_id,
                TokenUsage.recorded_at >= func.date_trunc("month", func.now()),
            )
        )
    ).scalar_one()

    created = agent.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    days_active = max((datetime.now(timezone.utc) - created).days, 1)

    out = AgentDetailOut(
        **_agent_out(agent, lifetime[0], lifetime[1]).model_dump(),
        usage=UsageSummary(
            lifetime_tokens=int(lifetime[0]),
            lifetime_cost_usd=float(lifetime[1]),
            month_cost_usd=float(month_cost),
            avg_cost_per_day_usd=float(lifetime[1]) / days_active,
        ),
    )
    return out


@router.get("/{agent_id}/runs", response_model=list[AgentRunOut])
async def list_agent_runs(
    agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[AgentRunOut]:
    """Runs of every pipeline whose agent_sequence includes this agent, newest first."""
    await _get_agent_or_404(agent_id, db)
    usage = (
        select(
            TokenUsage.pipeline_run_id,
            func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens).label("tokens"),
            func.sum(TokenUsage.cost_usd).label("cost"),
        )
        .where(TokenUsage.agent_id == agent_id)
        .group_by(TokenUsage.pipeline_run_id)
        .subquery()
    )
    rows = await db.execute(
        select(PipelineRun, Pipeline.title, usage.c.tokens, usage.c.cost)
        .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
        .outerjoin(usage, usage.c.pipeline_run_id == PipelineRun.id)
        .where(Pipeline.agent_sequence.contains([agent_id]))
        .order_by(PipelineRun.started_at.desc())
        .limit(50)
    )
    return [
        AgentRunOut(
            id=run.id,
            pipeline_id=run.pipeline_id,
            pipeline_title=title,
            status=run.status,
            current_agent_index=run.current_agent_index,
            error=run.error,
            started_at=run.started_at,
            completed_at=run.completed_at,
            tokens=int(tokens or 0),
            cost_usd=float(cost or 0),
        )
        for run, title, tokens, cost in rows.all()
    ]


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: uuid.UUID, body: AgentUpdate, db: AsyncSession = Depends(get_db)
) -> AgentOut:
    agent = await _get_agent_or_404(agent_id, db)
    if agent.is_eternal:
        raise HTTPException(
            status_code=403,
            detail=f"{agent.name} is an eternal agent — its configuration is permanent.",
        )
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)

    totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens), 0),
                func.coalesce(func.sum(TokenUsage.cost_usd), 0),
            ).where(TokenUsage.agent_id == agent_id)
        )
    ).one()
    return _agent_out(agent, totals[0], totals[1])


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    agent = await _get_agent_or_404(agent_id, db)
    if agent.is_eternal:
        raise HTTPException(
            status_code=403, detail=f"{agent.name} is an eternal agent and cannot be deleted."
        )

    active_runs = (
        await db.execute(
            select(func.count())
            .select_from(PipelineRun)
            .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
            .where(
                PipelineRun.status.in_(ACTIVE_RUN_STATUSES),
                Pipeline.agent_sequence.contains([agent_id]),
            )
        )
    ).scalar_one()
    if active_runs:
        raise HTTPException(
            status_code=409,
            detail=f"Agent has {active_runs} active pipeline run(s) — stop them before deleting",
        )

    await db.delete(agent)
    await db.commit()
