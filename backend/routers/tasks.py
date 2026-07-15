"""Tasks CRUD router."""

from fastapi import APIRouter

router = APIRouter(prefix="/tasks", tags=["tasks"])
