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
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Scene</th>
              {PHASES.map((p) => (
                <th key={p.key} className="px-4 py-3 text-left">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orderedScenes.map((scene) => {
              const st = sceneMap[scene.id] || { image: 'idle', voice: 'idle', video: 'idle' };
              return (
                <tr key={scene.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">Scene {scene.sceneIndex + 1}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[20rem]">
                      {scene.voiceoverText}
                    </div>
                  </td>
                  {PHASES.map((p) => (
                    <td key={p.key} className="px-4 py-3">
                      <PhasePill value={(st as any)[p.key] as PhaseState} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Final assembly</div>
          <div className="text-xs text-slate-500">
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
    idle: 'bg-slate-100 text-slate-600',
    queued: 'bg-indigo-100 text-indigo-700',
    polling: 'bg-indigo-100 text-indigo-700',
    running: 'bg-amber-100 text-amber-700',
    complete: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${classes[value]}`}>
      {value}
    </span>
  );
}
