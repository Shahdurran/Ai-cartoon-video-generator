'use client';

import { useEffect, useState } from 'react';
import { api, type Voice, type VoiceSettings } from '@/lib/api';

export function VoiceoverPanel({
  projectId,
  voices,
  currentVoiceId,
  currentSettings,
  onSaved,
}: {
  projectId: string;
  voices: Voice[];
  currentVoiceId: string | null;
  currentSettings: VoiceSettings;
  onSaved: () => Promise<void> | void;
}) {
  const [voiceId, setVoiceId] = useState(currentVoiceId || '');
  const [stability, setStability] = useState(currentSettings.stability ?? 0.5);
  const [similarity, setSimilarity] = useState(currentSettings.similarityBoost ?? 0.75);
  const [speed, setSpeed] = useState(currentSettings.speed ?? 1.0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVoiceId(currentVoiceId || ''); }, [currentVoiceId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patchProject(projectId, {
        voiceId,
        voiceSettings: {
          stability,
          similarityBoost: similarity,
          speed,
        },
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  const currentVoice = voices.find((v) => v.voiceId === voiceId);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-medium mb-3">Voiceover</h3>
      <label className="block text-xs text-slate-600">Voice</label>
      <select
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm"
      >
        <option value="">— Select —</option>
        {voices.map((v) => (
          <option key={v.voiceId} value={v.voiceId}>
            {v.name}
          </option>
        ))}
      </select>
      {currentVoice?.previewUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={currentVoice.previewUrl} className="mt-2 w-full" />
      )}

      <div className="mt-4 space-y-3">
        <Slider label="Stability" value={stability} onChange={setStability} min={0} max={1} step={0.05} />
        <Slider label="Similarity" value={similarity} onChange={setSimilarity} min={0} max={1} step={0.05} />
        <Slider label="Speed" value={speed} onChange={setSpeed} min={0.5} max={2} step={0.05} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 w-full rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save voice settings'}
      </button>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}: {value.toFixed(2)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
