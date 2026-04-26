'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type ImageModelSettings, type VideoModelSettings } from '@/lib/api';

const NB_ASPECT = [
  'auto',
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
  '4:1',
  '1:4',
  '8:1',
  '1:8',
] as const;

const NB_RES = ['0.5K', '1K', '2K', '4K'] as const;
const NB_FMT = ['png', 'jpeg', 'webp'] as const;
const NB_TOL = ['1', '2', '3', '4', '5', '6'] as const;

const VIDEO_MODELS = [
  {
    id: 'bytedance/seedance-2.0/image-to-video',
    label: 'Seedance 2.0 (image → video)',
  },
  {
    id: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    label: 'Seedance v1 Pro (legacy)',
  },
] as const;

const SD20_RES = ['480p', '720p'] as const;
const SD20_DUR = [
  'auto',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
] as const;
const SD20_AR = ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;

export function defaultImageSettings(): ImageModelSettings {
  return {
    preferredCascade: 'nano-banana-2',
    imageModelId: 'fal-ai/nano-banana-2',
    nanoBanana2: {
      aspect_ratio: 'auto',
      resolution: '1K',
      output_format: 'png',
      safety_tolerance: '4',
      sync_mode: false,
      limit_generations: true,
      enable_web_search: false,
      thinking_level: '',
    },
  };
}

export function defaultVideoSettings(): VideoModelSettings {
  return {
    videoModelId: 'bytedance/seedance-2.0/image-to-video',
    seedance20: {
      resolution: '720p',
      duration: 'auto',
      aspect_ratio: 'auto',
      generate_audio: true,
      seed: '',
      end_image_url: '',
      end_user_id: '',
    },
  };
}

export function mergeImage(s?: ImageModelSettings | null): ImageModelSettings {
  const d = defaultImageSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    nanoBanana2: { ...d.nanoBanana2!, ...s.nanoBanana2 },
  };
}

export function mergeVideo(s?: VideoModelSettings | null): VideoModelSettings {
  const d = defaultVideoSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    seedance20: { ...d.seedance20!, ...s.seedance20 },
  };
}

function sanitizeImage(img: ImageModelSettings): ImageModelSettings {
  const nb = { ...img.nanoBanana2 };
  if (nb.thinking_level == null || String(nb.thinking_level).trim() === '') {
    delete (nb as { thinking_level?: string }).thinking_level;
  }
  return { ...img, nanoBanana2: nb };
}

function sanitizeVideo(vid: VideoModelSettings): VideoModelSettings {
  const sd = { ...vid.seedance20 };
  if (sd.seed === '' || sd.seed == null) delete (sd as { seed?: string }).seed;
  return { ...vid, seedance20: sd };
}

/* ─────────────────────────────────────────────────────────────────────
 * Image model panel — rendered on the script-review page so the user
 * can tune image generation BEFORE images are queued.
 * ────────────────────────────────────────────────────────────────── */

export function ImageModelPanel({
  projectId,
  imageModelSettings,
  onSaved,
  disabled,
  compact = false,
}: {
  projectId: string;
  imageModelSettings: ImageModelSettings | null | undefined;
  onSaved?: (next: ImageModelSettings) => Promise<void> | void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const base = useMemo(() => mergeImage(imageModelSettings), [imageModelSettings]);
  const [img, setImg] = useState(base);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setImg(mergeImage(imageModelSettings));
  }, [imageModelSettings]);

  function patchNb(p: Partial<NonNullable<ImageModelSettings['nanoBanana2']>>) {
    setImg((prev) => ({
      ...prev,
      nanoBanana2: { ...prev.nanoBanana2!, ...p },
    }));
  }

  async function save() {
    if (disabled) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload = sanitizeImage(img);
      await api.patchProject(projectId, { imageModelSettings: payload } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved?.(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel animate-fade-up">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="font-medium text-white">Image generation</h3>
        <span className="text-[10px] uppercase tracking-wider text-ink-200/60">
          Nano Banana 2
        </span>
      </div>
      <p className="text-[11px] text-ink-200/70 mb-4 leading-relaxed">
        Tune how each scene&rsquo;s image is generated.{' '}
        <a
          className="text-brand-300 hover:underline"
          href="https://fal.ai/docs/model-api-reference/image-generation-api/nano-banana-2"
          target="_blank"
          rel="noreferrer"
        >
          Docs ↗
        </a>
        . Saved settings apply when you approve the script and to any later
        regenerations.
      </p>

      <label className="label">Primary cascade</label>
      <select
        className="field mt-1.5"
        value={img.preferredCascade || 'nano-banana-2'}
        disabled={disabled}
        onChange={(e) =>
          setImg((p) => ({
            ...p,
            preferredCascade: e.target.value as ImageModelSettings['preferredCascade'],
          }))
        }
      >
        <option value="nano-banana-2">Nano Banana 2 first (Flux as fallback)</option>
        <option value="flux-dev">Flux Dev first (Nano Banana 2 as fallback)</option>
      </select>

      {!compact && (
        <>
          <label className="label mt-3 block">Endpoint ID</label>
          <select
            className="field mt-1.5"
            value={img.imageModelId || 'fal-ai/nano-banana-2'}
            disabled={disabled}
            onChange={(e) => setImg((p) => ({ ...p, imageModelId: e.target.value }))}
          >
            <option value="fal-ai/nano-banana-2">fal-ai/nano-banana-2</option>
          </select>
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="label">Aspect ratio</span>
          <select
            className="field mt-1.5"
            value={img.nanoBanana2?.aspect_ratio || 'auto'}
            disabled={disabled}
            onChange={(e) => patchNb({ aspect_ratio: e.target.value })}
          >
            {NB_ASPECT.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Resolution</span>
          <select
            className="field mt-1.5"
            value={img.nanoBanana2?.resolution || '1K'}
            disabled={disabled}
            onChange={(e) => patchNb({ resolution: e.target.value })}
          >
            {NB_RES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="label">Output format</span>
          <select
            className="field mt-1.5"
            value={img.nanoBanana2?.output_format || 'png'}
            disabled={disabled}
            onChange={(e) =>
              patchNb({ output_format: e.target.value as 'png' | 'jpeg' | 'webp' })
            }
          >
            {NB_FMT.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Safety tolerance</span>
          <select
            className="field mt-1.5"
            value={String(img.nanoBanana2?.safety_tolerance ?? '4')}
            disabled={disabled}
            onChange={(e) => patchNb({ safety_tolerance: e.target.value })}
          >
            {NB_TOL.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!img.nanoBanana2?.sync_mode}
            disabled={disabled}
            onChange={(e) => patchNb({ sync_mode: e.target.checked })}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Sync mode (data URI)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={img.nanoBanana2?.limit_generations !== false}
            disabled={disabled}
            onChange={(e) => patchNb({ limit_generations: e.target.checked })}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Limit generations</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!img.nanoBanana2?.enable_web_search}
            disabled={disabled}
            onChange={(e) => patchNb({ enable_web_search: e.target.checked })}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Web search</span>
        </label>
      </div>

      <label className="label mt-3 block">Thinking level</label>
      <select
        className="field mt-1.5"
        value={img.nanoBanana2?.thinking_level || ''}
        disabled={disabled}
        onChange={(e) => patchNb({ thinking_level: e.target.value || undefined })}
      >
        <option value="">Off (omit)</option>
        <option value="minimal">minimal</option>
        <option value="high">high</option>
      </select>

      <button
        onClick={save}
        disabled={saving || disabled}
        className="btn-primary mt-5 w-full"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save image settings'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Video model panel — rendered on the project detail page where the
 * user picks images and is about to kick off video generation.
 * ────────────────────────────────────────────────────────────────── */

export function VideoModelPanel({
  projectId,
  videoModelSettings,
  onSaved,
  disabled,
}: {
  projectId: string;
  videoModelSettings: VideoModelSettings | null | undefined;
  onSaved?: (next: VideoModelSettings) => Promise<void> | void;
  disabled?: boolean;
}) {
  const base = useMemo(() => mergeVideo(videoModelSettings), [videoModelSettings]);
  const [vid, setVid] = useState(base);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVid(mergeVideo(videoModelSettings));
  }, [videoModelSettings]);

  const isSeedance20 =
    String(vid.videoModelId || '').includes('seedance-2.0') &&
    String(vid.videoModelId || '').includes('image-to-video');

  function patchSd(p: Partial<NonNullable<VideoModelSettings['seedance20']>>) {
    setVid((prev) => ({
      ...prev,
      seedance20: { ...prev.seedance20!, ...p },
    }));
  }

  async function save() {
    if (disabled) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload = sanitizeVideo(vid);
      await api.patchProject(projectId, { videoModelSettings: payload } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved?.(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel animate-fade-up">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="font-medium text-white">Video generation</h3>
        <span className="text-[10px] uppercase tracking-wider text-ink-200/60">
          Seedance
        </span>
      </div>
      <p className="text-[11px] text-ink-200/70 mb-4 leading-relaxed">
        Tune how each picked image is animated into video.{' '}
        <a
          className="text-brand-300 hover:underline"
          href="https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api"
          target="_blank"
          rel="noreferrer"
        >
          Docs ↗
        </a>
      </p>

      <label className="label">Model</label>
      <select
        className="field mt-1.5"
        value={vid.videoModelId || VIDEO_MODELS[0].id}
        disabled={disabled}
        onChange={(e) => setVid((p) => ({ ...p, videoModelId: e.target.value }))}
      >
        {VIDEO_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      {isSeedance20 ? (
        <>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="block">
              <span className="label">Resolution</span>
              <select
                className="field mt-1.5"
                value={vid.seedance20?.resolution || '720p'}
                disabled={disabled}
                onChange={(e) => patchSd({ resolution: e.target.value as '480p' | '720p' })}
              >
                {SD20_RES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Duration</span>
              <select
                className="field mt-1.5"
                value={String(vid.seedance20?.duration ?? 'auto')}
                disabled={disabled}
                onChange={(e) => patchSd({ duration: e.target.value })}
              >
                {SD20_DUR.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="label mt-3 block">Aspect ratio</label>
          <select
            className="field mt-1.5"
            value={vid.seedance20?.aspect_ratio || 'auto'}
            disabled={disabled}
            onChange={(e) => patchSd({ aspect_ratio: e.target.value })}
          >
            {SD20_AR.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={vid.seedance20?.generate_audio !== false}
              disabled={disabled}
              onChange={(e) => patchSd({ generate_audio: e.target.checked })}
              className="accent-brand-400"
            />
            <span className="text-xs text-ink-100/80">
              Generate audio (SFX / ambience / speech)
            </span>
          </label>
          <label className="label mt-3 block">Seed (optional)</label>
          <input
            className="field mt-1.5"
            inputMode="numeric"
            placeholder="Leave empty for random"
            value={vid.seedance20?.seed ?? ''}
            disabled={disabled}
            onChange={(e) => patchSd({ seed: e.target.value })}
          />
          <label className="label mt-3 block">End frame image URL (optional)</label>
          <input
            className="field mt-1.5"
            placeholder="https://…"
            value={vid.seedance20?.end_image_url || ''}
            disabled={disabled}
            onChange={(e) => patchSd({ end_image_url: e.target.value })}
          />
          <label className="label mt-3 block">End user ID (optional)</label>
          <input
            className="field mt-1.5"
            placeholder="Your stable user id"
            value={vid.seedance20?.end_user_id || ''}
            disabled={disabled}
            onChange={(e) => patchSd({ end_user_id: e.target.value })}
          />
        </>
      ) : (
        <p className="mt-3 text-[11px] text-ink-200/70">
          Legacy Seedance v1 uses scene duration (3–10s) and 1080p-style output.
          Switch to Seedance 2.0 above to tune resolution, duration string, aspect
          ratio, and audio.
        </p>
      )}

      <button
        onClick={save}
        disabled={saving || disabled}
        className="btn-primary mt-5 w-full"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save video settings'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Backwards-compatible combined panel (kept so any other call sites
 * don't break). Internally just renders both sub-panels stacked.
 * ────────────────────────────────────────────────────────────────── */

export function ModelSettingsPanel({
  projectId,
  imageModelSettings,
  videoModelSettings,
  onSaved,
}: {
  projectId: string;
  imageModelSettings: ImageModelSettings | null | undefined;
  videoModelSettings: VideoModelSettings | null | undefined;
  onSaved: () => Promise<void> | void;
}) {
  return (
    <div className="space-y-5">
      <ImageModelPanel
        projectId={projectId}
        imageModelSettings={imageModelSettings}
        onSaved={() => onSaved()}
      />
      <VideoModelPanel
        projectId={projectId}
        videoModelSettings={videoModelSettings}
        onSaved={() => onSaved()}
      />
    </div>
  );
}
