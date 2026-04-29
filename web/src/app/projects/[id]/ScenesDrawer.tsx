'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Project, type Scene } from '@/lib/api';

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

type SceneEdits = {
  voiceoverText: string;
  imagePrompt: string;
  durationSeconds: number;
};

/**
 * Global scenes drawer rendered on every per-project page. Lets the user
 * tweak any scene's narration, image prompt, image, or product reference
 * without leaving the current step.
 *
 * The drawer fetches the project on open (and re-fetches via SSE while it
 * is open). Edits to text fields are buffered locally and saved per-scene
 * via `PATCH /scenes/:sceneId`. Image actions hit existing endpoints.
 */
export function ScenesDrawer({ projectId, open, onClose }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, SceneEdits>>({});
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { project: fresh } = await api.getProject(projectId);
      setProject(fresh);
      setEdits((prev) => {
        const next = { ...prev };
        for (const s of fresh.scenes) {
          // Only overwrite buffered edits if the user hasn't touched this
          // scene yet -- otherwise we'd erase their in-progress text on
          // every SSE refresh.
          if (!next[s.id]) {
            next[s.id] = {
              voiceoverText: s.voiceoverText,
              imagePrompt: s.imagePrompt,
              durationSeconds: Number(s.durationSeconds) || 5,
            };
          }
        }
        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load project');
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [open, refresh]);

  // Live updates via SSE while the drawer is open so freshly-rendered
  // images appear without the user having to close + reopen.
  useEffect(() => {
    if (!open) return;
    const url = api.statusStreamUrl(projectId);
    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch {
      return;
    }
    sseRef.current = es;
    let t: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.phase) return;
        if (
          payload.phase === 'images' ||
          payload.phase === 'image' ||
          payload.phase === 'voice' ||
          payload.phase === 'video'
        ) {
          if (t) clearTimeout(t);
          t = setTimeout(refresh, 500);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      if (t) clearTimeout(t);
    };
  }, [open, projectId, refresh]);

  function setEdit(sceneId: string, patch: Partial<SceneEdits>) {
    setEdits((prev) => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], ...patch },
    }));
  }

  function setSceneBusy(sceneId: string, label: string | null) {
    setBusy((prev) => ({ ...prev, [sceneId]: label }));
  }

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500);
  }

  async function saveScene(scene: Scene) {
    const e = edits[scene.id];
    if (!e) return;
    const dirty =
      e.voiceoverText !== scene.voiceoverText ||
      e.imagePrompt !== scene.imagePrompt ||
      Number(e.durationSeconds) !== Number(scene.durationSeconds);
    if (!dirty) {
      flashToast('Nothing to save');
      return;
    }
    setSceneBusy(scene.id, 'save');
    try {
      await api.patchScene(projectId, scene.id, {
        voiceoverText: e.voiceoverText,
        imagePrompt: e.imagePrompt,
        durationSeconds: e.durationSeconds,
      });
      await refresh();
      flashToast(`Scene ${scene.sceneIndex + 1} saved`);
    } catch (err: any) {
      flashToast(err?.message || 'Save failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  async function regenerateScene(scene: Scene) {
    const e = edits[scene.id];
    setSceneBusy(scene.id, 'regen');
    try {
      // If the prompt was edited, send the new prompt along so the queue
      // job uses it instead of whatever is in the DB at queue-pop time.
      const promptArg =
        e && e.imagePrompt !== scene.imagePrompt ? e.imagePrompt : undefined;
      // Save edits first so the DB reflects the user's latest text.
      if (e) {
        await api.patchScene(projectId, scene.id, {
          voiceoverText: e.voiceoverText,
          imagePrompt: e.imagePrompt,
          durationSeconds: e.durationSeconds,
        });
      }
      await api.regenerateSceneImage(projectId, scene.id, {
        prompt: promptArg,
        variantCount: 3,
      });
      flashToast(`Scene ${scene.sceneIndex + 1} regenerating…`);
      await refresh();
    } catch (err: any) {
      flashToast(err?.message || 'Regenerate failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  async function uploadImage(scene: Scene, file: File) {
    setSceneBusy(scene.id, 'upload');
    try {
      await api.uploadSceneImage(projectId, scene.id, file);
      await refresh();
      flashToast(`Scene ${scene.sceneIndex + 1} image replaced`);
    } catch (err: any) {
      flashToast(err?.message || 'Upload failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  async function uploadProductRef(scene: Scene, file: File) {
    setSceneBusy(scene.id, 'productRef');
    try {
      await api.uploadProductReference(projectId, scene.id, file);
      await refresh();
      flashToast(`Product reference set on scene ${scene.sceneIndex + 1}`);
    } catch (err: any) {
      flashToast(err?.message || 'Product reference upload failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  async function clearProductRef(scene: Scene) {
    setSceneBusy(scene.id, 'productRefClear');
    try {
      await api.deleteProductReference(projectId, scene.id);
      await refresh();
      flashToast(`Product reference cleared on scene ${scene.sceneIndex + 1}`);
    } catch (err: any) {
      flashToast(err?.message || 'Clear failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  async function applyProductRefAll(scene: Scene) {
    if (!confirm(`Apply this scene's product reference to ALL other scenes?`)) {
      return;
    }
    setSceneBusy(scene.id, 'productRefApply');
    try {
      const { updated } = await api.applyProductReferenceToAll(projectId, scene.id);
      await refresh();
      flashToast(`Applied to ${updated} other scene${updated === 1 ? '' : 's'}`);
    } catch (err: any) {
      flashToast(err?.message || 'Apply failed');
    } finally {
      setSceneBusy(scene.id, null);
    }
  }

  const scenes = useMemo(
    () =>
      project
        ? project.scenes.slice().sort((a, b) => a.sceneIndex - b.sceneIndex)
        : [],
    [project]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />
      <aside
        role="dialog"
        aria-label="Scenes"
        className={[
          'fixed right-0 top-0 z-50 h-full w-full max-w-[640px] transform border-l border-white/10 bg-ink-900/95 backdrop-blur-xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-white">Scenes</h2>
              <p className="text-[11px] text-ink-100/60">
                Tweak any scene without leaving this step. Changes are saved
                per scene.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-100/80 transition hover:border-white/25 hover:text-white"
              aria-label="Close scenes panel"
            >
              Close
            </button>
          </header>

          {toast && (
            <div className="mx-6 mt-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white">
              {toast}
            </div>
          )}
          {error && (
            <div className="mx-6 mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loading && !project && (
              <div className="text-xs text-ink-100/60">Loading…</div>
            )}
            {project && scenes.length === 0 && (
              <div className="text-xs text-ink-100/60">
                No scenes yet. Approve the script first.
              </div>
            )}
            {project &&
              scenes.map((scene) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  edits={edits[scene.id]}
                  busyLabel={busy[scene.id] || null}
                  locked={
                    project.status === 'generating' ||
                    project.status === 'assembling'
                  }
                  onEdit={(patch) => setEdit(scene.id, patch)}
                  onSave={() => saveScene(scene)}
                  onRegenerate={() => regenerateScene(scene)}
                  onUploadImage={(f) => uploadImage(scene, f)}
                  onUploadProductRef={(f) => uploadProductRef(scene, f)}
                  onClearProductRef={() => clearProductRef(scene)}
                  onApplyProductRefAll={() => applyProductRefAll(scene)}
                />
              ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function SceneRow({
  scene,
  edits,
  busyLabel,
  locked,
  onEdit,
  onSave,
  onRegenerate,
  onUploadImage,
  onUploadProductRef,
  onClearProductRef,
  onApplyProductRefAll,
}: {
  scene: Scene;
  edits: SceneEdits | undefined;
  busyLabel: string | null;
  locked: boolean;
  onEdit: (patch: Partial<SceneEdits>) => void;
  onSave: () => void;
  onRegenerate: () => void;
  onUploadImage: (f: File) => void;
  onUploadProductRef: (f: File) => void;
  onClearProductRef: () => void;
  onApplyProductRefAll: () => void;
}) {
  const selectedImage = scene.imageVariants.find(
    (v) => v.id === scene.selectedImageId
  );
  const previewUrl =
    selectedImage?.signedUrl || scene.imageVariants[0]?.signedUrl || null;
  const dirty =
    edits != null &&
    (edits.voiceoverText !== scene.voiceoverText ||
      edits.imagePrompt !== scene.imagePrompt ||
      Number(edits.durationSeconds) !== Number(scene.durationSeconds));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[11px] uppercase tracking-wider text-brand-100/80">
            Scene {scene.sceneIndex + 1}
          </div>
          <StatusPill status={scene.status} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            disabled={locked || !dirty || !!busyLabel}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-ink-100/80 transition hover:border-white/25 hover:text-white disabled:opacity-30 disabled:hover:border-white/10"
          >
            {busyLabel === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={locked || !!busyLabel}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-ink-100/80 transition hover:border-white/25 hover:text-white disabled:opacity-30"
          >
            {busyLabel === 'regen' ? 'Queuing…' : 'Regenerate image'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div className="space-y-2">
          <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Scene ${scene.sceneIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-ink-100/50">
                {scene.status === 'failed' ? 'Failed' : 'Generating…'}
              </div>
            )}
          </div>
          <FilePickerButton
            label={busyLabel === 'upload' ? 'Uploading…' : 'Upload image'}
            disabled={locked || !!busyLabel}
            onPick={onUploadImage}
            accept="image/png,image/jpeg,image/webp"
          />
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-100/60">
              Narration
            </span>
            <textarea
              value={edits?.voiceoverText ?? scene.voiceoverText}
              onChange={(e) => onEdit({ voiceoverText: e.target.value })}
              rows={3}
              disabled={locked}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-ink-100/40 focus:border-white/30 focus:outline-none disabled:opacity-50"
              placeholder="What the narrator says"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-100/60">
              Visual prompt
            </span>
            <textarea
              value={edits?.imagePrompt ?? scene.imagePrompt}
              onChange={(e) => onEdit({ imagePrompt: e.target.value })}
              rows={3}
              disabled={locked}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-100/40 focus:border-white/30 focus:outline-none disabled:opacity-50"
              placeholder="What to show on screen"
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-100/60">
                Duration (s)
              </span>
              <input
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={edits?.durationSeconds ?? scene.durationSeconds}
                onChange={(e) =>
                  onEdit({
                    durationSeconds: parseFloat(e.target.value || '0'),
                  })
                }
                disabled={locked}
                className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none disabled:opacity-50"
              />
            </label>
            {dirty && (
              <span className="mt-5 text-[10px] text-amber-300">
                unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Product reference */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-white">
              Product reference
            </div>
            <div className="text-[10px] text-ink-100/60">
              Used as image input so the product stays consistent across regenerations.
            </div>
          </div>
          {scene.productReferenceSignedUrl && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onApplyProductRefAll}
                disabled={locked || !!busyLabel}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-ink-100/80 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                title="Copy this product reference to every other scene"
              >
                {busyLabel === 'productRefApply' ? 'Applying…' : 'Apply to all'}
              </button>
              <button
                type="button"
                onClick={onClearProductRef}
                disabled={locked || !!busyLabel}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-rose-200/80 transition hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-30"
              >
                {busyLabel === 'productRefClear' ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
            {scene.productReferenceSignedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.productReferenceSignedUrl}
                alt="Product reference"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[9px] text-ink-100/40">
                None
              </div>
            )}
          </div>
          <FilePickerButton
            label={
              busyLabel === 'productRef'
                ? 'Uploading…'
                : scene.productReferenceSignedUrl
                  ? 'Replace reference'
                  : 'Upload reference'
            }
            disabled={locked || !!busyLabel}
            onPick={onUploadProductRef}
            accept="image/png,image/jpeg,image/webp"
          />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'failed'
      ? 'bg-rose-500/15 text-rose-200 border-rose-400/30'
      : status === 'image-ready' || status === 'video-ready'
        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
        : 'bg-white/5 text-ink-100/70 border-white/15';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${tone}`}
    >
      {status}
    </span>
  );
}

function FilePickerButton({
  label,
  onPick,
  disabled,
  accept,
}: {
  label: string;
  onPick: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (ref.current) ref.current.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-ink-100/80 transition hover:border-white/25 hover:text-white disabled:opacity-30"
      >
        {label}
      </button>
    </>
  );
}
