-- 009: multi-image support for chat messages (up to 4 per message)
-- messages.image_data/image_media_type (008) are kept for backward
-- compatibility with pre-009 rows; new messages with images use
-- message_images instead. Idempotent.

CREATE TABLE IF NOT EXISTS message_images (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    image_data   TEXT NOT NULL,       -- raw base64, no data: prefix
    media_type   VARCHAR(50) NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_images_message_id ON message_images(message_id);
