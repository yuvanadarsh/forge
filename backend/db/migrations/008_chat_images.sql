-- 008: image attachments on chat messages (Session 12)
-- User messages may carry one base64-encoded image (PNG/JPEG/GIF/WebP),
-- stored inline: image_data is the raw base64 payload (no data: prefix),
-- image_media_type its MIME type. Passed to the model as an image content
-- block and rendered as a thumbnail in chat. Idempotent.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_data TEXT;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_media_type VARCHAR(50);

-- Existing rows get NULL for both new columns (default ALTER TABLE ADD
-- COLUMN behavior) — old messages load fine with no attachment.
