'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  isLockedShot,
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

const MAX_SHOTS_PER_SCENE = 6;
const MIN_SHOT_SECS = 1;
const MAX_SHOT_SECS = 10;

type DraftShot = {
  id?: string;
  role: SuggestedShot['role'];
  imagePrompt: string;
  durationSeconds: number;
  /** True for the "keep approved scene image" shot. Image is the parent
   *  scene's approved variant; no new generation runs for this shot. */
  useApprovedSceneImage?: boolean;
};

function clampDuration(v: number, fallback: number): number {
  if (!Number.isFinite(v) || v <= 0) return fallback;
  if (v < MIN_SHOT_SECS) return MIN_SHOT_SECS;
  if (v > MAX_SHOT_SECS) return MAX_SHOT_SECS;
  return Math.round(v * 10) / 10;
}

function shotFromServer(sh: SceneShot, fallbackSecs: number): DraftShot {
  const locked = isLockedShot(sh);
  return {
    id: sh.id,
    role: sh.role,
    imagePrompt: locked ? '' : sh.imagePrompt,
    durationSeconds: clampDuration(Number(sh.durationSeconds), fallbackSecs),
    useApprovedSceneImage: locked,
  };
}

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

function sumShotDurations(list: DraftShot[]): number {
  return list.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
}

export function ShotsReview({ initialProject }: Props) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const initialTarget =
    Number(initialProject.multiShotTargetSeconds) || 2.5;
  const [drafts, setDrafts] = useState<Record<string, DraftShot[]>>(() => {
    const out: Record<string, DraftShot[]> = {};
    for (const s of initialProject.scenes ?? []) {
      const shots = s.shots ?? [];
      if (s.multiShotEnabled && shots.length > 0) {
        out[s.id] = shots.map((sh) => shotFromServer(sh, initialTarget));
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
            next[s.id] = (s.shots || []).map((sh) =>
              shotFromServer(sh, targetSecs)
            );
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
          const seedFromServer = (res.scene?.shots || []).map((sh: SceneShot) =>
            shotFromServer(sh, targetSecs)
          );
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
      if (list.length >= MAX_SHOTS_PER_SCENE) return d;
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

  function toggleApprovedSceneImageShot(sceneId: string) {
    const sceneObj = (project.scenes ?? []).find((s) => s.id === sceneId);
    if (!sceneObj) return;
    setDrafts((d) => {
      const list = (d[sceneId] || []).slice();
      const existingIdx = list.findIndex((s) => s.useApprovedSceneImage);
      if (existingIdx >= 0) {
        list.splice(existingIdx, 1);
        return { ...d, [sceneId]: list };
      }
      if (list.length >= MAX_SHOTS_PER_SCENE) return d;
      list.unshift({
        role: 'wide',
        imagePrompt: '',
        durationSeconds: targetSecs,
        useApprovedSceneImage: true,
      });
      return { ...d, [sceneId]: list };
    });
  }

  function validateSceneShots(scene: Scene, list: DraftShot[]): string | null {
    if (list.length < 2) {
      return `Scene ${scene.sceneIndex + 1}: needs at least 2 shots`;
    }
    if (list.some((s) => !s.useApprovedSceneImage && !s.imagePrompt.trim())) {
      return `Scene ${scene.sceneIndex + 1}: every shot needs a prompt`;
    }
    const total = sumShotDurations(list);
    const sceneSecs = Number(scene.durationSeconds) || 0;
    if (sceneSecs > 0 && total > sceneSecs + 0.05) {
      return `Scene ${scene.sceneIndex + 1}: shot durations total ${total.toFixed(1)}s but the scene is only ${sceneSecs}s. Trim a shot or remove one.`;
    }
    return null;
  }

  async function saveSceneShots(scene: Scene) {
    const list = drafts[scene.id] || [];
    const err = validateSceneShots(scene, list);
    if (err) {
      setError(err);
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
          imagePrompt: s.useApprovedSceneImage ? '' : s.imagePrompt,
          durationSeconds: clampDuration(Number(s.durationSeconds), targetSecs),
          useApprovedSceneImage: s.useApprovedSceneImage === true,
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
        [scene.id]: normalizedShots.map((sh) => shotFromServer(sh, targetSecs)),
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingScene(null);
    }
  }

  async function approveShots() {
    setError(null);

    // Block before queueing if any scene's draft is invalid (over budget
    // or missing prompts). Surfacing this here is much friendlier than
    // letting the backend 400 mid-batch.
    for (const scene of project.scenes ?? []) {
      if (!scene.multiShotEnabled) continue;
      const list = drafts[scene.id];
      if (!list) continue;
      const errMsg = validateSceneShots(scene, list);
      if (errMsg) {
        setError(errMsg);
        return;
      }
    }

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
            if (!s) return true;
            const serverLocked = isLockedShot(s);
            if (d.role !== s.role) return true;
            if ((d.useApprovedSceneImage === true) !== serverLocked) return true;
            if (!serverLocked && d.imagePrompt.trim() !== s.imagePrompt) return true;
            if (Number(d.durationSeconds) !== Number(s.durationSeconds)) return true;
            return false;
          });
        if (dirty) {
          await api.replaceShots(
            project.id,
            scene.id,
            list.map((s) => ({
              role: s.role,
              imagePrompt: s.useApprovedSceneImage ? '' : s.imagePrompt,
              durationSeconds: clampDuration(Number(s.durationSeconds), targetSecs),
              useApprovedSceneImage: s.useApprovedSceneImage === true,
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

  const inShotImagesPending = project.status === 'shot-images-pending';
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

  // Count shots that still need variants while in shot-images-pending so
  // the banner can give a "X of Y still rendering" progress hint instead
  // of just disappearing into the void.
  const pendingShotProgress = (() => {
    if (!inShotImagesPending) return null;
    let total = 0;
    let done = 0;
    for (const s of project.scenes ?? []) {
      if (!s.multiShotEnabled) continue;
      for (const sh of s.shots ?? []) {
        if (isLockedShot(sh)) continue;
        total += 1;
        if ((sh.imageVariants ?? []).length > 0 || sh.status === 'failed') {
          done += 1;
        }
      }
    }
    return { total, done };
  })();

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in">
          {error}
        </div>
      )}

      {inShotImagesPending && (
        <div className="rounded-xl border border-[#FF4689]/30 bg-[#FF4689]/10 px-4 py-3 text-sm text-[#ffd6e0] animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF4689]" />
            <span className="font-medium">Generating shot images…</span>
            {pendingShotProgress && pendingShotProgress.total > 0 && (
              <span className="text-[#ffd6e0]/80">
                {pendingShotProgress.done} of {pendingShotProgress.total} shots ready
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#ffd6e0]/75">
            Each multi-shot scene generates new variants per shot. This page
            will auto-refresh when they&rsquo;re ready — you can leave and come back.
          </p>
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
          onToggleApprovedShot={() => toggleApprovedSceneImageShot(scene.id)}
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
  onToggleApprovedShot,
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
  onToggleApprovedShot: () => void;
  onSave: () => void;
  onShotChanged: () => void;
}) {
  const shots = scene.shots ?? [];
  const showShots = scene.multiShotEnabled && (draft?.length || shots.length) > 0;
  const showShotPickers =
    scene.multiShotEnabled &&
    shots.length > 0 &&
    shots.some((sh) => !isLockedShot(sh) && (sh.imageVariants ?? []).length > 0);

  // The variant the user approved on the Images step. We surface it on
  // multi-shot scenes so they remember which look they signed off on
  // before splitting the scene into shots.
  const sceneVariants = scene.imageVariants ?? [];
  const approvedSceneImage =
    sceneVariants.find((v) => v.id === scene.selectedImageId) ||
    sceneVariants[0] ||
    null;
  const hasApprovedShot = (draft || []).some((s) => s.useApprovedSceneImage);
  const draftList = draft || [];
  const sceneSecs = Number(scene.durationSeconds) || 0;
  const totalSecs = sumShotDurations(draftList);
  const overBudget = sceneSecs > 0 && totalSecs > sceneSecs + 0.05;
  const remainingSecs = Math.max(0, sceneSecs - totalSecs);

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {scene.multiShotEnabled && approvedSceneImage?.signedUrl && (
            <div
              className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40"
              title="Approved scene image from the Images step"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={approvedSceneImage.signedUrl}
                alt={`Approved scene ${scene.sceneIndex + 1} variant`}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[9px] uppercase tracking-wider text-white/80">
                Approved
              </span>
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-ink-100/60">
              Scene {scene.sceneIndex + 1} · {Math.round(scene.durationSeconds)}s
            </div>
            <div className="mt-1 text-sm text-ink-100/85 line-clamp-2">
              {scene.imagePrompt}
            </div>
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
          Single Seedance clip · enable multi-shot to cross-cut between several
          shorter cinematic shots of this scene.
        </p>
      )}

      {scene.multiShotEnabled && (
        <p className="text-[11px] text-ink-100/55">
          Multi-shot generates <span className="text-white/85">new images per shot</span> and ignores the scene&rsquo;s approved
          variant unless you add it as a shot below. Each shot&rsquo;s duration
          contributes to the scene&rsquo;s total length.
        </p>
      )}

      {showShots && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-ink-100/60">
              {draftList.length} shots · {draftList.map((d) => d.role).join(' → ')}
            </div>
            <div className={['text-[11px]', overBudget ? 'text-rose-300' : 'text-ink-100/60'].join(' ')}>
              {totalSecs.toFixed(1)}s / {sceneSecs}s
              {overBudget ? ' · over scene length' : remainingSecs > 0 ? ` · ${remainingSecs.toFixed(1)}s free` : ''}
            </div>
            {!editingLocked && !inShotImagesReview && (
              <div className="flex flex-wrap gap-2">
                {approvedSceneImage?.signedUrl && (
                  <button
                    onClick={onToggleApprovedShot}
                    disabled={
                      !hasApprovedShot &&
                      draftList.length >= MAX_SHOTS_PER_SCENE
                    }
                    className={[
                      'btn-ghost !px-2 !py-1 !text-[11px]',
                      hasApprovedShot
                        ? '!border-[#FF4689]/60 !text-[#ffb1c8]'
                        : '',
                    ].join(' ')}
                    title={
                      hasApprovedShot
                        ? 'Remove the approved scene image from this scene\u2019s shots'
                        : 'Add the approved scene image as one of this scene\u2019s shots'
                    }
                  >
                    {hasApprovedShot
                      ? 'Remove approved-image shot'
                      : '+ Use approved image as a shot'}
                  </button>
                )}
                <button
                  onClick={onAddShot}
                  disabled={draftList.length >= MAX_SHOTS_PER_SCENE}
                  className="btn-ghost !px-2 !py-1 !text-[11px]"
                >
                  + Add shot
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || overBudget}
                  className="btn-ghost !px-2 !py-1 !text-[11px]"
                  title={
                    overBudget
                      ? 'Trim a shot first — total exceeds scene length'
                      : undefined
                  }
                >
                  {saving ? 'Saving…' : 'Save shots'}
                </button>
              </div>
            )}
          </div>

          {draftList.map((d, i) => {
            const locked = d.useApprovedSceneImage === true;
            return (
              <div
                key={d.id || `new-${i}`}
                className={[
                  'rounded-xl border p-3 space-y-2',
                  locked
                    ? 'border-[#FF4689]/40 bg-[#FF4689]/[0.06]'
                    : 'border-white/10 bg-white/[0.03]',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-ink-100/60">
                    Shot {i + 1}
                  </span>
                  {locked && (
                    <span className="rounded bg-[#FF4689]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#ffb1c8]">
                      Approved image
                    </span>
                  )}
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
                  <label className="ml-auto flex items-center gap-1 text-[11px] text-ink-100/60">
                    <span>Duration</span>
                    <input
                      type="number"
                      min={MIN_SHOT_SECS}
                      max={MAX_SHOT_SECS}
                      step={0.1}
                      value={d.durationSeconds}
                      disabled={editingLocked || inShotImagesReview}
                      onChange={(e) =>
                        onUpdateShot(i, {
                          durationSeconds: clampDuration(
                            parseFloat(e.target.value),
                            targetSecs
                          ),
                        })
                      }
                      className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-right text-xs text-white"
                    />
                    <span className="text-[10px] text-ink-100/45">s</span>
                  </label>
                  {!editingLocked && !inShotImagesReview && draftList.length > 2 && (
                    <button
                      onClick={() => onRemoveShot(i)}
                      className="text-[11px] text-rose-300/80 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {locked ? (
                  <div className="flex items-center gap-3">
                    {approvedSceneImage?.signedUrl ? (
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={approvedSceneImage.signedUrl}
                          alt="Approved scene variant"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <p className="text-[11px] text-ink-100/65">
                      Uses the variant approved on the Images step.{' '}
                      <span className="text-white/80">No new image is generated</span> —
                      Seedance animates this exact frame for {d.durationSeconds.toFixed(1)}s.
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {scene.multiShotEnabled && shots.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="text-xs text-ink-100/60">
            {showShotPickers ? 'Pick a variant per shot' : 'Shot images'}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {shots.map((shot) => (
              <ShotImageStrip
                key={shot.id}
                projectId={projectId}
                sceneId={scene.id}
                shot={shot}
                approvedSceneImage={approvedSceneImage}
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
  approvedSceneImage,
  onChanged,
}: {
  projectId: string;
  sceneId: string;
  shot: SceneShot;
  approvedSceneImage: SceneImage | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const locked = isLockedShot(shot);
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

  // Locked shot: render the approved scene image as a single, fixed
  // option. No regen, no picker — the user already chose this on step 2.
  if (locked) {
    return (
      <div className="rounded-xl border border-[#FF4689]/40 bg-[#FF4689]/[0.05] p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-wider text-ink-100/60">
            Shot {shot.shotIndex + 1} · {shot.role}
          </span>
          <span className="rounded bg-[#FF4689]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#ffb1c8]">
            Approved image
          </span>
          <span className="ml-auto text-[10px] text-ink-100/45">
            {Number(shot.durationSeconds || 0).toFixed(1)}s
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-[#FF4689] ring-2 ring-[#FF4689]/30">
            {approvedSceneImage?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={approvedSceneImage.signedUrl}
                alt={`Approved scene variant for shot ${shot.shotIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-white/5" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pending generation: skeleton tiles so the user sees something is
  // happening between hitting "Generate shot images" and the worker
  // pushing variants. We pick the number from project.imageModelSettings
  // when we have it, but default to 3 (the controller's default).
  const expectedVariants = 3;
  const showSkeleton =
    variants.length === 0 &&
    shot.status !== 'failed';

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
          disabled={busy || showSkeleton}
          className="ml-auto btn-ghost !px-2 !py-1 !text-[10px]"
        >
          {busy ? '…' : 'Regenerate'}
        </button>
      </div>
      {showSkeleton ? (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: expectedVariants }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-video overflow-hidden rounded-lg border-2 border-white/10 bg-white/[0.03]"
              >
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/[0.02] via-white/[0.08] to-white/[0.02]" />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-100/55">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF4689]" />
            Generating variants for this shot…
          </div>
        </div>
      ) : variants.length === 0 ? (
        <div className="text-xs text-rose-300/90 py-3 text-center">
          Failed: {shot.errorMessage || 'unknown error'}
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
