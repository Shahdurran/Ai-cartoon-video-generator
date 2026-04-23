# FFmpeg Video Generator v2.0 - API Documentation

## 🚀 Overview

Advanced video generation platform with AI integrations, job queue management, and batch processing capabilities.

### New Features in v2.0

- ✅ **Bull Queue with Redis** - Robust job queue management
- ✅ **Claude API Integration** - AI-powered script generation
- ✅ **Fal.AI Integration** - Advanced image generation
- ✅ **Genaipro.vn Integration** - Primary voice generation service
- ✅ **AssemblyAI Integration** - Professional transcription
- ✅ **Batch Processing** - Process multiple videos in parallel
- ✅ **Channel Management** - Organize content by channels
- ✅ **Template System** - Reusable video configurations
- ✅ **Queue Monitoring** - Real-time queue status and management

---

## 📋 Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [API Endpoints](#api-endpoints)
4. [Queue Management](#queue-management)
5. [Workflow Examples](#workflow-examples)
6. [Monitoring](#monitoring)

---

## 🛠 Installation

### Prerequisites

- Node.js 16+
- Redis 6+
- FFmpeg
- Python 3.8+ (for Whisper transcription)

### Setup Steps

```bash
# 1. Install dependencies
npm install

# 2. Install Redis (if not already installed)
# Windows: Download from https://redis.io/download
# Linux: sudo apt-get install redis-server
# macOS: brew install redis

# 3. Start Redis
redis-server

# 4. Copy environment template
cp .env.template .env

# 5. Configure API keys in .env file
# Edit .env and add your API keys

# 6. Start the server
npm start

# 7. (Optional) Monitor queues in another terminal
npm run queue:monitor
```

---

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Server
PORT=3000
NODE_ENV=development

# Redis (Bull Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
ASSEMBLYAI_API_KEY=...
FAL_AI_API_KEY=...
GENAIPRO_API_KEY=...
GENAIPRO_BASE_URL=https://api.genaipro.vn/v1

# Queue Settings
QUEUE_MAX_CONCURRENT_JOBS=3
QUEUE_JOB_TIMEOUT=1800000
QUEUE_JOB_ATTEMPTS=3

# Storage
STORAGE_PATH=./storage
TEMP_DIR=./temp
OUTPUT_DIR=./public/videos
```

---

## 📡 API Endpoints

### Base URL: `http://localhost:3000/api/v2`

---

### 📝 Script Generation

#### Generate Script

```http
POST /script/generate
Content-Type: application/json

{
  "prompt": "Create a 60-second video about AI in healthcare",
  "options": {
    "tone": "informative",
    "length": "medium",
    "style": "professional",
    "targetAudience": "healthcare professionals"
  },
  "projectId": "optional-project-id",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "123",
  "message": "Script generation job queued",
  "status": "waiting"
}
```

#### Generate Image Prompts from Script

```http
POST /script/image-prompts
Content-Type: application/json

{
  "script": "Your video script text here...",
  "numberOfImages": 5,
  "projectId": "optional-project-id"
}
```

#### Check Script Job Status

```http
GET /script/job/:jobId
```

---

### 🎙️ Voice Generation

#### Generate Voice

```http
POST /voice/generate
Content-Type: application/json

{
  "text": "Your script text here",
  "voice": "alloy",
  "speed": 1.0,
  "projectId": "optional-project-id",
  "useFallback": false,
  "priority": "normal"
}
```

#### Get Available Voices

```http
GET /voice/list
```

**Response:**
```json
{
  "success": true,
  "voices": [
    { "id": "alloy", "name": "Alloy" },
    { "id": "echo", "name": "Echo" },
    { "id": "nova", "name": "Nova" }
  ]
}
```

---

### 🎨 Image Generation

#### Generate Single Image

```http
POST /image/generate
Content-Type: application/json

{
  "prompt": "A futuristic AI brain with glowing neural networks",
  "width": 1920,
  "height": 1080,
  "numInferenceSteps": 28,
  "guidanceScale": 3.5,
  "projectId": "optional-project-id"
}
```

#### Generate Multiple Images

```http
POST /image/generate-multiple
Content-Type: application/json

{
  "prompts": [
    {
      "prompt": "AI brain neural network",
      "options": { "width": 1920, "height": 1080 }
    },
    {
      "prompt": "Robots collaborating with humans",
      "options": { "width": 1920, "height": 1080 }
    }
  ],
  "projectId": "optional-project-id"
}
```

---

### 📺 Channel Management

#### Create Channel

```http
POST /channel
Content-Type: application/json

{
  "name": "Tech Insights",
  "description": "Technology news and tutorials",
  "settings": {
    "videoStyle": {
      "resolution": "1920x1080",
      "fps": 30
    },
    "defaultVoice": "alloy",
    "fontFamily": "Montserrat"
  }
}
```

#### List Channels

```http
GET /channel
```

#### Get Channel

```http
GET /channel/:channelId
```

#### Update Channel

```http
PUT /channel/:channelId
Content-Type: application/json

{
  "settings": {
    "defaultVoice": "nova"
  }
}
```

---

### 📦 Batch Processing

#### Create Batch

```http
POST /batch
Content-Type: application/json

{
  "videos": [
    {
      "id": "video-001",
      "generateScript": true,
      "scriptPrompt": "AI in healthcare",
      "voiceOptions": { "voice": "alloy" }
    },
    {
      "id": "video-002",
      "text": "Pre-written script here",
      "imagePrompts": [
        { "prompt": "Medical AI technology" }
      ]
    }
  ],
  "batchConfig": {
    "channelId": "tech-channel-001"
  },
  "priority": "high"
}
```

#### Get Batch Status

```http
GET /batch/:batchId
```

#### List All Batches

```http
GET /batch
```

---

### 🔍 Queue Management

#### Get All Queues Status

```http
GET /queue
```

**Response:**
```json
{
  "success": true,
  "queues": {
    "scriptGeneration": {
      "waiting": 2,
      "active": 1,
      "completed": 45,
      "failed": 3
    },
    "voiceGeneration": { ... },
    "imageGeneration": { ... }
  }
}
```

#### Get Specific Queue Status

```http
GET /queue/:queueName
```

#### Pause Queue

```http
POST /queue/:queueName/pause
```

#### Resume Queue

```http
POST /queue/:queueName/resume
```

#### Clean Queue (Remove completed/failed jobs)

```http
POST /queue/:queueName/clean
Content-Type: application/json

{
  "grace": 3600000
}
```

---

## 🔄 Complete Workflow Example

### Creating a Video from Scratch

```javascript
// Step 1: Generate Script
const scriptResponse = await fetch('http://localhost:3000/api/v2/script/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Create a 90-second video about quantum computing breakthroughs',
    options: {
      tone: 'informative',
      length: 'medium',
      style: 'professional'
    },
    projectId: 'quantum-video-001'
  })
});

const { jobId: scriptJobId } = await scriptResponse.json();

// Wait for job completion...
const scriptResult = await waitForJob('script', scriptJobId);

// Step 2: Generate Voice
const voiceResponse = await fetch('http://localhost:3000/api/v2/voice/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: scriptResult.result.script,
    voice: 'nova',
    speed: 1.0,
    projectId: 'quantum-video-001'
  })
});

// Step 3: Generate Images
const imageResponse = await fetch('http://localhost:3000/api/v2/image/generate-multiple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompts: [
      { prompt: 'Quantum computer processor glowing blue' },
      { prompt: 'Scientists working on quantum technology' },
      { prompt: 'Futuristic quantum laboratory' }
    ],
    projectId: 'quantum-video-001'
  })
});

// Step 4: Generate Final Video (use existing FFmpeg endpoint)
// ... existing video generation logic
```

---

## 📊 Monitoring

### CLI Queue Monitor

Monitor all queues in real-time:

```bash
npm run queue:monitor
```

This displays:
- ⏳ Waiting jobs
- ▶️ Active jobs
- ✅ Completed jobs
- ❌ Failed jobs
- Overall statistics

### API Monitoring

```javascript
// Get all queues status
GET /api/v2/queue

// Get specific job details
GET /api/v2/queue/:queueName/job/:jobId
```

---

## 🗂 Storage Structure

```
storage/
├── channels/         # Channel configurations
├── templates/        # Video templates
├── projects/         # Individual video projects
└── batches/          # Batch processing records
```

Each entity is stored as a JSON file for easy access and version control.

---

## 🔐 Security Notes

1. **API Keys**: Never commit `.env` file to version control
2. **Redis**: Use password authentication in production
3. **Rate Limiting**: Consider adding rate limiting middleware
4. **CORS**: Configure CORS for production use
5. **Input Validation**: All inputs are validated server-side

---

## 🐛 Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis if not running
redis-server
```

### Queue Jobs Stuck
```bash
# Clean stuck jobs via API
POST /api/v2/queue/:queueName/clean

# Or restart the queue
POST /api/v2/queue/:queueName/pause
POST /api/v2/queue/:queueName/resume
```

### API Key Errors
- Verify all API keys are correctly set in `.env`
- Check API key validity with providers
- Review API usage limits

---

## 📈 Performance Tips

1. **Concurrent Jobs**: Adjust `QUEUE_MAX_CONCURRENT_JOBS` based on CPU/RAM
2. **Redis Memory**: Monitor Redis memory usage for large queues
3. **Cleanup**: Regularly clean completed jobs to free memory
4. **Batch Size**: Use batch processing for multiple videos
5. **Priorities**: Use job priorities for urgent tasks

---

## 🔮 Future Enhancements

- [ ] Web dashboard for queue monitoring
- [ ] Webhook notifications for job completion
- [ ] Advanced retry strategies
- [ ] Multi-language support
- [ ] Video preview generation
- [ ] S3/Cloud storage integration

---

## 📞 Support

For issues or questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [your-docs-url]
- Email: support@example.com

---

**Version:** 2.0.0  
**Last Updated:** January 2025

