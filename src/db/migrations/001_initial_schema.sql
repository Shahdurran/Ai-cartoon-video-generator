-- Initial schema for AI Cartoon Generator.
-- Projects, scenes, variant images, styles, music, hook variants, and a generic jobs table.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS styles (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  thumbnail_key        TEXT,
  flux_prompt_suffix   TEXT NOT NULL,
  negative_prompt      TEXT,
  ffmpeg_color_grade   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT,
  source_script     TEXT,
  style_id          TEXT REFERENCES styles(id),
  scene_count       INT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  voice_id          TEXT,
  voice_settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  subtitle_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  music_track_id    UUID,
  music_volume      NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  subtitles_key     TEXT,
  output_key        TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_index        INT NOT NULL,
  image_prompt       TEXT NOT NULL,
  voiceover_text     TEXT NOT NULL,
  duration_seconds   NUMERIC(5,2) NOT NULL,
  selected_image_id  UUID,
  voice_key          TEXT,
  video_key          TEXT,
  fal_request_id     TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, scene_index)
);

CREATE TABLE IF NOT EXISTS scene_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id         UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  variant_index    INT NOT NULL,
  r2_key           TEXT NOT NULL,
  is_custom_upload BOOLEAN NOT NULL DEFAULT false,
  prompt_used      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  r2_key            TEXT NOT NULL,
  duration_seconds  NUMERIC(6,2),
  tags              TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hook_variants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  variant_index         INT NOT NULL,
  hook_script           TEXT NOT NULL,
  hook_duration_seconds INT NOT NULL,
  output_key            TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic jobs table for tracking long-running background tasks (parallel to Bull state,
-- used for cross-queue queries and audit history).
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  queue_name    TEXT NOT NULL,
  job_bull_id   TEXT,
  job_type      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenes_project          ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_images_scene      ON scene_images(scene_id);
CREATE INDEX IF NOT EXISTS idx_hook_variants_project   ON hook_variants(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status         ON projects(status);
CREATE INDEX IF NOT EXISTS idx_jobs_project            ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status             ON jobs(status);
