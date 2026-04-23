# Person Video Overlay System - Implementation Progress

## ✅ Completed (Backend)

### 1. Person Video Library Utility (`src/utils/personVideoLibrary.js`)
**Features:**
- Scan `./person-videos` folder
- Extract video metadata (duration, resolution, codec, FPS)
- **Alpha channel detection** (transparency check)
- Generate thumbnails automatically
- Validate videos (format, size limits, loop quality assessment)
- Cache results (5-minute timeout)
- Delete videos with thumbnails
- Get library statistics
- **FFmpeg overlay filter generation** (position, scale, opacity)
- **Chroma key filter** for green screen removal

**Key Methods:**
- `scanPersonVideos()` - Lists all person videos with metadata
- `getPersonVideoMetadata()` - Full video analysis
- `checkAlphaChannel()` - Detects transparency (yuva420p, rgba, etc.)
- `assessLoopQuality()` - Rates loop seamlessness (duration-based)
- `generatePersonVideoThumbnail()` - Auto-generates thumbnails
- `validatePersonVideo()` - Pre-upload validation
- `getOverlayFilter()` - Returns FFmpeg overlay parameters
- `getChromaKeyFilter()` - Green screen removal filter

### 2. Person Video Controller (`src/controllers/personVideoController.js`)
**API Endpoints:**
- `GET /api/v2/person-videos/scan` - List all videos
- `GET /api/v2/person-videos/stats` - Library statistics
- `POST /api/v2/person-videos/upload` - Upload new video (max 100MB)
- `DELETE /api/v2/person-videos/:filename` - Delete video
- `POST /api/v2/person-videos/thumbnail/:filename` - Regenerate thumbnail
- `GET /api/v2/person-videos/:filename` - Get video info
- `POST /api/v2/person-videos/refresh` - Clear cache and rescan

**Features:**
- Multer integration for file uploads
- Automatic filename sanitization
- Upload validation (size, format)
- Auto-thumbnail generation on upload
- Cache management

### 3. API Routes (`src/routes/apiRoutes.js`)
✅ All person video routes added to Express router

---

## ✅ Completed (Frontend)

### 1. API Client (`frontend/src/services/api.js`)
**personVideoAPI Object:**
- `scan(forceRefresh)` - Get all videos
- `getStats()` - Get statistics
- `upload(file, onProgress)` - Upload with progress tracking
- `delete(filename)` - Delete video
- `regenerateThumbnail(filename)` - Regenerate thumb
- `getInfo(filename)` - Get metadata
- `refresh()` - Force cache refresh

### 2. PersonVideoLibraryBrowser Component (`frontend/src/components/PersonVideoLibraryBrowser.jsx`)
**Features:**
- ✅ Grid layout with thumbnail previews
- ✅ Transparency indicator badge (green "Transparent")
- ✅ Loop quality assessment badges (Poor/Fair/Good/Excellent)
- ✅ Duration, resolution, format display
- ✅ Preview button (plays looped preview in modal)
- ✅ Radio button selection mode
- ✅ "No Person Overlay" option
- ✅ Upload button with progress bar
- ✅ Search/filter functionality
- ✅ Refresh and delete actions
- ✅ Statistics bar (total videos, with alpha, size)
- ✅ Help panel with best practices
- ✅ Responsive grid (1/2/3 columns)

---

## 🔄 In Progress

### PersonVideoSelectionModal Component
- Will wrap PersonVideoLibraryBrowser
- Add overlay settings:
  * Position selector (9 presets)
  * Scale slider (20-100%)
  * Opacity slider (0-100%)
  * Green screen removal toggle
  * Preview with transparency test

---

## 📋 Remaining Tasks

### Frontend:
1. **PersonVideoSelectionModal** - Settings wrapper ✓ (Next)
2. **Update ChannelForm.jsx** - Person overlay section
3. **Update VideoGenerator.jsx** - Override support
4. **Upload component improvements** - Drag & drop

### Backend:
5. **Update videoProcessor.js** - Apply overlays
6. **Green screen removal** - Chroma key implementation
7. **Overlay layering** - Correct z-index order

### Testing & Documentation:
8. **Create example videos** - Sample person videos
9. **Documentation** - Usage guide
10. **End-to-end testing** - Full flow validation

---

## 🎯 Technical Specifications

### Supported Formats:
- MP4, MOV, WebM, AVI
- **Preferred:** WebM/MOV with alpha channel
- **Max Size:** 100MB per video
- **Optimal Duration:** 3-10 seconds for seamless looping

### Alpha Channel Detection:
```javascript
// Detected pixel formats:
- yuva420p, yuva444p, yuva422p
- rgba, argb, bgra, abgr
- VP8/VP9 with alpha (WebM)
- ProRes 4444 (MOV)
```

### Loop Quality Assessment:
```
< 1s   → Poor
1-3s   → Fair
3-6s   → Good
6-12s  → Excellent
> 12s  → Very Long (may not loop seamlessly)
```

### Position Presets (FFmpeg coordinates):
```javascript
{
  'top-left':       x=10,           y=10
  'top-center':     x=(W-w)/2,      y=10
  'top-right':      x=W-w-10,       y=10
  'center':         x=(W-w)/2,      y=(H-h)/2
  'center-left':    x=10,           y=(H-h)/2
  'center-right':   x=W-w-10,       y=(H-h)/2
  'bottom-left':    x=10,           y=H-h-10
  'bottom-center':  x=(W-w)/2,      y=H-h-10
  'bottom-right':   x=W-w-10,       y=H-h-10
}
// W=background width, w=overlay width
// H=background height, h=overlay height
```

---

## 🎨 UI Design

### PersonVideoLibraryBrowser:
- **Grid Cards:** 320x240 thumbnails
- **Badges:**
  - Green "Transparent" for alpha channel
  - Color-coded loop quality (red/orange/green/blue)
- **Actions:**
  - Preview (modal with looping video)
  - Select (radio button in selection mode)
  - Delete (only in management mode)
- **Help Panel:** Best practices, format tips

### PersonVideoSelectionModal (Planned):
```
┌─────────────────────────────────────────┐
│ Select Person Video Overlay             │
├─────────────────────────────────────────┤
│ [PersonVideoLibraryBrowser Component]   │
│                                          │
│ ━━━━━ Overlay Settings ━━━━━            │
│                                          │
│ Position: [⚫⚫⚫] [Select Position]      │
│           [⚫⚫⚫]                         │
│           [⚫⚫⚫]                         │
│                                          │
│ Scale: [█████░░░] 50%                   │
│ Opacity: [██████████] 100%              │
│                                          │
│ ☐ Remove Green Screen                   │
│   Color: [#00FF00] 🎨                   │
│   Similarity: [███░░] 30%               │
│                                          │
│ ━━━━━ Preview ━━━━━                     │
│ [Looped video with checkerboard bg]     │
│                                          │
│         [Cancel] [Confirm Selection]    │
└─────────────────────────────────────────┘
```

---

## 🔧 FFmpeg Integration

### Overlay Filter Chain (Planned):
```bash
# 1. Load background videos (concatenated)
-i background.mp4

# 2. Load person video (looped)
-stream_loop -1 -i person.mp4

# 3. Scale person video
[1:v]scale=iw*0.5:ih*0.5[person]

# 4. Apply chroma key (if needed)
[person]chromakey=color=0x00FF00:similarity=0.3:blend=0.1[keyed]

# 5. Overlay on background
[0:v][keyed]overlay=x=W-w-10:y=H-h-10:format=auto:shortest=1[withperson]

# 6. Add static overlay (if configured)
[withperson][2:v]overlay=...[withstatic]

# 7. Add subtitles (always on top)
[withstatic]subtitles=...[final]
```

### Layering Order:
1. Background videos (base layer)
2. Person video overlay (looped)
3. Static image overlay (optional)
4. Subtitles (always top)

---

## 📦 Data Structures

### Person Video Metadata:
```javascript
{
  filename: "person_123456.webm",
  path: "/path/to/person-videos/person_123456.webm",
  duration: 5.2,
  width: 1080,
  height: 1920,
  codec: "vp9",
  fps: 30,
  hasAlpha: true,
  format: "webm",
  fileSize: 2457600,
  fileSizeFormatted: "2.34 MB",
  aspectRatio: "0.56",
  loopQuality: "good",
  thumbnail: "/person-videos/thumbnails/person_123456.jpg",
  createdAt: "2025-01-01T00:00:00.000Z"
}
```

### Channel Person Overlay Config:
```javascript
{
  visualSettings: {
    type1: {
      backgroundVideos: [...],
      personVideoOverlay: {
        enabled: true,
        filename: "person_123456.webm",
        path: "/path/to/person-videos/person_123456.webm",
        position: "bottom-right",
        scale: 50,        // percentage
        opacity: 100,     // percentage
        loop: true,
        chromaKey: {
          enabled: false,
          color: "#00FF00",
          similarity: 0.3,
          blend: 0.1
        }
      }
    }
  }
}
```

---

## 🚀 Next Steps (Priority Order)

1. ✅ **Complete PersonVideoSelectionModal** (30 min)
   - Settings form (position/scale/opacity)
   - Green screen toggle
   - Preview with transparency test

2. **Update ChannelForm.jsx** (20 min)
   - Add person overlay section (TYPE_1 only)
   - Radio buttons: Static/Person/None
   - Integrate PersonVideoSelectionModal
   - Display selected video with settings

3. **Update VideoGenerator.jsx** (15 min)
   - Show channel's person overlay
   - Override option
   - Preview thumbnail

4. **Update videoProcessor.js** (45 min)
   - Load person video
   - Loop to match duration
   - Apply overlay with position/scale/opacity
   - Handle alpha channel
   - Apply chroma key if configured
   - Correct filter chain ordering

5. **Testing** (30 min)
   - Create sample person video
   - Upload and configure
   - Generate TYPE_1 video
   - Verify overlay loops correctly

---

## 📊 Progress Summary

**Backend:** ✅ 100% Complete (3/3 tasks)
**Frontend:** 🔄 40% Complete (1/3 main components)
**Integration:** ⏳ 0% Complete (0/3 tasks)

**Overall:** 🔄 35% Complete

---

## 🎯 Quick Test Plan

Once complete, test with:

```bash
# 1. Upload person video
curl -X POST http://localhost:3000/api/v2/person-videos/upload \
  -F "personVideo=@test-person.webm"

# 2. Scan library
curl http://localhost:3000/api/v2/person-videos/scan

# 3. In UI:
# - Create TYPE_1 channel
# - Select person video overlay
# - Configure position: bottom-right, scale: 50%, opacity: 100%
# - Generate video
# - Verify person loops over background
# - Check subtitle rendering on top
```

---

**Status:** ✅ Backend Complete | 🔄 Frontend In Progress | ⏳ Integration Pending
**Last Updated:** [Current timestamp]
**Next Task:** Complete PersonVideoSelectionModal component

