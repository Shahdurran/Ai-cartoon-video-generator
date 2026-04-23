# 🎬 FFmpeg Video Generator - Windows 11 Installation

## Welcome!

This package contains everything you need to install and run the FFmpeg Video Generator on your Windows 11 machine.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Open PowerShell as Administrator

1. Press `Windows + X`
2. Select **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**

### Step 2: Run the Setup Script

```powershell
.\setup-windows-client.ps1
```

This will automatically:
- ✅ Check and install all required software
- ✅ Set up Docker and Redis
- ✅ Install dependencies
- ✅ Create configuration files
- ✅ Prepare the system

**Time required**: 10-15 minutes

### Step 3: Add Your API Keys

After setup completes:

```powershell
notepad .env
```

Replace these lines with your actual API keys (provided separately):
```env
ANTHROPIC_API_KEY=your_actual_key_here
FAL_AI_API_KEY=your_actual_key_here
GENAIPRO_API_KEY=your_actual_key_here
ASSEMBLYAI_API_KEY=your_actual_key_here
```

Save and close.

---

## ✅ Verify Installation

```powershell
.\verify-installation.ps1
```

You should see all green checkmarks ✅

---

## 🎯 Start the Application

```powershell
.\start-both.bat
```

This opens two windows:
- Backend Server (localhost:3000)
- Frontend UI (localhost:5173)

**Open your browser** to: http://localhost:5173

---

## 📚 Need More Help?

### Quick Start Guide
See: **[CLIENT_QUICK_START.md](CLIENT_QUICK_START.md)** - 5-step detailed guide

### Complete Documentation
See: **[DEPLOYMENT_INDEX.md](DEPLOYMENT_INDEX.md)** - Find any information

### Troubleshooting
See: **[WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md](WINDOWS_11_CLIENT_DEPLOYMENT_GUIDE.md)** - Troubleshooting section

---

## 🔧 Common Issues

### "Docker not running"
```powershell
# Open Docker Desktop from Start menu
# Wait for it to start, then run setup again
```

### "Port already in use"
```powershell
# Find and stop the process
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

### "API key invalid"
```powershell
# Re-open .env and verify keys are correct
notepad .env
# No spaces, no quotes around values
```

---

## 📞 Support

If you encounter any issues:
1. Run `.\verify-installation.ps1` for diagnostics
2. Check the troubleshooting section in documentation
3. Contact your developer with error messages

---

## ✨ What You Can Do

After installation, you can:
- ✅ Generate AI-powered videos
- ✅ Create custom scripts
- ✅ Add voice narration
- ✅ Include subtitles and effects
- ✅ Batch process multiple videos
- ✅ Monitor progress in real-time

---

## 🎯 System Requirements

- Windows 11 (64-bit)
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space
- Administrator access
- Internet connection

---

**Ready to create amazing videos!** 🚀

Start with: `.\setup-windows-client.ps1`

---

**Version**: 2.0.0  
**Last Updated**: November 4, 2025




