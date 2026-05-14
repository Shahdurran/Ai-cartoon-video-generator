/**
 * Typed fetch wrapper for the AI Cartoon Generator backend.
 *
 * All methods return the JSON body directly and throw on non-2xx.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type Style = {
  id: string;
  name: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  fluxPromptSuffix: string;
  negativePrompt: string | null;
  ffmpegColorGrade: string | null;
};

export type Voice = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  category: string | null;
  labels: Record<string, string>;
  description: string | null;
  /** Server-side favorite flag. Pinned to the top of the voice picker. */
  isFavorite?: boolean;
};

export type MusicTrack = {
  id: string;
  name: string;
  r2Key: string;
  previewUrl: string | null;
  durationSeconds: number | null;
  tags: string[];
};

export type SceneImage = {
  id: string;
  sceneId: string;
  /** When this variant belongs to a shot (multi-shot scene), the shot id;
   *  null for legacy scene-level variants used by single-shot scenes. */
  shotId: string | null;
  variantIndex: number;
  r2Key: string;
  signedUrl: string | null;
  isCustomUpload: boolean;
  promptUsed: string | null;
};

/** Suggested shot inside a scene -- Claude proposes 2-4 of these per
 *  scene during script generation; the user can opt into multi-shot
 *  per scene to materialize them as real shot rows. */
export type SuggestedShot = {
  role: 'wide' | 'closeup' | 'detail' | 'reaction' | 'custom';
  imagePrompt: string;
};

/**
 * Sentinel stored in `scene_shots.image_prompt` for "locked" shots whose
 * image is the parent scene's approved variant (kept from the Images step)
 * rather than newly generated. Mirrors `USE_APPROVED_SCENE_IMAGE_MARKER`
 * in `src/db/repositories/shotRepo.js`.
 */
export const USE_APPROVED_SCENE_IMAGE_MARKER = '__use_approved_scene_image__';

export function isLockedShot(shot: { imagePrompt: string }): boolean {
  return shot.imagePrompt === USE_APPROVED_SCENE_IMAGE_MARKER;
}

export type SceneShot = {
  id: string;
  sceneId: string;
  shotIndex: number;
  role: SuggestedShot['role'];
  imagePrompt: string;
  selectedImageId: string | null;
  falRequestId: string | null;
  videoKey: string | null;
  videoSignedUrl: string | null;
  durationSeconds: number;
  status: string;
  errorMessage: string | null;
  errorCode: SceneErrorCode | null;
  imageVariants: SceneImage[];
  createdAt: string;
};

export type SceneErrorCode =
  | 'content_policy'
  | 'rate_limit'
  | 'quota'
  | 'auth'
  | 'timeout'
  | 'network'
  | 'bad_request'
  | 'unknown';

export type Scene = {
  id: string;
  projectId: string;
  sceneIndex: number;
  imagePrompt: string;
  voiceoverText: string;
  durationSeconds: number;
  selectedImageId: string | null;
  voiceKey: string | null;
  videoKey: string | null;
  falRequestId: string | null;
  status: string;
  errorMessage: string | null;
  errorCode: SceneErrorCode | null;
  imageVariants: SceneImage[];
  voiceSignedUrl: string | null;
  videoSignedUrl: string | null;
  /** Optional R2 key for a per-scene product reference image. */
  productReferenceKey?: string | null;
  /** Renderable URL for the product reference image. */
  productReferenceSignedUrl?: string | null;
  /**
   * Higgsfield Soul custom reference id when registered; cleared when the
   * product image key changes.
   */
  productCustomReferenceId?: string | null;
  /** When true, this scene renders multiple Seedance shots cross-cut at
   *  ~project.multiShotTargetSeconds intervals. The shots[] array carries
   *  the per-shot prompt + selected image + rendered video. */
  multiShotEnabled: boolean;
  /** Claude's suggested 2-4 sub-shot prompts produced during script gen.
   *  Used as the default seed when the user toggles multiShotEnabled on. */
  suggestedShots: SuggestedShot[] | null;
  /** Materialized shots when multiShotEnabled is true; empty otherwise. */
  shots: SceneShot[];
};

/**
 * Scene shape accepted by PUT /scenes (script-review bulk replace).
 * sceneIndex is recomputed server-side from array order.
 */
export type SceneDraft = {
  imagePrompt: string;
  voiceoverText: string;
  durationSeconds: number;
};

export type ProjectStatus =
  | 'draft'
  | 'scripted'        // legacy; new projects skip this state
  | 'script-review'
  | 'images-pending'
  | 'images-review'
  | 'images-ready'    // legacy; behaves like images-review
  | 'shots-review'    // user is editing per-scene multi-shot prompts
  | 'shot-images-pending' // shots queued for image-variant generation
  | 'shot-images-review'  // user picks variants for each shot
  | 'generating'
  | 'videos-review'   // per-scene videos rendered; user previews/approves before assembly
  | 'assembling'
  | 'complete'
  | 'failed';

export type HookVariant = {
  id: string;
  projectId: string;
  variantIndex: number;
  hookScript: string;
  hookDurationSeconds: number;
  outputKey: string | null;
  outputSignedUrl: string | null;
  status: string;
  errorMessage: string | null;
};

export type VoiceSettings = {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
};

export type ImageModelSettings = {
  /**
   * Still-image backend: Higgsfield Soul (fast, default) vs Fal-only
   * (Nano Banana 2 / Flux). Stored per project; overrides server
   * IMAGE_PROVIDER when set.
   */
  imageProvider?: 'higgsfield' | 'fal';
  /** Which provider runs first in the cascade */
  preferredCascade?: 'nano-banana-2' | 'flux-dev';
  /** Fal text-to-image endpoint (Nano Banana 2) */
  imageModelId?: string;
  nanoBanana2?: {
    aspect_ratio?: string;
    resolution?: string;
    output_format?: 'png' | 'jpeg' | 'webp';
    safety_tolerance?: string;
    sync_mode?: boolean;
    limit_generations?: boolean;
    enable_web_search?: boolean;
    thinking_level?: string;
  };
};

export type VideoModelSettings = {
  videoModelId?: string;
  seedance20?: {
    resolution?: '480p' | '720p';
    duration?: string;
    aspect_ratio?: string;
    generate_audio?: boolean;
    seed?: string | number | null;
    end_image_url?: string;
    end_user_id?: string;
  };
};

export type SubtitleAnimationPreset =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'pop'
  | 'soft-glow';

export type SubtitleSettings = {
  fontName?: string;
  fontSize?: number;
  fontColor?: string;
  position?: 'top' | 'middle' | 'bottom';
  outline?: boolean;
  /** Outline thickness for libass (0–4) when outline is true */
  outlineWidth?: number;
  shadow?: boolean;
  bold?: boolean;
  /** R2 key set by POST /projects/:id/subtitle-font — final render uses FFmpeg fontsdir */
  customFontKey?: string | null;
  /** Preview / UI: how the in-browser sample animates (FFmpeg SRT burn-in is static) */
  animationPreset?: SubtitleAnimationPreset;
  maxCharsPerLine?: number;
  maxLines?: number;
};

export type SceneProgress = {
  /** Total number of scenes for the project. */
  total: number;
  /** Scenes that have at least one image variant rendered. */
  withImages: number;
  /** Scenes where the user has picked a final image. */
  picked: number;
  /** Scenes whose latest job failed. */
  failed: number;
  /** Scenes that have a per-scene Seedance video. */
  withVideo: number;
  /** Scenes whose status indicates they are queued or in-flight. */
  queued: number;
};

export type Project = {
  id: string;
  topic: string | null;
  sourceScript: string | null;
  styleId: string | null;
  sceneCount: number;
  status: string;
  voiceId: string | null;
  voiceSettings: VoiceSettings;
  subtitleSettings: SubtitleSettings;
  imageModelSettings?: ImageModelSettings;
  videoModelSettings?: VideoModelSettings;
  musicTrackId: string | null;
  musicVolume: number;
  /** Target window length (seconds) for multi-shot scenes. Default 2.5s.
   *  Used by Claude script gen to size suggestedShots, by the shots-review
   *  UI for the per-scene shot count default, and by the assembler to
   *  allocate window lengths inside each multi-shot scene. */
  multiShotTargetSeconds: number;
  subtitlesKey: string | null;
  subtitlesSignedUrl: string | null;
  /** Signed URL for user-uploaded subtitle font (.ttf/.otf), when present */
  subtitleCustomFontSignedUrl?: string | null;
  outputKey: string | null;
  outputSignedUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
  hookVariants: HookVariant[];
  /** Optional Step-1 free-text visual direction Claude uses when authoring
   *  every scene's imagePrompt (character traits, palette, sample prompt, etc). */
  visualNotes?: string | null;
  /** Reference images attached in Step 1. Claude reads them via the vision
   *  API to keep characters/aesthetic consistent across all scenes. */
  visualReferences?: ProjectVisualReference[];
};

export type ProjectVisualReference = {
  id: string;
  projectId: string;
  r2Key: string;
  sortIndex: number;
  mimeType: string | null;
  createdAt: string;
  signedUrl: string | null;
};

/** Server response for `POST /api/visual-references/upload`: pre-project
 *  staged blobs the New Project form holds onto, then sends back to the
 *  server inside `createProject({ visualReferenceKeys })`. */
export type StagedVisualReference = {
  tempKey: string;
  signedUrl: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number;
};

/**
 * Shape returned by `GET /api/projects` — same as Project minus the
 * heavy hydrated arrays, plus a `sceneProgress` summary used by the home
 * page's per-project status badges.
 */
export type ProjectListItem = Omit<
  Project,
  'scenes' | 'hookVariants' | 'subtitlesSignedUrl' | 'outputSignedUrl' | 'subtitleCustomFontSignedUrl'
> & {
  sceneProgress: SceneProgress;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch (_) {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  // Styles
  listStyles: () => request<{ styles: Style[] }>('/api/styles'),
  // Voices
  listVoices: () => request<{ voices: Voice[] }>('/api/voices'),
  /** Star a voice so it pins to the top of the picker. Backend-global. */
  favoriteVoice: (voiceId: string) =>
    request<{ voiceId: string; isFavorite: true }>(
      `/api/voices/${encodeURIComponent(voiceId)}/favorite`,
      { method: 'POST', body: JSON.stringify({}) }
    ),
  unfavoriteVoice: (voiceId: string) =>
    request<{ voiceId: string; isFavorite: false }>(
      `/api/voices/${encodeURIComponent(voiceId)}/favorite`,
      { method: 'DELETE' }
    ),
  // Music
  listMusic: () => request<{ tracks: MusicTrack[] }>('/api/music'),
  uploadMusicTrack: async (file: File, name?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name?.trim()) fd.append('name', name.trim());
    const res = await fetch(`${API_BASE}/api/music/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(message);
    }
    return res.json() as Promise<{ track: MusicTrack }>;
  },

  // Projects
  listProjects: () =>
    request<{ projects: ProjectListItem[] }>('/api/projects'),
  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),
  createProject: (body: {
    topic?: string;
    sourceScript?: string;
    styleId: string;
    sceneCount: number;
    voiceId?: string;
    voiceSettings?: VoiceSettings;
    subtitleSettings?: SubtitleSettings;
    imageModelSettings?: ImageModelSettings;
    videoModelSettings?: VideoModelSettings;
    musicTrackId?: string;
    musicVolume?: number;
    totalDurationSeconds?: number;
    language?: string;
    tone?: string;
    /** Optional Step-1 free-text visual direction Claude uses when
     *  authoring every scene's imagePrompt. */
    visualNotes?: string;
    /** R2 keys from `uploadVisualReferences`. Server moves them into
     *  the project's prefix and persists rows. */
    visualReferenceKeys?: string[];
  }) =>
    request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** Upload one or more reference images BEFORE the project exists.
   *  Returns the temp R2 keys the New Project form should hand back to
   *  `createProject({ visualReferenceKeys })`. */
  uploadVisualReferences: async (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    const res = await fetch(`${API_BASE}/api/visual-references/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const b = await res.json();
        if (b?.error) message = b.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(message);
    }
    return res.json() as Promise<{ uploaded: StagedVisualReference[] }>;
  },

  /** Detach an already-attached visual reference from a project. Only
   *  allowed pre-pipeline (the server enforces the same gate). */
  deleteVisualReference: (projectId: string, refId: string) =>
    request<{ removed: string }>(
      `/api/projects/${projectId}/visual-references/${refId}`,
      { method: 'DELETE' }
    ),
  patchProject: (id: string, body: Partial<Project>) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** Upload a .ttf or .otf for subtitle burn-in (stored on R2; merges customFontKey into subtitleSettings). */
  uploadSubtitleFont: async (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('font', file);
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/subtitle-font`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(message);
    }
    return res.json() as Promise<{ project: Project }>;
  },
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  selectSceneImage: (projectId: string, sceneId: string, sceneImageId: string) =>
    request<{ scene: Scene }>(
      `/api/projects/${projectId}/scenes/${sceneId}/select-image`,
      { method: 'PATCH', body: JSON.stringify({ sceneImageId }) }
    ),

  regenerateSceneImage: (
    projectId: string,
    sceneId: string,
    body: { prompt?: string; variantCount?: number } = {}
  ) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/regenerate-image`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  uploadSceneImage: async (projectId: string, sceneId: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(
      `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/upload-image`,
      { method: 'POST', body: form }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<{ sceneImage: SceneImage }>;
  },

  /**
   * Upload (or replace) the product reference image for a scene. The file
   * is stored on R2. When Higgsfield runs first, the API registers a Soul
   * custom reference from that URL before variants generate, then uses
   * `custom_reference_id` (stronger than `image_url` alone).
   */
  uploadProductReference: async (
    projectId: string,
    sceneId: string,
    file: File
  ) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(
      `${API_BASE}/api/projects/${projectId}/scenes/${sceneId}/product-reference`,
      { method: 'POST', body: form }
    );
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(message);
    }
    return res.json() as Promise<{ scene: Scene }>;
  },

  /** Remove the product reference image for a single scene. */
  deleteProductReference: (projectId: string, sceneId: string) =>
    request<{ scene: Scene }>(
      `/api/projects/${projectId}/scenes/${sceneId}/product-reference`,
      { method: 'DELETE' }
    ),

  /**
   * Copy the source scene's product reference image onto every other scene
   * in the project. Backend handles the R2 copy so we don't re-upload.
   */
  applyProductReferenceToAll: (projectId: string, sourceSceneId: string) =>
    request<{ updated: number }>(
      `/api/projects/${projectId}/scenes/${sourceSceneId}/product-reference/apply-to-all`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  generateSceneVoice: (projectId: string, sceneId: string, body?: { voiceId?: string; voiceSettings?: VoiceSettings }) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/voice`,
      { method: 'POST', body: JSON.stringify(body || {}) }
    ),

  /** Re-run Seedance for a single scene. */
  regenerateSceneVideo: (projectId: string, sceneId: string) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/regenerate-video`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  /** Bulk replace scenes during the script-review step. */
  replaceScenes: (projectId: string, scenes: SceneDraft[]) =>
    request<{ scenes: Scene[] }>(`/api/projects/${projectId}/scenes`, {
      method: 'PUT',
      body: JSON.stringify({ scenes }),
    }),

  /**
   * Patch one scene's editable fields (voiceoverText, imagePrompt,
   * durationSeconds) without disturbing its image variants, voice, or
   * video. Used by the global Scenes drawer after image generation has
   * started so users can tweak narration / prompt for one scene at a time.
   */
  patchScene: (
    projectId: string,
    sceneId: string,
    body: Partial<Pick<Scene, 'voiceoverText' | 'imagePrompt' | 'durationSeconds'>>
  ) =>
    request<{ scene: Scene }>(
      `/api/projects/${projectId}/scenes/${sceneId}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    ),

  /** Re-run Claude script generation. */
  regenerateScript: (
    projectId: string,
    body: { sceneCount?: number; totalDurationSeconds?: number; tone?: string; language?: string } = {}
  ) =>
    request<{ enqueued: true }>(
      `/api/projects/${projectId}/regenerate-script`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  /**
   * Approve script -> kick off per-scene image generation.
   *
   * Idempotent: only scenes whose imagePrompt changed (or have no variants
   * yet) are enqueued unless `force: true` is passed. Response reports how
   * many scenes were actually queued vs skipped so the UI can tell the user
   * "nothing changed" instead of pretending it's regenerating.
   */
  approveScript: (
    projectId: string,
    body: { variantCount?: number; force?: boolean } = {}
  ) =>
    request<{
      enqueued: boolean;
      enqueuedCount: number;
      skippedCount: number;
      sceneCount: number;
    }>(`/api/projects/${projectId}/approve-script`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  regenerateSubtitles: (projectId: string, subtitleSettings?: SubtitleSettings) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/subtitles`,
      { method: 'POST', body: JSON.stringify({ subtitleSettings }) }
    ),

  generate: (projectId: string) =>
    request<{ enqueued: true; sceneCount: number }>(
      `/api/projects/${projectId}/generate`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  /** Approve all per-scene videos -> kick off subtitles + final assembly. */
  approveVideos: (projectId: string) =>
    request<{ enqueued: true }>(
      `/api/projects/${projectId}/approve-videos`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  generateHooks: (projectId: string, body: { hookDurationSeconds?: number; variantCount?: number } = {}) =>
    request<{
      enqueued: true;
      jobId: string;
      hookDurationSeconds: number;
      variantCount: number;
      hookVariants?: HookVariant[];
    }>(
      `/api/projects/${projectId}/hooks`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  retryHookVariant: (projectId: string, hookId: string) =>
    request<{ enqueued: true; jobId: string; hookVariant: HookVariant }>(
      `/api/projects/${projectId}/hooks/retry`,
      { method: 'POST', body: JSON.stringify({ hookId }) }
    ),

  clearFailedHooks: (projectId: string) =>
    request<{ removed: number }>(
      `/api/projects/${projectId}/hooks/failed`,
      { method: 'DELETE' }
    ),

  // ---------------------------- Multi-shot --------------------------------

  /** Toggle multi-shot for one scene. On enable the backend seeds shots
   *  from suggestedShots; on disable it deletes the scene's shots (and
   *  their variants/videos via cascade). */
  setSceneMultiShot: (projectId: string, sceneId: string, enabled: boolean) =>
    request<{ scene: Scene & { shots: SceneShot[] } }>(
      `/api/projects/${projectId}/scenes/${sceneId}/multi-shot`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) }
    ),

  /** Bulk replace one scene's shot list (prompt edits, add/remove, reorder).
   *  Re-numbers shot_index from 0. */
  replaceShots: (
    projectId: string,
    sceneId: string,
    shots: Array<{
      role: SuggestedShot['role'];
      imagePrompt: string;
      durationSeconds?: number;
      /** When true, this shot reuses the scene's approved variant instead
       *  of generating new images. `imagePrompt` is ignored server-side. */
      useApprovedSceneImage?: boolean;
    }>
  ) =>
    request<{ shots: SceneShot[] }>(
      `/api/projects/${projectId}/scenes/${sceneId}/shots`,
      { method: 'PUT', body: JSON.stringify({ shots }) }
    ),

  /** Re-order the shots inside one multi-shot scene without re-rendering.
   *  Used by the scene-videos step to rearrange already-rendered shots
   *  before final assembly stitches them in `shot_index` order. */
  reorderShots: (projectId: string, sceneId: string, orderedShotIds: string[]) =>
    request<{ shots: SceneShot[] }>(
      `/api/projects/${projectId}/scenes/${sceneId}/shots/order`,
      { method: 'PUT', body: JSON.stringify({ orderedShotIds }) }
    ),

  /** Approve the project's shot list -> kick off per-shot image generation
   *  for every multi-shot scene. Idempotent: scenes whose shots already
   *  have variants matching the current prompt are skipped. */
  approveShots: (projectId: string, body: { variantCount?: number; force?: boolean } = {}) =>
    request<{ enqueued: boolean; enqueuedCount: number; sceneCount: number }>(
      `/api/projects/${projectId}/approve-shots`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  selectShotImage: (
    projectId: string, sceneId: string, shotId: string, sceneImageId: string
  ) =>
    request<{ shot: SceneShot }>(
      `/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}/select-image`,
      { method: 'PATCH', body: JSON.stringify({ sceneImageId }) }
    ),

  regenerateShotImage: (
    projectId: string, sceneId: string, shotId: string,
    body: { prompt?: string; variantCount?: number } = {}
  ) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}/regenerate-image`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  /** Approve all per-shot variants -> kick off Seedance for every shot
   *  AND any single-shot scenes that don't yet have a video render. */
  approveShotImages: (projectId: string) =>
    request<{ enqueued: true }>(
      `/api/projects/${projectId}/approve-shot-images`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  regenerateShotVideo: (projectId: string, sceneId: string, shotId: string) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}/regenerate-video`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  statusStreamUrl: (projectId: string) =>
    `${API_BASE}/api/projects/${projectId}/status/stream`,
};
