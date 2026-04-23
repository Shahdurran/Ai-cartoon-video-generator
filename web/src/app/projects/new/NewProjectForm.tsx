'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Style, type Voice, type MusicTrack } from '@/lib/api';

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
  const [musicTrackId, setMusicTrackId] = useState<string | ''>('');
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [tone, setTone] = useState('dramatic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <section>
        <h2 className="text-lg font-medium mb-3">1. What's the video about?</h2>
        <div className="flex gap-2 mb-3">
          {(['topic', 'rewrite'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                mode === m
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        ) : (
          <textarea
            value={sourceScript}
            onChange={(e) => setSourceScript(e.target.value)}
            placeholder="Paste an existing script -- it will be broken into scenes"
            rows={8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none font-mono text-sm"
          />
        )}
      </section>

      {/* Style picker */}
      <section>
        <h2 className="text-lg font-medium mb-3">2. Pick a style</h2>
        {styles.length === 0 ? (
          <div className="text-sm text-rose-600">
            No styles configured. Run <code>npm run seed</code> on the backend.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                className={`text-left rounded-lg border p-3 transition ${
                  styleId === s.id
                    ? 'border-brand-500 ring-2 ring-brand-200 bg-white'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className="aspect-video w-full rounded-md bg-slate-100 bg-center bg-cover mb-2"
                  style={s.thumbnailUrl ? { backgroundImage: `url(${s.thumbnailUrl})` } : {}}
                />
                <div className="text-sm font-medium">{s.name}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Scene + duration */}
      <section className="grid grid-cols-2 gap-6">
        <label className="block">
          <span className="text-sm font-medium">Scenes</span>
          <input
            type="number"
            min={1}
            max={20}
            value={sceneCount}
            onChange={(e) => setSceneCount(parseInt(e.target.value || '0', 10))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Target duration (seconds)</span>
          <input
            type="number"
            min={6}
            max={600}
            value={totalDurationSeconds}
            onChange={(e) =>
              setTotalDurationSeconds(e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </section>

      {/* Voice + tone */}
      <section className="grid grid-cols-2 gap-6">
        <label className="block">
          <span className="text-sm font-medium">Voice</span>
          {voicesError ? (
            <div className="mt-1 text-xs text-rose-600">{voicesError}</div>
          ) : (
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
            >
              <option value="">— Select a voice —</option>
              {voices.map((v) => (
                <option key={v.voiceId} value={v.voiceId}>
                  {v.name}{v.category ? ` (${v.category})` : ''}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
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
      <section className="grid grid-cols-2 gap-6">
        <label className="block">
          <span className="text-sm font-medium">Background music</span>
          <select
            value={musicTrackId}
            onChange={(e) => setMusicTrackId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
          >
            <option value="">— None —</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            Music volume: {Math.round(musicVolume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="mt-3 w-full"
          />
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  );
}
