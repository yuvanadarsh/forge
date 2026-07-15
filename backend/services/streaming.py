"""WebSocket streaming manager — one connection per active pipeline run.

Every frame uses the envelope:
    { "type": "token"|"tool_call"|"tool_result"|"status"|"gate"|"complete"|"error",
      "agent_id": str | null,
      "payload": { ...type-specific... },
      "timestamp": ISO8601 }
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class StreamingManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, pipeline_run_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[pipeline_run_id] = websocket

    def disconnect(self, pipeline_run_id: str) -> None:
        self._connections.pop(pipeline_run_id, None)

    async def _send(
        self,
        pipeline_run_id: str,
        event_type: str,
        payload: dict[str, Any],
        agent_id: str | None = None,
    ) -> None:
        """Push one envelope; a run with no listener is a no-op, and a dead
        socket is dropped instead of crashing the pipeline."""
        websocket = self._connections.get(pipeline_run_id)
        if websocket is None:
            return
        envelope = {
            "type": event_type,
            "agent_id": agent_id,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await websocket.send_json(envelope)
        except Exception as exc:  # any transport failure means the client is gone
            logger.debug("Dropping dead websocket for run %s: %s", pipeline_run_id, exc)
            self.disconnect(pipeline_run_id)

    async def send_token(self, pipeline_run_id: str, token: str, agent_id: str) -> None:
        await self._send(pipeline_run_id, "token", {"token": token}, agent_id)

    async def send_tool_call(
        self, pipeline_run_id: str, tool: str, args: dict, agent_id: str | None = None
    ) -> None:
        await self._send(pipeline_run_id, "tool_call", {"tool": tool, "args": args}, agent_id)

    async def send_tool_result(
        self, pipeline_run_id: str, result: str, agent_id: str | None = None
    ) -> None:
        await self._send(pipeline_run_id, "tool_result", {"result": result}, agent_id)

    async def send_status(
        self, pipeline_run_id: str, status: str, agent_id: str | None = None
    ) -> None:
        await self._send(pipeline_run_id, "status", {"status": status}, agent_id)

    async def send_gate(
        self, pipeline_run_id: str, gate_id: str, summary: str, agent_id: str | None = None
    ) -> None:
        await self._send(pipeline_run_id, "gate", {"gate_id": gate_id, "summary": summary}, agent_id)

    async def send_complete(self, pipeline_run_id: str) -> None:
        await self._send(pipeline_run_id, "complete", {})

    async def send_error(self, pipeline_run_id: str, error: str) -> None:
        await self._send(pipeline_run_id, "error", {"error": error})


streaming_manager = StreamingManager()
