-- 007_project_visual_references.sql
--
-- Step-1 inputs that shape Claude's scene/imagePrompt generation:
--   * visual_notes:    free-text style direction, e.g. "tall teenage basketball
--                      player, dark blue spiky hair, navy eyes". Optional.
--   * Multiple reference images keyed off the project, sent to Claude as
--                      image attachments so it can derive a consistent
--                      character/aesthetic anchor that gets folded into
--                      every scene's imagePrompt.
--
-- The pre-canned style library (`styles` table) is independent of this --
-- it still controls Flux suffix + ffmpeg color grade. These new fields
-- only steer Claude's scene authoring.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visual_notes TEXT;

CREATE TABLE IF NOT EXISTS project_visual_references (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  sort_index  INT  NOT NULL DEFAULT 0,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_visual_references_project
  ON project_visual_references(project_id);
