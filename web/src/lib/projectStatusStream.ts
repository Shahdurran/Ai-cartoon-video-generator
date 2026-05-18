/**
 * Project status stream — polling-based replacement.
 *
 * SSE caused a reconnect storm in dev (multiple components, strict-mode
 * double-mounts, dev-server proxy closing idle streams). Instead of
 * threading EventSource through that minefield, we now poll the project
 * REST endpoint at a single fixed interval per projectId and emit
 * synthetic phase events from the diff. Subscribers get the same shape
 * of payload they used to get from SSE.
 *
 * One poller per projectId is reused by every subscriber. When the last
 * subscriber unmounts the poller is torn down. When the document is
 * hidden we pause polling entirely so background tabs don't hammer the
 * backend.
 */
import { api, type Project, type Scene } from './api';
import { inferScenePipelinePhases } from './sceneStatus';

type Listener = (event: unknown) => void;

type Entry = {
  projectId: string;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  // Flips true the moment the very first subscriber is registered. Any
  // subsequent subscriber for the same projectId joins the existing
  // poller without kicking off its own immediate fetch — the small
  // burst of GETs we saw on page navigation came from N components
  // mounting at the same time and each triggering pollOnce() before the
  // first call had finished and set the timer.
  started: boolean;
  lastProject: Project | null;
  visible: boolean;
  vizListener: (() => void) | null;
};

const registry = new Map<string, Entry>();

const POLL_MS = Math.max(
  3000,
  Number(process.env.NEXT_PUBLIC_PROJECT_POLL_MS) || 8000
);

function emit(entry: Entry, payload: unknown) {
  for (const fn of Array.from(entry.listeners)) {
    try {
      fn(payload);
    } catch {
      /* listener errors should not break the poller */
    }
  }
}

function diffAndEmit(entry: Entry, fresh: Project) {
  const prev = entry.lastProject;
  entry.lastProject = fresh;

  if (!prev) {
    emit(entry, { phase: 'snapshot', status: fresh.status });
    // First poll: replay terminal scene failures into listeners (StatusStream
    // initialState matches SSR, but clients that only listen to pubsub would
    // otherwise never see `video: failed` because diff skips when
    // before.status is already failed).
    for (const s of fresh.scenes) {
      const p = inferScenePipelinePhases(s, fresh.status);
      if (p.image === 'failed') {
        emit(entry, {
          phase: 'image',
          sceneId: s.id,
          status: 'failed',
          error: p.pipelineError || 'Image failed',
        });
      }
      if (p.voice === 'failed') {
        emit(entry, {
          phase: 'voice',
          sceneId: s.id,
          status: 'failed',
          error: p.pipelineError || 'Voice failed',
        });
      }
      if (p.video === 'failed') {
        emit(entry, {
          phase: 'video',
          sceneId: s.id,
          status: 'failed',
          error: p.pipelineError || 'Video failed',
        });
      }
    }
    return;
  }

  if (prev.status !== fresh.status) {
    if (fresh.status === 'videos-review') {
      emit(entry, { phase: 'videos', status: 'review' });
    } else if (fresh.status === 'assembling') {
      emit(entry, { phase: 'assembly', status: 'started' });
    } else if (fresh.status === 'complete') {
      emit(entry, { phase: 'assembly', status: 'complete' });
    } else if (fresh.status === 'failed') {
      emit(entry, {
        phase: 'assembly',
        status: 'failed',
        error: fresh.errorMessage,
      });
    } else if (fresh.status === 'generating') {
      emit(entry, { phase: 'pipeline', status: 'started' });
    } else if (fresh.status === 'shot-images-review') {
      emit(entry, { phase: 'shot-images', status: 'review' });
    }
  }

  const prevById = new Map<string, Scene>();
  for (const s of prev.scenes) prevById.set(s.id, s);

  for (const s of fresh.scenes) {
    const before = prevById.get(s.id);
    if (!before) continue;

    if ((before.imageVariants?.length || 0) !== (s.imageVariants?.length || 0)) {
      emit(entry, { phase: 'image', sceneId: s.id, status: 'complete' });
      emit(entry, { phase: 'images', status: 'updated' });
    }
    if (!before.voiceKey && s.voiceKey) {
      emit(entry, { phase: 'voice', sceneId: s.id, status: 'complete' });
    }
    if (before.videoKey && !s.videoKey) {
      emit(entry, { phase: 'video', sceneId: s.id, status: 'idle' });
    }
    if (!before.videoKey && s.videoKey) {
      emit(entry, { phase: 'video', sceneId: s.id, status: 'complete' });
    } else if (before.status !== 'failed' && s.status === 'failed') {
      emit(entry, {
        phase: 'video',
        sceneId: s.id,
        status: 'failed',
        error: (s as any).errorMessage,
      });
    }

    // Per-shot diffs (multi-shot scenes only). For shots we emit with both
    // sceneId AND shotId so subscribers can route either way.
    const beforeShots = new Map((before.shots || []).map((sh: any) => [sh.id, sh]));
    for (const sh of s.shots || []) {
      const bsh = beforeShots.get(sh.id);
      if (!bsh) continue;
      if ((bsh.imageVariants?.length || 0) !== (sh.imageVariants?.length || 0)) {
        emit(entry, {
          phase: 'shot-image', sceneId: s.id, shotId: sh.id, status: 'complete',
        });
      }
      if (!bsh.videoKey && sh.videoKey) {
        emit(entry, {
          phase: 'shot-video', sceneId: s.id, shotId: sh.id, status: 'complete',
        });
      } else if (bsh.status !== 'failed' && sh.status === 'failed') {
        emit(entry, {
          phase: 'shot-video', sceneId: s.id, shotId: sh.id, status: 'failed',
          error: sh.errorMessage,
        });
      }
    }
  }
}

async function pollOnce(entry: Entry) {
  if (entry.inFlight) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  entry.inFlight = true;
  try {
    const { project } = await api.getProject(entry.projectId);
    diffAndEmit(entry, project);
  } catch {
    /* swallow transient errors */
  } finally {
    entry.inFlight = false;
  }
}

function schedule(entry: Entry) {
  if (entry.timer) return;
  const tick = async () => {
    entry.timer = null;
    if (entry.listeners.size === 0) return;
    await pollOnce(entry);
    if (entry.listeners.size === 0) return;
    entry.timer = setTimeout(tick, POLL_MS);
  };
  entry.timer = setTimeout(tick, POLL_MS);
}

function teardown(entry: Entry) {
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  if (entry.vizListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', entry.vizListener);
  }
  registry.delete(entry.projectId);
}

export function subscribeProjectStatus(
  projectId: string,
  listener: Listener
): () => void {
  let entry = registry.get(projectId);
  if (!entry) {
    entry = {
      projectId,
      listeners: new Set(),
      timer: null,
      inFlight: false,
      started: false,
      lastProject: null,
      visible: typeof document === 'undefined' ? true : !document.hidden,
      vizListener: null,
    };
    registry.set(projectId, entry);

    if (typeof document !== 'undefined') {
      const onViz = () => {
        if (!entry) return;
        if (!document.hidden && entry.started && !entry.timer && !entry.inFlight && entry.listeners.size > 0) {
          schedule(entry);
        }
      };
      entry.vizListener = onViz;
      document.addEventListener('visibilitychange', onViz);
    }
  }

  entry.listeners.add(listener);

  if (!entry.started) {
    entry.started = true;
    void pollOnce(entry).then(() => {
      if (entry && entry.listeners.size > 0) schedule(entry);
    });
  } else if (entry.lastProject) {
    // Replay the most recent snapshot synchronously so a fresh
    // subscriber sees current state without waiting for the next tick.
    try {
      listener({ phase: 'snapshot', status: entry.lastProject.status });
    } catch { /* ignore */ }
  }

  return () => {
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      teardown(entry);
    }
  };
}
