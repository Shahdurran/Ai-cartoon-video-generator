# API Endpoints Fix ✅

## Issue
The frontend was calling incorrect API endpoints. The error was:
```
GET http://localhost:3000/api/channels net::ERR_FAILED 404 (Not Found)
```

## Root Cause
The backend uses `/api/v2` as the base path for all new API routes, not just `/api`.

## Changes Applied

### 1. Updated API Base URL
**File**: `frontend/src/services/api.js`

**Before:**
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

**After:**
```javascript
const API_BASE_URL = 'http://localhost:3000/api/v2';
```

### 2. Updated Video Generation Endpoint
The backend doesn't have a dedicated `/video/generate` endpoint. Instead, it uses the batch processing system even for single videos.

**Before:**
```javascript
generate: async (videoData) => {
  const response = await apiClient.post('/video/generate', videoData);
  return response.data;
}
```

**After:**
```javascript
generate: async (videoData) => {
  // Use batch endpoint with single video
  const response = await apiClient.post('/batch', {
    videos: [{
      channelId: videoData.channelId,
      title: videoData.title,
      context: videoData.context,
      customPrompt: videoData.customPrompt,
    }],
  });
  return response.data;
}
```

### 3. Fixed Queue Status Endpoint
**Before:**
```javascript
getQueue: async () => {
  const response = await apiClient.get('/queue/status');
  return response.data;
}
```

**After:**
```javascript
getQueue: async () => {
  const response = await apiClient.get('/queue');
  return response.data;
}
```

### 4. Updated Job Status Endpoint
**Before:**
```javascript
getJobStatus: async (jobId) => {
  const response = await apiClient.get(`/queue/job/${jobId}`);
  return response.data;
}
```

**After:**
```javascript
getJobStatus: async (jobId, queueName = 'batchProcessing') => {
  const response = await apiClient.get(`/queue/${queueName}/job/${jobId}`);
  return response.data;
}
```

### 5. Fixed Batch Format
The backend expects `channelId` to be inside each video object, not at the batch level.

**Before:**
```json
{
  "channelId": "your-channel-id",
  "videos": [
    {
      "title": "Video 1",
      "context": "Context 1"
    }
  ]
}
```

**After:**
```json
{
  "videos": [
    {
      "channelId": "your-channel-id",
      "title": "Video 1",
      "context": "Context 1"
    }
  ]
}
```

## Complete API Endpoint Mapping

| Frontend Call | Backend Endpoint | Method |
|--------------|------------------|--------|
| `channelAPI.getAll()` | `/api/v2/channel` | GET |
| `channelAPI.getById(id)` | `/api/v2/channel/:channelId` | GET |
| `channelAPI.create(data)` | `/api/v2/channel` | POST |
| `channelAPI.update(id, data)` | `/api/v2/channel/:channelId` | PUT |
| `channelAPI.delete(id)` | `/api/v2/channel/:channelId` | DELETE |
| `videoAPI.generate(data)` | `/api/v2/batch` | POST |
| `videoAPI.batch(data)` | `/api/v2/batch` | POST |
| `videoAPI.getQueue()` | `/api/v2/queue` | GET |
| `videoAPI.getJobStatus(id)` | `/api/v2/queue/:queueName/job/:jobId` | GET |
| `templateAPI.getAll()` | `/api/v2/template` | GET |
| `templateAPI.save(data)` | `/api/v2/template` | POST |
| `imageAPI.generate(data)` | `/api/v2/image/generate` | POST |
| `scriptAPI.generate(data)` | `/api/v2/script/generate` | POST |
| `voiceAPI.generate(data)` | `/api/v2/voice/generate` | POST |
| `voiceAPI.list()` | `/api/v2/voice/list` | GET |

## Backend Route Structure

```
/api
  /v2                    # New API version
    /channel            # Channel management
    /batch              # Batch/video generation
    /queue              # Queue monitoring
    /template           # Template management
    /script             # Script generation
    /voice              # Voice generation
    /image              # Image generation
  /video                # Legacy video routes
    /generate-video
    /fonts
  /health               # Health check
```

## Testing

### Test Channel Listing
```bash
curl http://localhost:3000/api/v2/channel
```

### Test Channel Creation
```bash
curl -X POST http://localhost:3000/api/v2/channel \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Channel","type":"TYPE_1"}'
```

### Test Video Generation
```bash
curl -X POST http://localhost:3000/api/v2/batch \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [{
      "channelId": "test-channel",
      "title": "Test Video",
      "context": "Test context"
    }]
  }'
```

### Test Queue Status
```bash
curl http://localhost:3000/api/v2/queue
```

## Status: ✅ FIXED

The frontend should now correctly communicate with all backend endpoints!

## Notes

1. **Single Video = Batch of 1**: The backend processes all videos through the batch system, even single videos.

2. **Queue Names**: Different job types use different queues:
   - `batchProcessing` - Video generation jobs
   - `scriptGeneration` - Script generation jobs
   - `voiceGeneration` - Voice generation jobs
   - `imageGeneration` - Image generation jobs

3. **Cancel Job**: The cancel job feature returns a mock response for now since the backend doesn't have a cancel endpoint yet.

4. **Response Format**: All backend responses follow this pattern:
   ```json
   {
     "success": true,
     "data": {...},
     "message": "..."
   }
   ```

## Files Modified

1. `frontend/src/services/api.js` - Updated all API endpoints
2. `frontend/src/components/VideoGenerator.jsx` - Handle batch response
3. `frontend/src/components/BatchProcessor.jsx` - Fix batch format

## Refresh Your Browser

After these changes, refresh your browser (Ctrl+F5 or Cmd+Shift+R) to see the updates!

