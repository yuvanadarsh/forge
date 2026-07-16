-- 007: persisted tool call events (Session 10)
-- Messages with role 'tool_call' record each agent tool invocation
-- (content = JSON {tool_name, args, status, result_summary}) so pipeline
-- history survives page reloads instead of living only in the WebSocket.
-- Idempotent: the role CHECK is dropped and recreated.

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;

ALTER TABLE messages ADD CONSTRAINT messages_role_check
    CHECK (role IN ('user', 'assistant', 'system', 'tool', 'tool_call', 'approval_gate'));
