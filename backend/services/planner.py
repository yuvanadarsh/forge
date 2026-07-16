"""CEO planning services.

Runs as background tasks kicked off by POST /api/pipelines:
- generate_execution_plan: fills pipeline.plan_md via the CEO agent (or the
  first agent in the sequence). Always terminates in a populated plan_md —
  LLM failures fall back to an editable default template so the frontend's
  3-second poll never spins forever.

No WebSocket notification is sent here: streams are keyed by pipeline_run_id
and no run exists before approval — the frontend polls GET /api/pipelines/{id}.
"""

import logging
import uuid

from sqlalchemy import select

from db.connection import get_session_factory
from db.models import Agent, Pipeline, TokenUsage
from services.agent_executor import _anthropic_client, _cost

logger = logging.getLogger(__name__)

PLAN_MAX_OUTPUT_TOKENS = 4096

DEFAULT_PLAN_TEMPLATE = """# Execution Plan: {title}

## Objective
{description}

## Phase 1 — Planning
- [ ] Review the objective and the workspace
- [ ] Break the work into concrete tasks per agent

## Phase 2 — Execution
- [ ] Complete the tasks from Phase 1
- [ ] Summarize what was built

## Success Criteria
- [ ] The objective above is met and verified

_Starter template — no plan could be generated automatically (no CEO agent
or no working API key). Edit it before approving the pipeline._"""


async def _agents_in_sequence(db, pipeline: Pipeline) -> list[Agent]:
    """The pipeline's agents in run order."""
    rows = (
        await db.execute(select(Agent).where(Agent.id.in_(pipeline.agent_sequence)))
    ).scalars().all()
    by_id = {agent.id: agent for agent in rows}
    return [by_id[agent_id] for agent_id in pipeline.agent_sequence if agent_id in by_id]


async def _pick_planner(db, sequence_agents: list[Agent]) -> Agent | None:
    """CEO in the sequence, else any CEO on the roster, else the first agent."""
    for agent in sequence_agents:
        if agent.role.strip().lower() == "ceo":
            return agent
    ceo = (
        await db.execute(select(Agent).where(Agent.role.ilike("ceo")).order_by(Agent.created_at))
    ).scalars().first()
    if ceo is not None:
        return ceo
    return sequence_agents[0] if sequence_agents else None


def _plan_prompt(pipeline: Pipeline, agents: list[Agent]) -> str:
    return f"""You are planning the execution of a software pipeline.

Pipeline: {pipeline.title}
Description: {pipeline.description}
Workspace: {pipeline.workspace_path}
Agent sequence: {[f"{a.name} ({a.role})" for a in agents]}

Generate a detailed execution plan in markdown with:
- Objective section
- One phase per agent in the sequence
- Specific tasks for each agent with checkboxes [ ]
- An approval gate section between phases if multiple phases exist
- Success criteria

Format it as clean markdown. Be specific and actionable. Return only the
markdown plan with no preamble."""


def _default_plan(pipeline: Pipeline) -> str:
    return DEFAULT_PLAN_TEMPLATE.format(
        title=pipeline.title,
        description=pipeline.description or "Describe what this pipeline should build.",
    )


async def _write_plan(pipeline_id: uuid.UUID, plan_md: str) -> None:
    """Persist the plan unless someone else already filled it in."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        pipeline = await db.get(Pipeline, pipeline_id)
        if pipeline is not None and not pipeline.plan_md.strip():
            pipeline.plan_md = plan_md
            await db.commit()


async def generate_execution_plan(pipeline_id: uuid.UUID) -> None:
    """Background task: populate pipeline.plan_md, falling back to a template."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        pipeline = await db.get(Pipeline, pipeline_id)
        if pipeline is None or pipeline.plan_md.strip():
            return  # deleted, or the user supplied their own plan
        sequence_agents = await _agents_in_sequence(db, pipeline)
        planner = await _pick_planner(db, sequence_agents)
        if planner is None:
            await _write_plan(pipeline_id, _default_plan(pipeline))
            return
        try:
            client = await _anthropic_client(db)
        except Exception as exc:
            logger.warning("Plan generation for %s: no LLM client (%s)", pipeline_id, exc)
            await _write_plan(pipeline_id, _default_plan(pipeline))
            return

    try:
        response = await client.messages.create(
            model=planner.model,
            max_tokens=PLAN_MAX_OUTPUT_TOKENS,
            system=planner.system_prompt.strip() or f"You are {planner.name}, a {planner.role}.",
            messages=[{"role": "user", "content": _plan_prompt(pipeline, sequence_agents)}],
        )
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        if not text:
            raise ValueError("model returned an empty plan")
    except Exception as exc:
        logger.warning("Plan generation for %s failed (%s) — using template", pipeline_id, exc)
        await _write_plan(pipeline_id, _default_plan(pipeline))
        return

    async with session_factory() as db:
        db.add(
            TokenUsage(
                agent_id=planner.id,
                provider="anthropic",
                model=planner.model,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cost_usd=_cost(
                    planner.model, response.usage.input_tokens, response.usage.output_tokens
                ),
            )
        )
        await db.commit()
    await _write_plan(pipeline_id, text)
