'use client';

import { useRef, useState } from 'react';
import { api, type Scene, type SceneErrorCode } from '@/lib/api';

/** Human-readable explanation + suggested action for each classified
 *  failure code. Surfaced in place of raw provider error strings so the
 *  user has a clear next step rather than a wall of red text. */
const ERROR_COPY: Record<
  SceneErrorCode,
  { title: string; suggestion: string }
> = {
  content_policy: {
    title: 'Prompt rejected by the content filter',
    suggestion: 'Try rewording the prompt to remove anything that might be flagged (people, brands, violence, etc.) and retry.',
  },
  rate_limit: {
    title: 'Rate limit hit',
    suggestion: 'The image provider is throttling us. Wait ~30 seconds and retry.',
  },
  quota: {
    title: 'Out of credits / quota',
    suggestion: 'Top up the image provider account, then retry. Until then, you can upload a custom image instead.',
  },
  auth: {
    title: 'Image provider or storage not authenticated',
    suggestion: 'The Fal API key (FAL_AI_API_KEY) or R2 storage credentials (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET) are missing or invalid on the server. Check the backend .env and restart.',
  },
  timeout: {
    title: 'The image provider timed out',
    suggestion: 'Usually transient. Retry — if it keeps failing, simplify the prompt.',
  },
  network: {
    title: 'Network error reaching the image provider',
    suggestion: 'Check connectivity to fal.run and retry.',
  },
  bad_request: {
    title: 'Provider rejected the request',
    suggestion: 'The prompt may be too long, malformed, or contain unsupported characters. Edit and retry.',
  },
  unknown: {
    title: 'Image generation failed',
    suggestion: 'Edit the prompt and retry, or upload a custom image for this scene.',
  },
};

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
  const [showFailureDetails, setShowFailureDetails] = useState(false);
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

  async function retryFailed() {
    setBusy(true);
    try {
      await api.regenerateSceneImage(projectId, scene.id, {
        prompt: prompt !== scene.imagePrompt ? prompt : undefined,
      });
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

  const isFailed = scene.status === 'failed';
  const isGenerating =
    !isFailed && scene.imageVariants.length === 0;
  const isUnpicked =
    !isFailed && scene.imageVariants.length > 0 && !scene.selectedImageId;

  const failure = isFailed
    ? ERROR_COPY[scene.errorCode || 'unknown']
    : null;

  return (
    <div
      className={`glass-panel ${
        isFailed ? 'border border-rose-400/25' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0 flex-1">
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
        {isUnpicked && (
          <span className="pill bg-amber-400/15 text-amber-200 border border-amber-400/30 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            pick one
          </span>
        )}
      </div>

      {isFailed ? (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-4 space-y-3">
          <div>
            <div className="text-sm font-medium text-rose-100">
              {failure!.title}
            </div>
            <div className="text-[12px] text-rose-200/85 mt-1 leading-relaxed">
              {failure!.suggestion}
            </div>
          </div>

          <div>
            <label className="label block mb-1">Image prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="field font-mono text-[12px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={retryFailed}
              disabled={busy}
              className="btn-primary !px-3 !py-1.5 !text-xs"
            >
              {busy ? 'Retrying…' : 'Retry generation'}
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
            {scene.errorMessage && (
              <button
                type="button"
                onClick={() => setShowFailureDetails((v) => !v)}
                className="text-[11px] text-rose-200/70 hover:text-rose-100 underline-offset-2 hover:underline ml-auto self-center"
              >
                {showFailureDetails ? 'Hide details' : 'Show details'}
              </button>
            )}
          </div>

          {showFailureDetails && scene.errorMessage && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/30 px-3 py-2 text-[10px] text-rose-200/80 whitespace-pre-wrap">
              {scene.errorMessage}
            </pre>
          )}
        </div>
      ) : isGenerating ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-ink-100/70">
          <div className="flex items-center justify-center gap-3">
            <span
              className="h-3 w-3 rounded-full animate-glow"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
              }}
            />
            Generating variants…
          </div>
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

      {!isFailed && (
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
      )}

      {!isFailed && showPromptTweak && (
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
