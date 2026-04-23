#!/usr/bin/env node
/**
 * End-to-end smoke test for the AI Cartoon Generator.
 *
 *   BACKEND_URL=https://backend npm run smoke:cartoon
 *
 * or:
 *
 *   BACKEND_URL=http://localhost:3000 node scripts/smoke-cartoon.js
 *
 * Exit code is non-zero on any failure so it can be wired into CI.
 *
 * This script is intentionally zero-dep (uses global fetch) so it can run on
 * a clean Node 18+ install without `npm install`.
 */

/* eslint-disable no-console */

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SKIP_HOOKS = process.env.SKIP_HOOKS === '1';
const TOPIC = process.env.SMOKE_TOPIC || 'Why octopuses rule the ocean';
const SCENE_COUNT = parseInt(process.env.SMOKE_SCENES || '2', 10);
const TOTAL_DURATION = parseInt(process.env.SMOKE_DURATION || '12', 10);
const GENERATION_TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT || `${15 * 60 * 1000}`, 10);
const HOOK_TIMEOUT_MS = parseInt(process.env.SMOKE_HOOK_TIMEOUT || `${10 * 60 * 1000}`, 10);

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let stepNum = 0;
function step(name) {
  stepNum += 1;
  console.log(`\n${yellow(`[${stepNum}]`)} ${name}`);
}
function ok(msg) { console.log(`  ${green('✓')} ${msg}`); }
function info(msg) { console.log(`  ${dim('·')} ${dim(msg)}`); }
function fail(msg, err) {
  console.error(`  ${red('✗')} ${msg}`);
  if (err) console.error(err.stack || err);
  process.exit(1);
}

async function req(method, path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* non-json */ }
  if (!res.ok) {
    const msg = json?.error || text || `${res.status} ${res.statusText}`;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(predicate, { label, timeoutMs, intervalMs = 5000 }) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await predicate();
      if (last) return last;
    } catch (err) {
      info(`poll error: ${err.message}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for ${label} after ${Math.round(timeoutMs / 1000)}s`);
}

(async () => {
  console.log(`\n${green('AI Cartoon Generator smoke test')}`);
  console.log(`Backend: ${BACKEND_URL}\n`);

  // ------------------------------------------------------------------
  step('Health check');
  const health = await req('GET', '/health');
  ok(`/health OK (${JSON.stringify(health).slice(0, 120)})`);

  // ------------------------------------------------------------------
  step('Reference data (styles / voices / music)');
  const { styles } = await req('GET', '/api/styles');
  if (!styles?.length) fail('No styles returned');
  ok(`${styles.length} styles`);
  const style = styles[0];

  const { voices } = await req('GET', '/api/voices');
  if (!voices?.length) fail('No voices returned — check ELEVENLABS_API_KEY');
  ok(`${voices.length} voices`);
  const voice = voices[0];

  const { tracks } = await req('GET', '/api/music');
  ok(`${tracks?.length || 0} music tracks`);
  const track = tracks?.[0] || null;

  // ------------------------------------------------------------------
  step('Create project');
  const { project: created } = await req('POST', '/api/projects', {
    topic: TOPIC,
    styleId: style.id,
    sceneCount: SCENE_COUNT,
    voiceId: voice.voiceId,
    musicTrackId: track?.id,
    totalDurationSeconds: TOTAL_DURATION,
  });
  if (!created?.id) fail('Project creation returned no id');
  const projectId = created.id;
  ok(`Project ${projectId}`);

  // ------------------------------------------------------------------
  step('Wait for Claude scene script');
  const scripted = await waitFor(
    async () => {
      const { project } = await req('GET', `/api/projects/${projectId}`);
      info(`status=${project.status} scenes=${project.scenes.length}`);
      return project.scenes.length >= 1 ? project : null;
    },
    { label: 'scene script', timeoutMs: 2 * 60 * 1000, intervalMs: 4000 }
  );
  ok(`${scripted.scenes.length} scenes scripted`);

  // ------------------------------------------------------------------
  step('Wait for Flux image variants on every scene');
  const imaged = await waitFor(
    async () => {
      const { project } = await req('GET', `/api/projects/${projectId}`);
      const done = project.scenes.every((s) => s.imageVariants.length > 0);
      info(
        `variants: ${project.scenes
          .map((s) => `${s.imageVariants.length}`)
          .join(',')}`
      );
      return done ? project : null;
    },
    { label: 'image variants', timeoutMs: 5 * 60 * 1000, intervalMs: 6000 }
  );
  ok('all scenes have variants');

  // Make sure each scene has a selectedImageId (auto-select should handle it).
  for (const s of imaged.scenes) {
    if (!s.selectedImageId) {
      await req('PATCH', `/api/projects/${projectId}/scenes/${s.id}/select-image`, {
        sceneImageId: s.imageVariants[0].id,
      });
    }
  }
  ok('images selected');

  // ------------------------------------------------------------------
  step('Kick off full generation pipeline');
  await req('POST', `/api/projects/${projectId}/generate`, {});
  ok('enqueued');

  // ------------------------------------------------------------------
  step('Wait for final video');
  const finished = await waitFor(
    async () => {
      const { project } = await req('GET', `/api/projects/${projectId}`);
      info(`status=${project.status}`);
      if (project.status === 'failed') {
        throw new Error(project.errorMessage || 'project marked failed');
      }
      return project.status === 'complete' && project.outputSignedUrl
        ? project
        : null;
    },
    { label: 'final video', timeoutMs: GENERATION_TIMEOUT_MS, intervalMs: 10000 }
  );
  ok(`outputSignedUrl ready (${finished.outputSignedUrl.slice(0, 80)}…)`);

  // HEAD-check the signed URL actually serves a video.
  const head = await fetch(finished.outputSignedUrl, { method: 'HEAD' });
  if (!head.ok) fail(`Signed URL HEAD returned ${head.status}`);
  const contentType = head.headers.get('content-type') || '';
  if (!/video\//i.test(contentType) && !/octet-stream/i.test(contentType)) {
    console.log(`  ${yellow('!')} content-type=${contentType} (continuing)`);
  } else {
    ok(`content-type=${contentType}`);
  }

  // ------------------------------------------------------------------
  if (!SKIP_HOOKS) {
    step('Generate hook variants');
    await req('POST', `/api/projects/${projectId}/hooks`, {
      hookDurationSeconds: 8,
      variantCount: 2,
    });
    ok('hook job enqueued');

    const hooksDone = await waitFor(
      async () => {
        const { project } = await req('GET', `/api/projects/${projectId}`);
        const statuses = project.hookVariants.map((h) => h.status);
        info(`hooks=${statuses.join(',')}`);
        const allSettled = statuses.length >= 2 &&
          statuses.every((s) => s === 'complete' || s === 'failed');
        return allSettled ? project : null;
      },
      { label: 'hook variants', timeoutMs: HOOK_TIMEOUT_MS, intervalMs: 8000 }
    );
    const failed = hooksDone.hookVariants.filter((h) => h.status === 'failed');
    if (failed.length) {
      console.log(
        `  ${yellow('!')} ${failed.length} hook variant(s) failed: ${failed
          .map((h) => h.errorMessage)
          .join(' | ')}`
      );
    }
    const ready = hooksDone.hookVariants.filter((h) => h.status === 'complete');
    if (ready.length === 0) fail('No hook variants completed');
    ok(`${ready.length} hook variant(s) ready`);
  } else {
    info('SKIP_HOOKS=1 — skipping hook generation');
  }

  console.log(`\n${green('All smoke checks passed.')}\n`);
  process.exit(0);
})().catch((err) => {
  console.error(`\n${red('Smoke test failed:')} ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
