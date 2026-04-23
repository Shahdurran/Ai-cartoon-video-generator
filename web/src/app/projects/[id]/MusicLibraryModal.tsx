'use client';

import { useState } from 'react';
import { api, type MusicTrack } from '@/lib/api';
import { AudioPreviewButton } from '@/components/AudioPreviewButton';

export function MusicLibraryModal({
  projectId,
  tracks,
  onClose,
  onSelected,
}: {
  projectId: string;
  tracks: MusicTrack[];
  onClose: () => void;
  onSelected: () => void;
}) {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const filtered = tracks.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  async function pick(track: MusicTrack) {
    setSaving(track.id);
    try {
      await api.patchProject(projectId, { musicTrackId: track.id } as any);
      onSelected();
    } finally {
      setSaving(null);
    }
  }

  async function clear() {
    setSaving('clear');
    try {
      await api.patchProject(projectId, { musicTrackId: null } as any);
      onSelected();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6 animate-fade-in"
      style={{ background: 'rgba(14, 1, 6, 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-up"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Music library</h3>
            <p className="text-[11px] text-ink-200/70">
              {tracks.length} track{tracks.length === 1 ? '' : 's'} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-100/70 hover:text-white transition text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <input
            placeholder="Search tracks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field"
          />
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {filtered.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
            >
              <AudioPreviewButton src={t.previewUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{t.name}</div>
                <div className="text-[11px] text-ink-200/70 truncate">
                  {t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : ''}
                  {t.tags.length > 0 ? ` · ${t.tags.join(', ')}` : ''}
                </div>
              </div>
              <button
                onClick={() => pick(t)}
                disabled={saving !== null}
                className="btn-primary !px-3 !py-1.5 !text-xs"
              >
                {saving === t.id ? 'Saving…' : 'Select'}
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-ink-200/70 text-center py-8">
              No tracks match.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-between">
          <button
            onClick={clear}
            disabled={saving !== null}
            className="btn-subtle"
          >
            Clear selection
          </button>
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
