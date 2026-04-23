# Dashboard Analytics & Job Details - Usage Guide

## 🚀 Quick Start

### Starting the Application
```bash
# Option 1: Use the convenience script (Windows)
start-both.bat

# Option 2: Manual start
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## 📊 Dashboard Overview

### Main Sections (Top to Bottom)

#### 1. Stats Cards Row
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Channels   │ Active Jobs │  Completed  │   Failed    │
│     [5]     │     [2]     │    [123]    │     [3]     │
│   (blue)    │  (yellow)   │   (green)   │    (red)    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### 2. Video Generation Analytics
```
┌─────────────────────────────────────────────────────────┐
│              Video Generation Analytics                  │
├───────────────────────────┬─────────────────────────────┤
│  Videos Per Day (Line)    │  Processing Times (Bar)     │
│  [Shows last 7 days]      │  [Last 10 videos]           │
│                           │  Colors: 🟢 🟡 🔴          │
├───────────────────────────┴─────────────────────────────┤
│             Success Rate (Donut)                         │
│             Center: "95%" Success                        │
│             Success: 123  Failed: 3                      │
└──────────────────────────────────────────────────────────┘
```

#### 3. Activity Feed + Summary
```
┌──────────────────────────────┬────────────────────┐
│    Recent Activity (2/3)     │  Summary (1/3)     │
├──────────────────────────────┼────────────────────┤
│ ✅ Video 1 completed         │ Today's Summary:   │
│    2 minutes ago             │ • Videos: 5        │
│                              │ • Processing: 12m  │
│ ⏱️  Video 2 processing       │ • Avg Length: 45s  │
│    just now [Progress: 35%]  │ • Top Channel: X   │
│                              │                    │
│ ❌ Video 3 failed            │ Quick Start:       │
│    10 minutes ago            │ 1. Create Channel  │
│    [Retry button]            │ 2. Generate Video  │
│                              │ 3. Monitor Queue   │
│ [Auto-refreshes every 10s]   │                    │
└──────────────────────────────┴────────────────────┘
```

---

## 📈 Understanding the Charts

### Line Chart - Videos Per Day
**What it shows:** Daily video generation trends

**How to read:**
- X-axis: Dates (e.g., "Nov 21", "Nov 22", etc.)
- Y-axis: Number of videos generated
- Line peaks = busy days
- Hover over points for exact counts

**Use case:** Track productivity patterns

### Bar Chart - Processing Times
**What it shows:** How long recent videos took to process

**How to read:**
- X-axis: Video titles (truncated)
- Y-axis: Seconds
- 🟢 Green bars (< 60s) = Fast processing
- 🟡 Yellow bars (60-300s) = Normal processing  
- 🔴 Red bars (> 300s) = Slow processing

**Use case:** Identify performance bottlenecks

### Donut Chart - Success Rate
**What it shows:** Overall success vs failure rate

**How to read:**
- Center number = success percentage
- 🟢 Green segment = successful videos
- 🔴 Red segment = failed videos
- Below: Exact counts

**Use case:** Monitor system reliability

---

## 🔔 Recent Activity Feed

### Activity Types & Icons

**✅ Completed (Green)**
```
✅ "Amazing Travel Destinations" completed
   Video completed in 95s
   2 minutes ago
   [👁️ View button]
```

**❌ Failed (Red)**
```
❌ "Cooking Tutorial" failed
   Failed: API timeout error
   5 minutes ago
   [🔄 Retry button]
```

**⏱️ Processing (Yellow)**
```
⏱️ "Tech Review" processing
   Processing... 45%
   just now
   [45% indicator]
```

### Features
- **Auto-refresh**: Updates every 10 seconds automatically
- **Manual refresh**: Click 🔄 icon in header
- **Scrollable**: Shows up to 20 activities
- **Real-time**: See jobs as they start/complete

### Actions
- **View**: Opens Job Details Modal (completed jobs)
- **Retry**: Restarts failed job
- **Progress**: Shows completion percentage

---

## 📋 Today's Summary

### Four Key Metrics

**1. Videos Generated Today**
- 📈 Icon: TrendingUp
- Shows: Count of videos completed today
- Example: "5"

**2. Total Processing Time**
- ⏱️ Icon: Clock
- Shows: Sum of all processing times today
- Example: "12m 35s"

**3. Average Video Length**
- 🎬 Icon: Film
- Shows: Mean duration of videos
- Example: "45s"

**4. Most Used Channel**
- ⭐ Icon: Star
- Shows: Channel ID or name
- Example: "tech-channel"

### Time Formatting
- Under 60s: "35s"
- Over 60s: "2m 15s"
- Hours: "1h 30m 0s"

---

## 🎬 Job Details Modal

### Opening the Modal
**Method 1:** From Recent Activity
1. Find completed job in activity feed
2. Click 👁️ "View" button
3. Modal opens

**Method 2:** From Queue Monitor
1. Go to "Queue" tab
2. Click on any job
3. Modal opens

### Modal Layout
```
┌─────────────────────────────────────────────────────┐
│  Job Details                      Job ID: 12345   [X]│
├─────────────────────────────────────────────────────┤
│  [Overview] [Assets] [Logs] [Settings]              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [Tab Content Here]                                  │
│                                                      │
├─────────────────────────────────────────────────────┤
│  [Close]                    [Retry] [Share] [Delete]│
└─────────────────────────────────────────────────────┘
```

---

## 📑 Modal Tabs Explained

### 1. Overview Tab
**Job Information:**
- Job ID (click 📋 to copy)
- Job type (e.g., "Video Generation")
- Channel name
- Status badge (colored)
- Progress bar (if still processing)

**Timestamps:**
- Created: When job was queued
- Started: When processing began
- Completed: When finished
- Duration: Total processing time

**Video Information:**
- Title
- Duration
- Resolution (e.g., "1920x1080")

**Error Details (if failed):**
- Red box with full error message

### 2. Assets Tab

#### Final Video Section
```
┌─────────────────────────────────────┐
│  🎬 Video Player                     │
│  [Play controls, seek, volume]      │
│  [Fullscreen button]                │
└─────────────────────────────────────┘
[📥 Download Video] [📂 Open in Folder]
```

**Player Controls:**
- Play/Pause: Spacebar or click
- Seek: Click timeline or arrow keys
- Volume: Click speaker icon
- Fullscreen: Click icon or press F

#### Script Section
```
┌─────────────────────────────────────┐
│  Script Text (scrollable)            │
│  "Welcome to our channel..."         │
└─────────────────────────────────────┘
[📋 Copy Script]
```

#### Audio Section
```
┌─────────────────────────────────────┐
│  🎵 Audio Player                     │
│  [Play/pause, seek, volume]         │
└─────────────────────────────────────┘
[📥 Download Audio]
```

#### Images Section
```
┌─────────┬─────────┬─────────┐
│ [Img 1] │ [Img 2] │ [Img 3] │
│         │         │         │
└─────────┴─────────┴─────────┘
[Click image for full size view]
[📥 Download All Images]
```

**Image Lightbox:**
- Click any thumbnail → Full screen view
- Click anywhere → Close lightbox

### 3. Logs Tab
```
┌─────────────────────────────────────────┐
│  Execution Logs        [📥 Download]    │
├─────────────────────────────────────────┤
│  [12:00:01] ℹ️  Starting video generation│
│  [12:00:05] ℹ️  Script generated          │
│  [12:01:30] ⚠️  Warning: API rate limit   │
│  [12:02:45] ℹ️  Video rendering complete  │
│  [12:03:00] ✅ Job completed successfully │
└─────────────────────────────────────────┘
```

**Color Codes:**
- 🟢 Green: Info messages
- 🟡 Yellow: Warnings
- 🔴 Red: Errors

### 4. Settings Tab
```
┌─────────────────────────────────────────┐
│  Generation Settings    [📋 Copy]       │
│                        [🔄 Reuse]       │
├─────────────────────────────────────────┤
│  {                                       │
│    "channelId": "tech-channel",         │
│    "title": "Amazing Video",            │
│    "context": "Technology review",      │
│    "customPrompt": "...",               │
│    "referenceScripts": ["script1"],    │
│    "promptTemplateId": "template1"      │
│  }                                       │
└─────────────────────────────────────────┘
```

**Actions:**
- **Copy Settings**: Copy JSON to clipboard
- **Reuse Settings**: Open Video Generator with these settings pre-filled

---

## 🎮 Action Buttons

### For All Jobs
- **Close**: Close modal (or press ESC)

### For Failed Jobs
- **🔄 Retry Job**: Restart the failed job
- **View Error Details**: Expandable section with full error

### For Completed Jobs
- **🔗 Share**: Generate shareable link (coming soon)
- **🗑️ Delete**: Delete job and assets
  - Shows confirmation: "Are you sure? [Yes] [No]"
  - Cannot be undone!

---

## 📱 Responsive Behavior

### Desktop (> 1024px)
```
Stats:     [Card] [Card] [Card] [Card]
Charts:    [Line Chart] [Bar Chart]
           [Donut Chart]
Activity:  [Feed (2/3 width)] [Summary (1/3 width)]
```

### Tablet (768px - 1024px)
```
Stats:     [Card] [Card]
           [Card] [Card]
Charts:    [Line Chart]
           [Bar Chart]
           [Donut Chart]
Activity:  [Feed (full width)]
           [Summary (full width)]
```

### Mobile (< 768px)
```
Stats:     [Card]
           [Card]
           [Card]
           [Card]
Charts:    [Line Chart]
           [Bar Chart]
           [Donut Chart]
Activity:  [Feed]
           [Summary]
```

---

## 🎯 Common Tasks

### Task 1: Check Today's Performance
1. Look at "Today's Summary" card
2. See videos generated count
3. Check total processing time
4. Note most used channel

### Task 2: Monitor Active Jobs
1. Look at "Active Jobs" stat card
2. Scroll to Recent Activity feed
3. Find jobs with ⏱️ icon
4. Watch progress percentage

### Task 3: Review Completed Video
1. Click ✅ completed job in activity feed
2. Modal opens to Overview tab
3. Click "Assets" tab
4. Play video in player
5. Download if needed

### Task 4: Troubleshoot Failures
1. Find ❌ failed job in activity feed
2. Click 🔄 "Retry" or 👁️ "View"
3. In modal, check "Overview" for error
4. Check "Logs" tab for detailed errors
5. Fix issue and retry

### Task 5: Reuse Successful Settings
1. Open completed job modal
2. Go to "Settings" tab
3. Click "Reuse Settings"
4. Video Generator opens with settings pre-filled
5. Modify as needed and generate

### Task 6: Download All Assets
1. Open completed job modal
2. Go to "Assets" tab
3. Download video
4. Download audio
5. Download all images
6. Copy script text

### Task 7: Track Weekly Performance
1. Look at "Videos Per Day" line chart
2. See daily trends for last 7 days
3. Identify peak production days
4. Compare with processing times bar chart
5. Check success rate donut chart

---

## 🔧 Tips & Tricks

### Dashboard
- **Refresh Data**: Reload page to refresh all analytics
- **Activity Feed**: Refreshes automatically every 10s
- **Empty States**: Generate videos to see data in charts

### Job Details Modal
- **Keyboard Shortcuts**: 
  - ESC: Close modal
  - Space: Play/pause video
  - Arrow keys: Seek video
- **Image Viewing**: Click thumbnail for full size
- **Copy Buttons**: Instant clipboard copy (no notification needed)

### Performance
- **Processing Times**: Green bars are optimal
- **Yellow Bars**: Normal, but could be improved
- **Red Bars**: Investigate for bottlenecks

### Charts
- **Hover Tooltips**: Hover over any chart element for details
- **Responsive**: Charts adapt to screen size
- **Interactive**: Click legend to toggle data series

---

## ❓ Troubleshooting

### Charts Show No Data
**Problem:** All charts are empty  
**Solution:** 
1. Generate some videos first
2. Wait for completion
3. Refresh dashboard page

### Activity Feed Empty
**Problem:** "No recent activity" message  
**Solution:**
1. Generate a video via "Generate" tab
2. Wait a few seconds
3. Activity should appear

### Modal Won't Open
**Problem:** Clicking job doesn't open modal  
**Solution:**
1. Check browser console for errors
2. Ensure backend is running
3. Try refreshing page

### Video Won't Play
**Problem:** Video player shows error  
**Solution:**
1. Check if video file exists in output folder
2. Verify backend is serving files
3. Check browser console for 404 errors

### Auto-Refresh Not Working
**Problem:** Activity feed doesn't update  
**Solution:**
1. Check browser network tab
2. Verify backend API is responding
3. Look for JavaScript errors in console

---

## 🎨 Color Reference

### Status Colors
- 🔵 **Blue** `#3b82f6`: Primary, links, charts
- 🟢 **Green** `#10b981`: Success, completed, fast
- 🟡 **Yellow** `#f59e0b`: Warning, processing, retry
- 🔴 **Red** `#ef4444`: Error, failed, slow

### Chart Colors
- **Line Chart**: Blue line
- **Bar Chart**: Green/Yellow/Red (by speed)
- **Donut Chart**: Green success, Red failed

### UI Elements
- **Cards**: White background, gray borders
- **Buttons**: Colored backgrounds on hover
- **Code**: Dark background, green text

---

## 🚀 Next Steps

Now that you understand the dashboard:

1. **Generate Some Videos**: Use the "Generate" tab
2. **Monitor Progress**: Watch the Queue and Activity Feed
3. **Analyze Performance**: Check the charts daily
4. **Optimize**: Use processing time data to improve
5. **Review Assets**: Use Job Details Modal to preview

---

## 📚 Related Documentation

- `DASHBOARD_ANALYTICS_COMPLETE.md` - Technical implementation details
- `QUICK-REFERENCE.md` - General system reference
- `FRONTEND_QUICK_START.md` - Frontend setup guide
- `API-EXAMPLES.md` - API endpoint examples

---

**Enjoy your enhanced video generation dashboard!** 🎉

