'use client';

import { useRef, useState } from 'react';
import { api, type Scene, type SceneErrorCode } from '@/lib/api';
import {
  isSceneImageGenerationFailed,
  isSceneVideoStageFailed,
} from '@/lib/sceneStatus';

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
  const replaceFileInput = useRef<HTMLInputElement>(null);
  const insertProductInput = useRef<HTMLInputElement>(null);

  async function select(variantId: string) {
    await api.selectSceneImage(projectId, scene.id, variantId);
    await onChange();
  }

  async function regenerate() {
    if (busy) return;
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
    if (busy) return;
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

  async function replaceAllWithUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (busy) return;
    setBusy(true);
    try {
      await api.uploadSceneImage(projectId, scene.id, file);
      await onChange();
    } finally {
      setBusy(false);
      if (replaceFileInput.current) replaceFileInput.current.value = '';
    }
  }

  async function insertProductOnSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (busy) return;
    if (!scene.selectedImageId) return;
    setBusy(true);
    try {
      await api.insertProductOnSelectedFrame(projectId, scene.id, file, {
        sceneImageId: scene.selectedImageId,
        variantCount: 3,
      });
      await onChange();
    } finally {
      setBusy(false);
      if (insertProductInput.current) insertProductInput.current.value = '';
    }
  }

  const imageGenFailed = isSceneImageGenerationFailed(scene);
  const videoStageFailed = isSceneVideoStageFailed(scene);
  const isGenerating =
    !imageGenFailed && scene.imageVariants.length === 0;
  const isUnpicked =
    !imageGenFailed && scene.imageVariants.length > 0 && !scene.selectedImageId;

  const failure = imageGenFailed
    ? ERROR_COPY[scene.errorCode || 'unknown']
    : null;

  return (
    <div
      className={`glass-panel ${
        imageGenFailed ? 'border border-rose-400/25' : ''
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
            {scene.durationSeconds}s ·{' '}
            {videoStageFailed ? 'failed after images' : scene.status}
          </div>
        </div>
        {isUnpicked && (
          <span className="pill bg-amber-400/15 text-amber-200 border border-amber-400/30 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            pick one
          </span>
        )}
      </div>

      {videoStageFailed && (
        <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] text-amber-100/95 leading-relaxed">
          {`A later pipeline step (voice or video) failed for this scene, but your `}
          <span className="font-medium text-white">image variants below are still valid</span>.
          Use <span className="font-medium text-white">Scene videos</span> or <span className="font-medium text-white">Voice</span>{' '}
          steps to retry — you do not need to regenerate images unless you want new looks.
        </div>
      )}

      {imageGenFailed ? (
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
              aria-busy={busy}
              className="btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-70 disabled:cursor-wait"
            >
              {busy ? 'Processing…' : 'Retry generation'}
            </button>
            <label className="btn-ghost !px-3 !py-1.5 !text-xs cursor-pointer">
              Upload custom image
              <input
                ref={replaceFileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={replaceAllWithUpload}
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

      {!imageGenFailed && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowPromptTweak((v) => !v)}
            disabled={busy}
            className="btn-ghost !px-3 !py-1.5 !text-xs"
          >
            {showPromptTweak ? 'Cancel' : 'Regenerate with new prompt'}
          </button>
          <label
            className={`btn-ghost !px-3 !py-1.5 !text-xs cursor-pointer ${
              !scene.selectedImageId ? 'opacity-40 cursor-not-allowed' : ''
            }`}
            title={
              scene.selectedImageId
                ? 'Uses fal Kling O1 to add your packshot into the selected frame; keeps existing variants.'
                : 'Select a thumbnail first.'
            }
          >
            Add product to selected
            <input
              ref={insertProductInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={insertProductOnSelected}
              disabled={busy || !scene.selectedImageId}
            />
          </label>
          <label className="btn-ghost !px-3 !py-1.5 !text-xs cursor-pointer">
            Replace all with upload
            <input
              ref={replaceFileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={replaceAllWithUpload}
              disabled={busy}
            />
          </label>
          {busy && (
            <span className="text-[11px] text-ink-200/70 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-400 animate-glow" />
              Processing…
            </span>
          )}
        </div>
      )}

      {!imageGenFailed && showPromptTweak && (
        <div className="mt-3 space-y-2 animate-fade-up">
          {(scene.productReferenceKey || scene.productReferenceSignedUrl) && (
            <p className="text-[11px] text-ink-100/75 leading-snug rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              This scene has a <span className="text-white/90">product reference</span>. With Higgsfield, the API registers a{' '}
              <span className="text-white/90">Soul ID</span> from that image for stronger conditioning than{' '}
              <code className="text-[10px] text-white/75">image_url</code> alone — empty hands can still happen; spell out grip, label, and camera angle, retry variants, try{' '}
              <span className="text-white/90">fal.ai only</span> in image settings, use <span className="text-white/90">Add product to selected</span> to merge a packshot into the frame you picked, or <span className="text-white/90">Replace all with upload</span> for a single final image.
            </p>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="field"
          />
          <button
            onClick={regenerate}
            disabled={busy}
            aria-busy={busy}
            className="btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-70 disabled:cursor-wait"
          >
            {busy ? 'Processing…' : 'Generate new variants'}
          </button>
        </div>
      )}
    </div>
  );
}
