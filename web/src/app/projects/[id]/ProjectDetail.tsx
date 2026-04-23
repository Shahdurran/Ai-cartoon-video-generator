'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Project, type Voice, type MusicTrack } from '@/lib/api';
import { ScenePicker } from './ScenePicker';
import { VoiceoverPanel } from './VoiceoverPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { MusicLibraryModal } from './MusicLibraryModal';

type Props = {
  initialProject: Project;
  voices: Voice[];
  tracks: MusicTrack[];
};

export function ProjectDetail({ initialProject, voices, tracks }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll until scenes arrive (status: scripted) and then again while images render.
  useEffect(() => {
    const pollWhile = ['draft', 'scripted'];
    if (!pollWhile.includes(project.status) && project.scenes.some((s) => !s.imageVariants.length)) {
      // Scenes present but images still generating.
    } else if (!pollWhile.includes(project.status)) {
      return;
    }
    const t = setInterval(async () => {
      try {
        const { project: fresh } = await api.getProject(project.id);
        setProject(fresh);
        if (fresh.status === 'complete') clearInterval(t);
      } catch (_) { /* ignore */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.status]);

  async function refresh() {
    const { project: fresh } = await api.getProject(project.id);
    setProject(fresh);
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      await api.generate(project.id);
      router.push(`/projects/${project.id}/status`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const allSceneImagesPicked =
    project.scenes.length > 0 &&
    project.scenes.every((s) => s.selectedImageId);
  const hasVoice = project.voiceId;
  const ready = allSceneImagesPicked && hasVoice;

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {project.topic || 'Untitled project'}
          </h1>
          <div className="mt-2 text-sm text-slate-500">
            {project.sceneCount} scenes · status:{' '}
            <span className="font-medium text-slate-700">{project.status}</span>
          </div>
          {project.errorMessage && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {project.errorMessage}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {project.outputKey && (
            <Link
              href={`/projects/${project.id}/final`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              View final →
            </Link>
          )}
          <button
            onClick={handleGenerate}
            disabled={!ready || submitting}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Starting…' : 'Generate video'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          {project.scenes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
              <div className="text-sm text-slate-600">
                Claude is writing your scene breakdown…
              </div>
            </div>
          ) : (
            project.scenes.map((scene) => (
              <ScenePicker
                key={scene.id}
                projectId={project.id}
                scene={scene}
                onChange={refresh}
              />
            ))
          )}
        </div>

        <aside className="col-span-1 space-y-6">
          <VoiceoverPanel
            projectId={project.id}
            voices={voices}
            currentVoiceId={project.voiceId}
            currentSettings={project.voiceSettings}
            onSaved={refresh}
          />
          <SubtitlePanel
            projectId={project.id}
            currentSettings={project.subtitleSettings}
            onSaved={refresh}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-medium">Background music</h3>
            <p className="mt-1 text-xs text-slate-500">
              {project.musicTrackId
                ? tracks.find((t) => t.id === project.musicTrackId)?.name ||
                  'Selected'
                : 'No music selected'}
            </p>
            <button
              onClick={() => setMusicModalOpen(true)}
              className="mt-3 text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
            >
              {project.musicTrackId ? 'Change' : 'Browse library'}
            </button>
            <div className="mt-4">
              <label className="text-xs text-slate-600">
                Volume: {Math.round((Number(project.musicVolume) || 0) * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={project.musicVolume}
                onChange={async (e) => {
                  const v = parseFloat(e.target.value);
                  try {
                    await api.patchProject(project.id, { musicVolume: v } as any);
                  } catch (_) { /* ignore */ }
                }}
                className="w-full mt-1"
              />
            </div>
          </div>
        </aside>
      </div>

      {musicModalOpen && (
        <MusicLibraryModal
          projectId={project.id}
          tracks={tracks}
          onClose={() => setMusicModalOpen(false)}
          onSelected={async () => {
            setMusicModalOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
