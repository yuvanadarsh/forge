"""SQLAlchemy 2.0 async ORM models — mirror of migrations/001_initial.sql.

The SQL migration is the schema source of truth; these models exist for
typed application queries (no metadata.create_all at runtime).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # Every column in the migration is TIMESTAMPTZ; without this map,
    # Mapped[datetime] binds as naive TIMESTAMP and asyncpg rejects
    # timezone-aware values.
    type_annotation_map = {datetime: DateTime(timezone=True)}


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    specialty: Mapped[str] = mapped_column(Text, server_default=text("''"))
    avatar_color: Mapped[str] = mapped_column(Text, server_default=text("'#6366f1'"))
    model: Mapped[str] = mapped_column(Text, server_default=text("'claude-sonnet-4-5'"))
    system_prompt: Mapped[str] = mapped_column(Text, server_default=text("''"))
    status: Mapped[str] = mapped_column(Text, server_default=text("'idle'"))
    is_eternal: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    last_active: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    provider: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str | None] = mapped_column(Text)
    encrypted_key: Mapped[str] = mapped_column(Text)
    key_last4: Mapped[str] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, server_default=text("1"))
    terminal_execution: Mapped[str] = mapped_column(Text, server_default=text("'request_review'"))
    strict_mode: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    allowed_commands: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    denied_commands: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    default_model: Mapped[str] = mapped_column(Text, server_default=text("'claude-sonnet-4-5'"))
    embedding_model: Mapped[str] = mapped_column(
        Text, server_default=text("'all-MiniLM-L6-v2'")
    )
    workspace_root: Mapped[str] = mapped_column(Text, server_default=text("'~/forge-workspace'"))
    global_rules: Mapped[str] = mapped_column(Text, server_default=text("''"))
    max_run_cost: Mapped[Decimal] = mapped_column(Numeric(8, 2), server_default=text("5.00"))
    max_agent_cost: Mapped[Decimal] = mapped_column(Numeric(8, 2), server_default=text("2.00"))
    max_daily_cost: Mapped[Decimal] = mapped_column(Numeric(8, 2), server_default=text("20.00"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default=text("''"))
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending_approval'"))
    agent_sequence: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), server_default=text("'{}'")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    plan_md: Mapped[str] = mapped_column(Text, server_default=text("''"))
    suggestion_reasoning: Mapped[str | None] = mapped_column(Text)
    workspace_path: Mapped[str] = mapped_column(Text)
    # None = use global settings; 'full_auto' | 'supervised' | 'strict' overrides
    # Settings.terminal_execution / Settings.strict_mode for this pipeline only.
    execution_mode: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    approved_at: Mapped[datetime | None] = mapped_column()
    archived_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(Text, server_default=text("'running'"))
    langgraph_thread_id: Mapped[str] = mapped_column(Text)
    current_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    current_agent_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    completed_at: Mapped[datetime | None] = mapped_column()


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default=text("''"))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    priority: Mapped[str] = mapped_column(Text, server_default=text("'med'"))
    status: Mapped[str] = mapped_column(Text, server_default=text("'backlog'"))
    pipeline_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipelines.id", ondelete="SET NULL")
    )
    created_from_chat: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE")
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL")
    )
    pipeline_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(Text)
    last_message: Mapped[str | None] = mapped_column(Text)
    last_active: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    role: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, server_default=text("''"))
    sender_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    gate_status: Mapped[str | None] = mapped_column(Text)
    # One optional image attachment: raw base64 (no data: prefix) + MIME type.
    # Legacy single-image columns — kept for messages written before the
    # message_images table existed (migration 009); new messages use
    # message_images instead. Explicit default=None so rows from
    # pre-008 installs (before this column existed) still construct cleanly.
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    image_media_type: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class MessageImage(Base):
    """Up to 4 images per message (migration 009). Queried explicitly by
    message_id — no relationship() is declared, matching this file's existing
    convention of plain selects over ORM relationships."""

    __tablename__ = "message_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE")
    )
    image_data: Mapped[str] = mapped_column(Text)
    media_type: Mapped[str] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class TokenUsage(Base):
    __tablename__ = "token_usage"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE")
    )
    pipeline_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="SET NULL")
    )
    provider: Mapped[str] = mapped_column(Text, server_default=text("'anthropic'"))
    model: Mapped[str] = mapped_column(Text)
    input_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    output_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), server_default=text("0"))
    recorded_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class FileAccessLog(Base):
    __tablename__ = "file_access_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    pipeline_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE")
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    path: Mapped[str] = mapped_column(Text)
    operation: Mapped[str] = mapped_column(Text)
    bytes: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class CommandLog(Base):
    __tablename__ = "command_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    pipeline_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE")
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL")
    )
    command: Mapped[str] = mapped_column(Text)
    output: Mapped[str | None] = mapped_column(Text)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class AgentMemory(Base):
    __tablename__ = "agent_memory"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # NULL = workspace-level codebase chunk (no owning agent) — migration 011
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384))
    # 'agent' rows are auto-recalled before LLM calls; 'codebase_chunk' rows
    # are reachable only through the search_codebase tool.
    memory_type: Mapped[str] = mapped_column(Text, server_default=text("'agent'"))
    # Codebase chunks: keyed by workspace_path so the index persists across
    # pipelines on the same folder; source_file + file_hash drive the
    # skip-unchanged-files check on re-index.
    workspace_path: Mapped[str | None] = mapped_column(Text)
    source_file: Mapped[str | None] = mapped_column(Text)
    file_hash: Mapped[str | None] = mapped_column(Text)
    source_pipeline_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="SET NULL")
    )
    source_task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    type: Mapped[str] = mapped_column(Text, server_default=text("'info'"))
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, server_default=text("''"))
    link: Mapped[str | None] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
