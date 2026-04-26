'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Style, type Voice, type MusicTrack } from '@/lib/api';

type Props = {
  styles: Style[];
  /** Kept for API compatibility but no longer rendered on this page; voice
   *  is picked on the project detail page once the script is approved. */
  tracks?: MusicTrack[];
  voices?: Voice[];
  voicesError?: string | null;
};

/** Seedance produces ~5s clips; pad/trim happens during final assembly.
 *  Anything outside this band warrants a soft warning so users don't
 *  accidentally request impossible per-scene durations. */
const PER_SCENE_MIN = 4;
const PER_SCENE_MAX = 8;

export function NewProjectForm({ styles }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'topic' | 'rewrite'>('topic');
  const [topic, setTopic] = useState('');
  const [sourceScript, setSourceScript] = useState('');
  const [styleId, setStyleId] = useState(styles[0]?.id || '');
  const [sceneCount, setSceneCount] = useState(5);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number | ''>(30);
  const [tone, setTone] = useState('dramatic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perSceneSeconds = useMemo(() => {
    if (typeof totalDurationSeconds !== 'number' || sceneCount <= 0) return null;
    return totalDurationSeconds / sceneCount;
  }, [totalDurationSeconds, sceneCount]);

  const durationWarning = useMemo(() => {
    if (perSceneSeconds == null) return null;
    if (perSceneSeconds < PER_SCENE_MIN) {
      return `That's only ${perSceneSeconds.toFixed(1)}s per scene. Seedance generates ~5s clips, so very short scenes will be padded or feel choppy.`;
    }
    if (perSceneSeconds > PER_SCENE_MAX) {
      return `That's ${perSceneSeconds.toFixed(1)}s per scene. Anything over ${PER_SCENE_MAX}s typically requires multi-clip stitching that this pipeline doesn't do yet.`;
    }
    return null;
  }, [perSceneSeconds]);

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
        tone,
      });
      // Land on the script-review page; project detail page also handles
      // routing, but this saves the user a redirect hop.
      router.push(`/projects/${project.id}/script`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
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

      <section className="animate-fade-up stagger-2">
        <SectionHeader step="3" title="Scenes & duration" />
        <div className="grid grid-cols-2 gap-6">
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
        </div>
        {perSceneSeconds != null && (
          <div className="mt-2.5 text-[11px] text-ink-200/80">
            ≈ <span className="text-white">{perSceneSeconds.toFixed(1)}s per scene</span>
            {' '}— Seedance generates ~5s clips, so we&rsquo;ll trim or pad slightly.
          </div>
        )}
        {durationWarning && (
          <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
            {durationWarning}
          </div>
        )}
      </section>

      <section className="animate-fade-up stagger-3">
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
        <p className="mt-3 text-[11px] text-ink-200/60 max-w-md">
          Voice, background music, and subtitle styling are picked after you
          review the AI&rsquo;s scene breakdown — they don&rsquo;t affect
          script generation.
        </p>
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
          {submitting ? 'Writing your script…' : 'Generate script'}
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
