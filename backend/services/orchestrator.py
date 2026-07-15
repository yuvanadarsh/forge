"""LangGraph pipeline orchestrator.

Builds a sequential StateGraph over the pipeline's agent_sequence. The
Phase 1 → Phase 2 approval gate uses a dynamic interrupt() (per the
architecture decision in CLAUDE.md); the run resumes when the pipelines
router flips pipeline_runs.status back to 'approved'.
"""

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_session_factory
from db.models import Agent, Conversation, Message, Notification, Pipeline, PipelineRun, Settings, Task
from services.agent_executor import execute_agent
from services.streaming import streaming_manager

logger = logging.getLogger(__name__)

GATE_POLL_SECONDS = 2
GATE_TIMEOUT_SECONDS = 3600

# Checkpoints must outlive individual ainvoke calls so interrupt/resume works;
# MemorySaver is process-local, which matches the single-backend deployment.
_checkpointer = MemorySaver()


class PipelineState(TypedDict):
    messages: list
    current_agent_index: int
    workspace_path: str
    approval_status: str
    outputs: dict


def _gate_index(plan_md: str, agent_count: int) -> int | None:
    """Index of the last Phase 1 agent — the gate fires before the next one.

    An explicit `<!-- gate_after: N -->` marker in plan_md wins. Otherwise,
    if the plan defines a Phase 2, the gate defaults to after the first
    agent (Phase 1 = planning), matching the mock pipeline structure.
    Returns None when there is nothing to gate (single agent, no phases).
    """
    marker = re.search(r"<!--\s*gate_after:\s*(\d+)\s*-->", plan_md)
    if marker:
        index = int(marker.group(1))
        return index if 0 <= index < agent_count - 1 else None
    if agent_count > 1 and re.search(r"^#{1,3}\s*Phase\s*2", plan_md, re.MULTILINE | re.IGNORECASE):
        return 0
    return None


async def _get_or_create_conversation(db: AsyncSession, pipeline: Pipeline) -> Conversation:
    conversation = (
        await db.execute(
            select(Conversation)
            .where(Conversation.pipeline_id == pipeline.id)
            .order_by(Conversation.created_at)
        )
    ).scalars().first()
    if conversation is None:
        conversation = Conversation(pipeline_id=pipeline.id, title=pipeline.title)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
    return conversation


async def _get_or_create_task(db: AsyncSession, pipeline: Pipeline, agent: Agent) -> Task:
    """The agent's task in this pipeline; synthesized (and persisted, so FK
    references from agent_memory hold) when none was assigned."""
    task = (
        await db.execute(
            select(Task)
            .where(Task.pipeline_id == pipeline.id, Task.assigned_to == agent.id)
            .order_by(Task.created_at.desc())
        )
    ).scalars().first()
    if task is None:
        task = Task(
            title=f"{pipeline.title} — {agent.role}",
            description=pipeline.description or pipeline.plan_md[:2000],
            assigned_to=agent.id,
            status="in_progress",
            priority="high",
            pipeline_id=pipeline.id,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
    return task


def _make_agent_node(
    pipeline_id: uuid.UUID,
    pipeline_run_id: uuid.UUID,
    conversation_id: uuid.UUID,
    agent_id: uuid.UUID,
    index: int,
    gate_before: bool,
):
    async def agent_node(state: PipelineState) -> dict:
        # The gate must be the node's first statement: on resume LangGraph
        # re-executes the node from the top and interrupt() returns the
        # resume value instead of pausing again.
        if gate_before and state["approval_status"] != "approved_gate":
            interrupt({"gate": "phase_boundary", "next_agent_index": index})

        session_factory = get_session_factory()
        async with session_factory() as db:
            pipeline = await db.get(Pipeline, pipeline_id)
            agent = await db.get(Agent, agent_id)
            run = await db.get(PipelineRun, pipeline_run_id)
            settings = (await db.execute(select(Settings))).scalar_one()
            if pipeline is None or agent is None or run is None:
                raise RuntimeError("Pipeline, run, or agent vanished mid-execution")
            task = await _get_or_create_task(db, pipeline, agent)
            run.current_agent_id = agent.id
            run.current_agent_index = index
            await db.commit()

        await streaming_manager.send_status(str(pipeline_run_id), f"running:{agent.name}")
        output = await execute_agent(
            agent=agent,
            task=task,
            conversation_id=conversation_id,
            pipeline_run_id=pipeline_run_id,
            workspace_path=state["workspace_path"],
            prior_context=state["messages"],
            settings=settings,
            streaming_manager=streaming_manager,
        )

        return {
            "messages": state["messages"]
            + [{"role": "assistant", "content": f"[{agent.name} — {agent.role}]\n{output.content}"}],
            "current_agent_index": index + 1,
            "approval_status": state["approval_status"],
            "outputs": {
                **state["outputs"],
                str(agent_id): {
                    "content": output.content,
                    "tokens_used": output.tokens_used,
                    "cost_usd": output.cost_usd,
                    "files_touched": output.files_touched,
                    "commands_run": output.commands_run,
                },
            },
        }

    return agent_node


def _build_graph(
    pipeline: Pipeline,
    run: PipelineRun,
    conversation_id: uuid.UUID,
    gate_index: int | None,
):
    builder = StateGraph(PipelineState)
    for i, agent_id in enumerate(pipeline.agent_sequence):
        builder.add_node(
            f"agent_{i}",
            _make_agent_node(
                pipeline.id, run.id, conversation_id, agent_id, i,
                gate_before=(gate_index is not None and i == gate_index + 1),
            ),
        )
    builder.add_edge(START, "agent_0")
    for i in range(len(pipeline.agent_sequence) - 1):
        builder.add_edge(f"agent_{i}", f"agent_{i + 1}")
    builder.add_edge(f"agent_{len(pipeline.agent_sequence) - 1}", END)
    return builder.compile(checkpointer=_checkpointer)


async def _notify(db: AsyncSession, type_: str, title: str, body: str, link: str | None) -> None:
    db.add(Notification(type=type_, title=title, body=body, link=link))
    await db.commit()


async def _pause_for_gate(
    pipeline: Pipeline, run_id: uuid.UUID, conversation_id: uuid.UUID
) -> None:
    """Persist the paused state + gate message, notify, stream the gate."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        run = await db.get(PipelineRun, run_id)
        if run is not None and run.status == "running":
            run.status = "paused_for_approval"
        gate_message = Message(
            conversation_id=conversation_id,
            role="approval_gate",
            content=f"Phase 1 of **{pipeline.title}** is complete. Approve to continue with Phase 2.",
            gate_status="pending",
        )
        db.add(gate_message)
        await db.commit()
        await db.refresh(gate_message)
        await _notify(
            db, "approval_needed",
            f"Approval needed: {pipeline.title}",
            "Phase 1 complete — review the output and approve to continue.",
            f"/pipelines/{pipeline.id}/chat",
        )
    await streaming_manager.send_gate(
        str(run_id), gate_id=str(gate_message.id),
        summary=f"Approve Phase 2 of {pipeline.title}",
    )
    await streaming_manager.send_status(str(run_id), "paused_for_approval")


async def _wait_for_run_approval(run_id: uuid.UUID) -> None:
    """Block until the router flips the run to 'approved' (then mark running)."""
    session_factory = get_session_factory()
    waited = 0
    while waited < GATE_TIMEOUT_SECONDS:
        await asyncio.sleep(GATE_POLL_SECONDS)
        waited += GATE_POLL_SECONDS
        async with session_factory() as db:
            run = await db.get(PipelineRun, run_id)
            if run is None or run.status in ("failed", "cancelled"):
                raise RuntimeError("Pipeline run was cancelled while paused at gate")
            if run.status == "approved":
                run.status = "running"
                await db.commit()
                return
    raise RuntimeError("Pipeline approval gate timed out after 1 hour")


async def run_pipeline(pipeline_run_id: uuid.UUID, db: AsyncSession) -> None:
    """Execute one pipeline run end to end. `db` is used for initial loads;
    long-running phases open fresh sessions so no connection is pinned for
    the lifetime of the run."""
    run = await db.get(PipelineRun, pipeline_run_id)
    if run is None:
        raise RuntimeError(f"Pipeline run {pipeline_run_id} not found")
    pipeline = await db.get(Pipeline, run.pipeline_id)
    if pipeline is None:
        raise RuntimeError(f"Pipeline {run.pipeline_id} not found")
    if not pipeline.agent_sequence:
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        pipeline.status = "completed"
        await db.commit()
        return

    conversation = await _get_or_create_conversation(db, pipeline)
    run.status = "running"
    pipeline.status = "running"
    await db.commit()
    await streaming_manager.send_status(str(run.id), "running")

    gate_index = _gate_index(pipeline.plan_md, len(pipeline.agent_sequence))
    graph = _build_graph(pipeline, run, conversation.id, gate_index)
    config = {"configurable": {"thread_id": run.langgraph_thread_id}}
    initial_state: PipelineState = {
        "messages": [],
        "current_agent_index": 0,
        "workspace_path": pipeline.workspace_path,
        "approval_status": "pending",
        "outputs": {},
    }

    session_factory = get_session_factory()
    try:
        await graph.ainvoke(initial_state, config)
        # A non-empty `next` means interrupt() paused the graph at the gate.
        while (await graph.aget_state(config)).next:
            await _pause_for_gate(pipeline, run.id, conversation.id)
            await _wait_for_run_approval(run.id)
            await streaming_manager.send_status(str(run.id), "running")
            await graph.ainvoke(Command(resume="approved_gate"), config)

        async with session_factory() as done_db:
            done_run = await done_db.get(PipelineRun, run.id)
            done_pipeline = await done_db.get(Pipeline, pipeline.id)
            if done_run is not None:
                done_run.status = "completed"
                done_run.completed_at = datetime.now(timezone.utc)
            if done_pipeline is not None:
                done_pipeline.status = "completed"
            await done_db.commit()
            await _notify(
                done_db, "pipeline_completed",
                f"Pipeline completed: {pipeline.title}",
                f"All {len(pipeline.agent_sequence)} agents finished successfully.",
                f"/pipelines/{pipeline.id}/chat",
            )
        await streaming_manager.send_status(str(run.id), "completed")
        await streaming_manager.send_complete(str(run.id))
    except Exception as exc:
        logger.exception("Pipeline run %s failed", run.id)
        async with session_factory() as fail_db:
            fail_run = await fail_db.get(PipelineRun, run.id)
            fail_pipeline = await fail_db.get(Pipeline, pipeline.id)
            if fail_run is not None:
                fail_run.status = "failed"
                fail_run.error = str(exc)[:2000]
                fail_run.completed_at = datetime.now(timezone.utc)
            if fail_pipeline is not None:
                fail_pipeline.status = "failed"
            await fail_db.commit()
            await _notify(
                fail_db, "pipeline_failed",
                f"Pipeline failed: {pipeline.title}",
                str(exc)[:500],
                f"/pipelines/{pipeline.id}/chat",
            )
        await streaming_manager.send_error(str(run.id), str(exc)[:500])


async def start_pipeline_run(pipeline_run_id: uuid.UUID) -> None:
    """Background-task entry point: owns its own session for the whole run."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        try:
            await run_pipeline(pipeline_run_id, db)
        except Exception:
            # run_pipeline handles its own failure bookkeeping; this guard
            # only prevents an unhandled-exception traceback in the task.
            logger.exception("start_pipeline_run crashed for %s", pipeline_run_id)
