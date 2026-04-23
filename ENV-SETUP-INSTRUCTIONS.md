# .env File Setup Instructions

## ⚠️ Important: Create Your .env File

The `.env` file is **not tracked by git** for security reasons. You need to create it manually.

---

## 📝 Step-by-Step Instructions

### 1. Create the .env file

In your project root directory (`d:\ffmpeg jim\`), create a new file named `.env`

### 2. Copy this content into your .env file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Keys - Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-api03-W-VNBY5VOwgIXy6J3vd-otNeKgSpcLA6OPP08p4ncai5iZnvYZzwKkg44EyV7_Usgia08sBrqZZDjaPMGiimXA

# API Keys - Fal.AI (Image & Voice Fallback)
FAL_AI_API_KEY=f7da4756-9ee6-43ac-9d72-46da7241d6d4:675c98773f740d4bab4d3c731f301bb3

# API Keys - Genaipro.vn (Primary Voice Generation)
GENAIPRO_API_KEY=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18ydmlCa3pCZzdVUUJ4eW9FTHh4WmN4Q1FWc0MiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL2dlbmFpcHJvLnZuIiwiZXhwIjoxNzY4OTA0OTk5LCJpYXQiOjE3NjExMjg5OTksImlzcyI6Imh0dHBzOi8vY2xlcmsuZ2VuYWlwcm8udm4iLCJqdGkiOiIxNWE3ZTgzNzRmZjU2NmEzNmQ3NiIsIm5iZiI6MTc2MTEyODk5NCwicHVibGljX21ldGFkYXRhIjp7ImNoYXRncHRfYWNjb3VudF9pZCI6IjRjN2VhM2EwLWY1MzgtNDA3MC1iYWZkLTRmN2RlODdhMzY1ZCIsInJvbGUiOiJ1c2VyIiwidXNlcl9kYl9pZCI6ImZhZTI1MWNiLTdmOGQtNGViYi05MWIwLTAzYWFiODZjODNlZCJ9LCJzdWIiOiJ1c2VyXzMzVnZKMDU5b3hlSG1SYlh6dFlwOERWMUs3YiIsInVzZXJuYW1lIjoiamltZ29ybGljaDEyMyJ9.fGfI2UIRF1C3hyyy6g91zRhzXB1jOm7VKm_7NjpqQTGB9h2FureLd9LkoWHdalX7RXpUAmnjERClZ2IvWkeBYhRJtLnRV5lsv5Ai_xVziXZtzfaqd9TT1fQWOjV-srlsCZVOPXz4htucbustwHVN5Oc0kEFiRdriVAH-L8crQ3VwQVR4MkqLJsdF-a2DfVa5q2Hl1SL-7C8MpCrD-1ZcNvSfs_ZRH2qCVMGNE33qH31RjmWExnX_wKIckNeBxc_SsL9j45-N0C9Zr_MdH7N4LRqU_0aFNH5-fD6Ade1UQNUrZD42Gl8OlzkiRLvZeK4qijFq4dXN5vKaDwu3XGmDDA
GENAIPRO_BASE_URL=https://api.genaipro.vn

# API Keys - AssemblyAI (Transcription)
ASSEMBLYAI_API_KEY=d12d8379fdbf49a58169c01a50ea8d56

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_THREADS=4

# Path Configuration
VIDEO_BANK_PATH=./video-bank
OUTPUT_PATH=./output
TEMP_PATH=./temp
STORAGE_PATH=./storage

# Queue Configuration
QUEUE_SCRIPT_CONCURRENCY=3
QUEUE_VOICE_CONCURRENCY=2
QUEUE_IMAGE_CONCURRENCY=2
QUEUE_VIDEO_CONCURRENCY=1
QUEUE_JOB_TIMEOUT=300000
QUEUE_MAX_CONCURRENT_JOBS=3
QUEUE_JOB_ATTEMPTS=3

# Batch Processing
BATCH_SIZE=10
BATCH_CONCURRENCY=2

# Google Fonts API (optional)
GOOGLE_FONTS_API_KEY=
```

---

## 🔍 Configuration Breakdown

### Server Settings
- **PORT**: Server port (default: 3000)
- **NODE_ENV**: Environment mode (development/production)

### Redis Settings
- **REDIS_HOST**: Redis server host (default: localhost)
- **REDIS_PORT**: Redis port (default: 6379)
- **REDIS_PASSWORD**: Leave empty for local development
- **REDIS_DB**: Redis database number (default: 0)

### API Keys
All your API keys are configured and ready to use:

- ✅ **ANTHROPIC_API_KEY**: Claude API for script generation
- ✅ **FAL_AI_API_KEY**: Fal.AI for image generation
- ✅ **GENAIPRO_API_KEY**: Genaipro.vn for voice generation
- ✅ **ASSEMBLYAI_API_KEY**: AssemblyAI for transcription

### Paths
- **VIDEO_BANK_PATH**: Source videos/assets directory
- **OUTPUT_PATH**: Final rendered videos directory
- **TEMP_PATH**: Temporary processing files
- **STORAGE_PATH**: JSON database files

### Queue Settings
- **QUEUE_SCRIPT_CONCURRENCY**: Concurrent script generation jobs (3)
- **QUEUE_VOICE_CONCURRENCY**: Concurrent voice generation jobs (2)
- **QUEUE_IMAGE_CONCURRENCY**: Concurrent image generation jobs (2)
- **QUEUE_VIDEO_CONCURRENCY**: Concurrent video processing jobs (1)
- **QUEUE_JOB_TIMEOUT**: Job timeout in ms (5 minutes)
- **QUEUE_JOB_ATTEMPTS**: Retry attempts (3)

---

## ✅ Verification

After creating your `.env` file:

1. **Check file exists:**
   ```bash
   # Windows PowerShell
   Test-Path .env
   
   # Should return: True
   ```

2. **Verify it's ignored by git:**
   ```bash
   git status
   # .env should NOT appear in the output
   ```

3. **Start the server to test:**
   ```bash
   node server-new.js
   ```
   
   If API keys are loaded correctly, you'll see:
   - ✅ No warnings about missing API keys
   - ✅ Server starts successfully
   - ✅ All features available

---

## 🔐 Security Notes

- ✅ `.env` is in `.gitignore` - will NOT be committed to git
- ✅ All API keys are private and secure
- ⚠️ Never share your `.env` file
- ⚠️ Never commit `.env` to version control
- ⚠️ Use different keys for production

---

## 🆘 Troubleshooting

### Problem: API key warnings on startup

**Solution:** 
- Verify `.env` file is in project root
- Check for typos in variable names
- Ensure no spaces around `=` signs
- Make sure file is named exactly `.env` (not `.env.txt`)

### Problem: Can't create .env file

**Windows:**
```powershell
# Use PowerShell
New-Item -Path . -Name ".env" -ItemType "file"
```

**Alternative:**
- Create a text file named `env.txt`
- Rename it to `.env` (remove the .txt extension)
- Make sure "Show file extensions" is enabled in Windows

### Problem: Redis connection errors

**Solution:**
- Start Redis: `redis-server`
- Check Redis is running: `redis-cli ping`
- Verify REDIS_HOST and REDIS_PORT in `.env`

---

## 📝 Notes

- File is already configured with your actual API keys
- All paths are relative to project root
- Timeouts are in milliseconds
- Concurrency settings can be adjusted based on your CPU/RAM

---

**Ready to go!** 🚀

Once your `.env` file is created, you can start the server with:
```bash
node server-new.js
```

