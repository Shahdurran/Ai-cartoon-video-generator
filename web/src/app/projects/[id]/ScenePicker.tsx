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
    <div className="glass-panel">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-brand-100/80 font-medium">
            Scene {scene.sceneIndex + 1}
          </div>
          <div className="text-sm mt-1 text-ink-50 leading-relaxed">
            {scene.voiceoverText}
          </div>
          <div className="text-[11px] text-ink-200/70 mt-1.5">
            {scene.durationSeconds}s · {scene.status}
          </div>
        </div>
      </div>

      {scene.imageVariants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-ink-100/70">
          {scene.status === 'failed' ? (
            <span className="text-rose-300">
              Failed: {scene.errorMessage || 'unknown error'}
            </span>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <span className="h-3 w-3 rounded-full animate-glow"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
                }}
              />
              Generating variants…
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {scene.imageVariants.map((variant) => {
            const selected = variant.id === scene.selectedImageId;
            return (
              <button
                key={variant.id}
                onClick={() => select(variant.id)}
                className={`relative aspect-video rounded-xl overflow-hidden border-2 transition ${
                  selected
                    ? 'border-brand-400/70 ring-2 ring-brand-400/30'
                    : 'border-white/10 hover:border-white/30'
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
                  <div className="w-full h-full shimmer flex items-center justify-center text-[11px] text-ink-100/60">
                    rendering
                  </div>
                )}
                {selected && (
                  <span
                    className="absolute top-1 right-1 pill text-white text-[10px]"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
                    }}
                  >
                    selected
                  </span>
                )}
                {variant.isCustomUpload && (
                  <span className="absolute bottom-1 left-1 pill bg-ink-800/80 text-white border border-white/10">
                    custom
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowPromptTweak((v) => !v)}
          disabled={busy}
          className="btn-ghost !px-3 !py-1.5 !text-xs"
        >
          {showPromptTweak ? 'Cancel' : 'Regenerate with new prompt'}
        </button>
        <label className="btn-ghost !px-3 !py-1.5 !text-xs cursor-pointer">
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
        {busy && (
          <span className="text-[11px] text-ink-200/70 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-glow" />
            Working…
          </span>
        )}
      </div>

      {showPromptTweak && (
        <div className="mt-3 space-y-2 animate-fade-up">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="field"
          />
          <button
            onClick={regenerate}
            disabled={busy}
            className="btn-primary !px-3 !py-1.5 !text-xs"
          >
            {busy ? 'Queued…' : 'Generate new variants'}
          </button>
        </div>
      )}
    </div>
  );
}
