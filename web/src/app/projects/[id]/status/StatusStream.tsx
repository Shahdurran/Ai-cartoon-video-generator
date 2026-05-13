'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isLockedShot, type Project, type Scene, type SceneShot } from '@/lib/api';
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
  /** Per-shot video state for multi-shot scenes. Empty/undefined for
   *  single-shot scenes — they only have the aggregate `video` pill. */
  shotVideos?: Record<string, ScenePipelinePhase>;
};

const PHASES: Array<{ key: 'image' | 'voice' | 'video'; label: string }> = [
  { key: 'image', label: 'Image' },
  { key: 'voice', label: 'Voice' },
  { key: 'video', label: 'Video' },
];

/**
 * Aggregate per-shot video states into a single scene-level pill.
 *   - Any failed terminal shot -> 'failed'
 *   - Every shot 'complete'    -> 'complete'
 *   - Any shot mid-flight      -> 'running'
 *   - Otherwise                -> 'idle'
 */
function aggregateShotVideos(
  shotMap: Record<string, ScenePipelinePhase> | undefined
): ScenePipelinePhase {
  if (!shotMap) return 'idle';
  const values = Object.values(shotMap);
  if (values.length === 0) return 'idle';
  if (values.some((v) => v === 'failed')) return 'failed';
  if (values.every((v) => v === 'complete')) return 'complete';
  if (
    values.some((v) =>
      ['running', 'queued', 'polling', 'submitting', 'requeued'].includes(v)
    )
  )
    return 'running';
  return 'idle';
}

function deriveShotVideo(shot: SceneShot, projectStatus: string): ScenePipelinePhase {
  if (shot.videoKey) return 'complete';
  if (shot.status === 'failed') return 'failed';
  if (
    projectStatus === 'generating' ||
    projectStatus === 'videos-review' ||
    projectStatus === 'assembling'
  ) {
    return 'running';
  }
  return 'idle';
}

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
    let video = p.video;
    let shotVideos: Record<string, ScenePipelinePhase> | undefined;

    // Multi-shot scenes: derive the video pill from per-shot videoKeys /
    // statuses, because `scenes.video_key` is always null for them so
    // `inferScenePipelinePhases` would otherwise show 'idle' even after
    // every shot has rendered.
    if (s.multiShotEnabled && s.shots && s.shots.length > 0) {
      shotVideos = {};
      for (const sh of s.shots) {
        shotVideos[sh.id] = deriveShotVideo(sh, project.status);
      }
      video = aggregateShotVideos(shotVideos);
    }

    map[s.id] = {
      image: p.image,
      voice: p.voice,
      video,
      ...(shotVideos ? { shotVideos } : {}),
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
        if (payload.status === 'started') {
          // Immediately reflect "work is happening" on every scene whose
          // video isn't already done. Without this, multi-shot scenes
          // sit at 'idle' until their first per-shot event arrives a few
          // seconds later -- which made step 4 look frozen.
          setSceneMap((prev) => {
            const next: Record<string, SceneState> = {};
            for (const [sceneId, st] of Object.entries(prev)) {
              if (st.video === 'complete' || st.video === 'failed') {
                next[sceneId] = st;
                continue;
              }
              let shotVideos: Record<string, ScenePipelinePhase> | undefined;
              if (st.shotVideos) {
                shotVideos = {};
                for (const [id, v] of Object.entries(st.shotVideos)) {
                  shotVideos[id] = v === 'complete' || v === 'failed' ? v : 'running';
                }
              }
              next[sceneId] = {
                ...st,
                video: 'running',
                ...(shotVideos ? { shotVideos } : {}),
              };
            }
            return next;
          });
          setAssembly((prev) =>
            prev === 'complete' || prev === 'failed' ? prev : 'idle'
          );
        }
      } else if (payload.phase === 'shot-video' && payload.sceneId && payload.shotId) {
        // Multi-shot scene: per-shot video event. Update the shot's pill
        // and recompute the aggregate `video` pill from all shots in
        // that scene. Without this, multi-shot scenes look stuck at
        // 'idle' on the status table even while shots are rendering.
        const sceneId = payload.sceneId as string;
        const shotId = payload.shotId as string;
        const next = payload.status as ScenePipelinePhase;
        setSceneMap((prev) => {
          const cur =
            prev[sceneId] || { image: 'idle', voice: 'idle', video: 'idle' };
          const shotVideos = { ...(cur.shotVideos || {}) };
          shotVideos[shotId] = next;
          return {
            ...prev,
            [sceneId]: {
              ...cur,
              shotVideos,
              video: aggregateShotVideos(shotVideos),
              error:
                next === 'failed' && payload.error ? payload.error : cur.error,
            },
          };
        });
      } else if (payload.sceneId) {
        const phaseKey = payload.phase as 'image' | 'voice' | 'video';
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
                    {scene.multiShotEnabled && st.shotVideos && (
                      <MultiShotShotProgress
                        shots={scene.shots ?? []}
                        states={st.shotVideos}
                      />
                    )}
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

/**
 * Inline per-shot progress for a multi-shot scene. Renders a row of small
 * pills (one per shot) below the scene description so the user can see
 * exactly which shots are still in flight, completed, or failed --
 * instead of staring at a single 'idle' Video pill for the whole scene.
 */
function MultiShotShotProgress({
  shots,
  states,
}: {
  shots: SceneShot[];
  states: Record<string, ScenePipelinePhase>;
}) {
  if (shots.length === 0) return null;
  const total = shots.length;
  const done = shots.filter((sh) => states[sh.id] === 'complete').length;
  const failed = shots.some((sh) => states[sh.id] === 'failed');

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-200/55">
        Shots {done}/{total}
        {failed ? ' · partial failure' : ''}
      </span>
      {shots.map((sh, i) => {
        const v = states[sh.id] || 'idle';
        const tone =
          v === 'complete'
            ? 'bg-emerald-400/15 text-emerald-200 border-emerald-400/25'
            : v === 'failed'
              ? 'bg-rose-500/15 text-rose-200 border-rose-500/25'
              : v === 'running' ||
                  v === 'queued' ||
                  v === 'polling' ||
                  v === 'submitting' ||
                  v === 'requeued'
                ? 'bg-brand-400/15 text-brand-100 border-brand-400/25'
                : 'bg-white/[0.04] text-ink-200/70 border-white/10';
        const locked = isLockedShot(sh);
        return (
          <span
            key={sh.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${tone}`}
            title={`Shot ${i + 1} · ${sh.role}${locked ? ' · approved image' : ''} — ${v}`}
          >
            <span className="h-1 w-1 rounded-full bg-current opacity-80" />
            {i + 1}
          </span>
        );
      })}
    </div>
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
