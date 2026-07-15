"""Analytics endpoints over the token_usage time-series table.

Buckets are keyed by ISO-8601 timestamps (date_trunc output); the frontend
formats display labels from them. Empty buckets are omitted — the client
zero-fills the range it renders.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import TokenUsage

router = APIRouter(tags=["analytics"])

# interval -> (date_trunc unit, lookback window; None = unbounded)
USAGE_WINDOWS: dict[str, tuple[str, timedelta | None]] = {
    "day": ("hour", timedelta(hours=24)),
    "week": ("day", timedelta(days=7)),
    "month": ("week", timedelta(days=31)),
    "year": ("month", timedelta(days=366)),
    "all": ("month", None),
}

UsageInterval = Literal["day", "week", "month", "all"]
CostInterval = Literal["day", "week", "month", "year", "all"]


class UsagePoint(BaseModel):
    bucket: str  # ISO-8601 bucket start
    tokens: int
    input_tokens: int
    output_tokens: int
    cost_usd: float


class UsageSeries(BaseModel):
    interval: str
    points: list[UsagePoint]


class ModelSlice(BaseModel):
    provider: str
    model: str
    cost: float
    input_tokens: int
    output_tokens: int


class CostBucket(BaseModel):
    label: str  # ISO-8601 bucket start
    models: list[ModelSlice]


class CostAnalytics(BaseModel):
    buckets: list[CostBucket]


@router.get("/token-usage", response_model=UsageSeries)
async def token_usage_series(
    agent_id: uuid.UUID | None = Query(default=None),
    interval: UsageInterval = Query(default="week"),
    db: AsyncSession = Depends(get_db),
) -> UsageSeries:
    unit, window = USAGE_WINDOWS[interval]
    bucket = func.date_trunc(unit, TokenUsage.recorded_at).label("bucket")
    query = (
        select(
            bucket,
            func.sum(TokenUsage.input_tokens).label("inp"),
            func.sum(TokenUsage.output_tokens).label("out"),
            func.sum(TokenUsage.cost_usd).label("cost"),
        )
        .group_by(bucket)
        .order_by(bucket)
    )
    if agent_id is not None:
        query = query.where(TokenUsage.agent_id == agent_id)
    if window is not None:
        query = query.where(TokenUsage.recorded_at >= datetime.now(timezone.utc) - window)

    rows = await db.execute(query)
    points = [
        UsagePoint(
            bucket=b.isoformat(),
            tokens=int(inp or 0) + int(out or 0),
            input_tokens=int(inp or 0),
            output_tokens=int(out or 0),
            cost_usd=float(cost or 0),
        )
        for b, inp, out, cost in rows.all()
    ]
    return UsageSeries(interval=interval, points=points)


@router.get("/analytics/cost", response_model=CostAnalytics)
async def cost_analytics(
    interval: CostInterval = Query(default="week"),
    providers: str | None = Query(default=None, description="comma-separated provider filter"),
    db: AsyncSession = Depends(get_db),
) -> CostAnalytics:
    unit, window = USAGE_WINDOWS[interval]
    bucket = func.date_trunc(unit, TokenUsage.recorded_at).label("bucket")
    query = (
        select(
            bucket,
            TokenUsage.provider,
            TokenUsage.model,
            func.sum(TokenUsage.cost_usd).label("cost"),
            func.sum(TokenUsage.input_tokens).label("inp"),
            func.sum(TokenUsage.output_tokens).label("out"),
        )
        .group_by(bucket, TokenUsage.provider, TokenUsage.model)
        .order_by(bucket)
    )
    if providers:
        wanted = [p.strip().lower() for p in providers.split(",") if p.strip()]
        if wanted:
            query = query.where(func.lower(TokenUsage.provider).in_(wanted))
    if window is not None:
        query = query.where(TokenUsage.recorded_at >= datetime.now(timezone.utc) - window)

    buckets: dict[str, list[ModelSlice]] = {}
    for b, provider, model, cost, inp, out in (await db.execute(query)).all():
        buckets.setdefault(b.isoformat(), []).append(
            ModelSlice(
                provider=provider,
                model=model,
                cost=float(cost or 0),
                input_tokens=int(inp or 0),
                output_tokens=int(out or 0),
            )
        )
    return CostAnalytics(
        buckets=[CostBucket(label=label, models=models) for label, models in buckets.items()]
    )
