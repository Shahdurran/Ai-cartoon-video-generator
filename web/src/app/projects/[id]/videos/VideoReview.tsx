'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Project, type Scene, type SceneShot } from '@/lib/api';
import { subscribeProjectStatus } from '@/lib/projectStatusStream';
import { deriveSingleShotVideoPhase } from '@/lib/sceneStatus';

type SceneVideoState = 'idle' | 'queued' | 'submitting' | 'polling' | 'running' | 'complete' | 'failed' | 'partial' | 'requeued';

function isSceneVideoReady(scene: Scene): boolean {
  if (scene.multiShotEnabled) {
    const shots = scene.shots ?? [];
    return shots.length > 0 && shots.every((sh) => !!sh.videoKey);
  }
  return !!scene.videoKey;
}

/**
 * For a multi-shot scene, derive an aggregate phase from the underlying
 * shots' statuses. This is what the scene card pill + main-preview area
 * should reflect; per-scene SSE phase events don't fire for partial-
 * success multi-shot scenes, so the SceneVideoState seeded at mount
 * would otherwise stay stuck on 'running' forever.
 */
function deriveMultiShotPhase(scene: Scene): SceneVideoState {
  const shots = scene.shots ?? [];
  if (shots.length === 0) return 'running';
  const allReady = shots.every((sh) => !!sh.videoKey);
  if (allReady) return 'complete';
  const anyFailed = shots.some((sh) => sh.status === 'failed' && !sh.videoKey);
  const anyRendering = shots.some(
    (sh) => !sh.videoKey && sh.status !== 'failed'
  );
  if (anyRendering) return 'running';
  // No renders in flight and not all ready -> at least one failed.
  if (anyFailed) {
    const someReady = shots.some((sh) => !!sh.videoKey);
    return someReady ? 'partial' : 'failed';
  }
  return 'running';
}

export function VideoReview({ initialProject }: { initialProject: Project }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [project, setProject] = useState(initialProject);
  const projectIdRef = useRef(initialProject.id);
  projectIdRef.current = project.id;
  const [busy, setBusy] = useState<null | 'approve' | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Record<string, SceneVideoState>>(() =>
    Object.fromEntries(
      initialProject.scenes.map((s) => [
        s.id,
        isSceneVideoReady(s)
          ? 'complete'
          : s.status === 'failed'
            ? 'failed'
            : s.multiShotEnabled
              ? deriveMultiShotPhase(s)
              : deriveSingleShotVideoPhase(s, initialProject.status),
      ])
    )
  );

  useEffect(() => {
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const lastRefetchAt = { current: 0 };
    const MIN_REFETCH_MS = 1200;

    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(async () => {
        const now = Date.now();
        if (now - lastRefetchAt.current < MIN_REFETCH_MS) return;
        lastRefetchAt.current = now;
        try {
          const { project: fresh } = await api.getProject(projectIdRef.current);
          setProject(fresh);
        } catch (_) { /* ignore */ }
      }, 600);
    };

    const initialStatus = initialProject.status;
    const unsubscribe = subscribeProjectStatus(project.id, (payload: any) => {
      if (!payload?.phase) return;
      if (payload.phase === 'video' && payload.sceneId) {
        setPhase((p) => ({ ...p, [payload.sceneId]: payload.status }));
        if (payload.status === 'complete' || payload.status === 'failed') {
          scheduleRefetch();
        }
      } else if (payload.phase === 'shot-video' && payload.sceneId) {
        // Per-shot completion: update scene-level pill from current
        // hydrated state on next refetch and refresh.
        scheduleRefetch();
      } else if (payload.phase === 'assembly' && payload.status === 'started') {
        routerRef.current.push(`/projects/${projectIdRef.current}/status`);
      } else if (payload.phase === 'snapshot') {
        // First poll snapshot: if backend status has moved on from what
        // we SSR'd with, force a refresh so the UI catches up.
        if (payload.status && payload.status !== initialStatus) {
          scheduleRefetch();
        }
      }
    });

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Keep per-scene phase aligned with polled project data (videoKey / failed).
  useEffect(() => {
    setPhase((prev) => {
      const next = { ...prev };
      for (const s of project.scenes) {
        if (s.multiShotEnabled) continue;
        next[s.id] = deriveSingleShotVideoPhase(
          s,
          project.status,
          prev[s.id]
        );
      }
      return next;
    });
  }, [project.scenes, project.status]);

  const orderedScenes = useMemo(
    () => [...project.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex),
    [project.scenes]
  );

  const completeCount = orderedScenes.filter(isSceneVideoReady).length;
  const failedCount = orderedScenes.filter(
    (s) => !isSceneVideoReady(s) && s.status === 'failed'
  ).length;
  const allReady = completeCount === orderedScenes.length;

  async function regenerate(sceneId: string) {
    setError(null);
    setBusy(sceneId);
    setPhase((p) => ({ ...p, [sceneId]: 'requeued' }));
    try {
      await api.regenerateSceneVideo(project.id, sceneId);
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate');
      setPhase((p) => ({ ...p, [sceneId]: 'failed' }));
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!allReady) return;
    setError(null);
    setBusy('approve');
    try {
      await api.approveVideos(project.id);
      // router.refresh() invalidates the server-component cache so the
      // status page server-renders with the freshly-flipped 'assembling'
      // status instead of a stale 'complete' snapshot.
      router.refresh();
      router.push(`/projects/${project.id}/status`);
    } catch (err: any) {
      setError(err.message || 'Failed to approve videos');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel flex items-center justify-between gap-4 animate-fade-up flex-wrap">
        <div className="text-xs text-ink-200/70">
          <span className="text-white font-medium">{completeCount}</span> /
          {' '}{orderedScenes.length} ready
          {failedCount > 0 && (
            <span className="ml-3 text-rose-300">{failedCount} failed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={approve}
            disabled={busy !== null || !allReady}
            className="btn-primary !px-4 !py-2 !text-xs"
            title={
              allReady
                ? 'Lock in these takes and start final assembly'
                : 'Every scene needs a successful render before you can assemble'
            }
          >
            {busy === 'approve' ? 'Starting assembly…' : 'Assemble final video →'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orderedScenes.map((scene, i) => (
          <SceneVideoCard
            key={scene.id}
            projectId={project.id}
            projectStatus={project.status}
            scene={scene}
            index={i}
            phase={phase[scene.id] || (isSceneVideoReady(scene) ? 'complete' : 'idle')}
            busy={busy === scene.id}
            onRegenerate={() => regenerate(scene.id)}
            onShotChanged={async () => {
              try {
                const { project: fresh } = await api.getProject(project.id);
                setProject(fresh);
              } catch {
                /* ignore */
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SceneVideoCard({
  projectId,
  projectStatus,
  scene,
  index,
  phase,
  busy,
  onRegenerate,
  onShotChanged,
}: {
  projectId: string;
  projectStatus: string;
  scene: Scene;
  index: number;
  phase: SceneVideoState;
  busy: boolean;
  onRegenerate: () => void;
  onShotChanged: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shots = scene.shots ?? [];
  const isMultiShot = scene.multiShotEnabled && shots.length > 0;

  // Local (unsaved) shot order shared between the stitched preview and
  // the reorder strip below. Null means "use the server's order"; once
  // the user moves a shot we switch to a concrete array and the preview
  // re-stitches in that order so they can play the new edit before
  // committing it via the strip's Save button.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const serverOrderIds = useMemo(
    () =>
      shots
        .slice()
        .sort((a, b) => a.shotIndex - b.shotIndex)
        .map((sh) => sh.id),
    [shots]
  );
  useEffect(() => {
    setLocalOrder(null);
  }, [serverOrderIds.join('|')]);

  // For multi-shot scenes the per-scene `phase` map never receives
  // events (the backend emits 'shot-video' instead), so it stays at the
  // initial seed of 'running'. Use the shot-aggregated phase instead.
  const effectivePhase: SceneVideoState = isMultiShot
    ? deriveMultiShotPhase(scene)
    : deriveSingleShotVideoPhase(scene, projectStatus, phase);

  const previewUrl = isMultiShot
    ? null
    : scene.videoSignedUrl;

  const isReady = isMultiShot
    ? effectivePhase === 'complete' || effectivePhase === 'partial'
    : !!previewUrl && effectivePhase === 'complete';
  const isFailed = effectivePhase === 'failed';
  const isRendering =
    !isReady &&
    !isFailed &&
    effectivePhase !== 'idle' &&
    (effectivePhase === 'running' ||
      effectivePhase === 'queued' ||
      effectivePhase === 'submitting' ||
      effectivePhase === 'polling' ||
      effectivePhase === 'requeued');
  const needsRender = !isMultiShot && effectivePhase === 'idle';
  const failureNote = isMultiShot
    ? shots.find((sh) => sh.status === 'failed' && !sh.videoKey)?.errorMessage
    : scene.errorMessage;

  return (
    <div
      className="glass-panel animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-brand-100/80 font-medium">
          Scene {scene.sceneIndex + 1}
          {isMultiShot && (
            <span className="ml-2 inline-flex items-center rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] tracking-wider text-ink-100/70">
              {shots.length} shots
            </span>
          )}
        </div>
        <PhasePill phase={effectivePhase} />
      </div>

      {isMultiShot ? (
        <StitchedShotPreview
          scene={scene}
          localOrder={localOrder}
          isFailed={isFailed}
          isRendering={isRendering}
          failureNote={failureNote || null}
          partial={effectivePhase === 'partial'}
        />
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 mb-3">
          {isReady && previewUrl && (
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
            />
          )}
          {needsRender && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-ink-100/70 px-4 text-center">
              <div className="font-medium text-white/90 mb-1">
                New still — video needed
              </div>
              <div className="text-[11px] text-ink-100/60">
                Click Regenerate below to run Seedance for this scene only.
              </div>
            </div>
          )}
          {isRendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-ink-100/70">
              <div
                className="mb-2 h-8 w-8 rounded-full animate-glow"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
                }}
              />
              Rendering with Seedance…
            </div>
          )}
          {isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-rose-200/90 px-4 text-center">
              <div className="font-medium mb-1">Render failed</div>
              <div className="text-[11px] text-rose-200/70 line-clamp-3">
                {failureNote || 'Seedance returned an error.'}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] text-ink-200/70 line-clamp-2 mb-3" title={scene.voiceoverText}>
        {scene.voiceoverText}
      </div>

      {isMultiShot ? (
        <ShotOrderStrip
          projectId={projectId}
          scene={scene}
          localOrder={localOrder}
          onLocalOrderChange={setLocalOrder}
          onChanged={onShotChanged}
        />
      ) : (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy || isRendering}
          className="btn-ghost !px-3 !py-1.5 !text-xs w-full"
          title={
            isRendering
              ? 'Wait for the current render to finish'
              : 'Discard this take and re-run Seedance for this scene'
          }
        >
          {busy
            ? 'Re-queuing…'
            : needsRender
              ? 'Generate video for this scene'
              : 'Regenerate this scene'}
        </button>
      )}
      {isMultiShot && (
        <p className="mt-2 text-[10px] text-ink-100/50 text-center">
          Final cut stitches shots in the order shown, with continuous voiceover.
        </p>
      )}
    </div>
  );
}

/**
 * Plays a multi-shot scene as a continuous stitched preview by chaining
 * the shot videos in their current `shotIndex` order. When a clip ends
 * we advance to the next ready shot; failed/missing shots are skipped
 * with a brief on-screen note so the user still gets a coherent preview
 * of the takes that DID render. This mirrors what final assembly will
 * concat together, so the order shown here matches the final cut order.
 */
function StitchedShotPreview({
  scene,
  localOrder,
  isFailed,
  isRendering,
  failureNote,
  partial,
}: {
  scene: Scene;
  localOrder: string[] | null;
  isFailed: boolean;
  isRendering: boolean;
  failureNote: string | null;
  partial: boolean;
}) {
  const shots = scene.shots ?? [];
  const orderedShots = useMemo(() => {
    if (!localOrder) {
      return shots.slice().sort((a, b) => a.shotIndex - b.shotIndex);
    }
    const byId = new Map(shots.map((sh) => [sh.id, sh] as const));
    const out: SceneShot[] = [];
    for (const id of localOrder) {
      const sh = byId.get(id);
      if (sh) out.push(sh);
    }
    return out;
  }, [shots, localOrder]);

  // Only ready shots actually play; ordering carries through from above
  // so the indices line up with the reorder UI below and previewed cuts
  // match what final assembly will concatenate.
  const playableShots = useMemo(
    () => orderedShots.filter((sh) => !!sh.videoSignedUrl),
    [orderedShots]
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset to the start whenever the shot list / order changes server-side.
  useEffect(() => {
    setActiveIdx(0);
    setPlaying(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }, [
    // Re-key on the JOIN of ordered ids so reordering / new renders both reset.
    playableShots.map((sh) => sh.id).join('|'),
  ]);

  const current = playableShots[activeIdx] || null;

  function handleEnded() {
    if (activeIdx + 1 < playableShots.length) {
      setActiveIdx(activeIdx + 1);
      // Auto-play the next clip on the next paint.
      requestAnimationFrame(() => {
        videoRef.current?.play().catch(() => {});
      });
    } else {
      setPlaying(false);
    }
  }

  function playFromStart() {
    setActiveIdx(0);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      v.play().catch(() => {});
    });
  }

  const showOverlay = !current || (isRendering && playableShots.length === 0);

  return (
    <div className="mb-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {current && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={current.id}
            ref={videoRef}
            src={current.videoSignedUrl!}
            preload="metadata"
            playsInline
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="h-full w-full object-contain"
          />
        )}
        {showOverlay && isRendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-ink-100/70">
            <div
              className="mb-2 h-8 w-8 rounded-full animate-glow"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
              }}
            />
            Rendering shots…
          </div>
        )}
        {isFailed && playableShots.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-rose-200/90 px-4 text-center">
            <div className="font-medium mb-1">All shots failed</div>
            <div className="text-[11px] text-rose-200/70 line-clamp-3">
              {failureNote || 'Seedance returned errors for every shot.'}
            </div>
          </div>
        )}
        {current && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/85">
            Shot {playableShots.findIndex((sh) => sh.id === current.id) + 1}
            <span className="ml-1 text-white/60">/ {playableShots.length}</span>
            <span className="ml-2 uppercase tracking-wider text-white/55">
              {current.role}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) v.play().catch(() => {});
              else v.pause();
            }}
            disabled={!current}
            className="btn-ghost !px-2.5 !py-1 !text-[11px]"
            title="Play / pause the current shot"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={playFromStart}
            disabled={playableShots.length === 0}
            className="btn-ghost !px-2.5 !py-1 !text-[11px]"
            title="Preview the stitched scene from the first shot"
          >
            Preview stitched
          </button>
        </div>
        {partial && (
          <span className="text-[10px] text-amber-100/85">
            Some shots failed — preview skips them.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Per-scene shot ordering + retry strip. Each row shows a thumbnail of
 * the rendered shot, its role, move-up / move-down handles, and a Redo
 * button. The user can rearrange shots locally and either preview the
 * new order in the stitched player above or persist it to the backend
 * via `api.reorderShots`; saved order is what final assembly will
 * concatenate.
 */
function ShotOrderStrip({
  projectId,
  scene,
  localOrder,
  onLocalOrderChange,
  onChanged,
}: {
  projectId: string;
  scene: Scene;
  localOrder: string[] | null;
  onLocalOrderChange: (next: string[] | null) => void;
  onChanged: () => void;
}) {
  const [busyShot, setBusyShot] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverShots = useMemo(
    () => (scene.shots ?? []).slice().sort((a, b) => a.shotIndex - b.shotIndex),
    [scene.shots]
  );
  const serverIds = useMemo(() => serverShots.map((sh) => sh.id), [serverShots]);

  const order = localOrder ?? serverIds;
  const shotById = useMemo(() => {
    const m = new Map<string, SceneShot>();
    for (const sh of serverShots) m.set(sh.id, sh);
    return m;
  }, [serverShots]);
  const orderedShots = order
    .map((id) => shotById.get(id))
    .filter((sh): sh is SceneShot => !!sh);

  const dirty =
    localOrder != null &&
    localOrder.some((id, i) => serverIds[i] !== id);

  const everyReady = orderedShots.every((sh) => !!sh.videoSignedUrl);
  const reorderAllowed = orderedShots.length >= 2 && everyReady;
  const anyFailed = orderedShots.some(
    (sh) => sh.status === 'failed' && !sh.videoKey
  );

  function move(idx: number, delta: number) {
    const next = order.slice();
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onLocalOrderChange(next);
  }

  async function regen(shot: SceneShot) {
    setError(null);
    setBusyShot(shot.id);
    try {
      await api.regenerateShotVideo(projectId, scene.id, shot.id);
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Regenerate failed');
    } finally {
      setBusyShot(null);
    }
  }

  async function saveOrder() {
    if (!localOrder) return;
    setError(null);
    setSavingOrder(true);
    try {
      await api.reorderShots(projectId, scene.id, localOrder);
      await onChanged();
      onLocalOrderChange(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to save order');
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="space-y-2">
      {anyFailed && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-100/90 flex items-center justify-between gap-2">
          <span>
            Same image keeps failing? Try a different variant on the
            cinematic shots step.
          </span>
          <Link
            href={`/projects/${projectId}/shots`}
            className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-500/20"
          >
            Open shots →
          </Link>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] text-rose-200">
          {error}
        </div>
      )}

      <ol className="space-y-1.5">
        {orderedShots.map((shot, i) => {
          const ready = !!shot.videoSignedUrl;
          const failed = shot.status === 'failed' && !shot.videoKey;
          return (
            <li
              key={shot.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1.5"
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-medium text-ink-100/70">
                {i + 1}
              </span>
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
                {ready ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={shot.videoSignedUrl!}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    onMouseEnter={(e) =>
                      (e.currentTarget as HTMLVideoElement).play().catch(() => {})
                    }
                    onMouseLeave={(e) => {
                      const v = e.currentTarget as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] text-ink-100/60">
                    {failed ? 'failed' : 'rendering…'}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-ink-100/70">
                  {shot.role}
                </span>
                <span className="text-[10px] text-ink-100/45">
                  {Number(shot.durationSeconds || 0).toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || !reorderAllowed || savingOrder}
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-ink-100/80 hover:border-white/25 hover:text-white disabled:opacity-30"
                  title="Move shot earlier in the cut"
                  aria-label="Move shot up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={
                    i === orderedShots.length - 1 ||
                    !reorderAllowed ||
                    savingOrder
                  }
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-ink-100/80 hover:border-white/25 hover:text-white disabled:opacity-30"
                  title="Move shot later in the cut"
                  aria-label="Move shot down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => regen(shot)}
                  disabled={busyShot === shot.id || savingOrder}
                  className="ml-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-ink-100/80 hover:border-white/25 hover:text-white disabled:opacity-40"
                  title={
                    failed
                      ? 'Re-run Seedance. If it keeps failing, pick a different image variant on the cinematic shots step.'
                      : 'Re-run Seedance for this shot'
                  }
                >
                  {busyShot === shot.id ? '…' : 'Redo'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {reorderAllowed && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-ink-100/55">
            {dirty
              ? 'Preview above reflects new order. Save to apply to the final cut.'
              : 'Use ↑↓ to rearrange — the stitched preview matches the final cut order.'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onLocalOrderChange(null)}
              disabled={!dirty || savingOrder}
              className="btn-ghost !px-2 !py-1 !text-[11px]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveOrder}
              disabled={!dirty || savingOrder}
              className="btn-ghost !px-2 !py-1 !text-[11px]"
              title="Persist this shot order so final assembly uses it"
            >
              {savingOrder ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhasePill({ phase }: { phase: SceneVideoState }) {
  const map: Record<SceneVideoState, { label: string; cls: string }> = {
    idle: { label: 'idle', cls: 'border-white/15 text-ink-100/70' },
    queued: { label: 'queued', cls: 'border-amber-400/30 text-amber-200' },
    submitting: { label: 'submitting', cls: 'border-amber-400/30 text-amber-200' },
    polling: { label: 'rendering', cls: 'border-amber-400/30 text-amber-200' },
    running: { label: 'rendering', cls: 'border-amber-400/30 text-amber-200' },
    requeued: { label: 'requeued', cls: 'border-sky-400/30 text-sky-200' },
    complete: { label: 'complete', cls: 'border-emerald-400/30 text-emerald-200' },
    partial: { label: 'partial', cls: 'border-amber-400/30 text-amber-200' },
    failed: { label: 'failed', cls: 'border-rose-400/30 text-rose-200' },
  };
  const { label, cls } = map[phase] || map.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
