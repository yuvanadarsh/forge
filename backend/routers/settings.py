"""Settings and encrypted API key management router."""

from fastapi import APIRouter

router = APIRouter(prefix="/settings", tags=["settings"])
