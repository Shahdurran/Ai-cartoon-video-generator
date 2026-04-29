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

  // Optimistic favorites: start from server-provided flags, allow instant
  // toggle without waiting for the round-trip. The set is the source of
  // truth while the panel is mounted; the next listVoices() will reconcile.
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const s = new Set<string>();
    voices.forEach((v) => {
      if (v.isFavorite) s.add(v.voiceId);
    });
    return s;
  });

  useEffect(() => {
    setVoiceId(currentVoiceId || '');
  }, [currentVoiceId]);

  // If the parent re-renders with fresh `voices` (after a save / SSE
  // refresh), sync the favorites Set so star state reflects the server.
  useEffect(() => {
    setFavorites((prev) => {
      const next = new Set<string>();
      voices.forEach((v) => {
        if (v.isFavorite || prev.has(v.voiceId)) next.add(v.voiceId);
      });
      return next;
    });
  }, [voices]);

  async function toggleFavorite(voiceIdToToggle: string) {
    const wasFav = favorites.has(voiceIdToToggle);
    // Optimistic UI: flip immediately, revert on error.
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(voiceIdToToggle);
      else next.add(voiceIdToToggle);
      return next;
    });
    try {
      if (wasFav) await api.unfavoriteVoice(voiceIdToToggle);
      else await api.favoriteVoice(voiceIdToToggle);
    } catch {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(voiceIdToToggle);
        else next.delete(voiceIdToToggle);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? voices.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.category?.toLowerCase().includes(q) ||
            Object.values(v.labels || {}).some((l) => l?.toLowerCase().includes(q))
        )
      : voices.slice();

    // Pin favorites to the top, preserving the original order within each
    // group so the user's mental map of the list stays stable.
    matches.sort((a, b) => {
      const aFav = favorites.has(a.voiceId) ? 1 : 0;
      const bFav = favorites.has(b.voiceId) ? 1 : 0;
      return bFav - aFav;
    });
    return matches;
  }, [voices, query, favorites]);

  const favoriteCount = favorites.size;

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
          {favoriteCount > 0 && (
            <span className="ml-2 text-amber-200/80">★ {favoriteCount}</span>
          )}
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
        <div className="grid gap-2 max-h-[420px] overflow-y-auto overflow-x-hidden pr-2">
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
                isFavorite={favorites.has(v.voiceId)}
                onToggleFavorite={() => toggleFavorite(v.voiceId)}
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
