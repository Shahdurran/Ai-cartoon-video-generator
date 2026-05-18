import type { Scene } from './api';

/**
 * `scenes.status` is shared across the pipeline (image → voice → video).
 * Video/voice failures set `failed` even when image variants exist, so the
 * Images step must not treat every `failed` as an image-generation failure.
 */
export function isSceneImageGenerationFailed(scene: Scene): boolean {
  const n = scene.imageVariants?.length ?? 0;
  return scene.status === 'failed' && n === 0;
}

/** Failed in voice or video stage while image variants already exist. */
export function isSceneVideoStageFailed(scene: Scene): boolean {
  const n = scene.imageVariants?.length ?? 0;
  return scene.status === 'failed' && n > 0;
}

/** Pills on the /status pipeline table + pubsub-style payloads. */
export type ScenePipelinePhase =
  | 'idle'
  | 'running'
  | 'complete'
  | 'failed'
  | 'queued'
  | 'polling'
  | 'submitting'
  | 'requeued';

/**
 * Derive per-phase UI state from DB fields (no live pubsub history).
 * `projectStatus` is used only to show "running" for video when work is still expected.
 */
export function inferScenePipelinePhases(
  scene: Scene,
  projectStatus: string
): {
  image: ScenePipelinePhase;
  voice: ScenePipelinePhase;
  video: ScenePipelinePhase;
  pipelineError: string | null;
} {
  const failed = scene.status === 'failed';
  const hasImages = (scene.imageVariants?.length ?? 0) > 0;
  const hasVoice = !!scene.voiceKey;
  const hasVideo = !!scene.videoKey;
  const err =
    typeof scene.errorMessage === 'string' && scene.errorMessage.trim()
      ? scene.errorMessage.trim()
      : null;

  const image: ScenePipelinePhase = hasImages
    ? 'complete'
    : failed
      ? 'failed'
      : 'idle';

  const voice: ScenePipelinePhase = hasVoice
    ? 'complete'
    : failed && hasImages && !hasVoice
      ? 'failed'
      : 'idle';

  const inVideoPipeline =
    !failed &&
    !hasVideo &&
    hasVoice &&
    (projectStatus === 'generating' ||
      projectStatus === 'videos-review' ||
      projectStatus === 'assembling');

  const video: ScenePipelinePhase = hasVideo
    ? 'complete'
    : failed && hasVoice && !hasVideo
      ? 'failed'
      : inVideoPipeline
        ? 'running'
        : 'idle';

  let pipelineError: string | null = null;
  if (image === 'failed' || voice === 'failed' || video === 'failed') {
    pipelineError = err;
  }

  return { image, voice, video, pipelineError };
}

const VIDEO_IN_FLIGHT_PHASES = new Set([
  'submitting',
  'queued',
  'polling',
  'requeued',
  'running',
]);

/**
 * Single-shot scene video card state for /videos. Avoids showing "Rendering…"
 * when the still changed but no Seedance job is actually in flight.
 */
export function deriveSingleShotVideoPhase(
  scene: Scene,
  projectStatus: string,
  livePhase?: string
): ScenePipelinePhase {
  if (scene.videoKey) return 'complete';
  if (isSceneVideoStageFailed(scene)) return 'failed';

  if (livePhase && VIDEO_IN_FLIGHT_PHASES.has(livePhase)) {
    if (projectStatus === 'generating' || scene.falRequestId) {
      return livePhase as ScenePipelinePhase;
    }
  }

  if (scene.falRequestId) {
    return (livePhase as ScenePipelinePhase) || 'polling';
  }

  if (
    projectStatus === 'generating' &&
    scene.voiceKey &&
    !scene.videoKey
  ) {
    return 'running';
  }

  return 'idle';
}
