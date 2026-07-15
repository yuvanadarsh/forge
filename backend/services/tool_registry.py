"""Agent tools: read_file, write_file, run_command, search_codebase.

Every path is confined to the pipeline's workspace_path (symlinks are
resolved before the containment check). Every call is auditable: pass a
db session and the tool writes to file_access_log / command_log.
"""

import asyncio
import fnmatch
import os
import time
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CommandLog, FileAccessLog

COMMAND_TIMEOUT_SECONDS = 60
MAX_COMMAND_OUTPUT_CHARS = 50_000   # keep model context and command_log rows bounded
MAX_READ_BYTES = 200_000
MAX_SEARCH_MATCHES = 200


class ToolError(Exception):
    """Tool failed — message is safe to surface to the agent."""


class NeedsApprovalError(Exception):
    """Command requires human approval before execution."""

    def __init__(self, command: str, reason: str) -> None:
        super().__init__(reason)
        self.command = command
        self.reason = reason


def _resolve_safe(path: str, workspace_path: str) -> Path:
    """Resolve path inside the workspace; raise ToolError on escape."""
    workspace = Path(workspace_path).expanduser().resolve()
    candidate = Path(path)
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


def _matches_list(command: str, entries: list[str]) -> bool:
    """A list entry matches on exact command or word-boundary prefix,
    so denied 'rm' blocks 'rm -rf x' but not 'rmdir'."""
    cmd = command.strip()
    return any(cmd == e or cmd.startswith(f"{e} ") for e in (x.strip() for x in entries) if e)


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
    if mode == "request_review":
        raise NeedsApprovalError(command, "settings require review of terminal commands")
    # agent_decides: only allow-listed commands run unattended; anything
    # else still goes to a human — the safe reading of "agent decides".
    raise NeedsApprovalError(command, "command is not on the allow list")


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
    """Case-insensitive substring search across workspace files."""
    workspace = Path(workspace_path).expanduser().resolve()
    if not workspace.is_dir():
        raise ToolError(f"Workspace does not exist: {workspace_path}")
    if not query.strip():
        raise ToolError("Search query is empty")

    patterns = _load_gitignore(workspace)
    needle = query.lower()
    matches: list[dict] = []

    for root, dirnames, filenames in os.walk(workspace):
        rel_root = os.path.relpath(root, workspace)
        dirnames[:] = [
            d for d in dirnames
            if d != ".git" and not _is_ignored(os.path.normpath(os.path.join(rel_root, d)), patterns)
        ]
        for filename in filenames:
            rel_path = os.path.normpath(os.path.join(rel_root, filename))
            if _is_ignored(rel_path, patterns):
                continue
            file_path = Path(root) / filename
            try:
                if file_path.stat().st_size > MAX_READ_BYTES:
                    continue
                text = file_path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue  # unreadable/binary files are not searchable
            for line_no, line in enumerate(text.splitlines(), start=1):
                if needle in line.lower():
                    matches.append({"file": rel_path, "line": line_no, "content": line.strip()[:300]})
                    if len(matches) >= MAX_SEARCH_MATCHES:
                        break
            if len(matches) >= MAX_SEARCH_MATCHES:
                break
        if len(matches) >= MAX_SEARCH_MATCHES:
            break

    await _log_file_access(
        db, path=f"search:{query}", operation="search", num_bytes=None,
        agent_id=agent_id, pipeline_run_id=pipeline_run_id,
    )
    return matches
