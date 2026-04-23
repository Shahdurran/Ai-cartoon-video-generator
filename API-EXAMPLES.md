# API Examples - Video Generator v2.0

Complete collection of API examples you can test with curl, Postman, or any HTTP client.

---

## Base URL
```
http://localhost:3000
```

---

## 1. Health & Status Endpoints

### Check API Health
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 3600,
  "version": "2.0.0"
}
```

### Get All Queues Status
```bash
curl http://localhost:3000/api/v2/queue
```

**Response:**
```json
{
  "success": true,
  "queues": {
    "scriptGeneration": {
      "queueName": "scriptGeneration",
      "waiting": 0,
      "active": 1,
      "completed": 42,
      "failed": 2,
      "delayed": 0,
      "paused": 0,
      "total": 45
    },
    "voiceGeneration": { ... },
    "imageGeneration": { ... }
  }
}
```

---

## 2. Script Generation

### Generate Script
```bash
curl -X POST http://localhost:3000/api/v2/script/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a 60-second video explaining artificial intelligence for beginners",
    "options": {
      "tone": "friendly",
      "length": "medium",
      "style": "educational",
      "targetAudience": "general public",
      "includeHooks": true
    },
    "priority": "high"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "1",
  "message": "Script generation job queued",
  "status": "waiting"
}
```

### Check Script Job Status
```bash
curl http://localhost:3000/api/v2/script/job/1
```

**Response (Completed):**
```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "script": "Artificial intelligence isn't just science fiction anymore...",
    "metadata": {
      "model": "claude-3-5-sonnet-20241022",
      "tokens": 450,
      "tone": "friendly",
      "length": "medium",
      "generatedAt": "2025-01-15T10:05:00.000Z"
    }
  }
}
```

### Generate Image Prompts from Script
```bash
curl -X POST http://localhost:3000/api/v2/script/image-prompts \
  -H "Content-Type: application/json" \
  -d '{
    "script": "Artificial intelligence is transforming our world...",
    "numberOfImages": 3
  }'
```

### Refine Existing Script
```bash
curl -X POST http://localhost:3000/api/v2/script/refine \
  -H "Content-Type: application/json" \
  -d '{
    "script": "Your original script text here...",
    "instructions": "Make it more casual and add humor"
  }'
```

---

## 3. Voice Generation

### Generate Voice
```bash
curl -X POST http://localhost:3000/api/v2/voice/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to this amazing video about artificial intelligence.",
    "voice": "alloy",
    "speed": 1.0,
    "priority": "normal"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "5",
  "message": "Voice generation job queued",
  "status": "waiting"
}
```

### Get Available Voices
```bash
curl http://localhost:3000/api/v2/voice/list
```

**Response:**
```json
{
  "success": true,
  "voices": [
    { "id": "alloy", "name": "Alloy" },
    { "id": "echo", "name": "Echo" },
    { "id": "fable", "name": "Fable" },
    { "id": "onyx", "name": "Onyx" },
    { "id": "nova", "name": "Nova" },
    { "id": "shimmer", "name": "Shimmer" }
  ]
}
```

### Check Voice Job Status
```bash
curl http://localhost:3000/api/v2/voice/job/5
```

**Response (Completed):**
```json
{
  "jobId": "5",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "audioPath": "./temp/voice_1705315200000.mp3",
    "provider": "genaipro",
    "metadata": {
      "voice": "alloy",
      "speed": 1.0,
      "textLength": 62,
      "fileSize": 45678,
      "generatedAt": "2025-01-15T10:10:00.000Z"
    }
  }
}
```

---

## 4. Image Generation

### Generate Single Image
```bash
curl -X POST http://localhost:3000/api/v2/image/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic AI brain made of glowing blue neural networks, high quality, photorealistic",
    "width": 1920,
    "height": 1080,
    "numInferenceSteps": 28,
    "guidanceScale": 3.5,
    "priority": "normal"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "10",
  "message": "Image generation job queued",
  "status": "waiting"
}
```

### Generate Multiple Images
```bash
curl -X POST http://localhost:3000/api/v2/image/generate-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      {
        "prompt": "A futuristic AI brain with glowing neural networks",
        "options": { "width": 1920, "height": 1080 }
      },
      {
        "prompt": "Robots and humans working together in a modern office",
        "options": { "width": 1920, "height": 1080 }
      },
      {
        "prompt": "A digital world made of data and code",
        "options": { "width": 1920, "height": 1080 }
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "12",
  "message": "3 image generation jobs queued",
  "status": "waiting"
}
```

---

## 5. Channel Management

### Create Channel
```bash
curl -X POST http://localhost:3000/api/v2/channel \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech News Daily",
    "description": "Daily technology news and insights",
    "settings": {
      "videoStyle": {
        "resolution": "1920x1080",
        "fps": 30,
        "aspectRatio": "16:9"
      },
      "defaultVoice": "nova",
      "defaultSpeed": 1.1,
      "fontFamily": "Roboto",
      "fontSize": 24,
      "fontColor": "#FFFFFF",
      "useParticleEffect": true,
      "particleOpacity": 0.3
    },
    "contentPreferences": {
      "topics": ["AI", "Technology", "Science"],
      "tone": "informative",
      "style": "professional",
      "targetAudience": "tech enthusiasts"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "channelId": "abc-123-def",
  "message": "Channel created successfully"
}
```

### List All Channels
```bash
curl http://localhost:3000/api/v2/channel
```

### Get Specific Channel
```bash
curl http://localhost:3000/api/v2/channel/abc-123-def
```

### Update Channel
```bash
curl -X PUT http://localhost:3000/api/v2/channel/abc-123-def \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "defaultVoice": "alloy",
      "fontSize": 28
    }
  }'
```

### Delete Channel
```bash
curl -X DELETE http://localhost:3000/api/v2/channel/abc-123-def
```

---

## 6. Template Management

### Create Template
```bash
curl -X POST http://localhost:3000/api/v2/template \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick News Template",
    "description": "Template for 60-second news videos",
    "category": "news",
    "settings": {
      "videoDuration": "60",
      "voiceSettings": {
        "voice": "nova",
        "speed": 1.1
      },
      "visualSettings": {
        "numberOfImages": 3,
        "useParticleEffect": true
      },
      "subtitleSettings": {
        "fontFamily": "Montserrat",
        "fontSize": 28,
        "fontColor": "#FFFFFF"
      }
    }
  }'
```

### List All Templates
```bash
curl http://localhost:3000/api/v2/template
```

### Get Specific Template
```bash
curl http://localhost:3000/api/v2/template/template-123
```

---

## 7. Batch Processing

### Create Batch Job
```bash
curl -X POST http://localhost:3000/api/v2/batch \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      {
        "id": "video-001",
        "generateScript": true,
        "scriptPrompt": "AI in healthcare breakthrough",
        "scriptOptions": {
          "tone": "informative",
          "length": "short"
        },
        "voiceOptions": {
          "voice": "nova",
          "speed": 1.0
        },
        "imagePrompts": [
          { "prompt": "Medical AI technology" }
        ]
      },
      {
        "id": "video-002",
        "generateScript": true,
        "scriptPrompt": "Quantum computing advances",
        "scriptOptions": {
          "tone": "exciting",
          "length": "short"
        },
        "voiceOptions": {
          "voice": "alloy"
        }
      },
      {
        "id": "video-003",
        "text": "Space exploration is entering a new era...",
        "voiceOptions": {
          "voice": "echo"
        },
        "imagePrompts": [
          { "prompt": "SpaceX rocket launching" }
        ]
      }
    ],
    "batchConfig": {
      "channelId": "tech-news-channel"
    },
    "priority": "high"
  }'
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch-abc-123",
  "jobId": "50",
  "message": "Batch processing started with 3 videos",
  "status": "waiting"
}
```

### Get Batch Status
```bash
curl http://localhost:3000/api/v2/batch/batch-abc-123
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "id": "batch-abc-123",
    "status": "processing",
    "totalCount": 3,
    "processedCount": 2,
    "successCount": 2,
    "failedCount": 0,
    "results": [
      {
        "index": 0,
        "videoId": "video-001",
        "success": true,
        "videoPath": "./public/videos/video-001.mp4"
      },
      {
        "index": 1,
        "videoId": "video-002",
        "success": true,
        "videoPath": "./public/videos/video-002.mp4"
      }
    ],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:15:00.000Z"
  }
}
```

### List All Batches
```bash
curl http://localhost:3000/api/v2/batch
```

---

## 8. Queue Management

### Get Queue Status
```bash
curl http://localhost:3000/api/v2/queue/scriptGeneration
```

### Pause Queue
```bash
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/pause
```

### Resume Queue
```bash
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/resume
```

### Clean Queue (Remove old jobs)
```bash
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/clean \
  -H "Content-Type: application/json" \
  -d '{
    "grace": 3600000
  }'
```

### Get Specific Job in Queue
```bash
curl http://localhost:3000/api/v2/queue/scriptGeneration/job/1
```

---

## 9. Complete Workflow Example

### Full Video Creation Workflow

```bash
# Step 1: Generate Script
SCRIPT_JOB=$(curl -X POST http://localhost:3000/api/v2/script/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a 90-second video about renewable energy",
    "options": { "tone": "informative", "length": "medium" },
    "projectId": "renewable-video-001"
  }' | jq -r '.jobId')

echo "Script job: $SCRIPT_JOB"

# Wait for completion (in real app, poll or use webhooks)
sleep 30

# Step 2: Get generated script
SCRIPT=$(curl http://localhost:3000/api/v2/script/job/$SCRIPT_JOB \
  | jq -r '.result.script')

# Step 3: Generate voice
VOICE_JOB=$(curl -X POST http://localhost:3000/api/v2/voice/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$SCRIPT\",
    \"voice\": \"nova\",
    \"projectId\": \"renewable-video-001\"
  }" | jq -r '.jobId')

echo "Voice job: $VOICE_JOB"

# Step 4: Generate images
IMAGE_JOB=$(curl -X POST http://localhost:3000/api/v2/image/generate-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      { "prompt": "Solar panels on modern building" },
      { "prompt": "Wind turbines in green field" },
      { "prompt": "Hydroelectric dam" }
    ],
    "projectId": "renewable-video-001"
  }' | jq -r '.jobId')

echo "Image job: $IMAGE_JOB"

# Wait for all jobs to complete
sleep 60

# Step 5: Check job statuses
curl http://localhost:3000/api/v2/voice/job/$VOICE_JOB
curl http://localhost:3000/api/v2/image/job/$IMAGE_JOB

# Step 6: Generate final video (use existing FFmpeg endpoint)
# Get paths from completed jobs and call video generation
```

---

## 10. Legacy Endpoints (Still Supported)

### Original Video Generation
```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "http://example.com/audio.mp3",
    "imageUrl": "http://example.com/image.jpg",
    "useAssemblyAI": true,
    "useParticleEffect": true,
    "fontOptions": {
      "fontFamily": "Montserrat",
      "fontSize": 24
    }
  }'
```

### Get Fonts List
```bash
curl http://localhost:3000/api/fonts
```

---

## Testing Tips

### Using with Postman

1. Import these examples as a collection
2. Set base URL as environment variable
3. Chain requests using test scripts to pass jobIds
4. Add delays or polling for async operations

### Using with JavaScript

```javascript
// Helper function to wait for job completion
async function waitForJob(endpoint, jobId) {
  while (true) {
    const response = await fetch(`http://localhost:3000${endpoint}/job/${jobId}`);
    const data = await response.json();
    
    if (data.state === 'completed') {
      return data.result;
    } else if (data.state === 'failed') {
      throw new Error(data.failedReason);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Usage
const scriptJob = await fetch('/api/v2/script/generate', {...});
const { jobId } = await scriptJob.json();
const result = await waitForJob('/api/v2/script', jobId);
```

---

## Error Responses

### Common Error Formats

**400 Bad Request:**
```json
{
  "error": "Prompt is required"
}
```

**404 Not Found:**
```json
{
  "error": "Job not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Script generation failed: API key invalid"
}
```

---

## Rate Limiting Considerations

- Default: 3 concurrent jobs per queue
- Configure via `QUEUE_MAX_CONCURRENT_JOBS` in `.env`
- Jobs automatically queue when limit reached
- No HTTP 429 responses; jobs queue gracefully

---

**Happy Testing! 🚀**

