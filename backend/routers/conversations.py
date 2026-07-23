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
from db.models import Agent, Conversation, Message, MessageImage, Pipeline
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


ALLOWED_IMAGE_MEDIA_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
# Base64 chars, ~7.5MB decoded — above Anthropic's 5MB/image API limit, so the
# provider stays the effective ceiling and this only blocks absurd payloads.
MAX_IMAGE_B64_CHARS = 10_000_000
MAX_IMAGES_PER_MESSAGE = 4


class ImageIn(BaseModel):
    data: str  # raw base64, no data: prefix
    media_type: str


class MessageCreate(BaseModel):
    # Empty content is allowed when an image is attached (image-only message).
    content: str = ""
    images: list[ImageIn] = Field(default_factory=list)
    # Legacy single-image fields — still accepted for older clients; written
    # into message_images like everything else (see add_user_message).
    image_data: str | None = None
    image_media_type: str | None = None


class MessageImageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    image_data: str
    media_type: str


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    conversation_id: uuid.UUID
    agent_id: uuid.UUID | None
    role: str
    content: str
    sender_agent_id: uuid.UUID | None
    gate_status: str | None
    # Legacy single-image columns — populated only on pre-009 rows.
    image_data: str | None
    image_media_type: str | None
    # New multi-image rows (migration 009), ordered by sort_order.
    images: list[MessageImageOut] = Field(default_factory=list)
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


async def _images_by_message(
    message_ids: list[uuid.UUID], db: AsyncSession
) -> dict[uuid.UUID, list[MessageImage]]:
    if not message_ids:
        return {}
    rows = await db.execute(
        select(MessageImage)
        .where(MessageImage.message_id.in_(message_ids))
        .order_by(MessageImage.sort_order)
    )
    by_message: dict[uuid.UUID, list[MessageImage]] = {}
    for image in rows.scalars().all():
        by_message.setdefault(image.message_id, []).append(image)
    return by_message


def _message_out(message: Message, images: list[MessageImage]) -> MessageOut:
    """Build the API shape for one message. Defensive against rows from a
    pre-008 install where the legacy image columns may not have loaded
    cleanly — image_data/image_media_type just fall back to None rather than
    failing the whole page."""
    try:
        legacy_data = message.image_data
        legacy_media_type = message.image_media_type
    except Exception:
        logger.exception("Could not read legacy image columns for message %s", message.id)
        legacy_data = None
        legacy_media_type = None
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        agent_id=message.agent_id,
        role=message.role,
        content=message.content,
        sender_agent_id=message.sender_agent_id,
        gate_status=message.gate_status,
        image_data=legacy_data,
        image_media_type=legacy_media_type,
        images=[
            MessageImageOut(id=i.id, image_data=i.image_data, media_type=i.media_type)
            for i in images
        ],
        input_tokens=message.input_tokens,
        output_tokens=message.output_tokens,
        cost_usd=message.cost_usd,
        created_at=message.created_at,
    )


async def _pipeline_reply_agent(
    conversation: Conversation, content: str, db: AsyncSession
) -> uuid.UUID | None:
    """Pick the agent that should answer a pipeline conversation message.

    Only finished pipelines (completed/failed) chat here — while a run is
    active, traffic flows through the orchestrator + WebSocket instead.
    The @mentioned participant wins (earliest mention in the message);
    otherwise the last agent who spoke; otherwise the last agent in the
    sequence.
    """
    if conversation.pipeline_id is None:
        return None
    pipeline = await db.get(Pipeline, conversation.pipeline_id)
    if pipeline is None or pipeline.status not in ("completed", "failed"):
        return None
    sequence = pipeline.agent_sequence or []
    if not sequence:
        return None

    agents = (
        await db.execute(select(Agent).where(Agent.id.in_(sequence)))
    ).scalars().all()
    lowered = content.lower()
    mentioned: tuple[int, uuid.UUID] | None = None
    for agent in agents:
        pos = lowered.find(f"@{agent.name.lower()}")
        if pos != -1 and (mentioned is None or pos < mentioned[0]):
            mentioned = (pos, agent.id)
    if mentioned is not None:
        return mentioned[1]

    last_speaker = (
        await db.execute(
            select(Message.agent_id)
            .where(
                Message.conversation_id == conversation.id,
                Message.role == "assistant",
                Message.agent_id.is_not(None),
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last_speaker is not None:
        return last_speaker
    return sequence[-1]


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
    page_messages = list(rows.scalars().all())
    images_by_message = await _images_by_message([m.id for m in page_messages], db)

    items: list[MessageOut] = []
    for m in page_messages:
        try:
            items.append(_message_out(m, images_by_message.get(m.id, [])))
        except Exception:
            logger.exception("Failed to serialize message %s — using placeholder", m.id)
            try:
                items.append(
                    MessageOut(
                        id=m.id,
                        conversation_id=conversation_id,
                        agent_id=m.agent_id,
                        role="system",
                        content="[Message unavailable — format updated]",
                        sender_agent_id=None,
                        gate_status=None,
                        image_data=None,
                        image_media_type=None,
                        images=[],
                        input_tokens=None,
                        output_tokens=None,
                        cost_usd=None,
                        created_at=m.created_at,
                    )
                )
            except Exception:
                logger.exception("Placeholder serialization also failed for message %s — skipping", m.id)

    return MessagePage(
        items=items,
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
    conversations (agent_id null) auto-reply only once the pipeline is
    finished (completed/failed) — the @mentioned agent answers, else the
    last agent who spoke. While a run is active their traffic flows
    through the orchestrator + WebSocket instead."""
    conversation = await _get_conversation_or_404(conversation_id, db)

    # Legacy single-image field folds into the images list so both old and
    # new clients land in the same message_images write path.
    images = list(body.images)
    if body.image_data is not None:
        images = [ImageIn(data=body.image_data, media_type=body.image_media_type or "")] + images

    if not body.content.strip() and not images:
        raise HTTPException(status_code=422, detail="Message needs text or an image")
    if len(images) > MAX_IMAGES_PER_MESSAGE:
        raise HTTPException(
            status_code=422, detail=f"Too many images (max {MAX_IMAGES_PER_MESSAGE} per message)"
        )
    for image in images:
        if image.media_type not in ALLOWED_IMAGE_MEDIA_TYPES:
            raise HTTPException(
                status_code=422,
                detail="Unsupported image type — use PNG, JPEG, GIF, or WebP",
            )
        if len(image.data) > MAX_IMAGE_B64_CHARS:
            raise HTTPException(status_code=413, detail="Image too large (max ~5MB per image)")

    message = Message(conversation_id=conversation_id, role="user", content=body.content)
    db.add(message)
    await db.flush()  # assign message.id for the MessageImage rows below

    message_images = [
        MessageImage(
            message_id=message.id,
            image_data=image.data,
            media_type=image.media_type,
            sort_order=idx,
        )
        for idx, image in enumerate(images)
    ]
    for mi in message_images:
        db.add(mi)

    if not images:
        preview = body.content
    elif len(images) == 1:
        preview = body.content or "📷 Image"
    else:
        preview = body.content or f"📷 {len(images)} images"
    conversation.last_message = preview[:300]
    conversation.last_active = datetime.now(timezone.utc)
    is_agent_conversation = conversation.agent_id is not None
    pipeline_agent_id: uuid.UUID | None = None
    if not is_agent_conversation:
        pipeline_agent_id = await _pipeline_reply_agent(conversation, body.content, db)
    await db.commit()
    await db.refresh(message)
    user_out = _message_out(message, message_images)

    assistant_out: MessageOut | None = None
    error: str | None = None
    if is_agent_conversation or pipeline_agent_id is not None:
        try:
            reply = await chat_reply(conversation_id, agent_id=pipeline_agent_id)
            if reply is not None:
                assistant_out = _message_out(reply, [])
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
