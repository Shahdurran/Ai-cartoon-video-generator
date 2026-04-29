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
  variantIndex: number;
  r2Key: string;
  signedUrl: string | null;
  isCustomUpload: boolean;
  promptUsed: string | null;
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
  }) =>
    request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
   * is stored on R2 and used as `image_url` input for image generation so
   * the product appears consistently across regenerations of that scene.
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
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/hooks`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  statusStreamUrl: (projectId: string) =>
    `${API_BASE}/api/projects/${projectId}/status/stream`,
};
