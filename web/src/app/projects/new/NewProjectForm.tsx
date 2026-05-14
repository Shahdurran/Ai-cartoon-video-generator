'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type Style,
  type Voice,
  type MusicTrack,
  type StagedVisualReference,
} from '@/lib/api';

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
  /** Display name for the project when rewriting from an existing script (stored as `topic` in the API). */
  const [videoTitle, setVideoTitle] = useState('');
  const [sourceScript, setSourceScript] = useState('');
  // Style is optional: start unselected so the user makes a deliberate
  // choice between a preset and visual direction (or both).
  const [styleId, setStyleId] = useState<string>('');
  const [sceneCount, setSceneCount] = useState(5);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number | ''>(30);
  const [tone, setTone] = useState('dramatic');
  const [visualNotes, setVisualNotes] = useState('');
  const [visualRefs, setVisualRefs] = useState<StagedVisualReference[]>([]);
  const [refsUploading, setRefsUploading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_VISUAL_REFS = 4;

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

  async function handleAddReferenceFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const remaining = MAX_VISUAL_REFS - visualRefs.length;
    if (remaining <= 0) {
      setRefsError(`Max ${MAX_VISUAL_REFS} reference images.`);
      return;
    }
    const accepted = incoming.slice(0, remaining);
    const tooMany = incoming.length > remaining;
    setRefsError(null);
    setRefsUploading(true);
    try {
      const { uploaded } = await api.uploadVisualReferences(accepted);
      setVisualRefs((prev) => [...prev, ...uploaded]);
      if (tooMany) {
        setRefsError(`Only the first ${accepted.length} were uploaded (cap is ${MAX_VISUAL_REFS}).`);
      }
    } catch (err: any) {
      setRefsError(err?.message || 'Failed to upload reference images');
    } finally {
      setRefsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeReference(tempKey: string) {
    setVisualRefs((prev) => prev.filter((r) => r.tempKey !== tempKey));
    setRefsError(null);
  }

  const hasVisualNotes = visualNotes.trim().length > 0;
  const hasVisualRefs = visualRefs.length > 0;
  /** Server requires at least ONE of: style preset, reference image, or
   *  visual notes -- otherwise Claude/Fal have nothing to anchor the
   *  visuals on. We mirror that gate client-side for instant feedback. */
  const hasVisualAnchor = Boolean(styleId) || hasVisualRefs || hasVisualNotes;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'topic' && !topic.trim()) return setError('Topic is required');
    if (mode === 'rewrite') {
      if (!videoTitle.trim()) return setError('Video title is required');
      if (!sourceScript.trim()) return setError('Source script is required');
    }
    if (!hasVisualAnchor) {
      return setError(
        'Pick a style OR add visual direction (a reference image or notes) so we have something to anchor the visuals on.'
      );
    }

    setSubmitting(true);
    try {
      const { project } = await api.createProject({
        // Rewrite mode: title is the project name; script is the rewrite input.
        // Topic mode: the topic textarea is both the idea and the stored title.
        topic: mode === 'topic' ? topic : videoTitle.trim(),
        sourceScript: mode === 'rewrite' ? sourceScript : undefined,
        styleId: styleId || undefined,
        sceneCount,
        totalDurationSeconds:
          typeof totalDurationSeconds === 'number' ? totalDurationSeconds : undefined,
        tone,
        visualNotes: visualNotes.trim() ? visualNotes.trim() : undefined,
        visualReferenceKeys:
          visualRefs.length > 0 ? visualRefs.map((r) => r.tempKey) : undefined,
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
          <div className="space-y-4">
            <label className="block">
              <span className="label mb-1.5 block">Video title</span>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g. Summer launch promo — 60s cut"
                className="field"
                autoComplete="off"
              />
              <p className="mt-1.5 text-[11px] text-ink-200/65">
                This name appears on your dashboard and project pages. It is separate from the script below.
              </p>
            </label>
            <label className="block">
              <span className="label mb-1.5 block">Existing script</span>
              <textarea
                value={sourceScript}
                onChange={(e) => setSourceScript(e.target.value)}
                placeholder="Paste an existing script — it will be broken into scenes"
                rows={8}
                className="field font-mono"
              />
            </label>
          </div>
        )}
      </section>

      <section className="animate-fade-up stagger-1">
        <SectionHeader step="2" title="Pick a style (optional)" />
        <p className="text-[12px] text-ink-200/70 -mt-2 mb-3 max-w-2xl">
          Picks a baseline art style appended to every image prompt. Skip this
          if you&rsquo;re providing your own reference images / visual notes in
          step 3 — you need <span className="text-white">at least one</span>{' '}
          of the two.
        </p>
        {styles.length === 0 ? (
          <div className="text-sm text-rose-300">
            No styles configured. Run <code>npm run seed</code> on the backend.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {styles.map((s, i) => {
              const selected = styleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(selected ? '' : s.id)}
                  className={`group text-left rounded-2xl border p-3 transition animate-fade-up ${
                    selected
                      ? 'border-brand-400/60 bg-white/[0.08] shadow-glass'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  aria-pressed={selected}
                  title={selected ? 'Click to remove this style' : `Pick ${s.name}`}
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
                    {selected && (
                      <span className="absolute inset-0 ring-2 ring-brand-400/60 rounded-xl" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-white">{s.name}</div>
                </button>
              );
            })}
          </div>
        )}
        {styleId && (
          <button
            type="button"
            onClick={() => setStyleId('')}
            className="mt-3 text-[11px] text-ink-200/70 underline hover:text-white"
          >
            Clear style — rely on visual direction only
          </button>
        )}
      </section>

      <section className="animate-fade-up stagger-2">
        <SectionHeader
          step="3"
          title={`Visual direction${styleId ? ' (optional)' : ''}`}
        />
        <p className="text-[12px] text-ink-200/70 -mt-2 mb-3 max-w-2xl">
          Upload <span className="text-white">reference images</span> (character art, packshot, mood board)
          and/or describe the <span className="text-white">character traits & visual style</span> you want.
          Claude reads them when authoring scene prompts <em>and</em> we send the images
          back to Fal as <span className="text-white">image-to-image references</span> so the
          generated characters actually look like your reference.
          {styleId
            ? ' The style preset above still applies on top.'
            : ' Required when no style preset is picked.'}
        </p>

        {!styleId && !hasVisualRefs && !hasVisualNotes && (
          <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
            You haven&rsquo;t picked a style. Add at least one reference image
            <em> or</em> some visual notes here to give Claude / Fal a look to anchor on.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <span className="label block">Reference images</span>
            <p className="text-[11px] text-ink-200/65">
              Up to {MAX_VISUAL_REFS} images (PNG/JPG/WebP, 8MB each). Used by Claude as the
              canonical look for the main character <span className="text-white">and</span> sent to
              Fal&rsquo;s edit endpoint as the image-to-image reference for every generated scene.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {visualRefs.map((ref) => (
                <div
                  key={ref.tempKey}
                  className="relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-black/30"
                  title={ref.originalName || 'reference image'}
                >
                  {ref.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ref.signedUrl}
                      alt={ref.originalName || 'reference'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-100/60">
                      preview unavailable
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeReference(ref.tempKey)}
                    className="absolute right-1 top-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] text-white/85 hover:bg-black/85"
                    aria-label="Remove reference"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {visualRefs.length < MAX_VISUAL_REFS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={refsUploading}
                  className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-[11px] text-ink-100/70 transition hover:border-white/35 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {refsUploading ? 'Uploading…' : '+ Add'}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) handleAddReferenceFiles(e.target.files);
              }}
            />
            {refsError && (
              <div className="text-[11px] text-rose-300">{refsError}</div>
            )}
          </div>

          <label className="block">
            <span className="label mb-1.5 block">Character traits / visual notes</span>
            <textarea
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
              placeholder={
                'e.g. Tall teenage basketball player with dark blue spiky hair, tanned skin, ' +
                'sharp navy eyes, black sleeveless hoodie. Cinematic golden-hour palette. ' +
                'Or paste a sample image prompt and Claude will mirror its style.'
              }
              rows={8}
              className="field"
            />
            <p className="mt-1.5 text-[11px] text-ink-200/65">
              Either a description, a sample prompt, or both. If you upload references, the
              notes <span className="text-white/85">override</span> them when they conflict.
            </p>
          </label>
        </div>
      </section>

      <section className="animate-fade-up stagger-2">
        <SectionHeader step="4" title="Scenes & duration" />
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
          disabled={submitting || !hasVisualAnchor}
          title={
            !hasVisualAnchor
              ? 'Pick a style or add a reference image / notes first'
              : undefined
          }
          className="btn-primary !px-6 !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
