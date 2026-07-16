"""Settings and encrypted API key management router.

Raw keys are AES-256-GCM encrypted at rest and NEVER returned by any
endpoint — list/detail responses mask using the stored key_last4.
"""

import uuid
from datetime import datetime
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.models import ApiKey, Settings
from services.crypto import CryptoError, decrypt_key, encrypt_key, get_secret_key

router = APIRouter(prefix="/settings", tags=["settings"])

MASK_PREFIX = "••••••••"


class SettingsOut(BaseModel):
    model_config = {"from_attributes": True}

    terminal_execution: str
    strict_mode: bool
    allowed_commands: list[str]
    denied_commands: list[str]
    default_model: str
    embedding_model: str
    workspace_root: str
    global_rules: str
    max_run_cost: float
    max_agent_cost: float
    max_daily_cost: float
    updated_at: datetime


class SettingsUpdate(BaseModel):
    terminal_execution: Literal["always_proceed", "request_review", "agent_decides"] | None = None
    strict_mode: bool | None = None
    allowed_commands: list[str] | None = None
    denied_commands: list[str] | None = None
    default_model: str | None = None
    embedding_model: str | None = None
    workspace_root: str | None = None
    global_rules: str | None = None
    max_run_cost: float | None = Field(default=None, ge=0)
    max_agent_cost: float | None = Field(default=None, ge=0)
    max_daily_cost: float | None = Field(default=None, ge=0)


class ApiKeyCreate(BaseModel):
    provider: str = Field(min_length=1)
    name: str = Field(min_length=1)
    base_url: str | None = None
    api_key: str = Field(min_length=4)
    is_default: bool = False


class ApiKeyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    base_url: str | None = None
    api_key: str | None = Field(default=None, min_length=4)


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    provider: str
    name: str
    base_url: str | None
    masked_key: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


def _masked(row: ApiKey) -> ApiKeyOut:
    return ApiKeyOut(
        id=row.id,
        provider=row.provider,
        name=row.name,
        base_url=row.base_url,
        masked_key=f"{MASK_PREFIX}{row.key_last4}",
        is_default=row.is_default,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _secret_or_503() -> str:
    try:
        return get_secret_key()
    except CryptoError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


async def _get_settings_row(db: AsyncSession) -> Settings:
    """Single-row config: create defaults on first read if the seed is missing."""
    row = (await db.execute(select(Settings))).scalar_one_or_none()
    if row is None:
        row = Settings(id=1)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("", response_model=SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> Settings:
    return await _get_settings_row(db)


@router.patch("", response_model=SettingsOut)
async def update_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)) -> Settings:
    row = await _get_settings_row(db)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(row, field, value)
    row.updated_at = func.now()
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(db: AsyncSession = Depends(get_db)) -> list[ApiKeyOut]:
    rows = (await db.execute(select(ApiKey).order_by(ApiKey.created_at))).scalars().all()
    return [_masked(row) for row in rows]


@router.post("/api-keys", response_model=ApiKeyOut, status_code=201)
async def add_api_key(body: ApiKeyCreate, db: AsyncSession = Depends(get_db)) -> ApiKeyOut:
    secret = _secret_or_503()
    row = ApiKey(
        provider=body.provider,
        name=body.name,
        base_url=body.base_url,
        encrypted_key=encrypt_key(body.api_key, secret),
        key_last4=body.api_key[-4:],
        is_default=body.is_default,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _masked(row)


@router.patch("/api-keys/{key_id}", response_model=ApiKeyOut)
async def update_api_key(
    key_id: uuid.UUID, body: ApiKeyUpdate, db: AsyncSession = Depends(get_db)
) -> ApiKeyOut:
    row = await db.get(ApiKey, key_id)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")

    if body.name is not None:
        row.name = body.name
    if body.base_url is not None:
        row.base_url = body.base_url
    if body.api_key is not None:
        row.encrypted_key = encrypt_key(body.api_key, _secret_or_503())
        row.key_last4 = body.api_key[-4:]
    row.updated_at = func.now()
    await db.commit()
    await db.refresh(row)
    return _masked(row)


class KeyTestResult(BaseModel):
    success: bool
    message: str


async def _probe_provider(provider: str, base_url: str | None, raw_key: str) -> KeyTestResult:
    """Minimal authenticated request to verify a key. No completions are billed."""
    name = provider.lower()
    async with httpx.AsyncClient(timeout=10.0) as client:
        if "anthropic" in name:
            resp = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={"x-api-key": raw_key, "anthropic-version": "2023-06-01"},
            )
        elif "voyage" in name:
            # Voyage has no list endpoint; a 1-token embed is the cheapest probe.
            resp = await client.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {raw_key}"},
                json={"input": ["ping"], "model": "voyage-3"},
            )
        elif "openai" in name:
            resp = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {raw_key}"},
            )
        elif base_url:
            # OpenAI-compatible providers (DeepSeek, Gemini via proxy, local, …)
            resp = await client.get(
                f"{base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {raw_key}"},
            )
        else:
            return KeyTestResult(
                success=False,
                message=f"No test method for provider '{provider}' — set a base URL to enable testing",
            )

    if resp.status_code < 300:
        return KeyTestResult(success=True, message=f"{provider} key is valid")
    if resp.status_code in (401, 403):
        return KeyTestResult(
            success=False, message=f"{provider} rejected the key (HTTP {resp.status_code})"
        )
    return KeyTestResult(
        success=False, message=f"{provider} returned HTTP {resp.status_code} — key may still be valid"
    )


@router.post("/api-keys/{key_id}/test", response_model=KeyTestResult)
async def test_api_key(key_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> KeyTestResult:
    row = await db.get(ApiKey, key_id)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")
    try:
        raw_key = decrypt_key(row.encrypted_key, _secret_or_503())
    except CryptoError as exc:
        return KeyTestResult(success=False, message=f"Could not decrypt key: {exc}")
    try:
        return await _probe_provider(row.provider, row.base_url, raw_key)
    except httpx.HTTPError as exc:
        return KeyTestResult(success=False, message=f"Connection failed: {exc}")


@router.post("/reembed")
async def reembed_all_data() -> dict[str, str]:
    """Placeholder — full re-embedding of agent_memory ships in a later phase."""
    return {"status": "coming_soon"}


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(key_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    row = await db.get(ApiKey, key_id)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if row.is_default:
        # Mirrors the settings UI, where the default provider row has no delete button.
        raise HTTPException(status_code=409, detail="The default provider cannot be deleted")
    await db.delete(row)
    await db.commit()
