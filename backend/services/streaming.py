"""WebSocket streaming manager — one connection per active pipeline run."""

from fastapi import WebSocket


class StreamingManager:
    """Tracks the active WebSocket for each pipeline run.

    Full send API (token/tool_call/tool_result/status/gate/complete/error)
    is implemented in the streaming group of this session.
    """

    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, pipeline_run_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[pipeline_run_id] = websocket

    def disconnect(self, pipeline_run_id: str) -> None:
        self._connections.pop(pipeline_run_id, None)


streaming_manager = StreamingManager()
