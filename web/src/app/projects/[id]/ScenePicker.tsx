'use client';

import { useRef, useState } from 'react';
import { api, type Scene } from '@/lib/api';

export function ScenePicker({
  projectId,
  scene,
  onChange,
}: {
  projectId: string;
  scene: Scene;
  onChange: () => Promise<void> | void;
}) {
  const [showPromptTweak, setShowPromptTweak] = useState(false);
  const [prompt, setPrompt] = useState(scene.imagePrompt);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function select(variantId: string) {
    await api.selectSceneImage(projectId, scene.id, variantId);
    await onChange();
  }

  async function regenerate() {
    setBusy(true);
    try {
      await api.regenerateSceneImage(projectId, scene.id, {
        prompt: prompt !== scene.imagePrompt ? prompt : undefined,
      });
      setShowPromptTweak(false);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadSceneImage(projectId, scene.id, file);
      await onChange();
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Scene {scene.sceneIndex + 1}
          </div>
          <div className="text-sm mt-1 text-slate-700 leading-relaxed">
            {scene.voiceoverText}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {scene.durationSeconds}s · {scene.status}
          </div>
        </div>
      </div>

      {scene.imageVariants.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {scene.status === 'failed'
            ? `Failed: ${scene.errorMessage || 'unknown error'}`
            : 'Generating variants…'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {scene.imageVariants.map((variant) => {
            const selected = variant.id === scene.selectedImageId;
            return (
              <button
                key={variant.id}
                onClick={() => select(variant.id)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition ${
                  selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent hover:border-slate-300'
                }`}
              >
                {variant.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={variant.signedUrl}
                    alt={`Variant ${variant.variantIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                    (no preview)
                  </div>
                )}
                {selected && (
                  <span className="absolute top-1 right-1 rounded-full bg-brand-600 text-white text-[10px] px-1.5 py-0.5">
                    selected
                  </span>
                )}
                {variant.isCustomUpload && (
                  <span className="absolute bottom-1 left-1 rounded-full bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5">
                    custom
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setShowPromptTweak((v) => !v)}
          disabled={busy}
          className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
        >
          {showPromptTweak ? 'Cancel' : 'Regenerate with new prompt'}
        </button>
        <label className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
          Upload custom image
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadFile}
            disabled={busy}
          />
        </label>
        {busy && <span className="text-xs text-slate-500">Working…</span>}
      </div>

      {showPromptTweak && (
        <div className="mt-3 space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={regenerate}
            disabled={busy}
            className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Queued…' : 'Generate new variants'}
          </button>
        </div>
      )}
    </div>
  );
}
