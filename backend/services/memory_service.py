"""Agent memory: VoyageAI embeddings (voyage-3, 1024 dims) + pgvector similarity.

Degrades gracefully: without VOYAGE_API_KEY, memories are stored without
embeddings and similarity search returns nothing — execution never blocks
on the embedding provider.
"""

import logging
import os
import uuid

import voyageai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentMemory

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "voyage-3"
MAX_EMBED_CHARS = 20_000  # stay well inside voyage-3's context window

_client: voyageai.AsyncClient | None = None


def _get_client() -> voyageai.AsyncClient | None:
    global _client
    if _client is not None:
        return _client
    if not os.getenv("VOYAGE_API_KEY"):
        return None
    _client = voyageai.AsyncClient()
    return _client


async def embed_text(text: str, *, input_type: str) -> list[float] | None:
    """Embed one string; input_type is 'document' (storing) or 'query' (searching)."""
    client = _get_client()
    if client is None:
        logger.warning("VOYAGE_API_KEY not set — skipping embedding")
        return None
    try:
        result = await client.embed(
            [text[:MAX_EMBED_CHARS]], model=EMBEDDING_MODEL, input_type=input_type
        )
        return result.embeddings[0]
    except Exception as exc:
        # Memory is an enhancement, not a dependency — log and continue.
        logger.warning("Embedding failed (%s) — continuing without memory", exc)
        return None


async def save_memory(
    db: AsyncSession,
    agent_id: uuid.UUID,
    content: str,
    *,
    pipeline_run_id: uuid.UUID | None = None,
    task_id: uuid.UUID | None = None,
) -> AgentMemory:
    memory = AgentMemory(
        agent_id=agent_id,
        content=content,
        embedding=await embed_text(content, input_type="document"),
        source_pipeline_run_id=pipeline_run_id,
        source_task_id=task_id,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


async def search_memories(
    db: AsyncSession,
    agent_id: uuid.UUID,
    query: str,
    *,
    top_k: int = 5,
    threshold: float = 0.3,
) -> list[AgentMemory]:
    """Top-k memories by cosine similarity, keeping only similarity >= threshold."""
    query_embedding = await embed_text(query, input_type="query")
    if query_embedding is None:
        return []
    # pgvector cosine_distance = 1 - cosine_similarity
    max_distance = 1.0 - threshold
    distance = AgentMemory.embedding.cosine_distance(query_embedding)
    rows = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.agent_id == agent_id,
            AgentMemory.embedding.is_not(None),
            distance <= max_distance,
        )
        .order_by(distance)
        .limit(top_k)
    )
    return list(rows.scalars().all())
