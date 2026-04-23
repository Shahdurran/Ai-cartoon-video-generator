# 🚀 Client Quick Start Guide

## Windows 11 - Fast Setup in 5 Steps

This is a simplified quick start guide. For detailed instructions, see `WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md`.

---

## ⚡ Prerequisites

Before starting, make sure you have:
- ✅ **Windows 11** (64-bit)
- ✅ **Administrator access** on your computer
- ✅ **Stable internet connection**
- ✅ **10GB+ free disk space**

---

## 📋 5-Step Setup

### Step 1: Clone the Repository

Open PowerShell and run:

```powershell
cd D:\
git clone https://github.com/YOUR_REPO_URL/ffmpeg-video-generator.git
cd ffmpeg-video-generator
```

> **Note**: If Git is not installed, download from: https://git-scm.com/download/win

---

### Step 2: Run Automated Setup

**Right-click PowerShell → Run as Administrator**, then:

```powershell
.\setup-windows-client.ps1
```

This installs everything automatically:
- ✅ Checks/installs prerequisites
- ✅ Sets up Node.js dependencies
- ✅ Configures Docker & Redis
- ✅ Installs Python & Whisper
- ✅ Installs FFmpeg
- ✅ Creates directories and .env file

**Time required**: 10-15 minutes (depending on internet speed)

---

### Step 3: Add API Keys

After setup completes, open the `.env` file:

```powershell
notepad .env
```

Replace these placeholder values with your actual API keys:

```env
ANTHROPIC_API_KEY=your_actual_key_here
FAL_AI_API_KEY=your_actual_key_here
GENAIPRO_API_KEY=your_actual_key_here
ASSEMBLYAI_API_KEY=your_actual_key_here
```

**Save and close** the file.

> **Where do I get API keys?**  
> Your developer should provide these separately for security reasons.

---

### Step 4: Verify Installation

Run the verification script:

```powershell
.\verify-installation.ps1
```

You should see all green checkmarks ✅

If any checks fail, follow the suggested fixes in the output.

---

### Step 5: Start the Application

```powershell
.\start-both.bat
```

This opens **two windows**:
- **Backend Server** (port 3000)
- **Frontend UI** (port 5173)

**Open your browser** and go to:
```
http://localhost:5173
```

🎉 **You're ready to create videos!**

---

## 🎬 Creating Your First Video

1. Open http://localhost:5173 in your browser
2. Click **"New Video"** or select a channel
3. Enter video details:
   - Title
   - Script or let AI generate one
   - Choose background videos/music
   - Configure subtitles and effects
4. Click **"Generate Video"**
5. Monitor progress in real-time
6. Download your video when complete!

---

## 🛠️ Common Commands

### Start/Stop Services

```powershell
# Start both servers
.\start-both.bat

# Stop servers
# Close the command windows or press Ctrl+C

# Restart Redis
docker restart redis-video-gen
```

### Check Status

```powershell
# Verify everything is working
.\verify-installation.ps1

# Check Docker containers
docker ps

# Check Redis
docker exec redis-video-gen redis-cli ping
# Should return: PONG
```

### Run Tests

```powershell
# Test the entire pipeline
npm run test:pipeline

# Test video generation
npm run test:video

# Test API connections
npm run test:apis
```

---

## 🔧 Quick Troubleshooting

### Problem: "Docker not running"

**Solution**:
```powershell
# Open Docker Desktop from Start menu
# Wait for it to fully start (whale icon in tray)
# Then restart: .\start-both.bat
```

### Problem: "Redis connection failed"

**Solution**:
```powershell
# Start Redis container
docker start redis-video-gen

# Or recreate it
.\setup-docker-redis.ps1
```

### Problem: "Port 3000 already in use"

**Solution**:
```powershell
# Find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F

# Then restart
.\start-both.bat
```

### Problem: "API key invalid"

**Solution**:
1. Open `.env`: `notepad .env`
2. Verify API keys are correct (no spaces, no quotes)
3. Save the file
4. Restart the servers

### Problem: "FFmpeg not found"

**Solution**:
```powershell
# Install FFmpeg
.\install-ffmpeg.ps1

# Or manually download from:
# https://www.gyan.dev/ffmpeg/builds/
```

---

## 📚 Documentation

- **WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md** - Complete setup guide
- **DASHBOARD_USAGE_GUIDE.md** - How to use the web interface
- **API-EXAMPLES.md** - API documentation
- **QUICK_START_TESTING.md** - Testing guide

---

## 🆘 Getting Help

### Useful Commands

```powershell
# View installation log
notepad installation-log.txt

# Check system status
.\verify-installation.ps1

# View Docker logs
docker logs redis-video-gen

# Monitor job queue
npm run queue:monitor
```

### Configuration Files

- `.env` - Main configuration (API keys, paths)
- `package.json` - Backend dependencies
- `frontend/package.json` - Frontend dependencies

### Important Directories

- `output/` - Generated videos
- `temp/` - Temporary processing files
- `storage/` - Database (JSON files)
- `video-bank/` - Background videos
- `music-library/` - Background music

---

## ✅ Pre-Launch Checklist

Before using in production, verify:

- [ ] All prerequisites installed (Git, Node.js, Docker, Python, FFmpeg)
- [ ] Redis container running (`docker ps`)
- [ ] `.env` file exists with valid API keys
- [ ] Backend starts without errors (http://localhost:3000)
- [ ] Frontend accessible (http://localhost:5173)
- [ ] Test video generates successfully
- [ ] No errors in verification script

---

## 🎯 What's Next?

1. **Explore the Dashboard** - Try different video types and styles
2. **Create Channel Configs** - Set up branded video templates
3. **Upload Assets** - Add your own background videos and music
4. **Batch Generate** - Create multiple videos at once
5. **Monitor Queue** - Track video generation progress

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run `.\verify-installation.ps1` for diagnostics
3. Review `WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md`
4. Check `installation-log.txt` for error details
5. Contact your developer with error messages

---

## 🌟 Tips for Best Experience

### Performance
- Keep Docker Desktop running in the background
- Close unnecessary applications during video generation
- Use SSD storage for faster processing

### Storage
- Clean temp files regularly: `Remove-Item temp\* -Force`
- Archive old videos to free up space
- Monitor disk usage

### Maintenance
- Update dependencies monthly: `npm install`
- Restart Redis weekly: `docker restart redis-video-gen`
- Backup your `.env` file and channel configs

---

**You're all set! Happy video creating! 🎬✨**

---

**Last Updated**: November 4, 2025  
**Version**: 2.0.0  
**Platform**: Windows 11




