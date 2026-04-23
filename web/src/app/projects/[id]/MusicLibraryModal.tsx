'use client';

import { useState } from 'react';
import { api, type MusicTrack } from '@/lib/api';

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
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Music library</h3>
            <p className="text-xs text-slate-500">
              {tracks.length} track{tracks.length === 1 ? '' : 's'} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-slate-200">
          <input
            placeholder="Search tracks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : ''}
                  {t.tags.length > 0 ? ` · ${t.tags.join(', ')}` : ''}
                </div>
              </div>
              {t.previewUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={t.previewUrl} className="h-8" />
              )}
              <button
                onClick={() => pick(t)}
                disabled={saving !== null}
                className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {saving === t.id ? 'Saving…' : 'Select'}
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8">
              No tracks match.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between">
          <button
            onClick={clear}
            disabled={saving !== null}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Clear selection
          </button>
          <button
            onClick={onClose}
            className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
