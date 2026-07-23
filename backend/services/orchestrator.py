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
from pathlib import Path
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
from services.workspace_indexer import count_workspace_chunks, index_workspace

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


def _explicit_gate_indices(plan_md: str, agent_count: int) -> set[int]:
    """0-based agent indices after which plan_md defines an explicit
    approval gate — the ONLY plan-driven pause trigger.

    Either one or more `<!-- gate_after: N -->` markers, or an explicit
    "### Approval Gate" heading (defaults to after the first agent,
    matching a Phase 1 / Phase 2 structure). A generic "## Phase 2" heading
    is intentionally NOT treated as a gate: plans routinely use phase
    headings for structure without meaning to pause the pipeline, and
    treating every phase heading as a gate was the always-proceed bug —
    the default plan template's "## Phase 2" section silently paused every
    pipeline between agents even with Strict Mode off and Terminal
    Execution set to Always Proceed.
    """
    markers = {
        int(m.group(1)) for m in re.finditer(r"<!--\s*gate_after:\s*(\d+)\s*-->", plan_md)
    }
    markers = {i for i in markers if 0 <= i < agent_count - 1}
    if markers:
        return markers
    if agent_count > 1 and re.search(r"^#{1,3}\s*Approval Gate", plan_md, re.MULTILINE | re.IGNORECASE):
        return {0}
    return set()


def _gate_every_boundary(execution_mode: str | None, global_strict_mode: bool) -> bool:
    """Whether EVERY agent handoff must pause for approval.

    A pipeline's execution_mode overrides the global Strict Mode setting:
    'full_auto' forces this off (autonomous end to end, even if Strict Mode
    is globally on), 'supervised'/'strict' force it on, and None (use
    global settings) falls back to Settings.strict_mode.
    """
    if execution_mode == "full_auto":
        return False
    if execution_mode in ("supervised", "strict"):
        return True
    return global_strict_mode


def _gate_indices(
    plan_md: str, agent_count: int, gate_every_boundary: bool, execution_mode: str | None = None,
) -> set[int]:
    """0-based agent indices where the pipeline must pause for approval
    before the NEXT agent starts.

    Two triggers, matching the execution-mode model: an explicit gate in
    plan_md (normally applies in any mode), or every-boundary gating being
    on (Strict Mode, or execution_mode 'supervised'/'strict'). Neither
    Terminal Execution mode nor a plain phase heading pauses inter-agent
    handoffs on its own.

    'full_auto' is the one override that beats an explicit plan_md gate:
    plans are frequently LLM-generated (the auto-planner), and an LLM will
    naturally write a "## Approval Gate" checklist section as ordinary
    planning content with no idea that heading text alone pauses the
    pipeline. A pipeline explicitly configured to run fully autonomously
    must never stall on prose it didn't know was load-bearing.
    """
    if execution_mode == "full_auto":
        return set()
    indices = _explicit_gate_indices(plan_md, agent_count)
    if gate_every_boundary:
        indices |= set(range(agent_count - 1))
    return indices


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
            logger.info(
                "Gate: calling interrupt() before agent index %d (run %s)",
                index, pipeline_run_id,
            )
            interrupt({"gate": "phase_boundary", "next_agent_index": index})
            logger.info(
                "Gate: interrupt() returned (resumed) before agent index %d (run %s)",
                index, pipeline_run_id,
            )

        logger.info("Gate: entering agent node index %d (run %s)", index, pipeline_run_id)
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

        logger.info("Executing agent node: %s (index %d, run %s)", agent.name, index, pipeline_run_id)
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
            execution_mode=pipeline.execution_mode,
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
    gate_indices: set[int],
):
    gate_before_set = {index + 1 for index in gate_indices}
    builder = StateGraph(PipelineState)
    for i, agent_id in enumerate(pipeline.agent_sequence):
        builder.add_node(
            f"agent_{i}",
            _make_agent_node(
                pipeline.id, run.id, conversation_id, agent_id, i,
                gate_before=(i in gate_before_set),
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
    pipeline: Pipeline,
    run_id: uuid.UUID,
    conversation_id: uuid.UUID,
    next_agent_index: int | None,
) -> None:
    """Persist the paused state + gate message, notify, stream the gate."""
    if next_agent_index is not None and 0 < next_agent_index < len(pipeline.agent_sequence):
        step_label = f"Agent {next_agent_index} of {len(pipeline.agent_sequence)}"
    else:
        step_label = "This phase"
    session_factory = get_session_factory()
    async with session_factory() as db:
        run = await db.get(PipelineRun, run_id)
        if run is not None and run.status == "running":
            run.status = "paused_for_approval"
        gate_message = Message(
            conversation_id=conversation_id,
            role="approval_gate",
            content=f"{step_label} of **{pipeline.title}** is complete. Approve to continue.",
            gate_status="pending",
        )
        db.add(gate_message)
        await db.commit()
        await db.refresh(gate_message)
        await _notify(
            db, "approval_needed",
            f"Approval needed: {pipeline.title}",
            "Review the output so far and approve to continue.",
            f"/pipelines/{pipeline.id}/chat",
        )
    await streaming_manager.send_gate(
        str(run_id), gate_id=str(gate_message.id),
        summary=f"Approve to continue {pipeline.title}",
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
                logger.info("Gate: run %s flipped approved -> running after %ds", run_id, waited)
                return
    logger.error("Gate: run %s timed out waiting for approval after %ds", run_id, waited)
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
    logger.info(
        "Starting pipeline run %s for pipeline %s (%d agents)",
        run.id, pipeline.id, len(pipeline.agent_sequence),
    )
    if not pipeline.agent_sequence:
        error = "Pipeline has no agents assigned — cannot run an empty agent sequence."
        logger.error("Pipeline run %s failed: %s", run.id, error)
        run.status = "failed"
        run.error = error
        run.completed_at = datetime.now(timezone.utc)
        pipeline.status = "failed"
        await db.commit()
        await _notify(
            db, "pipeline_failed",
            f"Pipeline failed: {pipeline.title}",
            error,
            f"/pipelines/{pipeline.id}/chat",
        )
        await streaming_manager.send_error(str(run.id), error)
        return

    conversation = await _get_or_create_conversation(db, pipeline)
    run.status = "running"
    pipeline.status = "running"
    await db.commit()
    await streaming_manager.send_status(str(run.id), "running")

    session_factory = get_session_factory()

    # Existing-workspace indexing: when the workspace already has files,
    # index it for semantic search (the search_codebase tool) before the
    # first agent runs. Chunks are keyed by workspace_path, so a folder
    # indexed by an earlier pipeline only re-indexes files that changed.
    # An indexing failure never blocks the run — agents still have their
    # file tools; they just lose semantic search.
    try:
        workspace = Path(pipeline.workspace_path).expanduser()
        workspace_has_files = workspace.is_dir() and any(workspace.iterdir())
    except OSError:
        workspace_has_files = False
    if workspace_has_files:

        async def _report_index_progress(files_done: int, total_files: int) -> None:
            await streaming_manager.send_status(
                str(run.id), f"indexing:{files_done}/{total_files}"
            )

        try:
            # Fresh session: indexing a big repo can take a while and must
            # not pin this function's outer connection.
            async with session_factory() as index_db:
                new_chunks = await index_workspace(
                    pipeline.workspace_path,
                    index_db,
                    on_progress=_report_index_progress,
                    pipeline_run_id=run.id,
                )
                total_chunks = await count_workspace_chunks(pipeline.workspace_path, index_db)
        except Exception:
            logger.exception(
                "Workspace indexing failed for %s — running without semantic search",
                pipeline.workspace_path,
            )
        else:
            if total_chunks:
                note = (
                    f"📚 Forge indexed {new_chunks} code chunks from your workspace "
                    "for semantic search"
                    if new_chunks
                    else f"📚 Workspace index is up to date — {total_chunks} code "
                    "chunks available for semantic search"
                )
                db.add(Message(conversation_id=conversation.id, role="system", content=note))
                await db.commit()
                await streaming_manager.send_status(str(run.id), f"indexed:{total_chunks}")

    settings = (await db.execute(select(Settings))).scalar_one_or_none()
    global_strict_mode = settings.strict_mode if settings is not None else False
    gate_every_boundary = _gate_every_boundary(pipeline.execution_mode, global_strict_mode)
    gate_indices = _gate_indices(
        pipeline.plan_md, len(pipeline.agent_sequence), gate_every_boundary, pipeline.execution_mode,
    )
    graph = _build_graph(pipeline, run, conversation.id, gate_indices)
    config = {"configurable": {"thread_id": run.langgraph_thread_id}}
    initial_state: PipelineState = {
        "messages": [],
        "current_agent_index": 0,
        "workspace_path": pipeline.workspace_path,
        "approval_status": "pending",
        "outputs": {},
    }

    try:
        await graph.ainvoke(initial_state, config)
        # A non-empty `next` means interrupt() paused the graph at the gate.
        while True:
            state_snapshot = await graph.aget_state(config)
            if not state_snapshot.next:
                break
            next_agent_index = None
            if state_snapshot.tasks and state_snapshot.tasks[0].interrupts:
                next_agent_index = state_snapshot.tasks[0].interrupts[0].value.get("next_agent_index")
            logger.info(
                "Gate: paused at graph state next=%s, next_agent_index=%s (run %s)",
                state_snapshot.next, next_agent_index, run.id,
            )
            await _pause_for_gate(pipeline, run.id, conversation.id, next_agent_index)
            await _wait_for_run_approval(run.id)
            logger.info("Gate: approval observed, resuming graph (run %s)", run.id)
            await streaming_manager.send_status(str(run.id), "running")
            await graph.ainvoke(Command(resume="approved_gate"), config)
            logger.info("Gate: resume ainvoke returned (run %s)", run.id)

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
