# AI Cartoon Generator — End-to-End QA Checklist

This checklist validates the entire cartoon pipeline after deployment. Work
through it top to bottom; every step must pass before tagging a release.

Legend: ✅ pass · ❌ fail · ⏳ waiting on async job

---

## 0. Pre-flight

- [ ] `DATABASE_URL`, `REDIS_URL`, R2, Anthropic, Fal.AI, ElevenLabs, AssemblyAI
      keys set on the backend service.
- [ ] Backend health endpoint returns 200: `GET /health`.
- [ ] `RUN_MIGRATIONS_ON_STARTUP=true` was true for at least one deploy.
- [ ] `GET /api/styles` returns ≥ 4 styles.
- [ ] `GET /api/voices` returns ≥ 1 ElevenLabs voice.
- [ ] `GET /api/music` returns ≥ 1 music track (signed previewUrl opens in a
      browser).

Run the automated smoke script first:

```bash
BACKEND_URL=https://<backend> node scripts/smoke-cartoon.js
```

It exercises the happy path (create → status polling → hook generation) and
prints green ticks when each step succeeds.

---

## 1. Project creation (from topic)

- [ ] Open `/projects/new`.
- [ ] Fill topic = `"Why octopuses rule the ocean"`, scenes = `3`, total duration =
      `15`, pick a style, leave default voice, no music.
- [ ] Submit → redirected to `/projects/<id>`.
- [ ] Within ~30s the project status transitions `draft → scripted` and
      3 scene cards appear with Claude-generated `imagePrompt` and
      `voiceoverText`.
- [ ] Each scene card automatically starts generating 3–4 image variants.

## 2. Project creation (from existing script)

- [ ] `/projects/new` → switch to "paste script" mode, paste ~200-word script.
- [ ] Submit → scenes arrive with near-verbatim voiceover text chunks.

## 3. Scene image picker

- [ ] Each scene shows multiple variants, one is auto-selected (blue ring).
- [ ] Click a different variant → selection persists on refresh.
- [ ] Click **Regenerate** with an alternate prompt → new batch replaces old.
- [ ] **Upload custom** → PNG/JPG appears as a new variant, is selectable.

## 4. Voiceover panel

- [ ] Choose a different voice from dropdown → save → persists on refresh.
- [ ] Adjust stability / similarity / speed sliders → save.
- [ ] Values re-render correctly on page reload.

## 5. Subtitle panel

- [ ] Font, size, color, position, outline live-preview in the panel.
- [ ] Save → persists on reload.
- [ ] After generation, burned subtitles reflect chosen font/color/position.

## 6. Music library

- [ ] Open the music modal → tracks list with audio previews that actually
      play.
- [ ] Select a track → modal closes, panel shows track name.
- [ ] Change music volume slider → persists on refresh.
- [ ] "Clear selection" removes the track.

## 7. Generate pipeline

- [ ] "Generate video" is disabled until every scene has a selected image AND
      a voice is chosen.
- [ ] Click Generate → redirected to `/projects/<id>/status`.
- [ ] SSE status page updates in real time per scene (image/voice/video).
- [ ] Final assembly row transitions `idle → running → complete`.
- [ ] On complete, page auto-redirects to `/projects/<id>/final`.

## 8. Final video

- [ ] Video plays in the browser with burned subtitles.
- [ ] Background music is audible and ducked to ~15% (default).
- [ ] Download MP4 button produces a playable file on disk.
- [ ] Refresh URL regenerates a working signed URL.

## 9. Hook generator

- [ ] On final page, request 3 hooks × 10s.
- [ ] Each variant card appears in pending state, then switches to a playable
      MP4 within a few minutes.
- [ ] Each variant begins with a distinct rewritten hook and flows into the
      main video (no audible gap).
- [ ] Variant MP4 downloads work.

## 10. Deletion & cleanup

- [ ] Delete a project via API (`DELETE /api/projects/:id`) or UI.
- [ ] Confirm the R2 prefix `projects/<id>/` is fully empty (list via R2 UI or
      `aws s3 ls --endpoint-url=<r2>`).
- [ ] Confirm Postgres rows in `projects`, `scenes`, `scene_images`, and
      `hook_variants` for this project are gone.

## 11. Failure modes

- [ ] Invalid Fal.AI key → scene image job marks scene `failed` with a readable
      error; SSE propagates it.
- [ ] Empty voiceover text → scene-voice processor marks scene failed, pipeline
      does not hang.
- [ ] Kill the backend mid-assembly → on restart, in-flight jobs retry from
      Bull and either resume or fail cleanly (no silent zombies).

---

When every box is ticked, cut a tag (`cartoon-v1.0.0`) and ship it.
