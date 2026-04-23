# 🚀 Frontend Startup Checklist

Quick reference to get your video generation system running!

---

## ✅ Step 1: Start Backend Server

Open a terminal and run:

```bash
npm start
```

**Wait for:**
```
Server running on port 3000
✅ All required directories ensured
Queue processors initialized
```

---

## ✅ Step 2: Start Frontend Server

Open another terminal and run:

```bash
cd frontend
npm run dev
```

**Wait for:**
```
VITE v7.x.x ready in xxx ms
➜  Local:   http://localhost:5174/
```

**Note:** Port might be 5173, 5174, or 5175 - doesn't matter!

---

## ✅ Step 3: Open Browser

Navigate to the URL shown by Vite (usually):
- **http://localhost:5174**
- or **http://localhost:5173**

---

## ✅ Step 4: Verify Everything Works

### Check Dashboard Loads
- Should see stats: Channels, Active Jobs, Completed, Failed
- No CORS errors in console (F12)

### Check Channels Tab
- Click "Channels" in navigation
- Should load without errors
- Click "New Channel" to test form

---

## 🔧 Troubleshooting

### CORS Errors?
```
Access to XMLHttpRequest... has been blocked by CORS policy
```

**Fix:** Restart the backend server
```bash
# Stop backend (Ctrl+C)
npm start
```

### Backend Not Running?
```
GET http://localhost:3000/api/v2/channel net::ERR_FAILED
```

**Fix:** Start the backend
```bash
npm start
```

### Port Already in Use?
```
Port 3000 is already in use
```

**Fix:** Kill the process using port 3000
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Frontend Won't Start?
```
Error: Cannot find module...
```

**Fix:** Install dependencies
```bash
cd frontend
npm install
```

---

## 📋 Common Commands

### Start Both Servers
```bash
.\start-both.bat
```

### Stop Servers
- Press `Ctrl+C` in each terminal

### Restart Backend Only
```bash
# In backend terminal, press Ctrl+C then:
npm start
```

### Restart Frontend Only
```bash
# In frontend terminal, press Ctrl+C then:
npm run dev
```

### Build Frontend for Production
```bash
cd frontend
npm run build
```

---

## 🌐 Default URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Frontend UI | http://localhost:5173 or 5174 |
| API Health | http://localhost:3000/api/health |
| API Docs | http://localhost:3000/ |

---

## 📊 Quick Test

### Test Backend
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123,
  "version": "2.0.0"
}
```

### Test Frontend
Open browser DevTools Console (F12) and run:
```javascript
fetch('http://localhost:3000/api/v2/channel')
  .then(r => r.json())
  .then(d => console.log(d))
```

Should show channel list (might be empty).

---

## ✅ Success Checklist

- [ ] Backend running on port 3000
- [ ] Frontend running on port 5173/5174
- [ ] No CORS errors in console
- [ ] Dashboard shows stats
- [ ] Channels tab loads
- [ ] Can click "New Channel" button

---

## 🎉 You're Ready!

If all checks pass, you're ready to:
1. Create channels
2. Generate videos
3. Monitor the queue
4. Process batches

---

## 📖 Need More Help?

See these docs:
- `FRONTEND_QUICK_START.md` - Detailed startup guide
- `FRONTEND_SETUP_COMPLETE.md` - Complete technical docs
- `CORS_FIX.md` - CORS troubleshooting
- `FRONTEND_API_ENDPOINTS_FIX.md` - API reference

---

**Happy Video Generating! 🎬**

