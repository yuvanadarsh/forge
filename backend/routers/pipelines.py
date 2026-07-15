"""Pipelines router — CRUD, approval, and run management."""

from fastapi import APIRouter

router = APIRouter(prefix="/pipelines", tags=["pipelines"])
