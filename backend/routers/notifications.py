"""Notifications router."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    type: str
    title: str
    body: str
    link: str | None
    read: bool
    created_at: datetime


@router.get("", response_model=list[NotificationOut])
async def list_notifications(db: AsyncSession = Depends(get_db)) -> list[Notification]:
    """All notifications, unread first, newest within each group."""
    rows = await db.execute(
        select(Notification).order_by(Notification.read, Notification.created_at.desc())
    )
    return list(rows.scalars().all())


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Notification:
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)) -> dict[str, int]:
    result = await db.execute(
        update(Notification).where(Notification.read.is_(False)).values(read=True)
    )
    await db.commit()
    return {"marked_read": result.rowcount or 0}


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notification)
    await db.commit()
