'use client';

import { useState } from 'react';
import { api, type SubtitleSettings } from '@/lib/api';

const FONTS = ['Arial', 'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Bebas Neue', 'Lato'];

export function SubtitlePanel({
  projectId,
  currentSettings,
  onSaved,
}: {
  projectId: string;
  currentSettings: SubtitleSettings;
  onSaved: () => Promise<void> | void;
}) {
  const [fontName, setFontName] = useState(currentSettings.fontName || 'Arial');
  const [fontSize, setFontSize] = useState(currentSettings.fontSize || 28);
  const [fontColor, setFontColor] = useState(currentSettings.fontColor || '#FFFFFF');
  const [position, setPosition] = useState<'top' | 'middle' | 'bottom'>(currentSettings.position || 'bottom');
  const [outline, setOutline] = useState(currentSettings.outline ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patchProject(projectId, {
        subtitleSettings: { fontName, fontSize, fontColor, position, outline },
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-medium mb-3">Subtitles</h3>

      {/* Live preview strip */}
      <div
        className="aspect-video w-full rounded-md relative overflow-hidden mb-3"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #6366f1 100%)',
        }}
      >
        <div
          className={`absolute left-0 right-0 text-center px-2 ${
            position === 'top'
              ? 'top-2'
              : position === 'middle'
              ? 'top-1/2 -translate-y-1/2'
              : 'bottom-2'
          }`}
        >
          <span
            className="inline-block px-1"
            style={{
              fontFamily: `${fontName}, sans-serif`,
              fontSize: Math.min(fontSize, 28),
              color: fontColor,
              textShadow: outline ? '0 0 2px #000, 0 0 2px #000, 0 0 2px #000' : 'none',
              lineHeight: 1.1,
            }}
          >
            Example subtitle
          </span>
        </div>
      </div>

      <label className="block text-xs text-slate-600">Font</label>
      <select
        value={fontName}
        onChange={(e) => setFontName(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="text-xs text-slate-600">Size: {fontSize}</span>
          <input
            type="range"
            min={16}
            max={48}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="w-full mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Color</span>
          <input
            type="color"
            value={fontColor}
            onChange={(e) => setFontColor(e.target.value.toUpperCase())}
            className="w-full h-[30px] rounded border border-slate-200"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="text-xs text-slate-600">Position</span>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as any)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm"
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={outline}
            onChange={(e) => setOutline(e.target.checked)}
          />
          <span className="text-xs text-slate-700">Outline</span>
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 w-full rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save subtitle settings'}
      </button>
    </div>
  );
}
