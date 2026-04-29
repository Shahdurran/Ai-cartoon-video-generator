'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Project, type SceneDraft } from '@/lib/api';
import { ImageModelPanel } from '../ModelSettingsPanel';

type DraftScene = SceneDraft & { /** stable react key, not sent to backend */ key: string };

function nextKey() {
  return Math.random().toString(36).slice(2, 10);
}

function toDraft(scenes: Project['scenes']): DraftScene[] {
  return scenes
    .slice()
    .sort((a, b) => a.sceneIndex - b.sceneIndex)
    .map((s) => ({
      key: s.id,
      imagePrompt: s.imagePrompt,
      voiceoverText: s.voiceoverText,
      durationSeconds: Number(s.durationSeconds) || 5,
    }));
}

export function ScriptReview({ initialProject }: { initialProject: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [scenes, setScenes] = useState<DraftScene[]>(() =>
    toDraft(initialProject.scenes)
  );
  const [busy, setBusy] = useState<null | 'save' | 'regenerate' | 'approve'>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // While the script is still being written, poll until scenes arrive.
  useEffect(() => {
    if (project.status !== 'draft') return;
    const t = setInterval(async () => {
      try {
        const { project: fresh } = await api.getProject(project.id);
        setProject(fresh);
        if (fresh.scenes.length > 0 && !dirty) {
          setScenes(toDraft(fresh.scenes));
        }
        if (fresh.status === 'failed') {
          setError(fresh.errorMessage || 'Script generation failed');
        }
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [project.id, project.status, dirty]);

  const totalDuration = useMemo(
    () => scenes.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0),
    [scenes]
  );

  function patchScene(idx: number, patch: Partial<SceneDraft>) {
    setScenes((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    setDirty(true);
  }

  function moveScene(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= scenes.length) return;
    setScenes((prev) => {
      const next = prev.slice();
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
    setDirty(true);
  }

  function deleteScene(idx: number) {
    setScenes((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function addScene() {
    setScenes((prev) => [
      ...prev,
      {
        key: nextKey(),
        imagePrompt: '',
        voiceoverText: '',
        durationSeconds: 5,
      },
    ]);
    setDirty(true);
  }

  async function saveOnly() {
    setError(null);
    setBusy('save');
    try {
      const { scenes: saved } = await api.replaceScenes(
        project.id,
        scenes.map(({ key: _key, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
      );
      setScenes(
        saved
          .slice()
          .sort((a, b) => a.sceneIndex - b.sceneIndex)
          .map((s) => ({
            key: s.id,
            imagePrompt: s.imagePrompt,
            voiceoverText: s.voiceoverText,
            durationSeconds: Number(s.durationSeconds) || 5,
          }))
      );
      setDirty(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save scenes');
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!confirm('Discard all current scenes and regenerate from scratch?')) return;
    setError(null);
    setBusy('regenerate');
    try {
      await api.regenerateScript(project.id, {
        sceneCount: scenes.length || project.sceneCount,
      });
      // Optimistic UI: drop scenes & flip status so the polling effect kicks in.
      setScenes([]);
      setDirty(false);
      setProject((p) => ({ ...p, status: 'draft', errorMessage: null }));
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate script');
    } finally {
      setBusy(null);
    }
  }

  // True once images have been generated at least once. We use this both
  // to gate the "force regenerate" UI and to confirm before re-approving.
  const hasExistingImages = useMemo(
    () => project.scenes.some((s) => (s.imageVariants?.length || 0) > 0),
    [project.scenes]
  );

  async function approveAndGenerate(opts: { force?: boolean } = {}) {
    setError(null);
    setBusy('approve');
    try {
      if (dirty) {
        await api.replaceScenes(
          project.id,
          scenes.map(({ key: _key, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
        );
      }
      const result = await api.approveScript(project.id, {
        variantCount: 3,
        force: opts.force === true,
      });
      // If the backend deduped everything (no scene actually changed) just
      // bounce the user to the images step without flashing a "regenerating"
      // banner -- their existing variants are still good.
      if (!result.enqueued) {
        router.push(`/projects/${project.id}?stay=1`);
        return;
      }
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to approve script');
      setBusy(null);
    }
  }

  function handleApproveClick() {
    // Re-approving with existing images is allowed and idempotent on the
    // backend, but warn the user the first time around so they know they
    // are about to discard any image work for scenes whose prompts changed.
    if (hasExistingImages && dirty) {
      const ok = confirm(
        'You changed scenes that already have images. Approving will regenerate images for those scenes (others will be kept). Continue?'
      );
      if (!ok) return;
    }
    approveAndGenerate();
  }

  async function regenerateAllImages() {
    const ok = confirm(
      'Regenerate ALL scene images from scratch? Existing variants will be deleted.'
    );
    if (!ok) return;
    approveAndGenerate({ force: true });
  }

  // Loading state while Claude is still writing.
  if (project.status === 'draft' && scenes.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center animate-fade-up">
        <div
          className="mx-auto mb-4 h-10 w-10 rounded-full animate-glow"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
          }}
        />
        <div className="text-sm text-ink-100/80">
          Claude is writing your scene breakdown…
        </div>
        {project.errorMessage && (
          <div className="mt-4 text-xs text-rose-300">
            {project.errorMessage}
          </div>
        )}
      </div>
    );
  }

  const canApprove =
    scenes.length > 0 &&
    scenes.every(
      (s) => s.imagePrompt.trim() && s.voiceoverText.trim() && s.durationSeconds > 0
    );

  // Editing the script is allowed during image gen too -- approving again
  // is now idempotent on the backend and only re-runs scenes whose prompts
  // actually changed. Once we move on to video generation we hard-lock the
  // editor because mutating scenes mid-Seedance would orphan video clips.
  const editableStates = new Set([
    'draft',
    'scripted',
    'script-review',
    'images-pending',
    'images-review',
    'images-ready',
  ]);
  const locked = !editableStates.has(project.status);
  const inImagesPhase =
    project.status === 'images-pending' ||
    project.status === 'images-review' ||
    project.status === 'images-ready';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
      {locked && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 animate-fade-in">
          Script is locked because the project has reached video generation.
          Viewing in read-only mode.
        </div>
      )}
      {!locked && inImagesPhase && (
        <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-100 animate-fade-in">
          Images have already been generated. Editing a scene&rsquo;s narration or
          prompt and re-approving will <span className="text-white font-medium">only regenerate images for the scenes you changed</span>.
          Use <span className="text-white font-medium">Regenerate all images</span> to redo every scene from scratch.
        </div>
      )}
      <div className="glass-panel flex items-center justify-between gap-4 animate-fade-up flex-wrap">
        <div className="text-xs text-ink-200/70">
          <span className="text-white font-medium">{scenes.length}</span> scenes
          {' · '}
          <span className="text-white font-medium">≈ {totalDuration.toFixed(0)}s</span>
          {' total'}
          {dirty && (
            <span className="ml-3 text-amber-300">unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={busy !== null || locked}
            className="btn-ghost !px-3 !py-1.5 !text-xs"
          >
            {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate with AI'}
          </button>
          <button
            type="button"
            onClick={saveOnly}
            disabled={busy !== null || !dirty || locked}
            className="btn-ghost !px-3 !py-1.5 !text-xs"
          >
            {busy === 'save' ? 'Saving…' : 'Save edits'}
          </button>
          {inImagesPhase && !locked && (
            <button
              type="button"
              onClick={regenerateAllImages}
              disabled={busy !== null || !canApprove}
              className="btn-ghost !px-3 !py-1.5 !text-xs"
              title="Force regenerate every scene's images"
            >
              {busy === 'approve' ? 'Working…' : 'Regenerate all images'}
            </button>
          )}
          <button
            type="button"
            onClick={handleApproveClick}
            disabled={busy !== null || !canApprove || locked}
            className="btn-primary !px-4 !py-2 !text-xs"
            title={
              locked
                ? 'Script can no longer be approved -- project is past this stage'
                : canApprove
                  ? inImagesPhase
                    ? 'Save changes and regenerate images for changed scenes'
                    : 'Approve scenes and start generating images'
                  : 'Every scene needs a prompt and narration first'
            }
          >
            {busy === 'approve'
              ? 'Approving…'
              : inImagesPhase
                ? 'Save & update images →'
                : 'Approve & generate images →'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <ol className="space-y-4">
        {scenes.map((s, i) => (
          <li
            key={s.key}
            className="glass-panel animate-fade-up"
            style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-wider text-brand-100/80 font-medium">
                Scene {i + 1}
              </div>
              <div className="flex items-center gap-1">
                <IconBtn label="Move up" onClick={() => moveScene(i, -1)} disabled={i === 0 || locked}>
                  ↑
                </IconBtn>
                <IconBtn
                  label="Move down"
                  onClick={() => moveScene(i, 1)}
                  disabled={i === scenes.length - 1 || locked}
                >
                  ↓
                </IconBtn>
                <IconBtn label="Delete scene" onClick={() => deleteScene(i)} danger disabled={locked}>
                  ✕
                </IconBtn>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label mb-1 block">Narration (voiceover)</span>
                <textarea
                  value={s.voiceoverText}
                  onChange={(e) => patchScene(i, { voiceoverText: e.target.value })}
                  rows={4}
                  className="field"
                  placeholder="What the narrator says during this scene"
                  readOnly={locked}
                  disabled={locked}
                />
              </label>
              <label className="block">
                <span className="label mb-1 block">Visual prompt (for image gen)</span>
                <textarea
                  value={s.imagePrompt}
                  onChange={(e) => patchScene(i, { imagePrompt: e.target.value })}
                  rows={4}
                  className="field font-mono text-[12px]"
                  placeholder="What to show on screen"
                  readOnly={locked}
                  disabled={locked}
                />
              </label>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <label className="block">
                <span className="label mb-1 block">Duration (s)</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={s.durationSeconds}
                  onChange={(e) =>
                    patchScene(i, {
                      durationSeconds: parseFloat(e.target.value || '0'),
                    })
                  }
                  className="field max-w-[6rem]"
                  readOnly={locked}
                  disabled={locked}
                />
              </label>
              {s.durationSeconds > 0 && (s.durationSeconds < 4 || s.durationSeconds > 8) && (
                <div className="text-[11px] text-amber-300/90 mt-5">
                  Outside Seedance&rsquo;s sweet spot (4–8s); will be padded or trimmed.
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div>
        <button
          type="button"
          onClick={addScene}
          disabled={locked}
          className="btn-ghost !px-3 !py-2 !text-xs w-full"
        >
          + Add scene
        </button>
      </div>
      </div>

      <aside className="lg:col-span-1 space-y-6">
        <ImageModelPanel
          projectId={project.id}
          imageModelSettings={project.imageModelSettings}
          onSaved={async (next) => {
            setProject((p) => ({ ...p, imageModelSettings: next }));
          }}
          disabled={busy === 'approve'}
        />
        <div className="glass-panel text-[12px] text-ink-100/80 leading-relaxed animate-fade-up">
          <h3 className="font-medium text-white mb-2">What happens next?</h3>
          <ol className="list-decimal pl-4 space-y-1.5 text-ink-200/85">
            <li>You approve the script.</li>
            <li>
              We queue <span className="text-white">3 image variants</span> per scene
              using your image settings above.
            </li>
            <li>
              You pick the best image per scene (and tune voice, subtitles, music
              while images render).
            </li>
            <li>You hit <span className="text-white">Generate video</span>.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`h-7 w-7 inline-flex items-center justify-center rounded-lg border text-xs transition ${
        danger
          ? 'border-rose-400/20 text-rose-200/80 hover:bg-rose-500/10 hover:border-rose-400/40'
          : 'border-white/10 text-ink-100/80 hover:bg-white/[0.06] hover:border-white/25'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
