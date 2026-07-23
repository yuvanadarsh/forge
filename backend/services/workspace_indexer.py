"""Workspace indexing for semantic codebase search (RAG).

Chunks every text file in a workspace into overlapping line segments, embeds
them locally (memory_service), and stores them in agent_memory as
memory_type='codebase_chunk' rows keyed by workspace_path — NOT pipeline id —
so an index built by one pipeline stays searchable by every later pipeline
pointed at the same folder (the pipeline-per-feature pattern).

Re-indexing is incremental: a file whose hash matches its indexed chunks is
skipped, a changed file has its old chunks replaced, and chunks for files
deleted from disk are removed. Chunks are ONLY reachable through the
search_codebase tool — never auto-injected into agent context.
"""

import asyncio
import hashlib
import logging
import os
import uuid
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentMemory
from services.memory_service import embed_batch
from services.tool_registry import _is_ignored, _load_gitignore, normalize_workspace_path

logger = logging.getLogger(__name__)

CHUNK_LINES = 200
CHUNK_OVERLAP_LINES = 20
MAX_FILE_BYTES = 100 * 1024  # only text files under 100KB are indexed

# Dot-directories (.git, .venv, .next, …) are skipped wholesale in the walk.
INDEX_SKIP_DIRS = {
    "node_modules", "__pycache__", "venv", "dist", "build", "target", "coverage",
}
# Cheap extension pre-filter; anything that slips through is caught by the
# strict-UTF-8 decode (binary files fail it and are skipped).
BINARY_EXTENSIONS = {
    ".pyc", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".tar", ".gz", ".tgz", ".woff", ".woff2", ".ttf", ".otf",
    ".mp3", ".mp4", ".mov", ".so", ".dylib", ".db", ".sqlite",
}


def _chunk_lines(text: str) -> list[tuple[int, int, str]]:
    """(start_line, end_line, chunk_text) segments, 1-indexed inclusive:
    CHUNK_LINES lines per chunk with CHUNK_OVERLAP_LINES of overlap."""
    lines = text.splitlines()
    if not lines:
        return []
    chunks: list[tuple[int, int, str]] = []
    start = 0
    while True:
        end = min(start + CHUNK_LINES, len(lines))
        chunks.append((start + 1, end, "\n".join(lines[start:end])))
        if end == len(lines):
            return chunks
        start = end - CHUNK_OVERLAP_LINES


def _collect_files(workspace: Path) -> list[tuple[str, Path]]:
    """Sorted (relative_path, absolute_path) for every indexable file:
    gitignore-aware, skips dot-dirs/junk dirs, binary extensions, and
    files over MAX_FILE_BYTES. Sync file I/O — call via asyncio.to_thread."""
    patterns = _load_gitignore(workspace)
    collected: list[tuple[str, Path]] = []
    for root, dirnames, filenames in os.walk(workspace):
        rel_root = os.path.relpath(root, workspace)
        dirnames[:] = [
            d for d in dirnames
            if not d.startswith(".")
            and d not in INDEX_SKIP_DIRS
            and not _is_ignored(os.path.normpath(os.path.join(rel_root, d)), patterns)
        ]
        for filename in filenames:
            if filename.startswith("."):
                continue
            if Path(filename).suffix.lower() in BINARY_EXTENSIONS:
                continue
            rel_path = os.path.normpath(os.path.join(rel_root, filename))
            if _is_ignored(rel_path, patterns):
                continue
            abs_path = Path(root) / filename
            try:
                if abs_path.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            collected.append((rel_path, abs_path))
    return sorted(collected)


async def count_workspace_chunks(workspace_path: str, db: AsyncSession) -> int:
    """Total codebase chunks currently indexed for this workspace."""
    return (
        await db.execute(
            select(func.count())
            .select_from(AgentMemory)
            .where(
                AgentMemory.memory_type == "codebase_chunk",
                AgentMemory.workspace_path == normalize_workspace_path(workspace_path),
            )
        )
    ).scalar_one()


async def index_workspace(
    workspace_path: str,
    db: AsyncSession,
    on_progress=None,
    *,
    pipeline_run_id: uuid.UUID | None = None,
) -> int:
    """Index all code files in workspace_path into agent_memory for RAG.

    Returns the number of chunks indexed (new or changed files only —
    unchanged files are skipped via their stored file_hash). Calls
    `await on_progress(current, total)` after each file if provided, so the
    caller can stream status over the WebSocket. Commits per file: a failure
    partway leaves a consistent, resumable partial index.
    """
    workspace = Path(workspace_path).expanduser()
    if not workspace.is_dir():
        return 0
    workspace_key = normalize_workspace_path(workspace_path)

    files = await asyncio.to_thread(_collect_files, workspace)
    if not files:
        return 0

    # Already-indexed state: source_file -> file_hash. A file with mixed
    # hashes (interrupted earlier run) maps to None so it re-indexes.
    rows = await db.execute(
        select(AgentMemory.source_file, AgentMemory.file_hash)
        .where(
            AgentMemory.memory_type == "codebase_chunk",
            AgentMemory.workspace_path == workspace_key,
        )
        .distinct()
    )
    indexed: dict[str, str | None] = {}
    for source_file, file_hash in rows.all():
        if source_file in indexed and indexed[source_file] != file_hash:
            indexed[source_file] = None
        else:
            indexed[source_file] = file_hash

    total = len(files)
    new_chunks = 0
    seen_files: set[str] = set()
    for done, (rel_path, abs_path) in enumerate(files, start=1):
        seen_files.add(rel_path)
        try:
            raw = await asyncio.to_thread(abs_path.read_bytes)
            text = raw.decode("utf-8")  # strict: undecodable = binary, skip
        except (OSError, UnicodeDecodeError):
            if on_progress is not None:
                await on_progress(done, total)
            continue

        file_hash = hashlib.sha256(raw).hexdigest()
        if indexed.get(rel_path) == file_hash:
            if on_progress is not None:
                await on_progress(done, total)
            continue

        chunks = _chunk_lines(text)
        contents = [
            f"File: {rel_path} (lines {start}-{end})\n\n{chunk_text}"
            for start, end, chunk_text in chunks
        ]
        # Embed off the event loop, one model call per file (batch).
        embeddings = await asyncio.to_thread(embed_batch, contents)

        # Replace, don't accumulate: a changed file's old chunks go away
        # in the same commit that writes its new ones.
        await db.execute(
            delete(AgentMemory).where(
                AgentMemory.memory_type == "codebase_chunk",
                AgentMemory.workspace_path == workspace_key,
                AgentMemory.source_file == rel_path,
            )
        )
        for content, embedding in zip(contents, embeddings):
            db.add(
                AgentMemory(
                    agent_id=None,  # workspace-level, not agent-specific
                    content=content,
                    embedding=embedding,
                    memory_type="codebase_chunk",
                    workspace_path=workspace_key,
                    source_file=rel_path,
                    file_hash=file_hash,
                    source_pipeline_run_id=pipeline_run_id,
                )
            )
        await db.commit()
        new_chunks += len(chunks)
        if on_progress is not None:
            await on_progress(done, total)

    # Files that were indexed before but no longer exist on disk: their
    # chunks would otherwise surface as stale search results forever.
    stale = set(indexed) - seen_files
    if stale:
        await db.execute(
            delete(AgentMemory).where(
                AgentMemory.memory_type == "codebase_chunk",
                AgentMemory.workspace_path == workspace_key,
                AgentMemory.source_file.in_(stale),
            )
        )
        await db.commit()
        logger.info(
            "Removed chunks for %d deleted files from workspace index %s",
            len(stale), workspace_key,
        )

    logger.info(
        "Indexed workspace %s: %d files scanned, %d chunks written",
        workspace_key, total, new_chunks,
    )
    return new_chunks
