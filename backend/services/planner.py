"""Pipeline planning services.

Runs as background tasks kicked off by POST /api/pipelines:
- generate_execution_plan: fills pipeline.plan_md via the best available
  planning agent (see _pick_planner — CEO-like roles preferred, but any
  agent works). Always terminates in a populated plan_md — LLM failures
  fall back to an editable default template so the frontend's 3-second
  poll never spins forever.
- suggest_and_plan: auto_suggest mode — the planner picks the agent
  sequence, Atlas creates any missing agents, then plan generation runs.
  Same guarantee: plan_md always ends up populated.

No WebSocket notification is sent here: streams are keyed by pipeline_run_id
and no run exists before approval — the frontend polls GET /api/pipelines/{id}.
"""

import json
import logging
import re
import uuid

from sqlalchemy import select

from db.connection import get_session_factory
from db.models import Agent, Pipeline, TokenUsage
from services.agent_executor import (
    CREATE_AGENT_TOOL,
    _anthropic_client,
    _cost,
    _dispatch_create_agent,
)
from services.tool_registry import create_agent

logger = logging.getLogger(__name__)

PLAN_MAX_OUTPUT_TOKENS = 4096
SUGGEST_MAX_OUTPUT_TOKENS = 2048
MAX_MISSING_AGENTS = 5  # cap how many new agents one suggestion may create

ATLAS_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ATLAS_TEAM_MAX_AGENTS = 3          # cap when Atlas designs a team from scratch
ATLAS_TEAM_MAX_TOOL_ITERATIONS = 5  # bounded tool loop, same shape as chat_reply's

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

_Starter template — no plan could be generated automatically (no agents
yet or no working API key). Edit it before approving the pipeline._"""


async def _agents_in_sequence(db, pipeline: Pipeline) -> list[Agent]:
    """The pipeline's agents in run order."""
    rows = (
        await db.execute(select(Agent).where(Agent.id.in_(pipeline.agent_sequence)))
    ).scalars().all()
    by_id = {agent.id: agent for agent in rows}
    return [by_id[agent_id] for agent_id in pipeline.agent_sequence if agent_id in by_id]


# Role keywords that make an agent a good planner, in preference order.
PLANNER_ROLE_PREFERENCES: tuple[tuple[str, ...], ...] = (("ceo",), ("director", "lead"))


async def _pick_planner(db, candidate_agents: list[Agent]) -> Agent | None:
    """Best available planning agent — auto-plan never requires a CEO.

    Preference: a role containing 'CEO', then 'Director' or 'Lead' — checked
    among the candidates first, then across the whole non-eternal roster —
    else the first candidate, else the oldest agent ever created. Returns
    None only when no agents exist at all.
    """
    candidates = [a for a in candidate_agents if not a.is_eternal]

    def first_match(agents: list[Agent], needles: tuple[str, ...]) -> Agent | None:
        for agent in agents:
            role = agent.role.lower()
            if any(needle in role for needle in needles):
                return agent
        return None

    for needles in PLANNER_ROLE_PREFERENCES:
        found = first_match(candidates, needles)
        if found is not None:
            return found
    roster = list(
        (
            await db.execute(
                select(Agent).where(Agent.is_eternal.is_(False)).order_by(Agent.created_at)
            )
        ).scalars().all()
    )
    for needles in PLANNER_ROLE_PREFERENCES:
        found = first_match(roster, needles)
        if found is not None:
            return found
    if candidates:
        return candidates[0]
    return roster[0] if roster else None


def _plan_prompt(pipeline: Pipeline, agents: list[Agent]) -> str:
    if pipeline.execution_mode == "full_auto":
        gate_instruction = (
            "- Do NOT include any \"Approval Gate\" heading or human-checkpoint "
            "section of any kind — this pipeline runs fully autonomously with no "
            "pauses between phases, so a heading like that would be misleading"
        )
    else:
        gate_instruction = "- An approval gate section between phases if multiple phases exist"
    return f"""You are planning the execution of a software pipeline.

Pipeline: {pipeline.title}
Description: {pipeline.description}
Workspace: {pipeline.workspace_path}
Agent sequence: {[f"{a.name} ({a.role})" for a in agents]}

Generate a detailed execution plan in markdown with:
- Objective section
- One phase per agent in the sequence
- Specific tasks for each agent with checkboxes [ ]
{gate_instruction}
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


# --------------------------------------------------------------- auto-suggest


def _suggest_prompt(pipeline: Pipeline, roster: list[Agent]) -> str:
    agent_list = "\n".join(
        f"- {a.id} — {a.name} ({a.role}): {a.specialty}" for a in roster
    ) or "(none yet)"
    return f"""Given these available agents:
{agent_list}

And this task: {pipeline.title} — {pipeline.description}

Select the best agents for this pipeline and specify their order.
List ONLY existing agent ids in agent_sequence; if no existing agent fits a
role, describe it in missing_agents instead (Atlas will create it before the
pipeline runs, and it will be appended after the existing agents in the order
you list).

Respond with ONLY a JSON object, no markdown fences:
{{
  "agent_sequence": ["agent_id_1", "agent_id_2"],
  "missing_agents": [
    {{ "role": "...", "specialty": "...", "reason": "..." }}
  ],
  "reasoning": "..."
}}"""


def _parse_suggestion(text: str) -> dict | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned.strip())
    for candidate in (cleaned, *(m.group(0) for m in [re.search(r"\{.*\}", cleaned, re.DOTALL)] if m)):
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue
    return None


async def _record_usage(agent: Agent, response) -> None:
    session_factory = get_session_factory()
    async with session_factory() as db:
        db.add(
            TokenUsage(
                agent_id=agent.id,
                provider="anthropic",
                model=agent.model,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cost_usd=_cost(
                    agent.model, response.usage.input_tokens, response.usage.output_tokens
                ),
            )
        )
        await db.commit()


async def _atlas_create_missing(client, missing: dict) -> uuid.UUID | None:
    """Have Atlas design and create one missing agent; deterministic fallback
    (no extra LLM call) if Atlas is unavailable or errors."""
    role = str(missing.get("role", "")).strip()
    specialty = str(missing.get("specialty", "")).strip()
    reason = str(missing.get("reason", "")).strip()
    if not role:
        return None

    session_factory = get_session_factory()
    async with session_factory() as db:
        atlas = await db.get(Agent, ATLAS_ID)

    if atlas is not None and client is not None:
        try:
            response = await client.messages.create(
                model=atlas.model,
                max_tokens=SUGGEST_MAX_OUTPUT_TOKENS,
                system=atlas.system_prompt.strip() or "You are Atlas, the creator of agents.",
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Create one new agent now.\n"
                            f"Role: {role}\nSpecialty: {specialty}\nWhy needed: {reason}\n\n"
                            "Call the create_agent tool exactly once, with a "
                            "distinctive one-word name and a focused system prompt."
                        ),
                    }
                ],
                tools=[CREATE_AGENT_TOOL],
                tool_choice={"type": "tool", "name": "create_agent"},
            )
            await _record_usage(atlas, response)
            for block in response.content:
                if block.type == "tool_use" and block.name == "create_agent":
                    async with session_factory() as db:
                        result = json.loads(
                            await _dispatch_create_agent(atlas, dict(block.input), db)
                        )
                    return uuid.UUID(result["id"])
        except Exception as exc:
            logger.warning("Atlas could not create '%s' (%s) — synthesizing directly", role, exc)

    async with session_factory() as db:
        result = await create_agent(
            name=role,
            role=role,
            specialty=specialty,
            system_prompt=(
                f"You are a {role}. {specialty}. You work inside a Forge pipeline: "
                "complete the task you are given using your tools, then summarize "
                "what you did."
            ),
            db=db,
            creator_agent_id=ATLAS_ID,
        )
    return uuid.UUID(result["id"])


async def _atlas_build_team(client, pipeline: Pipeline) -> tuple[list[uuid.UUID], str]:
    """No agents exist at all: have Atlas design and create a small team
    directly via a bounded create_agent tool loop (same shape as chat_reply's
    eternal-agent loop in agent_executor.py)."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        atlas = await db.get(Agent, ATLAS_ID)
    if atlas is None:
        return [], "Atlas is not available — could not auto-build a team."

    request_kwargs = {
        "model": atlas.model,
        "max_tokens": SUGGEST_MAX_OUTPUT_TOKENS,
        "system": atlas.system_prompt.strip() or "You are Atlas, the creator of agents.",
        "tools": [CREATE_AGENT_TOOL],
    }
    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                f"Design a complete agent team for this task: {pipeline.title} — "
                f"{pipeline.description}.\nCreate each agent you need using the "
                "create_agent tool. Create them in execution order. Create "
                f"{ATLAS_TEAM_MAX_AGENTS} agents maximum."
            ),
        }
    ]
    created: list[uuid.UUID] = []
    try:
        response = await client.messages.create(messages=messages, **request_kwargs)
        await _record_usage(atlas, response)
        for _ in range(ATLAS_TEAM_MAX_TOOL_ITERATIONS):
            if response.stop_reason != "tool_use":
                break
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use" or block.name != "create_agent":
                    continue
                if len(created) >= ATLAS_TEAM_MAX_AGENTS:
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": "Team is complete — no more agents needed.",
                            "is_error": True,
                        }
                    )
                    continue
                async with session_factory() as db:
                    result_str = await _dispatch_create_agent(atlas, dict(block.input), db)
                created.append(uuid.UUID(json.loads(result_str)["id"]))
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": result_str}
                )
            messages.append({"role": "user", "content": tool_results})
            if len(created) >= ATLAS_TEAM_MAX_AGENTS:
                break
            response = await client.messages.create(messages=messages, **request_kwargs)
            await _record_usage(atlas, response)
    except Exception as exc:
        logger.warning("Atlas could not build a team for %s (%s)", pipeline.id, exc)

    if created:
        reasoning = (
            f"No agents existed yet, so Atlas designed and created a team of "
            f"{len(created)} agent(s) for this task."
        )
    else:
        reasoning = (
            "No agents exist yet, and Atlas could not build a team automatically. "
            "Chat with Atlas to create agents, then create this pipeline again."
        )
    return created, reasoning


async def suggest_and_plan(pipeline_id: uuid.UUID) -> None:
    """Background task for auto_suggest pipelines: the best available
    planner picks the sequence, Atlas fills gaps, then plan generation runs."""
    session_factory = get_session_factory()
    async with session_factory() as db:
        pipeline = await db.get(Pipeline, pipeline_id)
        if pipeline is None:
            return
        # Eternal agents never run tasks themselves, so they are not selectable.
        roster = (
            await db.execute(
                select(Agent).where(Agent.is_eternal.is_(False)).order_by(Agent.created_at)
            )
        ).scalars().all()
        planner = await _pick_planner(db, list(roster))
        client = None
        try:
            client = await _anthropic_client(db)
        except Exception as exc:
            logger.warning("Auto-suggest for %s: no LLM client (%s)", pipeline_id, exc)

    logger.info("Auto-plan: found %d existing agents", len(roster))

    sequence: list[uuid.UUID] = []
    reasoning: str

    if planner is None:
        if client is None:
            reasoning = (
                "No agents exist yet, so nothing could be selected. Chat with Atlas "
                "to build your team, then create this pipeline again."
            )
        else:
            logger.info(
                "Auto-plan: no existing agents — asking Atlas to build a team for %s",
                pipeline_id,
            )
            sequence, reasoning = await _atlas_build_team(client, pipeline)
            logger.info("Auto-plan: Atlas created %d new agents", len(sequence))
    elif client is None:
        sequence = [planner.id]
        reasoning = (
            f"Auto-suggest needs a working Anthropic API key; defaulted to "
            f"{planner.name} ({planner.role}) alone. Add a key in Settings and "
            "try again for a full team."
        )
    else:
        try:
            response = await client.messages.create(
                model=planner.model,
                max_tokens=SUGGEST_MAX_OUTPUT_TOKENS,
                system=planner.system_prompt.strip()
                or f"You are {planner.name}, a {planner.role}.",
                messages=[{"role": "user", "content": _suggest_prompt(pipeline, list(roster))}],
            )
            await _record_usage(planner, response)
            text = "".join(b.text for b in response.content if b.type == "text")
            data = _parse_suggestion(text)
            if data is None:
                raise ValueError("Planner response was not valid JSON")

            roster_ids = {agent.id for agent in roster}
            for raw_id in data.get("agent_sequence", []):
                try:
                    agent_id = uuid.UUID(str(raw_id))
                except ValueError:
                    continue
                if agent_id in roster_ids and agent_id not in sequence:
                    sequence.append(agent_id)

            missing = data.get("missing_agents") or []
            logger.info("Auto-plan: Atlas creating %d new agents", min(len(missing), MAX_MISSING_AGENTS))
            for entry in missing[:MAX_MISSING_AGENTS]:
                if not isinstance(entry, dict):
                    continue
                created_id = await _atlas_create_missing(client, entry)
                if created_id is not None:
                    sequence.append(created_id)

            reasoning = str(data.get("reasoning", "")).strip() or "No reasoning provided."
            if not sequence:
                sequence = [planner.id]
                reasoning += f"\n\n(No selectable agents were returned — defaulted to {planner.name}.)"
        except Exception as exc:
            logger.warning("Auto-suggest for %s failed (%s) — defaulting", pipeline_id, exc)
            sequence = [planner.id]
            reasoning = (
                f"Auto-suggest failed ({exc}); defaulted to {planner.name} "
                f"({planner.role}) alone. Approve to run anyway, or delete and retry."
            )

    async with session_factory() as db:
        row = await db.get(Pipeline, pipeline_id)
        if row is None:
            return  # deleted while we were thinking
        row.agent_sequence = sequence
        row.suggestion_reasoning = reasoning
        seq_agents = (
            (await db.execute(select(Agent).where(Agent.id.in_(sequence)))).scalars().all()
            if sequence
            else []
        )
        await db.commit()

    names_by_id = {a.id: a.name for a in seq_agents}
    logger.info(
        "Auto-plan: final sequence %s",
        [names_by_id.get(agent_id, str(agent_id)) for agent_id in sequence],
    )

    await generate_execution_plan(pipeline_id)
