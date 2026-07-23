"""Core agent execution loop.

Runs one agent against one task inside a pipeline run: builds context
(memory + prior agents), streams an Anthropic tool-use loop, pauses on
command approval gates, and persists messages / memory / token usage.
"""

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from anthropic import AsyncAnthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_session_factory
from db.models import (
    Agent,
    ApiKey,
    Conversation,
    Message,
    MessageImage,
    Notification,
    Pipeline,
    PipelineRun,
    Settings,
    Task,
    TokenUsage,
)
from services import memory_service
from services.crypto import CryptoError, decrypt_key, get_secret_key
from services.streaming import StreamingManager, streaming_manager
from services.tool_registry import (
    NeedsApprovalError,
    ToolError,
    append_file,
    create_agent,
    read_file,
    read_file_section,
    replace_in_file,
    run_command,
    search_codebase,
    write_file,
)

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 16_384
MAX_TOOL_ITERATIONS = 25          # hard stop against runaway tool loops
MAX_NO_TOOL_NUDGES = 3            # corrective re-prompts before accepting a tool-free turn
CONTEXT_VERBATIM_TAIL = 10        # prior-context messages kept verbatim when condensing
APPROVAL_POLL_SECONDS = 2
APPROVAL_TIMEOUT_SECONDS = 3600

# USD per million tokens (input, output); longest-prefix match on model id.
PRICING: dict[str, tuple[float, float]] = {
    "claude-fable-5": (10.0, 50.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-opus-4-6": (5.0, 25.0),
    "claude-opus-4-5": (5.0, 25.0),
    "claude-opus-4-1": (15.0, 75.0),
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-sonnet-4": (3.0, 15.0),  # covers 4-6, 4-5, 4-0 (all $3/$15)
    "claude-haiku-4-5": (1.0, 5.0),
}
DEFAULT_PRICE = (3.0, 15.0)  # unknown models: assume Sonnet-tier

TOOLS = [
    {
        "name": "read_file",
        "description": "Read a file from the workspace. Path is relative to the workspace root.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "File path relative to workspace"}},
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write a file in the workspace, creating parent directories as needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "content": {"type": "string", "description": "Full file contents to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "append_file",
        "description": (
            "Append content to the end of a file in the workspace (creating "
            "it if needed). For files over 400 lines: write_file the first "
            "section, then append_file each subsequent section."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "content": {"type": "string", "description": "Content to append to the end of the file"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "read_file_section",
        "description": (
            "Read only lines start_line through end_line (1-indexed, "
            "inclusive) of a file. Use instead of read_file for large files "
            "— reads to end-of-file if end_line is past the last line."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "start_line": {"type": "integer", "description": "First line to read (1-indexed)"},
                "end_line": {"type": "integer", "description": "Last line to read (inclusive)"},
            },
            "required": ["path", "start_line", "end_line"],
        },
    },
    {
        "name": "replace_in_file",
        "description": (
            "Replace the FIRST occurrence of old_content with new_content in "
            "a file — targeted fixes without rewriting the whole file. Fails "
            "if old_content is not found exactly, so pass the text as it "
            "currently appears in the file."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "old_content": {"type": "string", "description": "Exact existing text to replace (first occurrence)"},
                "new_content": {"type": "string", "description": "Replacement text"},
            },
            "required": ["path", "old_content", "new_content"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a shell command in the workspace. Commands may require human approval depending on workspace security settings.",
        "input_schema": {
            "type": "object",
            "properties": {"command": {"type": "string", "description": "Shell command to execute"}},
            "required": ["command"],
        },
    },
    {
        "name": "search_codebase",
        "description": (
            "Semantic search over the workspace's indexed code. Describe what "
            "you're looking for in natural language and get the most relevant "
            "code chunks (with file and line ranges) — use this to find code "
            "instead of reading entire files. The index is a snapshot from "
            "run start: files written during this run are not in it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What you're looking for, e.g. 'where database connections are configured'",
                }
            },
            "required": ["query"],
        },
    },
]

# Only eternal agents (Atlas) get this tool — it is appended to their tool
# list at call time and its dispatch double-checks is_eternal.
CREATE_AGENT_TOOL = {
    "name": "create_agent",
    "description": (
        "Create a new AI agent in Forge. The agent is registered immediately "
        "and can then be assigned tasks and pipeline roles."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Short display name, e.g. 'Vega'"},
            "role": {"type": "string", "description": "Role title, e.g. 'Frontend Developer'"},
            "specialty": {
                "type": "string",
                "description": "One sentence on what this agent is best at",
            },
            "system_prompt": {
                "type": "string",
                "description": "Full system prompt defining the agent's behavior and expertise",
            },
            "model": {
                "type": "string",
                "description": "Model id to run the agent on (default claude-sonnet-4-6)",
            },
            "avatar_color": {
                "type": "string",
                "description": "Hex accent color: #6366f1, #f59e0b, #3b82f6, #22c55e, #ec4899 or #f97316",
            },
        },
        "required": ["name", "role", "specialty", "system_prompt"],
    },
}


def _tools_for(agent: Agent) -> list[dict]:
    return [*TOOLS, CREATE_AGENT_TOOL] if agent.is_eternal else TOOLS


async def _dispatch_create_agent(
    agent: Agent,
    args: dict,
    db: AsyncSession,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    if not agent.is_eternal:
        raise ToolError("create_agent is reserved for eternal agents")
    result = await create_agent(
        name=str(args.get("name", "")),
        role=str(args.get("role", "")),
        specialty=str(args.get("specialty", "")),
        system_prompt=str(args.get("system_prompt", "")),
        model=str(args.get("model") or "claude-sonnet-4-6"),
        avatar_color=str(args.get("avatar_color") or "#6366f1"),
        db=db,
        creator_agent_id=agent.id,
        pipeline_run_id=pipeline_run_id,
    )
    return json.dumps(result)


TOOL_ARG_PERSIST_LIMIT = 500      # per-arg chars kept in persisted tool_call messages
TOOL_RESULT_SUMMARY_CHARS = 200


def _tool_call_content(
    tool_name: str, args: dict, status: str, result_summary: str | None = None
) -> str:
    """JSON body for a role='tool_call' message. Long string args (e.g.
    write_file content) are truncated — the card only shows a summary."""
    slim_args = {
        k: (v[:TOOL_ARG_PERSIST_LIMIT] + "…" if isinstance(v, str) and len(v) > TOOL_ARG_PERSIST_LIMIT else v)
        for k, v in args.items()
    }
    payload: dict = {"tool_name": tool_name, "args": slim_args, "status": status}
    if result_summary is not None:
        payload["result_summary"] = result_summary
    return json.dumps(payload)


async def _persist_tool_call_start(
    conversation_id: uuid.UUID, agent_id: uuid.UUID, tool_name: str, args: dict
) -> uuid.UUID:
    """Save a running tool_call message so history survives page reloads."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        message = Message(
            conversation_id=conversation_id,
            agent_id=agent_id,
            role="tool_call",
            content=_tool_call_content(tool_name, args, "running"),
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message.id


async def _persist_tool_call_end(
    message_id: uuid.UUID, tool_name: str, args: dict, result: str
) -> None:
    session_factory = get_session_factory()
    async with session_factory() as db:
        message = await db.get(Message, message_id)
        if message is None:
            return
        message.content = _tool_call_content(
            tool_name, args, "completed", result[:TOOL_RESULT_SUMMARY_CHARS]
        )
        await db.commit()


class ExecutionError(Exception):
    """Agent execution failed in a way the pipeline should surface."""


class CostLimitExceeded(ExecutionError):
    """A configured cost ceiling was crossed — the run must stop.

    Subclasses ExecutionError so the orchestrator's failure path (run status
    'failed', error streamed, notification created) applies unchanged.
    """


@dataclass
class AgentOutput:
    content: str
    tokens_used: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
    files_touched: list[str] = field(default_factory=list)
    commands_run: list[str] = field(default_factory=list)


def _price_for(model: str) -> tuple[float, float]:
    for prefix in sorted(PRICING, key=len, reverse=True):
        if model.startswith(prefix):
            return PRICING[prefix]
    return DEFAULT_PRICE


def _cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _price_for(model)
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000


async def _anthropic_client(db: AsyncSession) -> AsyncAnthropic:
    """API key from the encrypted vault (default anthropic row first), else env."""
    rows = (
        await db.execute(
            select(ApiKey)
            .where(ApiKey.provider == "anthropic")
            .order_by(ApiKey.is_default.desc(), ApiKey.created_at)
        )
    ).scalars().all()
    for row in rows:
        try:
            return AsyncAnthropic(api_key=decrypt_key(row.encrypted_key, get_secret_key()))
        except CryptoError as exc:
            logger.warning("Could not decrypt API key %s: %s", row.id, exc)
    if os.getenv("ANTHROPIC_API_KEY"):
        return AsyncAnthropic()
    raise ExecutionError("No Anthropic API key configured — add one in Settings")


def _condense_context(prior_context: list[dict]) -> list[dict]:
    """Keep the tail verbatim; collapse older messages into one digest.

    Deterministic (no extra LLM call): older messages become a compact
    digest so long pipelines don't blow the context window.
    """
    if len(prior_context) <= 20:
        return list(prior_context)
    head, tail = prior_context[:-CONTEXT_VERBATIM_TAIL], prior_context[-CONTEXT_VERBATIM_TAIL:]
    digest_lines = [
        f"- [{m.get('role', 'assistant')}] {str(m.get('content', ''))[:200]}" for m in head
    ]
    digest = {
        "role": "user",
        "content": (
            f"[Summary of {len(head)} earlier pipeline messages]\n" + "\n".join(digest_lines)
        ),
    }
    return [digest, *tail]


def _normalize_turns(messages: list[dict]) -> list[dict]:
    """Anthropic requires a user-first, alternating-role message list.

    Prior context arrives as loose turns (project-scan summary, per-agent
    handoff notes, the task itself) — merge consecutive same-role string
    messages, and prepend a framing user turn when the list would otherwise
    start with an assistant message (agent 2+ in a pipeline).
    """
    merged: list[dict] = []
    for message in messages:
        if (
            merged
            and merged[-1]["role"] == message["role"]
            and isinstance(merged[-1]["content"], str)
            and isinstance(message["content"], str)
        ):
            merged[-1]["content"] += f"\n\n{message['content']}"
        else:
            merged.append(dict(message))
    if merged and merged[0]["role"] != "user":
        merged.insert(
            0, {"role": "user", "content": "Context from earlier in this pipeline run:"}
        )
    return merged


def _effective_settings_dict(settings: Settings, execution_mode: str | None) -> dict:
    """settings_dict for tool_registry's command policy, with the pipeline's
    execution_mode (if any) overriding the global terminal_execution /
    strict_mode. None means "use global settings" unchanged.

    - full_auto: strict_mode off, terminal_execution always_proceed —
      matches "runs start to finish without interruption after approval".
    - supervised: terminal_execution request_review (agent boundaries are
      gated separately, in the orchestrator).
    - strict: strict_mode on — every action requires approval.
    """
    strict_mode = settings.strict_mode
    terminal_execution = settings.terminal_execution
    if execution_mode == "full_auto":
        strict_mode = False
        terminal_execution = "always_proceed"
    elif execution_mode == "supervised":
        terminal_execution = "request_review"
    elif execution_mode == "strict":
        strict_mode = True
    return {
        "terminal_execution": terminal_execution,
        "strict_mode": strict_mode,
        "allowed_commands": settings.allowed_commands,
        "denied_commands": settings.denied_commands,
    }


def _build_system_prompt(
    agent: Agent, settings: Settings, workspace_path: str, memories: list
) -> str:
    parts = [agent.system_prompt.strip() or f"You are {agent.name}, a {agent.role}."]
    if settings.global_rules.strip():
        parts.append(f"## Operator rules\n{settings.global_rules.strip()}")
    parts.append(
        f"Your workspace is {workspace_path}. You may only access files within it. "
        "Use the provided tools for all file and command operations."
    )
    if memories:
        memory_lines = "\n".join(f"- {m.content[:500]}" for m in memories)
        parts.append(f"## Relevant context from your past work\n{memory_lines}")
    parts.append(
        "EXECUTION RULE: For any task that requires creating files, "
        "call write_file as your FIRST or SECOND action. "
        "You may run ONE exploration command if needed, but then you MUST "
        "call write_file immediately after. Never explore without producing output."
    )
    return "\n\n".join(parts)


async def _check_cost_limits(
    agent: Agent,
    pipeline_run_id: uuid.UUID | None,
    settings: Settings,
    in_flight: float = 0.0,
) -> None:
    """Raise CostLimitExceeded before an LLM call once any ceiling is crossed.

    `in_flight` is the current agent execution's not-yet-persisted spend, so
    a runaway tool loop is stopped mid-agent, not just at agent boundaries.
    Limits are re-read from the DB each call so raising a ceiling in Settings
    takes effect immediately, even mid-run. The daily total spans ALL
    token_usage (runs, task runs, chat, planning) — it protects the budget,
    not a bookkeeping category.
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        fresh = (await db.execute(select(Settings))).scalar_one_or_none()
        limits = fresh if fresh is not None else settings

        daily = (
            await db.execute(
                select(func.coalesce(func.sum(TokenUsage.cost_usd), 0)).where(
                    TokenUsage.recorded_at >= func.date_trunc("day", func.now())
                )
            )
        ).scalar_one()
        if float(daily) + in_flight >= float(limits.max_daily_cost):
            raise CostLimitExceeded(
                f"Daily cost limit reached (${float(limits.max_daily_cost):.2f} across all "
                f"runs today) — raise max_daily_cost in Settings to continue"
            )

        if pipeline_run_id is None:
            return
        run_total = (
            await db.execute(
                select(func.coalesce(func.sum(TokenUsage.cost_usd), 0)).where(
                    TokenUsage.pipeline_run_id == pipeline_run_id
                )
            )
        ).scalar_one()
        if float(run_total) + in_flight >= float(limits.max_run_cost):
            raise CostLimitExceeded(
                f"Run cost limit reached (${float(limits.max_run_cost):.2f}) — "
                f"raise max_run_cost in Settings and run again"
            )
        agent_total = (
            await db.execute(
                select(func.coalesce(func.sum(TokenUsage.cost_usd), 0)).where(
                    TokenUsage.pipeline_run_id == pipeline_run_id,
                    TokenUsage.agent_id == agent.id,
                )
            )
        ).scalar_one()
        if float(agent_total) + in_flight >= float(limits.max_agent_cost):
            raise CostLimitExceeded(
                f"Agent cost limit reached for {agent.name} "
                f"(${float(limits.max_agent_cost):.2f} per run) — raise max_agent_cost "
                f"in Settings and run again"
            )


async def _wait_for_gate_approval(
    pipeline_run_id: uuid.UUID,
    gate_message_id: uuid.UUID,
) -> None:
    """Poll pipeline_runs until the user approves; 'approved' resumes execution."""
    session_factory = get_session_factory()
    waited = 0
    while waited < APPROVAL_TIMEOUT_SECONDS:
        await asyncio.sleep(APPROVAL_POLL_SECONDS)
        waited += APPROVAL_POLL_SECONDS
        async with session_factory() as db:
            run = await db.get(PipelineRun, pipeline_run_id)
            if run is None or run.status in ("failed", "cancelled"):
                raise ExecutionError("Pipeline run was cancelled while awaiting approval")
            if run.status == "approved":
                run.status = "running"
                gate = await db.get(Message, gate_message_id)
                if gate is not None and gate.gate_status == "pending":
                    gate.gate_status = "approved"
                await db.commit()
                return
    raise ExecutionError("Approval gate timed out after 1 hour")


async def _handle_command_approval(
    exc: NeedsApprovalError,
    *,
    agent: Agent,
    conversation_id: uuid.UUID,
    pipeline_run_id: uuid.UUID,
    streaming_manager: StreamingManager,
) -> None:
    """Pause the run, persist an approval_gate message, stream the gate, block until approved."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        run = await db.get(PipelineRun, pipeline_run_id)
        if run is not None:
            run.status = "paused_for_approval"
        gate_message = Message(
            conversation_id=conversation_id,
            agent_id=agent.id,
            role="approval_gate",
            content=f"`{exc.command}` requires approval — {exc.reason}",
            gate_status="pending",
        )
        db.add(gate_message)
        await db.commit()
        await db.refresh(gate_message)

    await streaming_manager.send_gate(
        str(pipeline_run_id),
        gate_id=str(gate_message.id),
        summary=f"Approve command: {exc.command}",
        agent_id=str(agent.id),
    )
    await streaming_manager.send_status(str(pipeline_run_id), "paused_for_approval")
    await _wait_for_gate_approval(pipeline_run_id, gate_message.id)
    await streaming_manager.send_status(str(pipeline_run_id), "running")


async def _execute_tool(
    name: str,
    args: dict,
    *,
    agent: Agent,
    conversation_id: uuid.UUID,
    pipeline_run_id: uuid.UUID | None,
    workspace_path: str,
    settings_dict: dict,
    streaming_manager: StreamingManager,
    output: AgentOutput,
) -> str:
    """Run one tool call; command approvals block here until resolved."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        if name == "create_agent":
            return await _dispatch_create_agent(agent, args, db, pipeline_run_id)
        if name == "read_file":
            output.files_touched.append(args["path"])
            return await read_file(
                args["path"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
        if name == "write_file":
            output.files_touched.append(args["path"])
            return await write_file(
                args["path"], args["content"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
        if name == "append_file":
            output.files_touched.append(args["path"])
            return await append_file(
                args["path"], args["content"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
        if name == "read_file_section":
            output.files_touched.append(args["path"])
            return await read_file_section(
                args["path"], args["start_line"], args["end_line"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
        if name == "replace_in_file":
            output.files_touched.append(args["path"])
            return await replace_in_file(
                args["path"], args["old_content"], args["new_content"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
        if name == "search_codebase":
            matches = await search_codebase(
                args["query"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
            return (
                json.dumps(matches)
                if matches
                else (
                    "No matches in the codebase index. The index is built at "
                    "run start — files written during this run are not in it; "
                    "use read_file for those."
                )
            )
        if name == "run_command":
            output.commands_run.append(args["command"])
            approved = False
            while True:
                async with session_factory() as cmd_db:
                    try:
                        result = await run_command(
                            args["command"], workspace_path, settings_dict,
                            db=cmd_db, agent_id=agent.id,
                            pipeline_run_id=pipeline_run_id, approved=approved,
                        )
                        return json.dumps(result)
                    except NeedsApprovalError as exc:
                        if pipeline_run_id is None:
                            # Single-agent task runs have no approval-gate UI;
                            # a gated command must fail, never silently run.
                            raise ToolError(
                                f"Command requires human approval ({exc.reason}) and task "
                                "runs have no approval gate. Add the command to "
                                "allowed_commands in Settings, or run this task inside "
                                "a pipeline."
                            ) from exc
                        await _handle_command_approval(
                            exc,
                            agent=agent,
                            conversation_id=conversation_id,
                            pipeline_run_id=pipeline_run_id,
                            streaming_manager=streaming_manager,
                        )
                        approved = True  # user approved — bypass policy on retry
    raise ToolError(f"Unknown tool: {name}")


CHAT_HISTORY_LIMIT = 40
CHAT_MAX_OUTPUT_TOKENS = 4096
CHAT_MAX_TOOL_ITERATIONS = 5  # Atlas creating a handful of agents per turn is plenty

# Pipeline follow-up chats replay the ENTIRE run transcript; past this many
# turns the middle is elided (head + tail kept) to protect the context window.
PIPELINE_HISTORY_SUMMARY_THRESHOLD = 30
PIPELINE_HISTORY_HEAD = 5
PIPELINE_HISTORY_TAIL = 20

PIPELINE_CONTEXT_NOTE = (
    "The following is the history of work done in this pipeline. The user is "
    "now asking you a follow-up question about this completed project."
)


def _chat_turns(
    history: list[Message],
    *,
    pipeline_followup: bool,
    speaker_names: dict[uuid.UUID, str],
    has_images: frozenset[uuid.UUID] = frozenset(),
) -> list[dict]:
    """Chat turns from persisted messages: user/assistant only — tool_call
    and gate rows are UI artifacts, not conversation content.

    Pipeline follow-ups additionally label each assistant turn with the
    speaking agent (multi-agent transcript), elide the middle of very long
    runs, and prepend a context note framing the transcript — which also
    guarantees the list is user-first, so the run history survives the
    alternating-roles merge instead of being dropped.
    """
    turns: list[dict] = []
    for m in history:
        if m.role not in ("user", "assistant"):
            continue
        content = m.content if m.content.strip() else ""
        if m.image_data or m.id in has_images:
            # Text stand-in; the actual image block is attached only to the
            # latest user turn (chat_reply) so history stays lightweight.
            content = f"[image attached] {content}".rstrip()
        if not content.strip():
            continue
        if m.role == "assistant" and m.agent_id in speaker_names:
            content = f"[{speaker_names[m.agent_id]}] {content}"
        turns.append({"role": m.role, "content": content})

    if not pipeline_followup:
        return turns

    if len(turns) > PIPELINE_HISTORY_SUMMARY_THRESHOLD:
        omitted = len(turns) - PIPELINE_HISTORY_HEAD - PIPELINE_HISTORY_TAIL
        turns = [
            *turns[:PIPELINE_HISTORY_HEAD],
            {"role": "user", "content": f"[Summary: {omitted} messages omitted]"},
            *turns[-PIPELINE_HISTORY_TAIL:],
        ]
    return [{"role": "user", "content": PIPELINE_CONTEXT_NOTE}, *turns]


async def chat_reply(
    conversation_id: uuid.UUID, agent_id: uuid.UUID | None = None
) -> Message | None:
    """Basic single-agent chat turn: one non-streaming completion, no tools.

    Used by POST /conversations/{id}/messages. For agent conversations the
    replying agent is the conversation's agent; pipeline-level conversations
    (agent_id null) only reply when an explicit `agent_id` override is passed
    — the router picks it from the @mention or the last agent who spoke.
    Pipeline replies get the FULL run transcript as context (see _chat_turns)
    so the agent remembers everything that happened in the pipeline.
    Persists the assistant Message + TokenUsage and returns the message.
    Raises ExecutionError when no Anthropic key is configured.
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None:
            return None
        target_agent_id = agent_id or conversation.agent_id
        if target_agent_id is None:
            return None
        agent = await db.get(Agent, target_agent_id)
        if agent is None:
            return None
        settings = (await db.execute(select(Settings))).scalar_one_or_none()

        pipeline_followup = (
            conversation.agent_id is None and conversation.pipeline_id is not None
        )
        if pipeline_followup:
            # Post-completion pipeline chat: replay the whole run, not a
            # recent-messages window — _chat_turns elides the middle if long.
            rows = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            )
            history = list(rows.scalars().all())
        else:
            rows = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(CHAT_HISTORY_LIMIT)
            )
            history = list(reversed(rows.scalars().all()))

        # Label pipeline turns by speaker so the replying agent can tell who
        # did what in a multi-agent transcript.
        speaker_names: dict[uuid.UUID, str] = {}
        if pipeline_followup:
            speaker_ids = {m.agent_id for m in history if m.agent_id is not None}
            if speaker_ids:
                agent_rows = await db.execute(
                    select(Agent).where(Agent.id.in_(speaker_ids))
                )
                speaker_names = {a.id: a.name for a in agent_rows.scalars().all()}

        latest_user_msg = next((m for m in reversed(history) if m.role == "user"), None)
        # message_images for every user turn in history (multi-image, migration
        # 009) — used both for the "[image attached]" text stand-in on older
        # turns and the real image blocks attached to the latest turn below.
        user_msg_ids = [m.id for m in history if m.role == "user"]
        images_by_message: dict[uuid.UUID, list[MessageImage]] = {}
        if user_msg_ids:
            image_rows = await db.execute(
                select(MessageImage)
                .where(MessageImage.message_id.in_(user_msg_ids))
                .order_by(MessageImage.sort_order)
            )
            for image in image_rows.scalars().all():
                images_by_message.setdefault(image.message_id, []).append(image)
        has_images = frozenset(images_by_message.keys())
        latest_images = images_by_message.get(latest_user_msg.id, []) if latest_user_msg else []
        memories = await memory_service.search_memories(
            db,
            agent.id,
            latest_user_msg.content if latest_user_msg is not None else "",
            top_k=5,
            threshold=0.3,
        )
        client = await _anthropic_client(db)
        agent.status = "working"
        agent.last_active = datetime.now(timezone.utc)
        await db.commit()

    parts = [agent.system_prompt.strip() or f"You are {agent.name}, a {agent.role}."]
    if settings is not None and settings.global_rules.strip():
        parts.append(f"## Operator rules\n{settings.global_rules.strip()}")
    if memories:
        memory_lines = "\n".join(f"- {m.content[:500]}" for m in memories)
        parts.append(f"## Relevant context from your past work\n{memory_lines}")
    system_prompt = "\n\n".join(parts)

    turns = _chat_turns(
        history,
        pipeline_followup=pipeline_followup,
        speaker_names=speaker_names,
        has_images=has_images,
    )

    # Anthropic requires user-first, alternating roles: merge consecutive
    # same-role messages and drop anything before the first user turn (the
    # pipeline context note is user-first, so run history is never dropped).
    merged: list[dict] = []
    for turn in turns:
        if merged and merged[-1]["role"] == turn["role"]:
            merged[-1]["content"] += f"\n\n{turn['content']}"
        else:
            merged.append(dict(turn))
    while merged and merged[0]["role"] != "user":
        merged.pop(0)
    if not merged:
        return None

    # The just-sent user message may carry images: send them as real image
    # content blocks ahead of the text (Anthropic multi-part content — image
    # blocks first, text last). Prefers message_images (up to 4); falls back
    # to the legacy single image_data column for pre-009 rows.
    image_blocks = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": img.media_type, "data": img.image_data},
        }
        for img in latest_images
    ]
    if (
        not image_blocks
        and latest_user_msg is not None
        and latest_user_msg.image_data
        and latest_user_msg.image_media_type
    ):
        image_blocks = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": latest_user_msg.image_media_type,
                    "data": latest_user_msg.image_data,
                },
            }
        ]
    if image_blocks and merged[-1]["role"] == "user" and isinstance(merged[-1]["content"], str):
        merged[-1] = {
            "role": "user",
            "content": [*image_blocks, {"type": "text", "text": merged[-1]["content"]}],
        }

    # Eternal agents (Atlas) get create_agent in chat — their whole job is
    # designing agents conversationally. Regular agents stay tool-free here.
    request_kwargs: dict = {
        "model": agent.model,
        "max_tokens": CHAT_MAX_OUTPUT_TOKENS,
        "system": system_prompt,
    }
    if agent.is_eternal:
        request_kwargs["tools"] = [CREATE_AGENT_TOOL]

    input_tokens = 0
    output_tokens = 0
    try:
        response = await client.messages.create(messages=merged, **request_kwargs)
        input_tokens += response.usage.input_tokens
        output_tokens += response.usage.output_tokens

        for _ in range(CHAT_MAX_TOOL_ITERATIONS):
            if response.stop_reason != "tool_use":
                break
            merged.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                try:
                    if block.name != "create_agent":
                        raise ToolError(f"Tool '{block.name}' is not available in chat")
                    async with session_factory() as db:
                        result_str = await _dispatch_create_agent(
                            agent, dict(block.input), db
                        )
                    is_error = False
                except ToolError as exc:
                    result_str, is_error = f"Error: {exc}", True
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                        **({"is_error": True} if is_error else {}),
                    }
                )
            merged.append({"role": "user", "content": tool_results})
            response = await client.messages.create(messages=merged, **request_kwargs)
            input_tokens += response.usage.input_tokens
            output_tokens += response.usage.output_tokens
    except Exception as exc:
        async with session_factory() as db:
            agent_row = await db.get(Agent, agent.id)
            if agent_row is not None:
                agent_row.status = "idle"
                await db.commit()
        raise ExecutionError(f"Anthropic call failed: {exc}") from exc

    text = "".join(b.text for b in response.content if b.type == "text")
    cost = _cost(agent.model, input_tokens, output_tokens)

    async with session_factory() as db:
        reply = Message(
            conversation_id=conversation_id,
            agent_id=agent.id,
            role="assistant",
            content=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
        )
        db.add(reply)
        db.add(
            TokenUsage(
                agent_id=agent.id,
                provider="anthropic",
                model=agent.model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
            )
        )
        conv = await db.get(Conversation, conversation_id)
        if conv is not None:
            conv.last_message = text[:300]
            conv.last_active = datetime.now(timezone.utc)
        agent_row = await db.get(Agent, agent.id)
        if agent_row is not None:
            agent_row.status = "idle"
            agent_row.last_active = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(reply)
        return reply


async def execute_agent(
    agent: Agent,
    task: Task,
    conversation_id: uuid.UUID,
    pipeline_run_id: uuid.UUID | None,
    workspace_path: str,
    prior_context: list[dict],
    settings: Settings,
    streaming_manager: StreamingManager,
    execution_mode: str | None = None,
) -> AgentOutput:
    session_factory = get_session_factory()
    # pipeline_run_id None = standalone task run: no WebSocket listener exists
    # for the synthetic key, so streaming calls become no-ops, and command
    # approval gates are unavailable (gated commands fail as tool errors).
    run_id = str(pipeline_run_id) if pipeline_run_id is not None else f"task:{task.id}"

    # 1. Recall relevant memories (top 5, similarity >= 0.3)
    async with session_factory() as db:
        memories = await memory_service.search_memories(
            db, agent.id, f"{task.title}\n{task.description}", top_k=5, threshold=0.3
        )
        client = await _anthropic_client(db)
        agent_row = await db.get(Agent, agent.id)
        if agent_row is not None:
            agent_row.status = "working"
            agent_row.last_active = datetime.now(timezone.utc)
            await db.commit()

    # 2. Message list: condensed prior context + the task itself, normalized
    # to the user-first alternating shape the API requires.
    system_prompt = _build_system_prompt(agent, settings, workspace_path, memories)
    messages: list[dict] = _condense_context(prior_context)
    messages.append(
        {
            "role": "user",
            "content": f"# Task: {task.title}\n\n{task.description}\n\n"
            "Complete this task using your tools. When finished, summarize what you did.",
        }
    )
    messages = _normalize_turns(messages)
    settings_dict = _effective_settings_dict(settings, execution_mode)

    output = AgentOutput(content="", tokens_used=0, input_tokens=0, output_tokens=0, cost_usd=0.0)
    final_text = ""
    usage_persisted = False

    try:
        # 3–5. Streaming tool-use loop
        tools_for_agent = _tools_for(agent)
        logger.info(
            "Tools available to %s: %s", agent.name, [t["name"] for t in tools_for_agent]
        )
        any_tool_used = False
        productive_tool_used = False  # write_file or meaningful run_command
        nudge_count = 0
        for _ in range(MAX_TOOL_ITERATIONS):
            # Cost guardrails: persisted spend plus this agent's in-flight
            # tokens, checked before every LLM call.
            await _check_cost_limits(
                agent,
                pipeline_run_id,
                settings,
                in_flight=_cost(agent.model, output.input_tokens, output.output_tokens),
            )
            async with client.messages.stream(
                model=agent.model,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=system_prompt,
                messages=messages,
                tools=tools_for_agent,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        await streaming_manager.send_token(run_id, event.delta.text, str(agent.id))
                response = await stream.get_final_message()

            output.input_tokens += response.usage.input_tokens
            output.output_tokens += response.usage.output_tokens

            logger.info("Response stop_reason: %s", response.stop_reason)

            iteration_text = "".join(b.text for b in response.content if b.type == "text")
            if iteration_text.strip():
                final_text = iteration_text

            tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
            if not tool_use_blocks:
                # The model sometimes narrates an action ("Let me write the
                # file:") and stops with end_turn instead of emitting a
                # tool_use block — Anthropic's stop_reason is genuinely
                # end_turn here, not an error, so nothing upstream catches
                # it. If no tool has run yet this whole agent turn, treat
                # the announcement as unfinished and nudge the model to
                # follow through, bounded so a task that truly needs no
                # tools still terminates. Exploration-only turns (ls, find,
                # cat…) count the same as no tool at all — agents were
                # exploring instead of writing and dodging the nudge.
                #
                # Branching on the absence of tool_use blocks (not on
                # stop_reason) matters: a response can stop for a reason
                # other than "tool_use" (e.g. "max_tokens") while still
                # containing a fully-formed tool_use block. Nudging in that
                # case would append the assistant turn with an orphaned
                # tool_use id followed by a plain-text user turn — never a
                # tool_result — which the Anthropic API rejects on the next
                # call ("tool_use ids were found without tool_result blocks
                # immediately after"). Any response carrying tool_use blocks
                # must go through the tool-execution path below instead,
                # regardless of stop_reason.
                if not productive_tool_used and nudge_count < MAX_NO_TOOL_NUDGES:
                    nudge_count += 1
                    logger.info(
                        "Agent %s stopped (%s) without a productive tool call — nudging (%d/%d)",
                        agent.name, response.stop_reason, nudge_count, MAX_NO_TOOL_NUDGES,
                    )
                    messages.append({"role": "assistant", "content": response.content})
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "You explored the workspace but haven't written any files yet. "
                                "You MUST call write_file now to create your deliverable. "
                                "Do not explore further — write the file immediately."
                            ),
                        }
                    )
                    continue
                break
            any_tool_used = True

            # Execute every requested tool; return all results in ONE user message
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                tool_name, tool_input = block.name, dict(block.input)
                # append_file / replace_in_file produce output the same way
                # write_file does — without them here, an agent doing a
                # legitimate targeted fix would still get nudged to write_file.
                productive_tools = {"write_file", "create_file", "append_file", "replace_in_file"}
                if tool_name in productive_tools:
                    productive_tool_used = True
                elif tool_name == "run_command":
                    # Only count as productive if it's not just exploration
                    exploration_commands = ("ls", "find", "cat", "head", "tail", "wc", "pwd", "echo")
                    cmd = tool_input.get("command", "")
                    if not any(cmd.strip().startswith(x) for x in exploration_commands):
                        productive_tool_used = True
                logger.info("TOOL CALL START: %s args=%s", block.name, dict(block.input))
                await streaming_manager.send_tool_call(
                    run_id, block.name, dict(block.input), agent_id=str(agent.id)
                )
                tool_msg_id = await _persist_tool_call_start(
                    conversation_id, agent.id, block.name, dict(block.input)
                )
                try:
                    result_str = await _execute_tool(
                        block.name, dict(block.input),
                        agent=agent,
                        conversation_id=conversation_id,
                        pipeline_run_id=pipeline_run_id,
                        workspace_path=workspace_path,
                        settings_dict=settings_dict,
                        streaming_manager=streaming_manager,
                        output=output,
                    )
                    is_error = False
                except ToolError as exc:
                    result_str, is_error = f"Error: {exc}", True
                logger.info("TOOL CALL END: %s result=%s", block.name, str(result_str)[:100])
                await _persist_tool_call_end(
                    tool_msg_id, block.name, dict(block.input), result_str
                )
                await streaming_manager.send_tool_result(
                    run_id, result_str[:2000], agent_id=str(agent.id)
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                        **({"is_error": True} if is_error else {}),
                    }
                )
            messages.append({"role": "user", "content": tool_results})
        else:
            final_text += "\n\n[Stopped: tool iteration limit reached]"

        output.content = final_text
        output.tokens_used = output.input_tokens + output.output_tokens
        output.cost_usd = _cost(agent.model, output.input_tokens, output.output_tokens)

        # 7–9. Persist message, memory, and token usage
        async with session_factory() as db:
            db.add(
                Message(
                    conversation_id=conversation_id,
                    agent_id=agent.id,
                    role="assistant",
                    content=output.content,
                    input_tokens=output.input_tokens,
                    output_tokens=output.output_tokens,
                    cost_usd=output.cost_usd,
                )
            )
            db.add(
                TokenUsage(
                    agent_id=agent.id,
                    pipeline_run_id=pipeline_run_id,
                    provider="anthropic",
                    model=agent.model,
                    input_tokens=output.input_tokens,
                    output_tokens=output.output_tokens,
                    cost_usd=output.cost_usd,
                )
            )
            conversation = await db.get(Conversation, conversation_id)
            if conversation is not None:
                conversation.last_message = output.content[:300]
                conversation.last_active = datetime.now(timezone.utc)
            await db.commit()
            usage_persisted = True
            await memory_service.save_memory(
                db,
                agent.id,
                f"Task: {task.title}\nOutcome: {output.content[:2000]}",
                pipeline_run_id=pipeline_run_id,
                task_id=task.id,
            )
        return output
    finally:
        # Tokens burned before a failure (cost limit, API error, cancel) must
        # still be accounted for — the cost guardrails read token_usage.
        if not usage_persisted and (output.input_tokens or output.output_tokens):
            async with session_factory() as db:
                db.add(
                    TokenUsage(
                        agent_id=agent.id,
                        pipeline_run_id=pipeline_run_id,
                        provider="anthropic",
                        model=agent.model,
                        input_tokens=output.input_tokens,
                        output_tokens=output.output_tokens,
                        cost_usd=_cost(agent.model, output.input_tokens, output.output_tokens),
                    )
                )
                await db.commit()
        async with session_factory() as db:
            agent_row = await db.get(Agent, agent.id)
            if agent_row is not None:
                agent_row.status = "idle"
                agent_row.last_active = datetime.now(timezone.utc)
                await db.commit()


async def run_task_agent(task_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
    """Background entry point for single-agent task runs (POST /api/tasks/{id}/run).

    Runs execute_agent with no pipeline run: memory recall and token usage
    still persist, but nothing streams (no WebSocket listener) and gated
    commands fail instead of pausing. The task lands in 'review' on success
    and back in 'backlog' on failure so it never sticks in 'in_progress'.
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        task = await db.get(Task, task_id)
        if task is None or task.assigned_to is None:
            return
        agent = await db.get(Agent, task.assigned_to)
        if agent is None:
            return
        settings = (await db.execute(select(Settings))).scalar_one_or_none()
        if settings is None:  # single-row config; recreate defaults if the seed is missing
            settings = Settings(id=1)
            db.add(settings)
            await db.commit()
            await db.refresh(settings)
        # Tasks have no workspace of their own: use the linked pipeline's
        # workspace when there is one, else the global workspace root.
        workspace_path = None
        if task.pipeline_id is not None:
            pipeline = await db.get(Pipeline, task.pipeline_id)
            if pipeline is not None:
                workspace_path = pipeline.workspace_path
        if not workspace_path:
            workspace_path = os.path.expanduser(settings.workspace_root)
    os.makedirs(workspace_path, exist_ok=True)

    try:
        output = await execute_agent(
            agent=agent,
            task=task,
            conversation_id=conversation_id,
            pipeline_run_id=None,
            workspace_path=workspace_path,
            prior_context=[],
            settings=settings,
            streaming_manager=streaming_manager,
        )
    except Exception as exc:
        logger.exception("Task run %s failed", task_id)
        async with session_factory() as db:
            row = await db.get(Task, task_id)
            if row is not None and row.status == "in_progress":
                row.status = "backlog"
            db.add(
                Message(
                    conversation_id=conversation_id,
                    agent_id=agent.id,
                    role="assistant",
                    content=f"⚠️ Task run failed: {exc}",
                )
            )
            db.add(
                Notification(
                    type="agent_error",
                    title=f"Task failed: {task.title}",
                    body=str(exc)[:500],
                    link=f"/agents/{agent.id}/conversations/{conversation_id}",
                )
            )
            conv = await db.get(Conversation, conversation_id)
            if conv is not None:
                conv.last_message = f"⚠️ Task run failed: {exc}"[:300]
                conv.last_active = datetime.now(timezone.utc)
            await db.commit()
    else:
        async with session_factory() as db:
            row = await db.get(Task, task_id)
            if row is not None and row.status == "in_progress":
                row.status = "review"
            db.add(
                Notification(
                    type="info",
                    title=f"Task complete: {task.title}",
                    body=output.content[:500],
                    link=f"/agents/{agent.id}/conversations/{conversation_id}",
                )
            )
            await db.commit()
