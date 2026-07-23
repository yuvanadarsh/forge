"""Agent memory: local sentence-transformers embeddings + pgvector similarity.

Embeddings run fully locally (all-MiniLM-L6-v2, 384 dims) — no API key and no
network dependency after the first model download (~90MB). Degrades
gracefully: if the model cannot load, memories are stored without embeddings
and similarity search returns nothing — execution never blocks on embeddings.
"""

import asyncio
import logging
import threading
import uuid

from sentence_transformers import SentenceTransformer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentMemory

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSIONS = 384
# Clamp pathological inputs before tokenization; the model itself truncates
# to its 256-token sequence window regardless.
MAX_EMBED_CHARS = 20_000

_model: SentenceTransformer | None = None
_model_lock = threading.Lock()


def get_model() -> SentenceTransformer:
    """The shared embedding model, loaded lazily on first use."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                logger.info("Loading embedding model (first run may take 30s)...")
                _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed(text: str) -> list[float]:
    """Embed one string locally. Sync and CPU-bound — call via embed_async
    (or asyncio.to_thread) from async code so the event loop keeps serving
    WebSocket streams while the model runs."""
    return get_model().encode(text[:MAX_EMBED_CHARS]).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed many strings in one model call — much faster than per-string
    for bulk work like workspace indexing. Sync and CPU-bound, same as embed."""
    if not texts:
        return []
    vectors = get_model().encode([t[:MAX_EMBED_CHARS] for t in texts])
    return [vector.tolist() for vector in vectors]


async def embed_async(text: str) -> list[float] | None:
    """Embed off the event loop; None on failure (memory is an enhancement,
    not a dependency — log and continue)."""
    try:
        return await asyncio.to_thread(embed, text)
    except Exception as exc:
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
        embedding=await embed_async(content),
        memory_type="agent",
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
    """Top-k memories by cosine similarity, keeping only similarity >= threshold.

    Codebase chunks (memory_type='codebase_chunk') are deliberately excluded:
    they are reachable only through the explicit search_codebase tool, never
    injected automatically — keeps per-call token cost predictable.
    """
    query_embedding = await embed_async(query)
    if query_embedding is None:
        return []
    # pgvector cosine_distance = 1 - cosine_similarity
    max_distance = 1.0 - threshold
    distance = AgentMemory.embedding.cosine_distance(query_embedding)
    rows = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.agent_id == agent_id,
            AgentMemory.memory_type != "codebase_chunk",
            AgentMemory.embedding.is_not(None),
            distance <= max_distance,
        )
        .order_by(distance)
        .limit(top_k)
    )
    return list(rows.scalars().all())
