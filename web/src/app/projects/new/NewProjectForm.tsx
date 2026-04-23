'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Style, type Voice, type MusicTrack } from '@/lib/api';
import { VoicePreviewCard } from '@/components/VoicePreviewCard';
import { AudioPreviewButton } from '@/components/AudioPreviewButton';

type Props = {
  styles: Style[];
  tracks: MusicTrack[];
  voices: Voice[];
  voicesError: string | null;
};

export function NewProjectForm({ styles, tracks, voices, voicesError }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'topic' | 'rewrite'>('topic');
  const [topic, setTopic] = useState('');
  const [sourceScript, setSourceScript] = useState('');
  const [styleId, setStyleId] = useState(styles[0]?.id || '');
  const [sceneCount, setSceneCount] = useState(5);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number | ''>(30);
  const [voiceId, setVoiceId] = useState(voices[0]?.voiceId || '');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [musicTrackId, setMusicTrackId] = useState<string | ''>('');
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [tone, setTone] = useState('dramatic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVoices = useMemo(() => {
    if (!voiceQuery.trim()) return voices;
    const q = voiceQuery.toLowerCase();
    return voices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        Object.values(v.labels || {}).some((l) => l?.toLowerCase().includes(q))
    );
  }, [voices, voiceQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!styleId) return setError('Please choose a style');
    if (mode === 'topic' && !topic.trim()) return setError('Topic is required');
    if (mode === 'rewrite' && !sourceScript.trim())
      return setError('Source script is required');

    setSubmitting(true);
    try {
      const { project } = await api.createProject({
        topic: mode === 'topic' ? topic : undefined,
        sourceScript: mode === 'rewrite' ? sourceScript : undefined,
        styleId,
        sceneCount,
        totalDurationSeconds:
          typeof totalDurationSeconds === 'number' ? totalDurationSeconds : undefined,
        voiceId: voiceId || undefined,
        musicTrackId: musicTrackId || undefined,
        musicVolume,
        tone,
      });
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Input mode */}
      <section className="animate-fade-up">
        <SectionHeader step="1" title="What's the video about?" />
        <div className="flex gap-2 mb-3">
          {(['topic', 'rewrite'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? 'btn-primary !px-4 !py-1.5 !text-xs'
                  : 'btn-ghost !px-4 !py-1.5 !text-xs'
              }
            >
              {m === 'topic' ? 'Just a topic' : 'From an existing script'}
            </button>
          ))}
        </div>
        {mode === 'topic' ? (
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. A dog who discovers he can talk to squirrels"
            rows={3}
            className="field"
          />
        ) : (
          <textarea
            value={sourceScript}
            onChange={(e) => setSourceScript(e.target.value)}
            placeholder="Paste an existing script — it will be broken into scenes"
            rows={8}
            className="field font-mono"
          />
        )}
      </section>

      {/* Style picker */}
      <section className="animate-fade-up stagger-1">
        <SectionHeader step="2" title="Pick a style" />
        {styles.length === 0 ? (
          <div className="text-sm text-rose-300">
            No styles configured. Run <code>npm run seed</code> on the backend.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {styles.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                className={`group text-left rounded-2xl border p-3 transition animate-fade-up ${
                  styleId === s.id
                    ? 'border-brand-400/60 bg-white/[0.08] shadow-glass'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div
                  className="aspect-video w-full rounded-xl mb-2 bg-center bg-cover relative overflow-hidden"
                  style={
                    s.thumbnailUrl
                      ? { backgroundImage: `url(${s.thumbnailUrl})` }
                      : {
                          backgroundImage:
                            'linear-gradient(135deg, rgba(255,168,70,0.3), rgba(255,70,137,0.3))',
                        }
                  }
                >
                  {styleId === s.id && (
                    <span className="absolute inset-0 ring-2 ring-brand-400/60 rounded-xl" />
                  )}
                </div>
                <div className="text-sm font-medium text-white">{s.name}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Scene + duration */}
      <section className="grid grid-cols-2 gap-6 animate-fade-up stagger-2">
        <label className="block">
          <span className="label mb-1.5 block">Scenes</span>
          <input
            type="number"
            min={1}
            max={20}
            value={sceneCount}
            onChange={(e) => setSceneCount(parseInt(e.target.value || '0', 10))}
            className="field"
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Target duration (seconds)</span>
          <input
            type="number"
            min={6}
            max={600}
            value={totalDurationSeconds}
            onChange={(e) =>
              setTotalDurationSeconds(e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="field"
          />
        </label>
      </section>

      {/* Voice picker with previews */}
      <section className="animate-fade-up stagger-3">
        <SectionHeader step="3" title="Choose a voice" />
        {voicesError ? (
          <div className="text-xs text-rose-300">{voicesError}</div>
        ) : voices.length === 0 ? (
          <div className="text-xs text-ink-200/70">No voices available.</div>
        ) : (
          <>
            <input
              placeholder="Search voices…"
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              className="field mb-3"
            />
            <div className="grid sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
              {filteredVoices.map((v, i) => (
                <div
                  key={v.voiceId}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                >
                  <VoicePreviewCard
                    voice={v}
                    selected={voiceId === v.voiceId}
                    onSelect={() => setVoiceId(v.voiceId)}
                  />
                </div>
              ))}
              {filteredVoices.length === 0 && (
                <div className="col-span-full text-xs text-ink-200/70 text-center py-6">
                  No voices match &ldquo;{voiceQuery}&rdquo;.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Tone */}
      <section className="animate-fade-up stagger-4">
        <label className="block max-w-xs">
          <span className="label mb-1.5 block">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="field"
          >
            <option value="dramatic">Dramatic</option>
            <option value="playful">Playful</option>
            <option value="mysterious">Mysterious</option>
            <option value="educational">Educational</option>
            <option value="inspirational">Inspirational</option>
          </select>
        </label>
      </section>

      {/* Music */}
      <section className="animate-fade-up stagger-5">
        <SectionHeader step="4" title="Background music" />
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMusicTrackId('')}
            className={`text-left rounded-2xl border p-4 transition ${
              !musicTrackId
                ? 'border-brand-400/60 bg-white/[0.08]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
            }`}
          >
            <div className="text-sm font-medium text-white">None</div>
            <div className="text-[11px] text-ink-200/70 mt-0.5">
              No background music
            </div>
          </button>
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMusicTrackId(t.id)}
              className={`text-left rounded-2xl border p-4 transition flex items-center gap-3 ${
                musicTrackId === t.id
                  ? 'border-brand-400/60 bg-white/[0.08]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
              }`}
            >
              <AudioPreviewButton src={t.previewUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">
                  {t.name}
                </div>
                <div className="text-[11px] text-ink-200/70 truncate">
                  {t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : ''}
                  {t.tags.length > 0 ? ` · ${t.tags.join(', ')}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
        <label className="block mt-4 max-w-md">
          <span className="label mb-1.5 block">
            Volume: {Math.round(musicVolume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="w-full"
          />
        </label>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary !px-6 !py-3"
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold text-white shadow-md"
        style={{
          backgroundImage: 'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
        }}
      >
        {step}
      </span>
      <h2 className="text-lg font-medium text-white">{title}</h2>
    </div>
  );
}
