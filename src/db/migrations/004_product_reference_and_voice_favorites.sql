-- 004_product_reference_and_voice_favorites.sql
--
-- Adds:
--   1. scenes.product_reference_key  -- optional R2 key for a per-scene
--      product reference image. The image is passed as `image_url` to
--      Higgsfield Soul (and as image-to-image input to Fal models that
--      support it) so the product appears consistently across scenes.
--   2. voice_favorites              -- global ElevenLabs voice favorites.
--      No user accounts in this app yet, so favorites are shared
--      across all browsers (single-tenant tool).

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS product_reference_key TEXT;

CREATE TABLE IF NOT EXISTS voice_favorites (
  voice_id    TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
