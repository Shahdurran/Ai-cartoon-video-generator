'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type Project,
  type Scene,
  type SceneShot,
  type SuggestedShot,
  type SceneImage,
} from '@/lib/api';
import { subscribeProjectStatus } from '@/lib/projectStatusStream';

type Props = { initialProject: Project };

const ROLE_OPTIONS: Array<{ value: SuggestedShot['role']; label: string }> = [
  { value: 'wide', label: 'Wide' },
  { value: 'closeup', label: 'Close-up' },
  { value: 'detail', label: 'Detail' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'custom', label: 'Custom' },
];

type DraftShot = {
  id?: string;
  role: SuggestedShot['role'];
  imagePrompt: string;
  durationSeconds?: number;
};

function defaultSeedFromScene(scene: Scene, targetSecs: number): DraftShot[] {
  if (scene.suggestedShots && scene.suggestedShots.length >= 2) {
    return scene.suggestedShots.map((s) => ({
      role: s.role,
      imagePrompt: s.imagePrompt,
      durationSeconds: targetSecs,
    }));
  }
  return [
    {
      role: 'wide',
      imagePrompt: `${scene.imagePrompt}. Wide establishing shot.`,
      durationSeconds: targetSecs,
    },
    {
      role: 'closeup',
      imagePrompt: `${scene.imagePrompt}. Tight close-up on the main subject.`,
      durationSeconds: targetSecs,
    },
  ];
}

export function ShotsReview({ initialProject }: Props) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [drafts, setDrafts] = useState<Record<string, DraftShot[]>>(() => {
    const out: Record<string, DraftShot[]> = {};
    for (const s of initialProject.scenes ?? []) {
      const shots = s.shots ?? [];
      if (s.multiShotEnabled && shots.length > 0) {
        out[s.id] = shots.map((sh) => ({
          id: sh.id,
          role: sh.role,
          imagePrompt: sh.imagePrompt,
          durationSeconds: sh.durationSeconds,
        }));
      }
    }
    return out;
  });
  const [savingScene, setSavingScene] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targetSecs = Number(project.multiShotTargetSeconds) || 2.5;

  const refresh = useCallback(async () => {
    try {
      const { project: fresh } = await api.getProject(project.id);
      setProject(fresh);
      // Re-sync drafts from server for any scene that changed shape (new
      // shots inserted / deleted server-side). Drafts the user is mid-edit
      // for an unchanged scene are preserved.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const s of fresh.scenes ?? []) {
          if (!s.multiShotEnabled) {
            delete next[s.id];
            continue;
          }
          const cur = next[s.id];
          const serverIds = (s.shots || []).map((sh) => sh.id).join('|');
          const draftIds = (cur || [])
            .filter((d) => !!d.id)
            .map((d) => d.id)
            .join('|');
          if (!cur || serverIds !== draftIds) {
            next[s.id] = (s.shots || []).map((sh) => ({
              id: sh.id,
              role: sh.role,
              imagePrompt: sh.imagePrompt,
              durationSeconds: sh.durationSeconds,
            }));
          }
        }
        return next;
      });
    } catch {
      /* ignore */
    }
  }, [project.id]);

  // Keep the latest status in a ref so the subscriber's closure doesn't
  // re-subscribe every render when local status changes.
  const projectStatusRef = useRef(project.status);
  projectStatusRef.current = project.status;

  useEffect(() => {
    const unsub = subscribeProjectStatus(project.id, (payload: any) => {
      if (!payload?.phase) return;
      if (
        payload.phase === 'shot-image' ||
        payload.phase === 'shot-video' ||
        payload.phase === 'shot-images' ||
        payload.phase === 'videos'
      ) {
        void refresh();
      } else if (payload.phase === 'snapshot') {
        // First poll always replays the current backend status as a
        // 'snapshot' event. If the SSR-rendered project status differs
        // from what the poll sees, we need to re-fetch so the UI moves
        // off the stale state. (Common case: user lands on /shots while
        // status is 'shot-images-pending', the worker flips it to
        // 'shot-images-review' before the first poll arrives.)
        if (payload.status && payload.status !== projectStatusRef.current) {
          void refresh();
        }
      }
    });
    return unsub;
  }, [project.id, refresh]);

  async function toggleMultiShot(scene: Scene, enable: boolean) {
    setError(null);
    setSavingScene(scene.id);
    try {
      const res = await api.setSceneMultiShot(project.id, scene.id, enable);
      const mergedShots = ((res.scene?.shots || []) as SceneShot[]).map((sh) => ({
        ...sh,
        imageVariants: sh.imageVariants ?? [],
      }));
      setProject((p) => ({
        ...p,
        scenes: (p.scenes ?? []).map((s) =>
          s.id === scene.id
            ? {
                ...s,
                multiShotEnabled: enable,
                shots: mergedShots,
              }
            : s
        ),
      }));
      setDrafts((d) => {
        const copy = { ...d };
        if (enable) {
          const seedFromServer = (res.scene?.shots || []).map((sh: SceneShot) => ({
            id: sh.id,
            role: sh.role,
            imagePrompt: sh.imagePrompt,
            durationSeconds: sh.durationSeconds,
          }));
          copy[scene.id] =
            seedFromServer.length > 0
              ? seedFromServer
              : defaultSeedFromScene(scene, targetSecs);
        } else {
          delete copy[scene.id];
        }
        return copy;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingScene(null);
    }
  }

  function updateShotDraft(sceneId: string, idx: number, patch: Partial<DraftShot>) {
    setDrafts((d) => {
      const list = (d[sceneId] || []).slice();
      list[idx] = { ...list[idx], ...patch };
      return { ...d, [sceneId]: list };
    });
  }

  function addShot(sceneId: string) {
    setDrafts((d) => {
      const list = (d[sceneId] || []).slice();
      if (list.length >= 6) return d;
      list.push({
        role: 'detail',
        imagePrompt: '',
        durationSeconds: targetSecs,
      });
      return { ...d, [sceneId]: list };
    });
  }

  function removeShot(sceneId: string, idx: number) {
    setDrafts((d) => {
      const list = (d[sceneId] || []).slice();
      if (list.length <= 2) return d;
      list.splice(idx, 1);
      return { ...d, [sceneId]: list };
    });
  }

  async function saveSceneShots(scene: Scene) {
    const list = drafts[scene.id] || [];
    if (list.length < 2) {
      setError(`Scene ${scene.sceneIndex + 1}: needs at least 2 shots`);
      return;
    }
    if (list.some((s) => !s.imagePrompt.trim())) {
      setError(`Scene ${scene.sceneIndex + 1}: every shot needs a prompt`);
      return;
    }
    setError(null);
    setSavingScene(scene.id);
    try {
      const res = await api.replaceShots(
        project.id,
        scene.id,
        list.map((s) => ({
          role: s.role,
          imagePrompt: s.imagePrompt,
          durationSeconds: s.durationSeconds || targetSecs,
        }))
      );
      const normalizedShots = (res.shots ?? []).map((sh) => ({
        ...sh,
        imageVariants: sh.imageVariants ?? [],
      })) as SceneShot[];
      setProject((p) => ({
        ...p,
        scenes: p.scenes.map((s) =>
          s.id === scene.id
            ? { ...s, multiShotEnabled: true, shots: normalizedShots }
            : s
        ),
      }));
      setDrafts((d) => ({
        ...d,
        [scene.id]: normalizedShots.map((sh) => ({
          id: sh.id,
          role: sh.role,
          imagePrompt: sh.imagePrompt,
          durationSeconds: sh.durationSeconds,
        })),
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingScene(null);
    }
  }

  async function approveShots() {
    setError(null);
    setBusy(true);
    try {
      // Persist any unsaved drafts first so the user's edits are not lost.
      for (const scene of project.scenes ?? []) {
        if (!scene.multiShotEnabled) continue;
        const list = drafts[scene.id];
        if (!list) continue;
        const serverShots = scene.shots ?? [];
        const dirty =
          list.length !== serverShots.length ||
          list.some((d, i) => {
            const s = serverShots[i];
            return !s || d.imagePrompt.trim() !== s.imagePrompt || d.role !== s.role;
          });
        if (dirty) {
          await api.replaceShots(
            project.id,
            scene.id,
            list.map((s) => ({
              role: s.role,
              imagePrompt: s.imagePrompt,
              durationSeconds: s.durationSeconds || targetSecs,
            }))
          );
        }
      }
      await api.approveShots(project.id);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approveShotImages() {
    setError(null);
    setBusy(true);
    try {
      await api.approveShotImages(project.id);
      await router.push(`/projects/${project.id}/status`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Editing is locked once shot rendering has started; from there the
  // user can only pick variants. Single-shot scenes (multiShotEnabled
  // false) are always shown so the user can opt in.
  const editingLocked = useMemo(() => {
    return [
      'shot-images-pending',
      'generating',
      'assembling',
      'complete',
    ].includes(project.status);
  }, [project.status]);

  const inShotImagesReview = project.status === 'shot-images-review';
  const multiSceneCount = (project.scenes ?? []).filter((s) => s.multiShotEnabled).length;
  const allShotsPicked =
    multiSceneCount > 0 &&
    (project.scenes ?? []).every((s) =>
      !s.multiShotEnabled
        ? true
        : (s.shots ?? []).length > 0 &&
            (s.shots ?? []).every((sh) => !!sh.selectedImageId)
    );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      <div className="glass-panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-100/60">
            Status
          </div>
          <div className="text-sm text-white">
            <span className="font-medium">{project.status}</span>
            {' · '}
            {multiSceneCount} of {(project.scenes ?? []).length} scenes are multi-shot
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editingLocked && !inShotImagesReview && (
            <button
              type="button"
              onClick={() => void approveShots()}
              disabled={busy || multiSceneCount === 0}
              aria-busy={busy}
              className="btn-primary disabled:opacity-70 disabled:cursor-wait"
              title={
                multiSceneCount === 0
                  ? 'Toggle multi-shot on at least one scene first'
                  : 'Generate images for every shot'
              }
            >
              {busy ? 'Processing…' : 'Generate shot images'}
            </button>
          )}
          {inShotImagesReview && (
            <button
              type="button"
              onClick={() => void approveShotImages()}
              disabled={busy || !allShotsPicked}
              aria-busy={busy}
              className="btn-primary disabled:opacity-70 disabled:cursor-wait"
              title={
                allShotsPicked
                  ? 'Render videos for every shot + any single-shot scenes'
                  : 'Pick a variant for every shot in every multi-shot scene'
              }
            >
              {busy ? 'Processing…' : 'Render videos'}
            </button>
          )}
        </div>
      </div>

      {(project.scenes ?? []).map((scene) => (
        <SceneShotsCard
          key={scene.id}
          scene={scene}
          draft={drafts[scene.id]}
          targetSecs={targetSecs}
          editingLocked={editingLocked}
          inShotImagesReview={inShotImagesReview}
          saving={savingScene === scene.id}
          projectId={project.id}
          onToggle={(enable) => toggleMultiShot(scene, enable)}
          onUpdateShot={(idx, patch) => updateShotDraft(scene.id, idx, patch)}
          onAddShot={() => addShot(scene.id)}
          onRemoveShot={(idx) => removeShot(scene.id, idx)}
          onSave={() => saveSceneShots(scene)}
          onShotChanged={refresh}
        />
      ))}
    </div>
  );
}

function SceneShotsCard({
  scene,
  draft,
  targetSecs,
  editingLocked,
  inShotImagesReview,
  saving,
  projectId,
  onToggle,
  onUpdateShot,
  onAddShot,
  onRemoveShot,
  onSave,
  onShotChanged,
}: {
  scene: Scene;
  draft?: DraftShot[];
  targetSecs: number;
  editingLocked: boolean;
  inShotImagesReview: boolean;
  saving: boolean;
  projectId: string;
  onToggle: (enable: boolean) => void;
  onUpdateShot: (idx: number, patch: Partial<DraftShot>) => void;
  onAddShot: () => void;
  onRemoveShot: (idx: number) => void;
  onSave: () => void;
  onShotChanged: () => void;
}) {
  const shots = scene.shots ?? [];
  const showShots = scene.multiShotEnabled && (draft?.length || shots.length) > 0;
  const showShotPickers =
    scene.multiShotEnabled &&
    shots.length > 0 &&
    shots.some((sh) => (sh.imageVariants ?? []).length > 0);

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ink-100/60">
            Scene {scene.sceneIndex + 1} · {Math.round(scene.durationSeconds)}s
          </div>
          <div className="mt-1 text-sm text-ink-100/85 line-clamp-2">
            {scene.imagePrompt}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-100/80">
          <span>Multi-shot</span>
          <input
            type="checkbox"
            checked={scene.multiShotEnabled}
            disabled={editingLocked || saving}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 accent-[#FF4689]"
          />
        </label>
      </div>

      {!scene.multiShotEnabled && (
        <p className="text-xs text-ink-100/55">
          Single Seedance clip · enable multi-shot to cross-cut between
          ~{targetSecs}s shots of this scene.
        </p>
      )}

      {showShots && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-ink-100/60">
              {(draft || []).length} shots ·{' '}
              {(draft || []).map((d) => d.role).join(' → ')}
            </div>
            {!editingLocked && !inShotImagesReview && (
              <div className="flex gap-2">
                <button
                  onClick={onAddShot}
                  disabled={(draft || []).length >= 6}
                  className="btn-ghost !px-2 !py-1 !text-[11px]"
                >
                  + Add shot
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="btn-ghost !px-2 !py-1 !text-[11px]"
                >
                  {saving ? 'Saving…' : 'Save shots'}
                </button>
              </div>
            )}
          </div>

          {(draft || []).map((d, i) => (
            <div
              key={d.id || `new-${i}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-ink-100/60">
                  Shot {i + 1}
                </span>
                <select
                  value={d.role}
                  disabled={editingLocked || inShotImagesReview}
                  onChange={(e) =>
                    onUpdateShot(i, {
                      role: e.target.value as SuggestedShot['role'],
                    })
                  }
                  className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-[10px] text-ink-100/50">
                  ~
                  {(Number(d.durationSeconds) || targetSecs).toFixed(1)}s
                </span>
                {!editingLocked && !inShotImagesReview && (draft || []).length > 2 && (
                  <button
                    onClick={() => onRemoveShot(i)}
                    className="text-[11px] text-rose-300/80 hover:text-rose-200"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                value={d.imagePrompt}
                disabled={editingLocked || inShotImagesReview}
                onChange={(e) =>
                  onUpdateShot(i, { imagePrompt: e.target.value })
                }
                rows={2}
                placeholder="Describe this shot — same character/setting, different angle…"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-ink-100/90"
              />
            </div>
          ))}
        </div>
      )}

      {showShotPickers && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="text-xs text-ink-100/60">Pick a variant per shot</div>
          <div className="grid grid-cols-1 gap-3">
            {shots.map((shot) => (
              <ShotImageStrip
                key={shot.id}
                projectId={projectId}
                sceneId={scene.id}
                shot={shot}
                onChanged={onShotChanged}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShotImageStrip({
  projectId,
  sceneId,
  shot,
  onChanged,
}: {
  projectId: string;
  sceneId: string;
  shot: SceneShot;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const variants = shot.imageVariants ?? [];
  const selected = variants.find((v) => v.id === shot.selectedImageId);

  async function pick(v: SceneImage) {
    setBusy(true);
    try {
      await api.selectShotImage(projectId, sceneId, shot.id, v.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function regen() {
    setBusy(true);
    try {
      await api.regenerateShotImage(projectId, sceneId, shot.id, {});
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-100/60">
          Shot {shot.shotIndex + 1} · {shot.role}
        </span>
        <span className="text-[10px] text-ink-100/45 truncate">
          {shot.imagePrompt}
        </span>
        <button
          onClick={regen}
          disabled={busy}
          className="ml-auto btn-ghost !px-2 !py-1 !text-[10px]"
        >
          {busy ? '…' : 'Regenerate'}
        </button>
      </div>
      {variants.length === 0 ? (
        <div className="text-xs text-ink-100/55 py-4 text-center">
          {shot.status === 'failed'
            ? `Failed: ${shot.errorMessage || 'unknown error'}`
            : 'Generating variants…'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {variants.map((v) => {
            const isSel = selected?.id === v.id;
            return (
              <button
                key={v.id}
                onClick={() => pick(v)}
                disabled={busy}
                className={[
                  'group relative aspect-video overflow-hidden rounded-lg border-2 transition',
                  isSel
                    ? 'border-[#FF4689] ring-2 ring-[#FF4689]/30'
                    : 'border-white/10 hover:border-white/30',
                ].join(' ')}
              >
                {v.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.signedUrl}
                    alt={`shot ${shot.shotIndex + 1} variant ${v.variantIndex + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-white/5" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
