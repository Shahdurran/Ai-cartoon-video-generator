'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  api,
  type SubtitleAnimationPreset,
  type SubtitleSettings,
} from '@/lib/api';

/** Google Fonts family names (must match libass / system names for burn-in). */
const FONT_PRESETS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Bebas Neue',
  'Poppins',
  'Nunito',
  'Raleway',
  'Merriweather',
  'Playfair Display',
  'Ubuntu',
  'Source Sans 3',
  'Work Sans',
  'DM Sans',
  'Rubik',
  'Quicksand',
  'Archivo Black',
  'Barlow',
  'Fira Sans',
  'Arial',
] as const;

const ANIMATION_OPTIONS: { value: SubtitleAnimationPreset; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'Static text (matches export closest)' },
  { value: 'fade', label: 'Fade', hint: 'Soft in / out loop (preview only)' },
  { value: 'slide-up', label: 'Slide up', hint: 'Preview only' },
  { value: 'slide-down', label: 'Slide down', hint: 'Preview only' },
  { value: 'pop', label: 'Pop', hint: 'Preview only' },
  { value: 'soft-glow', label: 'Soft glow', hint: 'Preview only' },
];

function googleFontsHref(families: readonly string[]) {
  const q = families
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

function settingsFromProps(s: SubtitleSettings | null | undefined) {
  return {
    fontName: s?.fontName || 'Inter',
    fontSize: s?.fontSize ?? 28,
    fontColor: s?.fontColor || '#FFFFFF',
    position: (s?.position || 'bottom') as 'top' | 'middle' | 'bottom',
    outline: s?.outline ?? true,
    outlineWidth: s?.outlineWidth ?? 2,
    shadow: s?.shadow ?? false,
    bold: s?.bold ?? false,
    animationPreset: (s?.animationPreset || 'none') as SubtitleAnimationPreset,
    customFontKey: s?.customFontKey ?? null,
  };
}

export function SubtitlePanel({
  projectId,
  currentSettings,
  customFontSignedUrl,
  onSaved,
}: {
  projectId: string;
  currentSettings: SubtitleSettings;
  customFontSignedUrl?: string | null;
  onSaved: () => Promise<void> | void;
}) {
  const linkId = useId();
  const init = useMemo(() => settingsFromProps(currentSettings), [currentSettings]);
  const [fontName, setFontName] = useState(init.fontName);
  const [fontSize, setFontSize] = useState(init.fontSize);
  const [fontColor, setFontColor] = useState(init.fontColor);
  const [position, setPosition] = useState(init.position);
  const [outline, setOutline] = useState(init.outline);
  const [outlineWidth, setOutlineWidth] = useState(init.outlineWidth);
  const [shadow, setShadow] = useState(init.shadow);
  const [bold, setBold] = useState(init.bold);
  const [animationPreset, setAnimationPreset] = useState<SubtitleAnimationPreset>(
    init.animationPreset
  );
  const [fontSource, setFontSource] = useState<'preset' | 'custom'>(
    init.customFontKey ? 'custom' : 'preset'
  );
  const [customFontFamily, setCustomFontFamily] = useState(
    init.customFontKey ? init.fontName : 'My Font'
  );
  const [customFaceFamily, setCustomFaceFamily] = useState<string | null>(null);
  const [fontUploading, setFontUploading] = useState(false);
  const [fontUploadError, setFontUploadError] = useState<string | null>(null);
  const customFontFaceRef = useRef<FontFace | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const presetList: string[] = useMemo(() => [...FONT_PRESETS], []);

  // Inject Google Fonts in two batches so the CSS request URL stays under browser limits.
  useEffect(() => {
    const safeId = linkId.replace(/:/g, '');
    const batch1 = presetList.slice(0, 12);
    const batch2 = presetList.slice(12);
    const add = (suffix: string, families: string[]) => {
      const id = `gf-subtitles-${safeId}-${suffix}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = googleFontsHref(families);
      document.head.appendChild(link);
    };
    add('a', batch1);
    if (batch2.length) add('b', batch2);
  }, [linkId, presetList]);

  // When the server sends updated settings (e.g. after refresh), sync local state.
  useEffect(() => {
    const next = settingsFromProps(currentSettings);
    setFontName(next.fontName);
    setFontSize(next.fontSize);
    setFontColor(next.fontColor);
    setPosition(next.position);
    setOutline(next.outline);
    setOutlineWidth(next.outlineWidth);
    setShadow(next.shadow);
    setBold(next.bold);
    setAnimationPreset(next.animationPreset);
    setFontSource(next.customFontKey ? 'custom' : 'preset');
    if (next.customFontKey) setCustomFontFamily(next.fontName);
  }, [currentSettings]);

  // Load uploaded font into the document for preview (CORS must allow the origin).
  useEffect(() => {
    const prev = customFontFaceRef.current;
    if (prev) {
      try {
        document.fonts.delete(prev);
      } catch {
        /* ignore */
      }
      customFontFaceRef.current = null;
    }
    setCustomFaceFamily(null);
    if (!customFontSignedUrl || !currentSettings?.customFontKey) return;

    const family = `SubtitleCustom_${projectId.slice(0, 8)}`;
    const face = new FontFace(family, `url(${customFontSignedUrl})`);
    customFontFaceRef.current = face;
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        setCustomFaceFamily(family);
      })
      .catch(() => {
        setFontUploadError(
          'Could not load uploaded font for preview (check CORS on the font URL). Export still uses the file on the server.'
        );
      });
    return () => {
      try {
        if (customFontFaceRef.current) document.fonts.delete(customFontFaceRef.current);
      } catch {
        /* ignore */
      }
      customFontFaceRef.current = null;
    };
  }, [customFontSignedUrl, currentSettings?.customFontKey, projectId]);

  const previewFontFamily = useMemo(() => {
    if (fontSource === 'custom' && customFaceFamily) return `"${customFaceFamily}", sans-serif`;
    if (fontSource === 'custom') return `"${customFontFamily}", sans-serif`;
    return `"${fontName}", sans-serif`;
  }, [fontSource, customFaceFamily, customFontFamily, fontName]);

  const previewAnimationClass = useMemo(() => {
    const map: Record<SubtitleAnimationPreset, string> = {
      none: '',
      fade: 'subtitle-preview-anim-fade',
      'slide-up': 'subtitle-preview-anim-slide-up',
      'slide-down': 'subtitle-preview-anim-slide-down',
      pop: 'subtitle-preview-anim-pop',
      'soft-glow': 'subtitle-preview-anim-soft-glow',
    };
    return map[animationPreset] || '';
  }, [animationPreset]);

  const buildPayload = useCallback((): SubtitleSettings => {
    const base: SubtitleSettings = {
      ...currentSettings,
      fontName: fontSource === 'custom' ? customFontFamily.trim() || 'Arial' : fontName,
      fontSize,
      fontColor,
      position,
      outline,
      outlineWidth,
      shadow,
      bold,
      animationPreset,
      customFontKey: fontSource === 'custom' ? currentSettings?.customFontKey ?? null : null,
    };
    return base;
  }, [
    fontSource,
    customFontFamily,
    fontName,
    fontSize,
    fontColor,
    position,
    outline,
    outlineWidth,
    shadow,
    bold,
    animationPreset,
    currentSettings,
  ]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patchProject(projectId, {
        subtitleSettings: buildPayload(),
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function onFontFile(file: File | null) {
    if (!file) return;
    setFontUploadError(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf')) {
      setFontUploadError('Please choose a .ttf or .otf file.');
      return;
    }
    setFontUploading(true);
    try {
      await api.uploadSubtitleFont(projectId, file);
      const base = file.name.replace(/\.(ttf|otf)$/i, '').replace(/[-_]+/g, ' ');
      setCustomFontFamily(base);
      setFontSource('custom');
      await onSaved();
    } catch (e: any) {
      setFontUploadError(e?.message || 'Upload failed');
    } finally {
      setFontUploading(false);
    }
  }

  async function clearCustomFont() {
    setFontUploadError(null);
    setFontSource('preset');
    const subtitleSettings: SubtitleSettings = {
      ...currentSettings,
      fontName: (FONT_PRESETS as readonly string[]).includes(fontName) ? fontName : 'Inter',
      fontSize,
      fontColor,
      position,
      outline,
      outlineWidth,
      shadow,
      bold,
      animationPreset,
      customFontKey: null,
    };
    await api.patchProject(projectId, { subtitleSettings } as any);
    await onSaved();
  }

  const previewSize = Math.min(fontSize, 36);

  return (
    <div className="glass-panel animate-fade-up">
      <h3 className="font-medium text-white mb-3">Subtitles</h3>
      <p className="text-[11px] text-ink-200/70 mb-3 leading-relaxed">
        Preview uses your settings and Google Fonts. Motion presets are{' '}
        <span className="text-ink-100/90">preview-only</span> — burned SRT subtitles in the final
        MP4 are static; export uses font, size, colour, position, outline, shadow, and bold.
      </p>

      <div
        className="aspect-video w-full rounded-xl relative overflow-hidden mb-4 border border-white/10"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #FFA846 0%, #FF4689 55%, #1C030D 100%)',
        }}
      >
        <div
          className={`absolute left-0 right-0 text-center px-3 ${
            position === 'top'
              ? 'top-3'
              : position === 'middle'
              ? 'top-1/2 -translate-y-1/2'
              : 'bottom-3'
          }`}
        >
          <span
            key={`${previewFontFamily}-${fontSize}-${fontColor}-${outline}-${bold}-${animationPreset}`}
            className={`subtitle-preview-text inline-block px-2 ${previewAnimationClass}`}
            style={{
              fontFamily: previewFontFamily,
              fontSize: previewSize,
              fontWeight: bold ? 700 : 600,
              color: fontColor,
              letterSpacing: '0.02em',
              textShadow: shadow
                ? '0 2px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)'
                : outline
                ? '0 0 2px #000, 0 0 4px #000, 0 0 6px #000'
                : 'none',
              lineHeight: 1.2,
            }}
          >
            Example subtitle — Ag 123
          </span>
        </div>
      </div>

      <label className="label">Font source</label>
      <div className="mt-1.5 flex rounded-xl border border-white/10 p-0.5 bg-black/20">
        <button
          type="button"
          onClick={() => setFontSource('preset')}
          className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
            fontSource === 'preset'
              ? 'bg-white/15 text-white shadow-inner'
              : 'text-ink-200/80 hover:text-white'
          }`}
        >
          Preset (Google Fonts)
        </button>
        <button
          type="button"
          onClick={() => setFontSource('custom')}
          className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
            fontSource === 'custom'
              ? 'bg-white/15 text-white shadow-inner'
              : 'text-ink-200/80 hover:text-white'
          }`}
        >
          Custom upload
        </button>
      </div>

      {fontSource === 'preset' ? (
        <>
          <label className="label mt-3 block">Font</label>
          <select
            value={fontName || 'Inter'}
            onChange={(e) => setFontName(e.target.value)}
            className="field mt-1.5"
          >
            {!presetList.includes(fontName) && fontName ? (
              <option value={fontName}>{fontName} (saved)</option>
            ) : null}
            {presetList.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="label block">Font name (must match font metadata for export)</label>
          <input
            className="field mt-1.5"
            value={customFontFamily}
            onChange={(e) => setCustomFontFamily(e.target.value)}
            placeholder="e.g. Roboto Condensed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer !py-2 !text-xs">
              {fontUploading ? 'Uploading…' : 'Upload .ttf / .otf'}
              <input
                type="file"
                accept=".ttf,.otf,font/ttf,font/otf"
                className="hidden"
                disabled={fontUploading}
                onChange={(e) => onFontFile(e.target.files?.[0] || null)}
              />
            </label>
            {currentSettings?.customFontKey && (
              <button type="button" onClick={clearCustomFont} className="btn-subtle !text-xs">
                Remove uploaded font
              </button>
            )}
          </div>
          {!currentSettings?.customFontKey && (
            <p className="text-[11px] text-ink-200/70">
              Upload a font file first. It is stored with the project and used during FFmpeg
              subtitle burn-in.
            </p>
          )}
        </div>
      )}

      {fontUploadError && (
        <div className="mt-2 text-[11px] text-rose-300">{fontUploadError}</div>
      )}

      <label className="label mt-3 block">Motion (preview)</label>
      <select
        value={animationPreset}
        onChange={(e) => setAnimationPreset(e.target.value as SubtitleAnimationPreset)}
        className="field mt-1.5"
      >
        {ANIMATION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} — {o.hint}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="label">Size: {fontSize}</span>
          <input
            type="range"
            min={16}
            max={48}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="w-full mt-1.5"
          />
        </label>
        <label className="block">
          <span className="label">Color</span>
          <input
            type="color"
            value={fontColor.length === 7 ? fontColor : '#FFFFFF'}
            onChange={(e) => setFontColor(e.target.value.toUpperCase())}
            className="w-full h-[34px] mt-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="label">Position</span>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as 'top' | 'middle' | 'bottom')}
            className="field mt-1.5"
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Outline width</span>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={outlineWidth}
            onChange={(e) => setOutlineWidth(parseInt(e.target.value, 10))}
            disabled={!outline}
            className="w-full mt-1.5 disabled:opacity-40"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={outline}
            onChange={(e) => setOutline(e.target.checked)}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Outline</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={shadow}
            onChange={(e) => setShadow(e.target.checked)}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Shadow</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={bold}
            onChange={(e) => setBold(e.target.checked)}
            className="accent-brand-400"
          />
          <span className="text-xs text-ink-100/80">Bold</span>
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary mt-5 w-full"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save subtitle settings'}
      </button>
    </div>
  );
}
