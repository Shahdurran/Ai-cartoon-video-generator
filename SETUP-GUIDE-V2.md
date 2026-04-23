# Setup Guide - Video Generator v2.0

## Quick Start Guide

### 1. Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js 16+ (`node --version`)
- ✅ Redis 6+ (`redis-server --version`)
- ✅ FFmpeg (`ffmpeg -version`)
- ✅ Python 3.8+ (for Whisper, `python --version`)

### 2. Install Redis

#### Windows
```bash
# Download Redis for Windows
# Visit: https://github.com/tporadowski/redis/releases
# Download and install the .msi file

# Or use WSL
wsl --install
sudo apt-get install redis-server
```

#### Linux
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### macOS
```bash
brew install redis
brew services start redis
```

### 3. Verify Redis Installation

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

### 4. Clone and Install

```bash
# Navigate to your project
cd "d:\ffmpeg jim"

# Install Node.js dependencies
npm install

# This will install:
# - Bull (queue management)
# - ioredis (Redis client)
# - @anthropic-ai/sdk (Claude API)
# - axios (HTTP client)
# - dotenv (environment variables)
# - uuid (unique IDs)
# - And all existing dependencies
```

### 5. Environment Configuration

```bash
# Copy the template (manually since .env is in .gitignore)
# Create a new file: .env

# Add the following content to .env:
```

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
FAL_AI_API_KEY=your_fal_ai_api_key_here
GENAIPRO_API_KEY=your_genaipro_api_key_here
GENAIPRO_BASE_URL=https://api.genaipro.vn/v1

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_THREADS=4

# Storage Configuration
STORAGE_PATH=./storage
TEMP_DIR=./temp
OUTPUT_DIR=./public/videos

# Queue Configuration
QUEUE_MAX_CONCURRENT_JOBS=3
QUEUE_JOB_TIMEOUT=1800000
QUEUE_JOB_ATTEMPTS=3

# Batch Processing
BATCH_SIZE=10
BATCH_CONCURRENCY=2
```

### 6. Get API Keys

#### Claude (Anthropic)
1. Visit: https://console.anthropic.com/
2. Sign up/login
3. Go to API Keys section
4. Create new key
5. Copy to `.env` as `ANTHROPIC_API_KEY`

#### AssemblyAI
1. Visit: https://www.assemblyai.com/
2. Sign up/login
3. Go to Dashboard
4. Copy API key
5. Add to `.env` as `ASSEMBLYAI_API_KEY`

#### Fal.AI
1. Visit: https://fal.ai/
2. Sign up/login
3. Generate API key
4. Add to `.env` as `FAL_AI_API_KEY`

#### Genaipro.vn
1. Visit: https://genaipro.vn/
2. Sign up/login
3. Get API credentials
4. Add to `.env` as `GENAIPRO_API_KEY`

### 7. Directory Structure Check

Your project should now have:

```
d:\ffmpeg jim\
├── src/
│   ├── config/
│   │   ├── api.config.js        ✅ NEW
│   │   ├── queue.config.js      ✅ NEW
│   │   └── config.js            (existing)
│   ├── controllers/
│   │   ├── scriptController.js  ✅ NEW
│   │   ├── voiceController.js   ✅ NEW
│   │   ├── imageController.js   ✅ NEW
│   │   ├── channelController.js ✅ NEW
│   │   ├── batchController.js   ✅ NEW
│   │   ├── queueController.js   ✅ NEW
│   │   └── videoController.js   (existing)
│   ├── services/
│   │   ├── claudeService.js     ✅ NEW
│   │   ├── voiceService.js      ✅ NEW
│   │   ├── imageService.js      ✅ NEW
│   │   ├── storageService.js    ✅ NEW
│   │   └── (existing services)
│   ├── queues/
│   │   ├── index.js             ✅ NEW
│   │   ├── monitor.js           ✅ NEW
│   │   ├── setupProcessors.js   ✅ NEW
│   │   └── processors/
│   │       ├── scriptProcessor.js      ✅ NEW
│   │       ├── voiceProcessor.js       ✅ NEW
│   │       ├── imageProcessor.js       ✅ NEW
│   │       ├── videoProcessor.js       ✅ NEW
│   │       ├── batchProcessor.js       ✅ NEW
│   │       └── transcriptionProcessor.js ✅ NEW
│   ├── routes/
│   │   ├── apiRoutes.js         ✅ NEW
│   │   ├── index.js             ✅ NEW
│   │   └── videoRoutes.js       (existing)
│   ├── utils/                   (existing)
│   └── app.js                   ✅ NEW
├── storage/                     ✅ NEW
│   ├── channels/
│   │   └── example-channel.json
│   ├── templates/
│   │   └── example-template.json
│   ├── projects/
│   │   └── example-project.json
│   └── batches/
│       └── example-batch.json
├── server.js                    (existing - keep for backward compatibility)
├── server-new.js                ✅ NEW (v2.0 server)
├── package.json                 ✅ UPDATED
├── .env                         ✅ CREATE THIS
├── README-V2.md                 ✅ NEW
└── SETUP-GUIDE-V2.md           ✅ NEW (this file)
```

### 8. Test the Setup

#### Test 1: Start Redis
```bash
# Terminal 1
redis-server
```

#### Test 2: Start the Server
```bash
# Terminal 2
node server-new.js

# You should see:
# 🚀 FFmpeg Video Generator Server v2.0.0
# 📍 Server running on: http://0.0.0.0:3000
```

#### Test 3: Monitor Queues
```bash
# Terminal 3
npm run queue:monitor

# You should see a live dashboard of all queues
```

#### Test 4: Health Check
```bash
curl http://localhost:3000/api/health

# Should return:
# {
#   "status": "ok",
#   "timestamp": "...",
#   "uptime": 123.45,
#   "version": "2.0.0"
# }
```

#### Test 5: Queue Status
```bash
curl http://localhost:3000/api/v2/queue

# Should return all queues with their status
```

### 9. Run Your First Job

#### Test Script Generation
```bash
curl -X POST http://localhost:3000/api/v2/script/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a 30-second video about coffee",
    "options": {
      "tone": "friendly",
      "length": "short"
    }
  }'

# Response will include a jobId
# Check job status:
curl http://localhost:3000/api/v2/script/job/[jobId]
```

### 10. Backward Compatibility

The old endpoints still work! Your existing setup remains functional:

```bash
# Old endpoint (still works)
POST /api/generate-video

# New v2 endpoints
POST /api/v2/script/generate
POST /api/v2/voice/generate
POST /api/v2/image/generate
```

---

## Common Issues and Solutions

### Issue: Redis connection refused

**Solution:**
```bash
# Make sure Redis is running
redis-cli ping

# If not running, start it:
# Windows (WSL): sudo service redis-server start
# Linux: sudo systemctl start redis
# macOS: brew services start redis
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Change port in .env
PORT=3001

# Or kill the process using port 3000
# Windows: netstat -ano | findstr :3000
# Linux/Mac: lsof -ti:3000 | xargs kill
```

### Issue: API key errors

**Solution:**
- Double-check API keys in `.env`
- Ensure no quotes around values
- Verify keys are active with the providers

### Issue: Queue jobs stuck

**Solution:**
```bash
# Clean the queue via API
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/clean

# Or restart Redis
redis-cli FLUSHALL
```

---

## Development vs Production

### Development Setup
```bash
NODE_ENV=development
npm run dev  # Uses nodemon for auto-restart
```

### Production Setup
```bash
NODE_ENV=production
npm run deploy  # Uses PM2

# Monitor with PM2
pm2 logs video-generator
pm2 monit
```

---

## Next Steps

1. ✅ Read `README-V2.md` for API documentation
2. ✅ Check `storage/` folder for example configurations
3. ✅ Explore the queue monitor: `npm run queue:monitor`
4. ✅ Test endpoints with Postman or curl
5. ✅ Create your first channel configuration
6. ✅ Try batch processing multiple videos

---

## Need Help?

- 📖 Full API docs: `README-V2.md`
- 🔍 Check logs: `console.log` statements everywhere
- 🐛 Debug mode: Set `NODE_ENV=development` in `.env`
- 💬 Queue monitor: `npm run queue:monitor`

---

**Congratulations! You're ready to use Video Generator v2.0! 🎉**

