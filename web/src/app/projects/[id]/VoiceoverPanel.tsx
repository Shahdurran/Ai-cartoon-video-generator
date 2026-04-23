'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Voice, type VoiceSettings } from '@/lib/api';
import { VoicePreviewCard } from '@/components/VoicePreviewCard';

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
  const [query, setQuery] = useState('');
  const [stability, setStability] = useState(currentSettings.stability ?? 0.5);
  const [similarity, setSimilarity] = useState(currentSettings.similarityBoost ?? 0.75);
  const [speed, setSpeed] = useState(currentSettings.speed ?? 1.0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVoiceId(currentVoiceId || '');
  }, [currentVoiceId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return voices;
    const q = query.toLowerCase();
    return voices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        Object.values(v.labels || {}).some((l) => l?.toLowerCase().includes(q))
    );
  }, [voices, query]);

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

  return (
    <div className="glass-panel animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-white">Voiceover</h3>
        <span className="text-[11px] text-ink-200/70">
          {voices.length} voice{voices.length === 1 ? '' : 's'}
        </span>
      </div>

      <input
        placeholder="Search voices…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field mb-3"
      />

      {voices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-ink-200/70">
          No voices available. Check ELEVENLABS_API_KEY.
        </div>
      ) : (
        <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map((v, i) => (
            <div
              key={v.voiceId}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <VoicePreviewCard
                voice={v}
                selected={voiceId === v.voiceId}
                onSelect={() => setVoiceId(v.voiceId)}
              />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-xs text-ink-200/70 text-center py-6">
              No voices match &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <Slider label="Stability" value={stability} onChange={setStability} min={0} max={1} step={0.05} />
        <Slider label="Similarity" value={similarity} onChange={setSimilarity} min={0} max={1} step={0.05} />
        <Slider label="Speed" value={speed} onChange={setSpeed} min={0.5} max={2} step={0.05} />
      </div>

      <button
        onClick={save}
        disabled={saving || !voiceId}
        className="btn-primary mt-5 w-full"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save voice settings'}
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-ink-200/80">
          {label}
        </span>
        <span className="text-xs text-white tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1.5"
      />
    </label>
  );
}
