-- 006_scene_shots.sql
--
-- Multi-shot scenes: a single scene can contain multiple Seedance "shots"
-- (different angles / actions of the same scene), cross-cut on hard cuts at
-- ~2.5s intervals to break up the slideshow feel.
--
-- A scene with multi_shot_enabled = false is the legacy single-shot path:
--   scenes.selected_image_id -> scene_images row -> Seedance -> scenes.video_key
-- A scene with multi_shot_enabled = true uses scene_shots:
--   for each shot in scene_shots:
--     shot.image_prompt + shared product/character refs -> scene_images (with shot_id)
--     -> Seedance -> shot.video_key
--   then assembly bakes shots together with the voice across the cuts.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS multi_shot_target_seconds NUMERIC(3,1) NOT NULL DEFAULT 2.5;

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS multi_shot_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Stored Claude-suggested shots so we don't re-call Claude every time the
  -- user toggles multi-shot on; populated during script generation.
  ADD COLUMN IF NOT EXISTS suggested_shots JSONB;

CREATE TABLE IF NOT EXISTS scene_shots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id           UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  shot_index         INT NOT NULL,                         -- 0..N within the scene
  role               TEXT NOT NULL DEFAULT 'wide',         -- 'wide'|'closeup'|'detail'|'reaction'|'custom'
  image_prompt       TEXT NOT NULL,
  selected_image_id  UUID,                                 -- references scene_images(id); FK added below
  fal_request_id     TEXT,
  video_key          TEXT,
  duration_seconds   NUMERIC(4,2) NOT NULL DEFAULT 2.5,    -- target window length in the final cut
  status             TEXT NOT NULL DEFAULT 'pending',
  error_message      TEXT,
  error_code         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scene_id, shot_index)
);

CREATE INDEX IF NOT EXISTS idx_scene_shots_scene ON scene_shots(scene_id);

-- Per-shot image variants live in the existing scene_images table to reuse
-- the picker UI. shot_id IS NULL for the legacy scene-level variants used
-- by single-shot scenes.
ALTER TABLE scene_images
  ADD COLUMN IF NOT EXISTS shot_id UUID REFERENCES scene_shots(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scene_images_shot ON scene_images(shot_id);

-- selected_image_id -> scene_images(id) FK can only be added after the
-- shot_id column exists on scene_images (since CASCADE rules need both
-- ends in place to not race during DELETE FROM scene_shots).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scene_shots_selected_image_id_fkey'
  ) THEN
    ALTER TABLE scene_shots
      ADD CONSTRAINT scene_shots_selected_image_id_fkey
      FOREIGN KEY (selected_image_id) REFERENCES scene_images(id) ON DELETE SET NULL;
  END IF;
END $$;
