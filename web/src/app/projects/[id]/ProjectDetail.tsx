'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Project, type Voice, type MusicTrack } from '@/lib/api';
import { ScenePicker } from './ScenePicker';
import { VoiceoverPanel } from './VoiceoverPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { MusicLibraryModal } from './MusicLibraryModal';
import { AudioPreviewButton } from '@/components/AudioPreviewButton';

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
  const selectedTrack = tracks.find((t) => t.id === project.musicTrackId);

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4 animate-fade-up">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            {project.topic || 'Untitled project'}
          </h1>
          <div className="mt-2 text-sm text-ink-100/70">
            {project.sceneCount} scenes · status:{' '}
            <span className="font-medium text-white">{project.status}</span>
          </div>
          {project.errorMessage && (
            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {project.errorMessage}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {project.outputKey && (
            <Link
              href={`/projects/${project.id}/final`}
              className="btn-ghost"
            >
              View final →
            </Link>
          )}
          <button
            onClick={handleGenerate}
            disabled={!ready || submitting}
            className="btn-primary"
          >
            {submitting ? 'Starting…' : 'Generate video'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          {project.scenes.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center animate-fade-up">
              <div className="mx-auto mb-4 h-10 w-10 rounded-full animate-glow"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
                }}
              />
              <div className="text-sm text-ink-100/80">
                Claude is writing your scene breakdown…
              </div>
            </div>
          ) : (
            project.scenes.map((scene, i) => (
              <div
                key={scene.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <ScenePicker
                  projectId={project.id}
                  scene={scene}
                  onChange={refresh}
                />
              </div>
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
          <div className="glass-panel animate-fade-up">
            <h3 className="font-medium text-white">Background music</h3>
            {selectedTrack ? (
              <div className="mt-3 flex items-center gap-3">
                <AudioPreviewButton src={selectedTrack.previewUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {selectedTrack.name}
                  </div>
                  <div className="text-[11px] text-ink-200/70">
                    {selectedTrack.durationSeconds
                      ? `${Math.round(selectedTrack.durationSeconds)}s`
                      : ''}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-200/70">No music selected</p>
            )}
            <button
              onClick={() => setMusicModalOpen(true)}
              className="btn-ghost mt-3 !px-3 !py-1.5 !text-xs"
            >
              {project.musicTrackId ? 'Change track' : 'Browse library'}
            </button>
            <div className="mt-4">
              <label className="label block">
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
                className="w-full mt-2"
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
