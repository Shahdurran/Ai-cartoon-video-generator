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
  imageVariants: SceneImage[];
  voiceSignedUrl: string | null;
  videoSignedUrl: string | null;
};

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

export type SubtitleSettings = {
  fontName?: string;
  fontSize?: number;
  fontColor?: string;
  position?: 'top' | 'middle' | 'bottom';
  outline?: boolean;
  maxCharsPerLine?: number;
  maxLines?: number;
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
  musicTrackId: string | null;
  musicVolume: number;
  subtitlesKey: string | null;
  subtitlesSignedUrl: string | null;
  outputKey: string | null;
  outputSignedUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
  hookVariants: HookVariant[];
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
  // Music
  listMusic: () => request<{ tracks: MusicTrack[] }>('/api/music'),

  // Projects
  listProjects: () => request<{ projects: Project[] }>('/api/projects'),
  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),
  createProject: (body: {
    topic?: string;
    sourceScript?: string;
    styleId: string;
    sceneCount: number;
    voiceId?: string;
    voiceSettings?: VoiceSettings;
    subtitleSettings?: SubtitleSettings;
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

  generateSceneVoice: (projectId: string, sceneId: string, body?: { voiceId?: string; voiceSettings?: VoiceSettings }) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/scenes/${sceneId}/voice`,
      { method: 'POST', body: JSON.stringify(body || {}) }
    ),

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

  generateHooks: (projectId: string, body: { hookDurationSeconds?: number; variantCount?: number } = {}) =>
    request<{ enqueued: true; jobId: string }>(
      `/api/projects/${projectId}/hooks`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  statusStreamUrl: (projectId: string) =>
    `${API_BASE}/api/projects/${projectId}/status/stream`,
};
