"""In-app, container-aware workspace folder browser.

Backs CreatePipelineModal's "Existing folder" picker. A native OS file
picker (<input type="file" webkitdirectory>) can only return a path on
the user's HOST machine (e.g. /Users/name/forge-workspace/project) — but
agents run inside the backend container, where the same folder is
mounted at a different path (/root/forge-workspace/project). There is no
way for a host-side picker to know the container's mount point, so it is
structurally incapable of returning a usable path; the fix is to list
directories from inside the container itself, so every path this
endpoint returns is already correct for the backend to use.

Path safety reuses tool_registry._resolve_safe — the same containment
check (symlinks resolved, escape rejected) already enforced for agent
file tools — rather than a second, parallel implementation.
"""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from routers.settings import _get_settings_row
from services.tool_registry import ToolError, _resolve_safe

router = APIRouter(prefix="/workspace", tags=["workspace"])

# Picker only, not a general file browser — keep noise out of the listing.
_EXCLUDED_NAMES = {"node_modules", "__pycache__", ".git", "venv", ".venv"}


class WorkspaceEntry(BaseModel):
    name: str
    path: str
    type: str = "directory"


class WorkspaceBrowseOut(BaseModel):
    current_path: str
    parent_path: str | None
    entries: list[WorkspaceEntry]


@router.get("/browse", response_model=WorkspaceBrowseOut)
async def browse_workspace(
    path: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceBrowseOut:
    settings_row = await _get_settings_row(db)
    root = Path(os.path.expanduser(settings_row.workspace_root)).resolve()
    os.makedirs(root, exist_ok=True)

    if path:
        try:
            target = _resolve_safe(path, str(root))
        except ToolError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    else:
        target = root

    if not target.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {target}")

    try:
        children = sorted(target.iterdir(), key=lambda p: p.name.lower())
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    entries = [
        WorkspaceEntry(name=child.name, path=str(child))
        for child in children
        if child.is_dir() and not child.name.startswith(".") and child.name not in _EXCLUDED_NAMES
    ]

    parent_path = None if target == root else str(target.parent)
    return WorkspaceBrowseOut(current_path=str(target), parent_path=parent_path, entries=entries)
