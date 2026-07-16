"""Conversations and messages router."""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import Conversation, Message
from services.agent_executor import ExecutionError, chat_reply

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])

PAGE_SIZE = 50


class ConversationCreate(BaseModel):
    title: str = Field(min_length=1)
    agent_id: uuid.UUID | None = None  # None = pipeline-level conversation
    task_id: uuid.UUID | None = None
    pipeline_id: uuid.UUID | None = None


class ConversationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_id: uuid.UUID | None
    task_id: uuid.UUID | None
    pipeline_id: uuid.UUID | None
    title: str
    last_message: str | None
    last_active: datetime | None
    created_at: datetime


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    conversation_id: uuid.UUID
    agent_id: uuid.UUID | None
    role: str
    content: str
    sender_agent_id: uuid.UUID | None
    gate_status: str | None
    input_tokens: int | None
    output_tokens: int | None
    cost_usd: Decimal | None
    created_at: datetime


class MessagePage(BaseModel):
    items: list[MessageOut]
    page: int
    page_size: int
    total: int


class SendMessageOut(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut | None = None
    # Set when the user message was saved but the agent reply failed
    # (e.g. no API key configured) — the client shows it as a toast.
    error: str | None = None


async def _get_conversation_or_404(conversation_id: uuid.UUID, db: AsyncSession) -> Conversation:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    agent_id: uuid.UUID | None = Query(default=None),
    pipeline_id: uuid.UUID | None = Query(default=None),
    task_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    query = select(Conversation).order_by(
        Conversation.last_active.desc().nulls_last(), Conversation.created_at.desc()
    )
    if agent_id is not None:
        query = query.where(Conversation.agent_id == agent_id)
    if pipeline_id is not None:
        query = query.where(Conversation.pipeline_id == pipeline_id)
    if task_id is not None:
        query = query.where(Conversation.task_id == task_id)
    rows = await db.execute(query)
    return list(rows.scalars().all())


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate, db: AsyncSession = Depends(get_db)
) -> Conversation:
    conversation = Conversation(**body.model_dump())
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    # Clean up stale empty general chats for this agent — task conversations
    # are excluded since a task's chat is expected to sit empty until used.
    if conversation.agent_id is not None:
        empty_ids = (
            await db.execute(
                select(Conversation.id)
                .outerjoin(Message, Message.conversation_id == Conversation.id)
                .where(
                    Conversation.agent_id == conversation.agent_id,
                    Conversation.task_id.is_(None),
                    Conversation.id != conversation.id,
                    Message.id.is_(None),
                )
            )
        ).scalars().all()
        if empty_ids:
            await db.execute(delete(Conversation).where(Conversation.id.in_(empty_ids)))
            await db.commit()

    return conversation


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> MessagePage:
    """Chronological messages, 50 per page (page 1 = oldest)."""
    await _get_conversation_or_404(conversation_id, db)
    total = (
        await db.execute(
            select(func.count()).select_from(Message).where(Message.conversation_id == conversation_id)
        )
    ).scalar_one()
    rows = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
    )
    return MessagePage(
        items=[MessageOut.model_validate(m) for m in rows.scalars().all()],
        page=page,
        page_size=PAGE_SIZE,
        total=int(total),
    )


@router.post("/{conversation_id}/messages", response_model=SendMessageOut, status_code=201)
async def add_user_message(
    conversation_id: uuid.UUID, body: MessageCreate, db: AsyncSession = Depends(get_db)
) -> SendMessageOut:
    """Persist the user message; for agent conversations, also run one LLM
    turn (chat_reply) and return the assistant message. Pipeline-level
    conversations (agent_id null) never auto-reply here — their traffic
    flows through the orchestrator + WebSocket."""
    conversation = await _get_conversation_or_404(conversation_id, db)
    message = Message(conversation_id=conversation_id, role="user", content=body.content)
    db.add(message)
    conversation.last_message = body.content[:300]
    conversation.last_active = datetime.now(timezone.utc)
    is_agent_conversation = conversation.agent_id is not None
    await db.commit()
    await db.refresh(message)
    user_out = MessageOut.model_validate(message)

    assistant_out: MessageOut | None = None
    error: str | None = None
    if is_agent_conversation:
        try:
            reply = await chat_reply(conversation_id)
            if reply is not None:
                assistant_out = MessageOut.model_validate(reply)
        except ExecutionError as exc:
            error = str(exc)
        except Exception as exc:  # the saved user message must survive reply failures
            logger.exception("chat_reply failed for conversation %s", conversation_id)
            error = f"Agent reply failed: {exc}"
    return SendMessageOut(user_message=user_out, assistant_message=assistant_out, error=error)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: uuid.UUID, body: ConversationUpdate, db: AsyncSession = Depends(get_db)
) -> Conversation:
    conversation = await _get_conversation_or_404(conversation_id, db)
    conversation.title = body.title
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    conversation = await _get_conversation_or_404(conversation_id, db)
    await db.delete(conversation)
    await db.commit()
