"""Conversations and messages router."""

from fastapi import APIRouter

router = APIRouter(prefix="/conversations", tags=["conversations"])
