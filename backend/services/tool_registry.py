"""Agent tools: read_file, write_file, run_command, search_codebase, create_agent.

Every path is confined to the pipeline's workspace_path (symlinks are
resolved before the containment check). Every call is auditable: pass a
db session and the tool writes to file_access_log / command_log.
create_agent is only exposed to eternal agents (Atlas).
"""

import asyncio
import fnmatch
import os
import re
import time
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Agent, AgentMemory, CommandLog, FileAccessLog
from services import memory_service

COMMAND_TIMEOUT_SECONDS = 60
MAX_COMMAND_OUTPUT_CHARS = 50_000   # keep model context and command_log rows bounded
MAX_READ_BYTES = 200_000
SEARCH_TOP_K = 5                    # codebase chunks returned per semantic search


class ToolError(Exception):
    """Tool failed — message is safe to surface to the agent."""


class NeedsApprovalError(Exception):
    """Command requires human approval before execution."""

    def __init__(self, command: str, reason: str) -> None:
        super().__init__(reason)
        self.command = command
        self.reason = reason


def _resolve_safe(path: str, workspace_path: str) -> Path:
    """Resolve path inside the workspace; raise ToolError on escape.

    Agents sometimes pass a path already prefixed with the workspace's own
    folder name (e.g. 'my-project/todo.py' against a workspace_path that
    already ends in '.../my-project'), which would otherwise double-nest
    into '.../my-project/my-project/todo.py'. Strip that redundant leading
    segment before joining.
    """
    workspace = Path(workspace_path).expanduser().resolve()
    candidate = Path(path)
    if not candidate.is_absolute() and candidate.parts and candidate.parts[0] == workspace.name:
        candidate = Path(*candidate.parts[1:]) if len(candidate.parts) > 1 else Path(".")
    target = (candidate if candidate.is_absolute() else workspace / candidate).resolve()
    if target != workspace and not target.is_relative_to(workspace):
        raise ToolError(f"Path '{path}' escapes the workspace — access denied")
    return target


async def _log_file_access(
    db: AsyncSession | None,
    *,
    path: str,
    operation: str,
    num_bytes: int | None,
    agent_id: uuid.UUID | None,
    pipeline_run_id: uuid.UUID | None,
) -> None:
    if db is None:
        return
    db.add(
        FileAccessLog(
            pipeline_run_id=pipeline_run_id,
            agent_id=agent_id,
            path=path,
            operation=operation,
            bytes=num_bytes,
        )
    )
    await db.commit()


async def read_file(
    path: str,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    target = _resolve_safe(path, workspace_path)
    if not target.is_file():
        raise ToolError(f"File not found: {path}")
    if target.stat().st_size > MAX_READ_BYTES:
        raise ToolError(f"File too large to read ({target.stat().st_size} bytes, limit {MAX_READ_BYTES})")
    try:
        content = target.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise ToolError(f"Could not read {path}: {exc}") from exc
    await _log_file_access(
        db, path=str(target), operation="read", num_bytes=len(content.encode()),
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return content


async def write_file(
    path: str,
    content: str,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    target = _resolve_safe(path, workspace_path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        data = content.encode("utf-8")
        target.write_bytes(data)
    except OSError as exc:
        raise ToolError(f"Could not write {path}: {exc}") from exc
    await _log_file_access(
        db, path=str(target), operation="write", num_bytes=len(data),
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return f"Wrote {target} ({len(data)} bytes)"


async def append_file(
    path: str,
    content: str,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    """Append to a file, creating it (parents included) if missing — the
    chunked-writing companion to write_file for large files."""
    target = _resolve_safe(path, workspace_path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        data = content.encode("utf-8")
        with target.open("ab") as handle:
            handle.write(data)
        total_bytes = target.stat().st_size
    except OSError as exc:
        raise ToolError(f"Could not append to {path}: {exc}") from exc
    await _log_file_access(
        db, path=str(target), operation="append", num_bytes=len(data),
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return f"Appended {len(data)} bytes to {target} — file is now {total_bytes} bytes"


async def read_file_section(
    path: str,
    start_line: int,
    end_line: int,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    """Read only lines start_line..end_line (1-indexed, inclusive).

    Unlike read_file there is no whole-file size gate — reading a slice of
    a huge file is the point — but the returned section itself stays under
    MAX_READ_BYTES. Reads to EOF when end_line is past the last line.
    """
    target = _resolve_safe(path, workspace_path)
    if not target.is_file():
        raise ToolError(f"File not found: {path}")
    try:
        start_line, end_line = int(start_line), int(end_line)
    except (TypeError, ValueError) as exc:
        raise ToolError("start_line and end_line must be integers") from exc
    if start_line < 1 or end_line < start_line:
        raise ToolError("start_line must be >= 1 and end_line must be >= start_line")

    section_lines: list[str] = []
    section_bytes = 0
    try:
        with target.open("r", encoding="utf-8", errors="replace") as handle:
            for line_no, line in enumerate(handle, start=1):
                if line_no < start_line:
                    continue
                if line_no > end_line:
                    break
                stripped = line.rstrip("\n")
                section_bytes += len(stripped.encode()) + 1
                if section_bytes > MAX_READ_BYTES:
                    raise ToolError(
                        f"Section is over {MAX_READ_BYTES} bytes — request a "
                        "smaller line range"
                    )
                section_lines.append(stripped)
    except OSError as exc:
        raise ToolError(f"Could not read {path}: {exc}") from exc
    if not section_lines:
        raise ToolError(f"{path} has fewer than {start_line} lines — nothing to read")

    actual_end = start_line + len(section_lines) - 1
    content = "\n".join(section_lines)
    await _log_file_access(
        db, path=str(target), operation="read_section", num_bytes=len(content.encode()),
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return f"Lines {start_line}-{actual_end} of {path}:\n\n{content}"


async def replace_in_file(
    path: str,
    old_content: str,
    new_content: str,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> str:
    """Replace the FIRST occurrence of old_content with new_content.

    Raises when old_content is absent so a stale/imagined snippet can never
    silently no-op — the agent must read the real file and try again.
    """
    target = _resolve_safe(path, workspace_path)
    if not target.is_file():
        raise ToolError(f"File not found: {path}")
    if not old_content:
        raise ToolError("old_content is empty — pass the exact text to replace")
    try:
        text = target.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise ToolError(f"Could not read {path}: {exc}") from exc
    if old_content not in text:
        raise ToolError(
            f"old_content not found in {path} — no changes made. Read the "
            "current file content (read_file or read_file_section) and pass "
            "the text exactly as it appears."
        )
    try:
        data = text.replace(old_content, new_content, 1).encode("utf-8")
        target.write_bytes(data)
    except OSError as exc:
        raise ToolError(f"Could not write {path}: {exc}") from exc
    await _log_file_access(
        db, path=str(target), operation="replace", num_bytes=len(data),
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return f"Replaced in {path} — file is now {len(data)} bytes"


def _matches_list(command: str, entries: list[str]) -> bool:
    """A list entry matches on exact command or word-boundary prefix,
    so denied 'rm' blocks 'rm -rf x' but not 'rmdir'."""
    cmd = command.strip()
    return any(cmd == e or cmd.startswith(f"{e} ") for e in (x.strip() for x in entries) if e)


# agent_decides: commands matching any of these run unattended; everything
# else in that mode also runs unattended (see _check_command_policy) unless
# denied/strict — only these patterns are treated as risky enough to ask.
_RISKY_COMMAND_PATTERNS = [
    re.compile(r"^\s*rm\b"),
    re.compile(r"^\s*sudo\b"),
    re.compile(r"^\s*chmod\b"),
    re.compile(r"^\s*chown\b"),
    re.compile(r"^\s*dd\b"),
    re.compile(r"^\s*mkfs"),
    re.compile(r"^\s*wget\b"),
    re.compile(r"\bcurl\b[^\n]*(-o\b|--output\b)"),
]


def _is_risky_command(command: str) -> bool:
    return any(pattern.search(command) for pattern in _RISKY_COMMAND_PATTERNS)


def _check_command_policy(command: str, settings: dict) -> None:
    """Apply the security model; raises on block or approval requirement."""
    denied = settings.get("denied_commands") or []
    allowed = settings.get("allowed_commands") or []
    mode = settings.get("terminal_execution", "request_review")

    if _matches_list(command, denied):
        raise ToolError(f"Command is on the denied list and will never run: {command}")
    if settings.get("strict_mode"):
        raise NeedsApprovalError(command, "strict mode: all agent actions require approval")
    if _matches_list(command, allowed):
        return  # allow list always runs regardless of terminal_execution
    if mode == "always_proceed":
        return
    if mode == "agent_decides":
        # Safe commands run unattended; only risky ones (rm, sudo, chmod,
        # curl -o, wget, …) go to a human — the balanced reading of
        # "agent decides", not a synonym for request_review.
        if _is_risky_command(command):
            raise NeedsApprovalError(command, "command looks risky under agent_decides and requires approval")
        return
    # request_review (default): everything not on the allow list needs approval.
    raise NeedsApprovalError(command, "settings require review of terminal commands")


async def run_command(
    command: str,
    workspace_path: str,
    settings: dict,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
    approved: bool = False,
) -> dict:
    """Execute a shell command inside the workspace.

    `approved=True` skips the policy check — used when re-running a command
    after the human clears its approval gate.
    """
    workspace = Path(workspace_path).expanduser().resolve()
    if not workspace.is_dir():
        raise ToolError(f"Workspace does not exist: {workspace_path}")
    if not approved:
        _check_command_policy(command, settings)

    started = time.monotonic()
    proc = await asyncio.create_subprocess_shell(
        command,
        cwd=workspace,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    timed_out = False
    try:
        raw, _ = await asyncio.wait_for(proc.communicate(), timeout=COMMAND_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        timed_out = True
        proc.kill()
        raw, _ = await proc.communicate()

    duration_ms = int((time.monotonic() - started) * 1000)
    output = raw.decode("utf-8", errors="replace")
    if len(output) > MAX_COMMAND_OUTPUT_CHARS:
        output = output[:MAX_COMMAND_OUTPUT_CHARS] + "\n… [output truncated]"
    if timed_out:
        output += f"\n… [killed: exceeded {COMMAND_TIMEOUT_SECONDS}s timeout]"
    exit_code = -1 if timed_out else (proc.returncode if proc.returncode is not None else -1)

    if db is not None:
        db.add(
            CommandLog(
                pipeline_run_id=pipeline_run_id,
                agent_id=agent_id,
                command=command,
                output=output,
                exit_code=exit_code,
                duration_ms=duration_ms,
            )
        )
        await db.commit()

    return {"command": command, "output": output, "exit_code": exit_code, "duration_ms": duration_ms}


_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


async def create_agent(
    name: str,
    role: str,
    specialty: str,
    system_prompt: str,
    model: str = "claude-sonnet-4-6",
    avatar_color: str = "#6366f1",
    *,
    db: AsyncSession | None = None,
    creator_agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> dict:
    """Create a new agent in Forge and return the created agent.

    Only eternal agents (Atlas) get this tool — callers enforce that before
    dispatching. The creation is audited in file_access_log with
    operation='agent_created'.
    """
    if db is None:
        raise ToolError("create_agent needs a database session")
    name, role = name.strip(), role.strip()
    if not name or not role:
        raise ToolError("Both 'name' and 'role' are required to create an agent")
    if not system_prompt.strip():
        raise ToolError("'system_prompt' is required — it defines the agent's behavior")
    if not _HEX_COLOR.match(avatar_color):
        avatar_color = "#6366f1"

    agent = Agent(
        name=name,
        role=role,
        specialty=specialty.strip(),
        system_prompt=system_prompt.strip(),
        model=model.strip() or "claude-sonnet-4-6",
        avatar_color=avatar_color,
    )
    db.add(agent)
    await db.flush()
    db.add(
        FileAccessLog(
            pipeline_run_id=pipeline_run_id,
            agent_id=creator_agent_id,
            path=f"agent:{agent.id}",
            operation="agent_created",
            bytes=None,
        )
    )
    await db.commit()
    return {
        "id": str(agent.id),
        "name": agent.name,
        "role": agent.role,
        "specialty": agent.specialty,
        "status": "created",
    }


def normalize_workspace_path(workspace_path: str) -> str:
    """Canonical string key for a workspace (expanduser + resolve).

    Codebase chunks in agent_memory are stored and searched by this key, so
    the writer (workspace_indexer) and reader (search_codebase) must agree
    on it exactly.
    """
    return str(Path(workspace_path).expanduser().resolve())


def _load_gitignore(workspace: Path) -> list[str]:
    gitignore = workspace / ".gitignore"
    if not gitignore.is_file():
        return []
    patterns = []
    for line in gitignore.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("!"):
            patterns.append(line.rstrip("/").lstrip("/"))
    return patterns


def _is_ignored(rel_path: str, patterns: list[str]) -> bool:
    # fnmatch-based subset of gitignore semantics (no negation) — enough to
    # keep node_modules/.git/build junk out of search results.
    parts = rel_path.split(os.sep)
    for pattern in patterns:
        if fnmatch.fnmatch(rel_path, pattern) or any(fnmatch.fnmatch(p, pattern) for p in parts):
            return True
    return False


async def search_codebase(
    query: str,
    workspace_path: str,
    *,
    db: AsyncSession | None = None,
    agent_id: uuid.UUID | None = None,
    pipeline_run_id: uuid.UUID | None = None,
) -> list[dict]:
    """Semantic (vector) search over the workspace's indexed codebase chunks.

    Scoped by workspace_path, not pipeline — an index built by an earlier
    pipeline on the same folder serves this search too. The index is built
    at run start (workspace_indexer), so files written during the current
    run are not searchable until the next one. Fresh, never-indexed
    workspaces simply return no matches.
    """
    if not query.strip():
        raise ToolError("Search query is empty")
    if db is None:
        raise ToolError("search_codebase needs a database session")
    query_embedding = await memory_service.embed_async(query)
    if query_embedding is None:
        raise ToolError("Embedding model unavailable — semantic search cannot run right now")

    # The score must be selected as a column — it is not an attribute that
    # exists on the AgentMemory row itself.
    distance = AgentMemory.embedding.cosine_distance(query_embedding)
    results = await db.execute(
        select(AgentMemory, distance.label("distance"))
        .where(AgentMemory.memory_type == "codebase_chunk")
        .where(AgentMemory.workspace_path == normalize_workspace_path(workspace_path))
        .order_by(distance)
        .limit(SEARCH_TOP_K)
    )
    matches = [
        {"content": row.AgentMemory.content, "distance": float(row.distance)}
        for row in results
    ]

    await _log_file_access(
        db, path=f"search:{query}", operation="search", num_bytes=None,
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return matches
