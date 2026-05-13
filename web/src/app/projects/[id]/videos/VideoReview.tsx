'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Project, type Scene, type SceneShot } from '@/lib/api';
import { subscribeProjectStatus } from '@/lib/projectStatusStream';

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
            : 'running',
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
            scene={scene}
            index={i}
            phase={phase[scene.id] || (isSceneVideoReady(scene) ? 'complete' : 'running')}
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
  scene,
  index,
  phase,
  busy,
  onRegenerate,
  onShotChanged,
}: {
  projectId: string;
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

  // For single-shot scenes the existing `videoSignedUrl` drives the
  // preview. For multi-shot scenes we play the FIRST shot in the main
  // preview slot and offer per-shot retry/preview below.
  const previewUrl = isMultiShot
    ? shots.find((sh) => !!sh.videoSignedUrl)?.videoSignedUrl || null
    : scene.videoSignedUrl;

  // For multi-shot scenes the per-scene `phase` map never receives
  // events (the backend emits 'shot-video' instead), so it stays at the
  // initial seed of 'running'. Use the shot-aggregated phase instead.
  const effectivePhase: SceneVideoState = isMultiShot
    ? deriveMultiShotPhase(scene)
    : phase;

  const isReady = !!previewUrl && (effectivePhase === 'complete' || effectivePhase === 'partial');
  const isFailed =
    effectivePhase === 'failed' ||
    (!isMultiShot && !isSceneVideoReady(scene) && scene.status === 'failed');
  const isRendering = !isReady && !isFailed;
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
        {!isFailed && !isReady && effectivePhase === 'partial' && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-500/15 px-3 py-1.5 text-[10px] text-amber-100/90 text-center border-t border-amber-400/20">
            One shot failed — pick a different image variant or regenerate.
          </div>
        )}
      </div>

      <div className="text-[11px] text-ink-200/70 line-clamp-2 mb-3" title={scene.voiceoverText}>
        {scene.voiceoverText}
      </div>

      {isMultiShot ? (
        <ShotRetryStrip
          projectId={projectId}
          scene={scene}
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
          {busy ? 'Re-queuing…' : 'Regenerate this scene'}
        </button>
      )}
      {isMultiShot && (
        <p className="mt-2 text-[10px] text-ink-100/50 text-center">
          Final cut cross-cuts between these shots with continuous voiceover.
        </p>
      )}
    </div>
  );
}

function ShotRetryStrip({
  projectId,
  scene,
  onChanged,
}: {
  projectId: string;
  scene: Scene;
  onChanged: () => void;
}) {
  const [busyShot, setBusyShot] = useState<string | null>(null);
  const shots = scene.shots ?? [];
  const anyFailed = shots.some(
    (sh) => sh.status === 'failed' && !sh.videoKey
  );

  async function regen(shot: SceneShot) {
    setBusyShot(shot.id);
    try {
      await api.regenerateShotVideo(projectId, scene.id, shot.id);
      await onChanged();
    } finally {
      setBusyShot(null);
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
      <div className="grid grid-cols-2 gap-1.5">
      {shots.map((shot) => {
        const ready = !!shot.videoSignedUrl;
        const failed = shot.status === 'failed' && !shot.videoKey;
        return (
          <div
            key={shot.id}
            className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/40"
          >
            {ready ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={shot.videoSignedUrl!}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                onMouseLeave={(e) => {
                  const v = e.currentTarget as HTMLVideoElement;
                  v.pause();
                  v.currentTime = 0;
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-100/55">
                {failed ? 'failed' : 'rendering…'}
              </div>
            )}
            <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/80">
              {shot.role}
            </div>
            <button
              type="button"
              onClick={() => regen(shot)}
              disabled={busyShot === shot.id}
              className="absolute right-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80 hover:bg-black/80 disabled:opacity-50"
              title={
                failed
                  ? 'Re-run Seedance. If it keeps failing, pick a different image variant on the cinematic shots step.'
                  : 'Re-run Seedance for this shot'
              }
            >
              {busyShot === shot.id ? '…' : 'Redo'}
            </button>
          </div>
        );
      })}
      </div>
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
