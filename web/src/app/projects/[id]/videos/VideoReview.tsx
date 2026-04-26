'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Project, type Scene } from '@/lib/api';

type SceneVideoState = 'idle' | 'queued' | 'submitting' | 'polling' | 'running' | 'complete' | 'failed' | 'requeued';

export function VideoReview({ initialProject }: { initialProject: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [busy, setBusy] = useState<null | 'approve' | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Record<string, SceneVideoState>>(() =>
    Object.fromEntries(
      initialProject.scenes.map((s) => [
        s.id,
        s.videoKey
          ? 'complete'
          : s.status === 'failed'
            ? 'failed'
            : 'running',
      ])
    )
  );

  // Live SSE so newly-completed regenerations + concurrent renders flip
  // their preview cards without a manual refresh.
  useEffect(() => {
    const es = new EventSource(api.statusStreamUrl(project.id));
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(async () => {
        try {
          const { project: fresh } = await api.getProject(project.id);
          setProject(fresh);
        } catch (_) { /* ignore */ }
      }, 600);
    };

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.phase) return;
        if (payload.phase === 'video' && payload.sceneId) {
          setPhase((p) => ({ ...p, [payload.sceneId]: payload.status }));
          if (payload.status === 'complete' || payload.status === 'failed') {
            scheduleRefetch();
          }
        } else if (payload.phase === 'assembly' && payload.status === 'started') {
          router.push(`/projects/${project.id}/status`);
        }
      } catch (_) { /* ignore */ }
    };
    es.onerror = () => { /* browser auto-retries */ };
    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const orderedScenes = useMemo(
    () => [...project.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex),
    [project.scenes]
  );

  const completeCount = orderedScenes.filter((s) => !!s.videoKey).length;
  const failedCount = orderedScenes.filter((s) => !s.videoKey && s.status === 'failed').length;
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
            scene={scene}
            index={i}
            phase={phase[scene.id] || (scene.videoKey ? 'complete' : 'running')}
            busy={busy === scene.id}
            onRegenerate={() => regenerate(scene.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SceneVideoCard({
  scene,
  index,
  phase,
  busy,
  onRegenerate,
}: {
  scene: Scene;
  index: number;
  phase: SceneVideoState;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isReady = !!scene.videoSignedUrl && phase === 'complete';
  const isFailed = phase === 'failed' || (!scene.videoKey && scene.status === 'failed');
  const isRendering = !isReady && !isFailed;

  return (
    <div
      className="glass-panel animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-brand-100/80 font-medium">
          Scene {scene.sceneIndex + 1}
        </div>
        <PhasePill phase={phase} />
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 mb-3">
        {isReady && (
          <video
            ref={videoRef}
            src={scene.videoSignedUrl!}
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
              {scene.errorMessage || 'Seedance returned an error.'}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-ink-200/70 line-clamp-2 mb-3" title={scene.voiceoverText}>
        {scene.voiceoverText}
      </div>

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
