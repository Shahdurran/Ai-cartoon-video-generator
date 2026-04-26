/**
 * Defaults and merge helpers for Fal image / video model settings (JSON on `projects`).
 * Docs: Nano Banana 2, Seedance 2.0 image-to-video.
 */

const DEFAULT_IMAGE_MODEL_SETTINGS = {
  /** Primary cascade preference: nano-banana-2 | flux-dev */
  preferredCascade: 'nano-banana-2',
  /** Fal endpoint id for Nano Banana 2 text-to-image */
  imageModelId: 'fal-ai/nano-banana-2',
  nanoBanana2: {
    aspect_ratio: 'auto',
    resolution: '1K',
    output_format: 'png',
    safety_tolerance: '4',
    sync_mode: false,
    limit_generations: true,
    enable_web_search: false,
    thinking_level: null,
  },
};

const DEFAULT_VIDEO_MODEL_SETTINGS = {
  /** Fal queue model id */
  videoModelId: 'bytedance/seedance-2.0/image-to-video',
  seedance20: {
    resolution: '720p',
    duration: 'auto',
    aspect_ratio: 'auto',
    generate_audio: true,
    seed: null,
    end_image_url: '',
    end_user_id: '',
  },
};

function mergeImageModelSettings(stored = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_IMAGE_MODEL_SETTINGS));
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    ...base,
    ...s,
    nanoBanana2: {
      ...base.nanoBanana2,
      ...(s.nanoBanana2 && typeof s.nanoBanana2 === 'object' ? s.nanoBanana2 : {}),
    },
  };
}

function mergeVideoModelSettings(stored = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_VIDEO_MODEL_SETTINGS));
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    ...base,
    ...s,
    seedance20: {
      ...base.seedance20,
      ...(s.seedance20 && typeof s.seedance20 === 'object' ? s.seedance20 : {}),
    },
  };
}

module.exports = {
  DEFAULT_IMAGE_MODEL_SETTINGS,
  DEFAULT_VIDEO_MODEL_SETTINGS,
  mergeImageModelSettings,
  mergeVideoModelSettings,
};
