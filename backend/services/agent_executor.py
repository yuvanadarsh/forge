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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_session_factory
from db.models import (
    Agent,
    ApiKey,
    Conversation,
    Message,
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
    read_file,
    run_command,
    search_codebase,
    write_file,
)

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 16_384
MAX_TOOL_ITERATIONS = 25          # hard stop against runaway tool loops
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
        "description": "Case-insensitive text search across all workspace files. Returns file, line number, and matching line.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Text to search for"}},
            "required": ["query"],
        },
    },
]


class ExecutionError(Exception):
    """Agent execution failed in a way the pipeline should surface."""


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
    return "\n\n".join(parts)


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
        if name == "search_codebase":
            matches = await search_codebase(
                args["query"], workspace_path,
                db=db, agent_id=agent.id, pipeline_run_id=pipeline_run_id,
            )
            return json.dumps(matches) if matches else "No matches found."
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


async def chat_reply(conversation_id: uuid.UUID) -> Message | None:
    """Basic single-agent chat turn: one non-streaming completion, no tools.

    Used by POST /conversations/{id}/messages for agent conversations (not
    pipeline runs). Persists the assistant Message + TokenUsage and returns
    the message; returns None for pipeline-level conversations. Raises
    ExecutionError when no Anthropic key is configured.
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None or conversation.agent_id is None:
            return None
        agent = await db.get(Agent, conversation.agent_id)
        if agent is None:
            return None
        settings = (await db.execute(select(Settings))).scalar_one_or_none()

        rows = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(CHAT_HISTORY_LIMIT)
        )
        history = list(reversed(rows.scalars().all()))

        latest_user = next(
            (m.content for m in reversed(history) if m.role == "user"), ""
        )
        memories = await memory_service.search_memories(
            db, agent.id, latest_user, top_k=5, threshold=0.3
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

    # Anthropic requires user-first, alternating roles: merge consecutive
    # same-role messages and drop anything before the first user turn.
    merged: list[dict] = []
    for m in history:
        if m.role not in ("user", "assistant") or not m.content.strip():
            continue
        if merged and merged[-1]["role"] == m.role:
            merged[-1]["content"] += f"\n\n{m.content}"
        else:
            merged.append({"role": m.role, "content": m.content})
    while merged and merged[0]["role"] != "user":
        merged.pop(0)
    if not merged:
        return None

    try:
        response = await client.messages.create(
            model=agent.model,
            max_tokens=CHAT_MAX_OUTPUT_TOKENS,
            system=system_prompt,
            messages=merged,
        )
    except Exception as exc:
        async with session_factory() as db:
            agent_row = await db.get(Agent, agent.id)
            if agent_row is not None:
                agent_row.status = "idle"
                await db.commit()
        raise ExecutionError(f"Anthropic call failed: {exc}") from exc

    text = "".join(b.text for b in response.content if b.type == "text")
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
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

    # 2. Message list: condensed prior context + the task itself
    system_prompt = _build_system_prompt(agent, settings, workspace_path, memories)
    messages: list[dict] = _condense_context(prior_context)
    messages.append(
        {
            "role": "user",
            "content": f"# Task: {task.title}\n\n{task.description}\n\n"
            "Complete this task using your tools. When finished, summarize what you did.",
        }
    )
    settings_dict = {
        "terminal_execution": settings.terminal_execution,
        "strict_mode": settings.strict_mode,
        "allowed_commands": settings.allowed_commands,
        "denied_commands": settings.denied_commands,
    }

    output = AgentOutput(content="", tokens_used=0, input_tokens=0, output_tokens=0, cost_usd=0.0)
    final_text = ""

    try:
        # 3–5. Streaming tool-use loop
        for _ in range(MAX_TOOL_ITERATIONS):
            async with client.messages.stream(
                model=agent.model,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=system_prompt,
                messages=messages,
                tools=TOOLS,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        await streaming_manager.send_token(run_id, event.delta.text, str(agent.id))
                response = await stream.get_final_message()

            output.input_tokens += response.usage.input_tokens
            output.output_tokens += response.usage.output_tokens

            iteration_text = "".join(b.text for b in response.content if b.type == "text")
            if iteration_text.strip():
                final_text = iteration_text

            if response.stop_reason != "tool_use":
                break

            # Execute every requested tool; return all results in ONE user message
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                await streaming_manager.send_tool_call(
                    run_id, block.name, dict(block.input), agent_id=str(agent.id)
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
            await memory_service.save_memory(
                db,
                agent.id,
                f"Task: {task.title}\nOutcome: {output.content[:2000]}",
                pipeline_run_id=pipeline_run_id,
                task_id=task.id,
            )
        return output
    finally:
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
