'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Project, type Voice, type MusicTrack } from '@/lib/api';
import { ScenePicker } from './ScenePicker';
import { VoiceoverPanel } from './VoiceoverPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { VideoModelPanel } from './ModelSettingsPanel';
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
  const reloadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live updates via SSE -- no more 3s polling. Image / voice / video phase
  // events from the queue trigger a debounced refetch so signed URLs stay
  // valid and per-scene status pills update in real time.
  useEffect(() => {
    const url = api.statusStreamUrl(project.id);
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
    } catch {
      return;
    }

    function scheduleReload() {
      if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
      reloadDebounce.current = setTimeout(refresh, 400);
    }

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.phase) return;

        if (payload.phase === 'images' || payload.phase === 'image') {
          scheduleReload();
        } else if (payload.phase === 'pipeline' && payload.status === 'started') {
          router.push(`/projects/${project.id}/status`);
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      // Browser auto-reconnects.
    };

    return () => {
      es?.close();
      if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function refresh() {
    try {
      const { project: fresh } = await api.getProject(project.id);
      setProject(fresh);
    } catch {
      /* ignore */
    }
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
  const hasVoice = !!project.voiceId;
  const ready = allSceneImagesPicked && hasVoice;
  const selectedTrack = tracks.find((t) => t.id === project.musicTrackId);

  const stillRendering = project.scenes.some(
    (s) => s.imageVariants.length === 0 && s.status !== 'failed'
  );
  const failedCount = project.scenes.filter((s) => s.status === 'failed').length;
  const pickedCount = project.scenes.filter((s) => !!s.selectedImageId).length;
  const totalCount = project.scenes.length;

  const readyTooltip = useMemo(() => {
    if (!hasVoice) return 'Pick a voice in the sidebar before generating';
    if (!allSceneImagesPicked) {
      const remaining = totalCount - pickedCount;
      return `${remaining} scene${remaining === 1 ? '' : 's'} still need an image picked`;
    }
    return 'Start the video generation pipeline';
  }, [hasVoice, allSceneImagesPicked, pickedCount, totalCount]);

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
            {totalCount > 0 && (
              <span className="ml-2 text-ink-200/70">
                · {pickedCount}/{totalCount} picked
                {failedCount > 0 && (
                  <span className="ml-2 text-rose-300">· {failedCount} failed</span>
                )}
              </span>
            )}
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
            title={readyTooltip}
          >
            {submitting ? 'Starting…' : 'Generate video'}
          </button>
        </div>
      </div>

      {/* Inline guidance banner so the user knows the sidebar is editable
          while images are still rendering. */}
      {stillRendering && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink-100/85 animate-fade-in">
          <span className="text-white font-medium">Images are still rendering.</span>
          {' '}You can pick voice, subtitles, and music in the sidebar now —
          they don&rsquo;t block image generation.
        </div>
      )}

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
                Waiting for scene images…
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
          <VideoModelPanel
            projectId={project.id}
            videoModelSettings={project.videoModelSettings}
            onSaved={refresh}
          />
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
            customFontSignedUrl={project.subtitleCustomFontSignedUrl}
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
