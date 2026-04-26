-- Per-project Fal image / video model IDs and tweakable API parameters.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS image_model_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_model_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
