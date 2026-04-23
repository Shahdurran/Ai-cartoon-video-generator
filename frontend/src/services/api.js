import axios from 'axios';

// API Base URL - dynamically configured based on environment
// In production, this should be set via environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v2';

// Backend URL for static assets (videos, thumbnails, etc.)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Channel API methods
export const channelAPI = {
  getAll: async () => {
    const response = await apiClient.get('/channel');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await apiClient.get(`/channel/${id}`);
    return response.data;
  },
  
  get: async (id) => {
    const response = await apiClient.get(`/channel/${id}`);
    return response.data;
  },
  
  list: async () => {
    const response = await apiClient.get('/channel');
    return response.data;
  },
  
  create: async (channelData) => {
    const response = await apiClient.post('/channel', channelData);
    return response.data;
  },
  
  update: async (id, channelData) => {
    const response = await apiClient.put(`/channel/${id}`, channelData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await apiClient.delete(`/channel/${id}`);
    return response.data;
  },
};

// Video API methods (using batch endpoint for video generation)
export const videoAPI = {
  generate: async (videoData) => {
    // Use batch endpoint with single video
    const response = await apiClient.post('/batch', {
      videos: [{
        channelId: videoData.channelId,
        title: videoData.title,
        context: videoData.context,
        customPrompt: videoData.customPrompt,
        referenceScripts: videoData.referenceScripts,
        promptTemplateId: videoData.promptTemplateId,
        personVideoOverlay: videoData.personVideoOverlay,
        backgroundMusic: videoData.backgroundMusic,
        musicTracks: videoData.musicTracks, // New: support multiple music tracks
      }],
    });
    return response.data;
  },
  
  batch: async (batchData) => {
    const response = await apiClient.post('/batch', batchData);
    return response.data;
  },
  
  getQueue: async () => {
    const response = await apiClient.get('/queue?includeJobs=true');
    return response.data;
  },
  
  getJobStatus: async (jobId, queueName = 'batchProcessing') => {
    const response = await apiClient.get(`/queue/${queueName}/job/${jobId}`);
    return response.data;
  },
  
  cancelJob: async (jobId, queueName = 'batchProcessing') => {
    // Queue cancellation not implemented yet, return mock
    return { success: true, message: 'Cancel feature coming soon' };
  },
  
  deleteJob: async (jobId, queueName) => {
    const response = await apiClient.delete(`/queue/${queueName}/job/${jobId}`);
    return response.data;
  },
  
  // NEW: Step-by-Step Generation API
  generateScript: async (scriptData) => {
    const response = await apiClient.post('/video/generate-script', scriptData);
    return response.data;
  },
  
  generateVoice: async (voiceData) => {
    const response = await apiClient.post('/video/generate-voice', voiceData);
    return response.data;
  },
  
  generateImages: async (imageData) => {
    const response = await apiClient.post('/video/generate-images', imageData);
    return response.data;
  },
  
  // NEW: Session History API
  getSessionsByChannel: async (channelId) => {
    const response = await apiClient.get(`/video/sessions/channel/${channelId}`);
    return response.data;
  },
  
  getSessionDetails: async (sessionId) => {
    const response = await apiClient.get(`/video/session/${sessionId}`);
    return response.data;
  },
  
  regenerateAsset: async (regenerateData) => {
    const response = await apiClient.post('/video/regenerate-asset', regenerateData);
    return response.data;
  },
  
  generateFinal: async (finalData) => {
    const response = await apiClient.post('/video/generate-final', finalData);
    return response.data;
  },
  
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/video/session/${sessionId}`);
    return response.data;
  },
  
  listSessions: async () => {
    const response = await apiClient.get('/video/sessions');
    return response.data;
  },
  
  deleteSession: async (sessionId) => {
    const response = await apiClient.delete(`/video/session/${sessionId}`);
    return response.data;
  },
};

// Template API methods
export const templateAPI = {
  getAll: async () => {
    const response = await apiClient.get('/template');
    return response.data;
  },
  
  save: async (templateData) => {
    const response = await apiClient.post('/template', templateData);
    return response.data;
  },
};

// Image API methods
export const imageAPI = {
  generate: async (imageData) => {
    const response = await apiClient.post('/image/generate', imageData);
    return response.data;
  },
};

// Script API methods
export const scriptAPI = {
  generate: async (scriptData) => {
    const response = await apiClient.post('/script/generate', scriptData);
    return response.data;
  },
};

// Voice API methods
export const voiceAPI = {
  generate: async (voiceData) => {
    const response = await apiClient.post('/voice/generate', voiceData);
    return response.data;
  },
  
  list: async () => {
    const response = await apiClient.get('/voice/list');
    return response.data;
  },
};

// Queue API methods
export const queueAPI = {
  status: async () => {
    const response = await apiClient.get('/queue/status');
    return response.data;
  },
  
  jobs: async () => {
    const response = await apiClient.get('/queue/jobs');
    return response.data;
  },
  
  job: async (jobId) => {
    const response = await apiClient.get(`/queue/job/${jobId}`);
    return response.data;
  },
};

// Person Video Library API methods
export const personVideoAPI = {
  scan: async (forceRefresh = false) => {
    const response = await apiClient.get(`/person-videos/scan?forceRefresh=${forceRefresh}`);
    return response.data;
  },
  
  getStats: async () => {
    const response = await apiClient.get('/person-videos/stats');
    return response.data;
  },
  
  upload: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('personVideo', file);
    
    const response = await apiClient.post('/person-videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },
  
  delete: async (filename) => {
    const response = await apiClient.delete(`/person-videos/${filename}`);
    return response.data;
  },
  
  regenerateThumbnail: async (filename) => {
    const response = await apiClient.post(`/person-videos/thumbnail/${filename}`);
    return response.data;
  },
  
  getInfo: async (filename) => {
    const response = await apiClient.get(`/person-videos/${filename}`);
    return response.data;
  },
  
  refresh: async () => {
    const response = await apiClient.post('/person-videos/refresh');
    return response.data;
  },
};

// Video Bank API methods
export const videoBankAPI = {
  scan: async () => {
    const response = await apiClient.get('/video-bank/scan');
    return response.data;
  },
  
  refresh: async () => {
    const response = await apiClient.post('/video-bank/refresh');
    return response.data;
  },
  
  getStats: async () => {
    const response = await apiClient.get('/video-bank/stats');
    return response.data;
  },
  
  delete: async (filename) => {
    const response = await apiClient.delete(`/video-bank/${filename}`);
    return response.data;
  },
};

// Music Library API methods
export const musicLibraryAPI = {
  scan: async () => {
    const response = await apiClient.get('/music-library/scan');
    return response.data;
  },
  
  refresh: async () => {
    const response = await apiClient.post('/music-library/refresh');
    return response.data;
  },
  
  getStats: async () => {
    const response = await apiClient.get('/music-library/stats');
    return response.data;
  },
  
  getInfo: async (filename) => {
    const response = await apiClient.get(`/music-library/${filename}`);
    return response.data;
  },
  
  delete: async (filename) => {
    const response = await apiClient.delete(`/music-library/${filename}`);
    return response.data;
  },
};

// Sound Wave API methods
export const soundWaveAPI = {
  scan: async () => {
    const response = await apiClient.get('/sound-waves/library');
    return response.data;
  },
  
  refresh: async () => {
    const response = await apiClient.post('/sound-waves/refresh');
    return response.data;
  },
  
  getStats: async () => {
    const response = await apiClient.get('/sound-waves/stats');
    return response.data;
  },
  
  getInfo: async (filename) => {
    const response = await apiClient.get(`/sound-waves/${filename}`);
    return response.data;
  },
  
  delete: async (filename) => {
    const response = await apiClient.delete(`/sound-waves/${filename}`);
    return response.data;
  },
};

// Voice Clone API methods
export const voiceCloneAPI = {
  list: async () => {
    const response = await apiClient.get('/voice-clones');
    return response.data;
  },
  
  create: async (formData) => {
    const response = await apiClient.post('/voice-clones', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  delete: async (id) => {
    const response = await apiClient.delete(`/voice-clones/${id}`);
    return response.data;
  },
};

// Prompt Template API methods
export const promptTemplateAPI = {
  getAll: async () => {
    const response = await apiClient.get('/prompt-templates');
    return response.data;
  },
  
  list: async () => {
    const response = await apiClient.get('/prompt-templates');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await apiClient.get(`/prompt-templates/${id}`);
    return response.data;
  },
  
  getCategories: async () => {
    const response = await apiClient.get('/prompt-templates/categories');
    return response.data;
  },
  
  getByCategory: async (category) => {
    const response = await apiClient.get(`/prompt-templates/category/${category}`);
    return response.data;
  },
  
  search: async (query) => {
    const response = await apiClient.get(`/prompt-templates/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
  
  create: async (templateData) => {
    const response = await apiClient.post('/prompt-templates', templateData);
    return response.data;
  },
  
  update: async (id, templateData) => {
    const response = await apiClient.put(`/prompt-templates/${id}`, templateData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await apiClient.delete(`/prompt-templates/${id}`);
    return response.data;
  },
  
  duplicate: async (id, newName) => {
    const response = await apiClient.post(`/prompt-templates/${id}/duplicate`, { name: newName });
    return response.data;
  },
  
  export: async (id) => {
    const response = await apiClient.get(`/prompt-templates/${id}/export`);
    return response.data;
  },
  
  import: async (templateData) => {
    const response = await apiClient.post('/prompt-templates/import', templateData);
    return response.data;
  },
};

// Dashboard API methods
export const dashboardAPI = {
  getAnalytics: async (period = '7days') => {
    const response = await apiClient.get(`/dashboard/analytics?period=${period}`);
    return response.data;
  },
  
  getRecentActivity: async () => {
    const response = await apiClient.get('/dashboard/recent-activity');
    return response.data;
  },
  
  getTodaySummary: async () => {
    const response = await apiClient.get('/dashboard/today-summary');
    return response.data;
  },
  
  getStats: async () => {
    const response = await apiClient.get('/dashboard/analytics');
    return response.data;
  },
};

// System Status API methods
export const systemAPI = {
  getHealth: async () => {
    const response = await apiClient.get('/system/health');
    return response.data;
  },
  
  getStatus: async () => {
    const response = await apiClient.get('/system/status');
    return response.data;
  },
  
  testService: async (service) => {
    const response = await apiClient.post(`/system/health/test/${service}`);
    return response.data;
  },
  
  getAPIUsage: async () => {
    const response = await apiClient.get('/system/api-usage');
    return response.data;
  },
  
  getResources: async () => {
    const response = await apiClient.get('/system/resources');
    return response.data;
  },
  
  getSystemInfo: async () => {
    const response = await apiClient.get('/system/info');
    return response.data;
  },
  
  exportReport: async () => {
    const response = await apiClient.get('/system/export-report', {
      responseType: 'blob'
    });
    return response.data;
  },
  
  exportLogs: async () => {
    const response = await apiClient.get('/system/export-logs', {
      responseType: 'blob'
    });
    return response.data;
  },
};

// Step-by-Step Video Generation API
export const stepByStepAPI = {
  generateScript: async (data) => {
    const response = await apiClient.post('/video/generate-script', data);
    return response.data;
  },

  generateVoice: async (data) => {
    const response = await apiClient.post('/video/generate-voice', data);
    return response.data;
  },

  generateImages: async (data) => {
    const response = await apiClient.post('/video/generate-images', data);
    return response.data;
  },

  regenerateAsset: async (data) => {
    const response = await apiClient.post('/video/regenerate-asset', data);
    return response.data;
  },

  generateFinal: async (data) => {
    const response = await apiClient.post('/video/generate-final', data);
    return response.data;
  },

  listSessions: async () => {
    const response = await apiClient.get('/video/sessions');
    return response.data;
  },

  getSessionDetails: async (sessionId) => {
    const response = await apiClient.get(`/video/session/${sessionId}`);
    return response.data;
  },

  getSessionsByChannel: async (channelId) => {
    const response = await apiClient.get(`/video/sessions/channel/${channelId}`);
    return response.data;
  },

  deleteSession: async (sessionId) => {
    const response = await apiClient.delete(`/video/session/${sessionId}`);
    return response.data;
  },
};

// Video Library API (NEW - Generated Videos Management)
export const videoLibraryAPI = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/video-library?${query}`);
    return response.data;
  },

  get: async (videoId) => {
    const response = await apiClient.get(`/video-library/${videoId}`);
    return response.data;
  },

  delete: async (videoId) => {
    const response = await apiClient.delete(`/video-library/${videoId}`);
    return response.data;
  },

  generateThumbnail: async (videoId, timestamp = '00:00:02') => {
    const response = await apiClient.post(`/video-library/${videoId}/thumbnail`, { timestamp });
    return response.data;
  },

  generateAllThumbnails: async () => {
    const response = await apiClient.post('/video-library/generate-all-thumbnails');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/video-library/stats');
    return response.data;
  },
};

export default apiClient;
