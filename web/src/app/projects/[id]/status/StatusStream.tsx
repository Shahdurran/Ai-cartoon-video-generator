'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Project, type Scene } from '@/lib/api';
import { subscribeProjectStatus } from '@/lib/projectStatusStream';
import {
  inferScenePipelinePhases,
  type ScenePipelinePhase,
} from '@/lib/sceneStatus';

type SceneState = {
  image: ScenePipelinePhase;
  voice: ScenePipelinePhase;
  video: ScenePipelinePhase;
  error?: string;
};

const PHASES: Array<{ key: keyof SceneState; label: string }> = [
  { key: 'image', label: 'Image' },
  { key: 'voice', label: 'Voice' },
  { key: 'video', label: 'Video' },
];

/**
 * Translate the backend's `assembly` SSE payloads into the pill states
 * the UI actually renders. Any unknown value returns null so we leave
 * the previous pill state alone instead of clearing it.
 *
 * Backend wire values (see projectController.approveVideos +
 * finalAssemblyProcessor): 'started' | 'running' | 'complete' | 'failed'.
 */
function mapAssemblyStatus(raw: unknown): ScenePipelinePhase | null {
  switch (raw) {
    case 'started':
    case 'running':
    case 'requeued':
      return 'running';
    case 'complete':
      return 'complete';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

function initialState(project: Project) {
  const map: Record<string, SceneState> = {};
  for (const s of project.scenes) {
    const p = inferScenePipelinePhases(s, project.status);
    map[s.id] = {
      image: p.image,
      voice: p.voice,
      video: p.video,
      ...(p.pipelineError ? { error: p.pipelineError } : {}),
    };
  }
  return map;
}

export function StatusStream({ project }: { project: Project }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  // Latches so the auto-jump effects fire at most once each per page
  // session. Without these, `router` changing identity every render
  // restarted the setTimeout, which caused the API to be polled at
  // ~800ms instead of the configured 8s.
  const jumpedToVideosRef = useRef(false);
  const jumpedToFinalRef = useRef(false);
  const [sceneMap, setSceneMap] = useState<Record<string, SceneState>>(() =>
    initialState(project)
  );
  // If the project is mid-assembly we ignore any stale outputKey from a
  // previous successful render -- otherwise re-assembly from a 'complete'
  // project would render the page as "complete" the moment we land here.
  const [assembly, setAssembly] = useState<ScenePipelinePhase>(() => {
    if (project.status === 'assembling') return 'running';
    if (project.status === 'failed') return 'failed';
    return project.outputKey ? 'complete' : 'idle';
  });
  const [status, setStatus] = useState<string>(project.status);
  const [error, setError] = useState<string | null>(project.errorMessage);
  // Tracks whether we've actually observed assembly transition to
  // 'complete' during this page session (vs. landing on an already-
  // complete project). Only the former should auto-bounce to /final.
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeProjectStatus(project.id, (payload: any) => {
      if (!payload?.phase) return;
      if (payload.phase === 'assembly') {
        // The backend emits two pre-complete states:
        //   - 'started' when the job is enqueued (projectController)
        //   - 'running' when the processor picks it up (finalAssemblyProcessor)
        // The PhasePill only renders known ScenePipelinePhase values, so map
        // both to 'running' instead of dropping the literal string into state
        // (which would render the pill in its default 'idle' style and make
        // it look like nothing is happening).
        const next = mapAssemblyStatus(payload.status);
        if (next) setAssembly(next);
        if (payload.status === 'complete') {
          setStatus('complete');
          setJustCompleted(true);
        }
        if (payload.status === 'failed') {
          setStatus('failed');
          setError(payload.error);
        }
      } else if (payload.phase === 'videos' && payload.status === 'review') {
        setStatus('videos-review');
      } else if (payload.phase === 'pipeline') {
        setStatus((prev) =>
          payload.status === 'started' ? 'generating' : prev
        );
      } else if (payload.sceneId) {
        const phaseKey = payload.phase as keyof SceneState;
        if (PHASES.some((p) => p.key === phaseKey)) {
          setSceneMap((prev) => ({
            ...prev,
            [payload.sceneId]: {
              ...(prev[payload.sceneId] || { image: 'idle', voice: 'idle', video: 'idle' }),
              [phaseKey]: payload.status,
              error: payload.status === 'failed' ? payload.error : undefined,
            },
          }));
        }
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    // Only auto-jump to /final when we observed the assembly finish in
    // this session. Landing on an already-complete project should not
    // bounce -- the user may have come here via the step nav to monitor
    // a re-assembly that hasn't been published yet.
    if (status === 'complete' && justCompleted && !jumpedToFinalRef.current) {
      jumpedToFinalRef.current = true;
      const t = setTimeout(() => {
        routerRef.current.refresh();
        routerRef.current.push(`/projects/${project.id}/final`);
      }, 1500);
      return () => clearTimeout(t);
    }
    if (status === 'videos-review' && !jumpedToVideosRef.current) {
      jumpedToVideosRef.current = true;
      const t = setTimeout(
        () => routerRef.current.push(`/projects/${project.id}/videos`),
        800
      );
      return () => clearTimeout(t);
    }
  }, [status, justCompleted, project.id]);

  const orderedScenes = useMemo(
    () => [...project.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex),
    [project.scenes]
  );

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <div className="glass overflow-hidden rounded-2xl">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-200/70 border-b border-white/10 bg-white/[0.02]">
              <th className="px-4 py-3 text-left font-medium">Scene</th>
              {PHASES.map((p) => (
                <th key={p.key} className="px-4 py-3 text-left font-medium">
                  {p.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {orderedScenes.map((scene, i) => {
              const st = sceneMap[scene.id] || { image: 'idle', voice: 'idle', video: 'idle' };
              return (
                <tr
                  key={scene.id}
                  className="border-b border-white/5 last:border-none animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-white">
                      Scene {scene.sceneIndex + 1}
                    </div>
                    <div className="text-[11px] text-ink-200/70 truncate max-w-[20rem]">
                      {scene.voiceoverText}
                    </div>
                    {st.error && (
                      <div className="mt-2 max-w-[28rem] rounded-lg border border-rose-400/25 bg-rose-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-rose-100/95">
                        {st.error}
                      </div>
                    )}
                  </td>
                  {PHASES.map((p) => (
                    <td key={p.key} className="px-4 py-3 align-top">
                      <PhasePill value={(st as any)[p.key] as ScenePipelinePhase} />
                    </td>
                  ))}
                  <td className="px-4 py-3 align-top">
                    <SceneRetryButton
                      scene={scene}
                      videoState={st.video}
                      onRetried={(vState) =>
                        setSceneMap((prev) => ({
                          ...prev,
                          [scene.id]: {
                            ...(prev[scene.id] || { image: 'idle', voice: 'idle', video: 'idle' }),
                            video: vState,
                            error: undefined,
                          },
                        }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 glass-panel flex items-center justify-between animate-fade-up">
        <div>
          <div className="text-sm font-medium text-white">Final assembly</div>
          <div className="text-[11px] text-ink-200/70">
            Concatenates scenes, burns subtitles, mixes music, renders MP4.
          </div>
        </div>
        <PhasePill value={assembly} />
      </div>
    </div>
  );
}

function PhasePill({ value }: { value: ScenePipelinePhase }) {
  const classes: Record<ScenePipelinePhase, string> = {
    idle: 'bg-white/10 text-ink-100 border border-white/10',
    queued: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
    polling: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
    submitting: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
    requeued: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
    running:
      'bg-brand-400/15 text-brand-100 border border-brand-400/30 animate-glow',
    complete:
      'bg-emerald-400/15 text-emerald-200 border border-emerald-400/30',
    failed: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
  };
  return (
    <span className={`pill ${classes[value]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {value}
    </span>
  );
}

/** Per-scene retry control. Only renders when the video phase has failed,
 *  so successful or in-flight scenes don't get a noisy button. */
function SceneRetryButton({
  scene,
  videoState,
  onRetried,
}: {
  scene: Scene;
  videoState: ScenePipelinePhase;
  onRetried: (state: ScenePipelinePhase) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (videoState !== 'failed') return null;

  async function handleClick() {
    setBusy(true);
    try {
      await api.regenerateSceneVideo(scene.projectId, scene.id);
      onRetried('requeued');
    } catch (_err) {
      onRetried('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="btn-ghost !px-2.5 !py-1 !text-[11px]"
    >
      {busy ? 'Retrying…' : 'Retry'}
    </button>
  );
}
