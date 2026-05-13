/**
 * Defaults and merge helpers for Fal image / video model settings (JSON on `projects`).
 * Docs: Nano Banana 2; video defaults to Seedance 1.0 Pro (2.0 optional in UI).
 */

const DEFAULT_IMAGE_MODEL_SETTINGS = {
  /** higgsfield | fal — project UI overrides IMAGE_PROVIDER when present */
  imageProvider: 'higgsfield',
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
  /** Higgsfield Soul — passed through to image jobs when provider is higgsfield */
  higgsfieldSoul: {
    resolution: '720p',
    /** 0–1, forwarded as custom_reference_strength when a Soul ID is used */
    customReferenceStrength: 0.85,
  },
};

const DEFAULT_VIDEO_MODEL_SETTINGS = {
  /** Fal queue model id — default Seedance 1.0 Pro; user may switch to 2.0 in video settings */
  videoModelId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
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
    higgsfieldSoul: {
      ...base.higgsfieldSoul,
      ...(s.higgsfieldSoul && typeof s.higgsfieldSoul === 'object' ? s.higgsfieldSoul : {}),
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
