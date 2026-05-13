-- 005_product_custom_reference_id.sql
-- Higgsfield Soul "Soul ID" from POST /v1/custom-references; used as
-- custom_reference_id on image generation for stronger product lock than image_url alone.

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS product_custom_reference_id TEXT;
