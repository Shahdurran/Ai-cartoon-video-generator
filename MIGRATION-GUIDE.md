# Migration Guide: v1.0 → v2.0

## Overview

This guide helps you migrate from the original video generator (v1.0) to the new queue-based system (v2.0).

**Good News:** Both versions can run side-by-side! Your existing code continues to work.

---

## What's New in v2.0?

### Architecture Changes

| v1.0 (Old) | v2.0 (New) |
|------------|------------|
| Direct processing | Bull queue with Redis |
| Single video at a time | Concurrent processing |
| Manual retry | Automatic retry with backoff |
| No job tracking | Full job lifecycle tracking |
| Limited integrations | Multiple AI service integrations |

### New Services

1. **Claude API** - AI script generation
2. **Fal.AI** - Advanced image generation  
3. **Genaipro.vn** - Primary voice generation
4. **Fal.AI Voice** - Fallback voice generation
5. **AssemblyAI** - Professional transcription (already existed, now integrated with queues)

### New Features

- ✅ Job queue management
- ✅ Batch processing
- ✅ Channel configurations
- ✅ Video templates
- ✅ Project management
- ✅ Real-time monitoring
- ✅ Automatic retry logic
- ✅ Priority-based processing

---

## Running Both Versions

### Option 1: Keep Original Server (Recommended)

Your original `server.js` continues to work as-is. To use v2.0 features, just add new endpoints:

```javascript
// server.js (your existing file)
const express = require("express");
const app = express();

// ... your existing code ...

// Add v2.0 routes (optional)
const apiRoutesV2 = require("./src/routes/apiRoutes");
app.use("/api/v2", apiRoutesV2);

// Your existing endpoints still work!
app.post("/generate-video", async (req, res) => {
  // existing implementation
});

app.listen(3000);
```

### Option 2: Use New Server

Use the new `server-new.js` which includes everything:

```bash
# Start new server (includes v1 compatibility)
node server-new.js

# Old endpoints work on /api/*
# New endpoints on /api/v2/*
```

---

## API Endpoint Comparison

### Video Generation

**v1.0 (Still Works):**
```http
POST /generate-video
POST /api/generate-video-enhanced

Body: {
  audioUrl: "...",
  imageUrl: "...",
  useAssemblyAI: true
}
```

**v2.0 (New):**
```http
# Complete workflow using queues
POST /api/v2/script/generate      # Generate script
POST /api/v2/voice/generate       # Generate voice
POST /api/v2/image/generate       # Generate images
POST /api/video/generate-video    # Generate video (uses existing service)
```

### Batch Processing

**v1.0:** Not available (had to call endpoint multiple times)

**v2.0:**
```http
POST /api/v2/batch

Body: {
  videos: [
    { scriptPrompt: "...", voiceOptions: {...} },
    { scriptPrompt: "...", voiceOptions: {...} }
  ]
}
```

---

## Code Migration Examples

### Example 1: Simple Video Generation

**Before (v1.0):**
```javascript
const response = await fetch('/generate-video', {
  method: 'POST',
  body: JSON.stringify({
    audioUrl: 'http://example.com/audio.mp3',
    imageUrl: 'http://example.com/image.jpg',
    useAssemblyAI: true
  })
});

const result = await response.json();
// Video is ready immediately
console.log(result.videoUrl);
```

**After (v2.0) - Still works the same way!**

But you can also use queues for better reliability:

```javascript
// Step 1: Generate voice from text
const voiceJob = await fetch('/api/v2/voice/generate', {
  method: 'POST',
  body: JSON.stringify({
    text: 'Your script here',
    voice: 'alloy'
  })
});

const { jobId } = await voiceJob.json();

// Step 2: Poll for completion (or use webhooks in the future)
const checkStatus = async () => {
  const status = await fetch(`/api/v2/voice/job/${jobId}`);
  const data = await status.json();
  
  if (data.state === 'completed') {
    return data.result.audioPath;
  } else if (data.state === 'failed') {
    throw new Error(data.failedReason);
  }
  
  // Still processing, check again
  await new Promise(resolve => setTimeout(resolve, 2000));
  return checkStatus();
};

const audioPath = await checkStatus();
```

### Example 2: Multiple Videos

**Before (v1.0):**
```javascript
// Had to process sequentially
for (const video of videos) {
  await fetch('/generate-video', {
    method: 'POST',
    body: JSON.stringify(video)
  });
}
```

**After (v2.0):**
```javascript
// Process all in parallel with batch
await fetch('/api/v2/batch', {
  method: 'POST',
  body: JSON.stringify({
    videos: videos,
    batchConfig: { channelId: 'my-channel' }
  })
});

// All videos process concurrently!
```

---

## Configuration Migration

### Environment Variables

**v1.0:**
```bash
PORT=3000
ASSEMBLYAI_API_KEY=...
```

**v2.0 (Add these):**
```bash
# Existing from v1.0
PORT=3000
ASSEMBLYAI_API_KEY=...

# New for v2.0
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=...
FAL_AI_API_KEY=...
GENAIPRO_API_KEY=...
QUEUE_MAX_CONCURRENT_JOBS=3
```

---

## New Capabilities

### 1. Script Generation (New!)

```javascript
// Generate scripts with AI
const script = await fetch('/api/v2/script/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Create a video about quantum computing',
    options: {
      tone: 'informative',
      length: 'medium',
      style: 'professional'
    }
  })
});
```

### 2. Image Generation (New!)

```javascript
// Generate images with AI
const image = await fetch('/api/v2/image/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'A futuristic quantum computer',
    width: 1920,
    height: 1080
  })
});
```

### 3. Channel Management (New!)

```javascript
// Create reusable channel configs
const channel = await fetch('/api/v2/channel', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Tech Channel',
    settings: {
      defaultVoice: 'alloy',
      fontFamily: 'Montserrat',
      useParticleEffect: true
    }
  })
});
```

### 4. Queue Monitoring (New!)

```bash
# Terminal-based monitoring
npm run queue:monitor

# API-based monitoring
GET /api/v2/queue
```

---

## Benefits of Migration

### Reliability
- ✅ Automatic retries on failure
- ✅ Job persistence (survives server restarts)
- ✅ Better error tracking

### Performance
- ✅ Process multiple videos concurrently
- ✅ Queue management prevents server overload
- ✅ Priority-based processing

### Features
- ✅ AI-powered script generation
- ✅ AI image generation
- ✅ Multiple voice providers
- ✅ Batch processing
- ✅ Channel management

### Monitoring
- ✅ Real-time queue status
- ✅ Job progress tracking
- ✅ Failure diagnostics

---

## Step-by-Step Migration Plan

### Phase 1: Setup (No code changes required)
1. ✅ Install Redis
2. ✅ Run `npm install` (installs new dependencies)
3. ✅ Create `.env` file with new variables
4. ✅ Test: `node server-new.js`

### Phase 2: Coexistence (Both versions run)
1. ✅ Keep using v1.0 endpoints
2. ✅ Test v2.0 endpoints on `/api/v2/*`
3. ✅ Monitor queues with `npm run queue:monitor`

### Phase 3: Gradual Adoption
1. ✅ Use v2.0 for new features (script generation, batch processing)
2. ✅ Slowly migrate video generation to queue-based approach
3. ✅ Set up channels and templates

### Phase 4: Full Migration (Optional)
1. ✅ Update all clients to use v2.0 endpoints
2. ✅ Remove old endpoint handlers (keep compatibility layer)
3. ✅ Enjoy improved reliability and features!

---

## Troubleshooting

### "Cannot connect to Redis"
```bash
# Install and start Redis
redis-server

# Test connection
redis-cli ping
```

### "Jobs are stuck in queue"
```bash
# Clean the queue
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/clean

# Or restart Redis (development only)
redis-cli FLUSHALL
```

### "Old endpoints stopped working"
- Check that you're using the correct server file
- Verify both old and new routes are registered
- Check logs for errors

---

## Rollback Plan

If you need to rollback to v1.0:

1. **Stop new server:**
   ```bash
   # Kill server-new.js
   ```

2. **Start original server:**
   ```bash
   node server.js
   ```

3. **Your original functionality is preserved!**

All v1.0 code remains untouched and functional.

---

## Getting Help

- 📖 **Full API Docs:** `README-V2.md`
- 🚀 **Setup Guide:** `SETUP-GUIDE-V2.md`
- 🔍 **Monitor Queues:** `npm run queue:monitor`
- 📝 **Examples:** Check `storage/` folder for example configs

---

## Summary

**Key Points:**
1. ✅ **No Breaking Changes** - v1.0 endpoints still work
2. ✅ **Gradual Migration** - Adopt v2.0 at your own pace
3. ✅ **New Features** - AI integrations, batch processing, monitoring
4. ✅ **Better Reliability** - Queue-based processing with automatic retries
5. ✅ **Easy Rollback** - Can always go back to v1.0

**Recommendation:** Start with coexistence mode, test v2.0 features, then gradually migrate.

---

**Questions?** Check the other documentation files or examine the example storage files in `storage/` directory.

