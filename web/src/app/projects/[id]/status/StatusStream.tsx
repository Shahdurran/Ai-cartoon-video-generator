'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Project } from '@/lib/api';

type PhaseState = 'idle' | 'running' | 'complete' | 'failed' | 'queued' | 'polling';
type SceneState = {
  image: PhaseState;
  voice: PhaseState;
  video: PhaseState;
  error?: string;
};

const PHASES: Array<{ key: keyof SceneState; label: string }> = [
  { key: 'image', label: 'Image' },
  { key: 'voice', label: 'Voice' },
  { key: 'video', label: 'Video' },
];

function initialState(project: Project) {
  const map: Record<string, SceneState> = {};
  for (const s of project.scenes) {
    map[s.id] = {
      image: s.imageVariants.length > 0 ? 'complete' : 'idle',
      voice: s.voiceKey ? 'complete' : 'idle',
      video: s.videoKey ? 'complete' : 'idle',
    };
  }
  return map;
}

export function StatusStream({ project }: { project: Project }) {
  const router = useRouter();
  const [sceneMap, setSceneMap] = useState<Record<string, SceneState>>(() =>
    initialState(project)
  );
  const [assembly, setAssembly] = useState<PhaseState>(
    project.outputKey ? 'complete' : 'idle'
  );
  const [status, setStatus] = useState<string>(project.status);
  const [error, setError] = useState<string | null>(project.errorMessage);

  useEffect(() => {
    const url = api.statusStreamUrl(project.id);
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.phase) return;

        if (payload.phase === 'assembly') {
          setAssembly(payload.status);
          if (payload.status === 'complete') setStatus('complete');
          if (payload.status === 'failed') {
            setStatus('failed');
            setError(payload.error);
          }
        } else if (payload.phase === 'pipeline') {
          setStatus(payload.status === 'started' ? 'generating' : status);
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
      } catch (_) { /* ignore */ }
    };

    es.onerror = () => {
      // Browsers retry automatically; no-op.
    };

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    if (status === 'complete') {
      const t = setTimeout(() => router.push(`/projects/${project.id}/final`), 1500);
      return () => clearTimeout(t);
    }
  }, [status, project.id, router]);

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
                  </td>
                  {PHASES.map((p) => (
                    <td key={p.key} className="px-4 py-3 align-top">
                      <PhasePill value={(st as any)[p.key] as PhaseState} />
                    </td>
                  ))}
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

function PhasePill({ value }: { value: PhaseState }) {
  const classes: Record<PhaseState, string> = {
    idle: 'bg-white/10 text-ink-100 border border-white/10',
    queued: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
    polling: 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
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
