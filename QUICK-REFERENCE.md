# Quick Reference Card - Video Generator v2.0

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Start Redis
redis-server

# 3. Configure (create .env)
cp .env.template .env
# Add your API keys

# 4. Start Server
node server-new.js

# 5. Monitor (optional)
npm run queue:monitor
```

---

## 📡 Essential Endpoints

### Health & Status
```bash
GET  /api/health                      # Server health
GET  /api/v2/queue                    # All queues status
```

### Script Generation
```bash
POST /api/v2/script/generate          # Generate script
GET  /api/v2/script/job/:jobId        # Check status
```

### Voice Generation
```bash
POST /api/v2/voice/generate           # Generate voice
GET  /api/v2/voice/list               # Available voices
```

### Image Generation
```bash
POST /api/v2/image/generate           # Single image
POST /api/v2/image/generate-multiple  # Multiple images
```

### Batch Processing
```bash
POST /api/v2/batch                    # Create batch
GET  /api/v2/batch/:batchId           # Check status
```

### Channel Management
```bash
POST /api/v2/channel                  # Create channel
GET  /api/v2/channel                  # List all
GET  /api/v2/channel/:id              # Get one
PUT  /api/v2/channel/:id              # Update
DELETE /api/v2/channel/:id            # Delete
```

---

## 🔑 Environment Variables

```bash
# Required
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-...
FAL_AI_API_KEY=...
GENAIPRO_API_KEY=...
ASSEMBLYAI_API_KEY=...

# Optional
PORT=3000
QUEUE_MAX_CONCURRENT_JOBS=3
QUEUE_JOB_TIMEOUT=1800000
```

---

## 📊 Queue Names

```javascript
scriptGeneration    // Claude script generation
voiceGeneration     // Voice synthesis
imageGeneration     // AI image generation
videoProcessing     // FFmpeg video processing
batchProcessing     // Batch operations
transcription       // AssemblyAI transcription
```

---

## 🎯 Job Priorities

```javascript
LOW: 1
NORMAL: 5
HIGH: 10
URGENT: 20
```

---

## 📝 Example Requests

### Generate Script
```bash
curl -X POST http://localhost:3000/api/v2/script/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a 60-second video about AI",
    "options": {"tone": "friendly", "length": "medium"}
  }'
```

### Generate Voice
```bash
curl -X POST http://localhost:3000/api/v2/voice/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "voice": "alloy",
    "speed": 1.0
  }'
```

### Generate Image
```bash
curl -X POST http://localhost:3000/api/v2/image/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic AI brain",
    "width": 1920,
    "height": 1080
  }'
```

### Create Batch
```bash
curl -X POST http://localhost:3000/api/v2/batch \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      {"scriptPrompt": "AI topic 1"},
      {"scriptPrompt": "AI topic 2"}
    ]
  }'
```

---

## 🛠 Common Commands

### Redis
```bash
redis-server                  # Start Redis
redis-cli ping                # Test connection
redis-cli FLUSHALL            # Clear all data (DEV ONLY!)
```

### Server
```bash
node server-new.js            # Start v2.0 server
node server.js                # Start legacy server
npm start                     # Start (default)
npm run dev                   # Dev mode (nodemon)
npm run queue:monitor         # Monitor queues
```

### Queue Management
```bash
# Pause queue
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/pause

# Resume queue
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/resume

# Clean queue
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/clean
```

---

## 📂 File Locations

```
src/config/          # Configurations
src/controllers/     # API controllers
src/services/        # Service layer
src/queues/          # Queue system
src/routes/          # API routes
storage/            # JSON storage
  ├── channels/     # Channel configs
  ├── templates/    # Video templates
  ├── projects/     # Projects
  └── batches/      # Batch records
```

---

## 🔍 Monitoring

### CLI Monitor
```bash
npm run queue:monitor
```

### API Monitoring
```bash
# All queues
curl http://localhost:3000/api/v2/queue

# Specific queue
curl http://localhost:3000/api/v2/queue/scriptGeneration

# Job status
curl http://localhost:3000/api/v2/script/job/:jobId
```

---

## 🐛 Quick Fixes

### Redis Connection Failed
```bash
redis-server
```

### Port Already in Use
```bash
# Change in .env
PORT=3001
```

### Jobs Stuck
```bash
curl -X POST http://localhost:3000/api/v2/queue/scriptGeneration/clean
```

### API Key Invalid
```bash
# Check .env file
# Verify with provider
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `README-V2.md` | Full API documentation |
| `SETUP-GUIDE-V2.md` | Detailed setup guide |
| `MIGRATION-GUIDE.md` | v1→v2 migration |
| `API-EXAMPLES.md` | 50+ examples |
| `QUICK-REFERENCE.md` | This cheat sheet |

---

## 🎨 Available Voices

```
alloy    - Neutral, balanced
echo     - Deep, authoritative  
fable    - Warm, storytelling
onyx     - Deep, professional
nova     - Energetic, engaging
shimmer  - Soft, pleasant
```

---

## 🔄 Job States

```
waiting     - Queued, not started
active      - Currently processing
completed   - Finished successfully
failed      - Error occurred
delayed     - Scheduled for later
paused      - Queue paused
```

---

## 💾 Storage Structure

### Channel Config
```json
{
  "id": "...",
  "name": "Channel Name",
  "settings": {
    "defaultVoice": "alloy",
    "fontFamily": "Montserrat"
  }
}
```

### Template Config
```json
{
  "id": "...",
  "name": "Template Name",
  "settings": {
    "videoDuration": "60",
    "voiceSettings": {...}
  }
}
```

---

## ⚡ Performance Tips

- Set `QUEUE_MAX_CONCURRENT_JOBS` based on CPU
- Use batch processing for multiple videos
- Clean completed jobs regularly
- Monitor Redis memory
- Use priorities for urgent tasks

---

## 🔐 Security Notes

- ✅ Never commit `.env` file
- ✅ Use Redis password in production
- ✅ Validate all inputs
- ✅ Configure CORS properly
- ✅ Add rate limiting

---

## 📞 Need Help?

1. Check documentation files
2. Examine `storage/` examples
3. Use queue monitor: `npm run queue:monitor`
4. Test with curl examples above

---

**Version:** 2.0.0  
**Print this for quick reference!** 📄

