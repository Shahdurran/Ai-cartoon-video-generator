# Dashboard Analytics - Visual Reference

## 📱 Complete Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                                       │
│                Welcome to the Video Generation System                   │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Channels    │ Active Jobs  │  Completed   │   Failed     │
│              │              │              │              │
│     [5]      │     [2]      │    [123]     │     [3]      │
│   (blue)     │  (yellow)    │   (green)    │    (red)     │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│              📊 Video Generation Analytics                             │
├────────────────────────────────┬───────────────────────────────────────┤
│  Videos Generated Per Day      │  Processing Time Trends               │
│  ┌──────────────────────────┐  │  ┌──────────────────────────────┐    │
│  │      /\        /\         │  │  │  ║       ║    ║       ║      │    │
│  │     /  \      /  \        │  │  │  ║   ║   ║    ║   ║   ║      │    │
│  │    /    \    /    \  /    │  │  │  ║   ║   ║    ║   ║   ║      │    │
│  │   /      \__/      \/     │  │  │ ║║  ║║  ║║   ║║  ║║  ║║      │    │
│  │  ────────────────────────  │  │  │ v1  v2  v3  v4  v5  v6       │    │
│  │  Nov 20  Nov 22  Nov 24   │  │  │ (Green/Yellow/Red bars)       │    │
│  └──────────────────────────┘  │  └──────────────────────────────┘    │
│  Line chart showing daily      │  Bar chart with color-coded          │
│  video generation trends       │  processing times                    │
├────────────────────────────────┴───────────────────────────────────────┤
│                    Success Rate                                        │
│                  ┌──────────────┐                                      │
│                  │    ╔══╗      │                                      │
│                  │   ╔╝  ╚╗     │                                      │
│                  │   ║ 95%║     │  (Donut chart)                      │
│                  │   ╚╗__╔╝     │  Green: Success                     │
│                  │    ╚══╝      │  Red: Failed                        │
│                  └──────────────┘                                      │
│                Success: 123  Failed: 3                                 │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┬────────────────────────────────┐
│       📋 Recent Activity             │    📈 Today's Summary          │
│                          [↻ Refresh] │                                │
├──────────────────────────────────────┼────────────────────────────────┤
│ ✅ Amazing Travel Destinations       │ ┌────────────┬────────────┐   │
│    Video completed in 95s            │ │ 📈 Videos  │ ⏱️ Time    │   │
│    2 minutes ago              [👁️]   │ │    5       │   12m 35s  │   │
│                                      │ └────────────┴────────────┘   │
│ ⏱️ Tech Review Video                 │ ┌────────────┬────────────┐   │
│    Processing... 45%                 │ │ 🎬 Length  │ ⭐ Channel │   │
│    just now                  [45%]   │ │    45s     │ tech-chan  │   │
│                                      │ └────────────┴────────────┘   │
│ ❌ Cooking Tutorial                  │                                │
│    Failed: API timeout               │  Quick Start:                  │
│    5 minutes ago              [🔄]   │  ① Create a Channel            │
│                                      │  ② Generate Videos             │
│ ✅ Gaming Highlights                 │  ③ Monitor Progress            │
│    Video completed in 120s           │                                │
│    10 minutes ago             [👁️]   │                                │
│                                      │                                │
│ ⏱️ Music Video Creation              │                                │
│    Processing... 78%                 │                                │
│    30 seconds ago            [78%]   │                                │
│                                      │                                │
│ [Auto-refreshes every 10s]           │                                │
│ [Scrollable - 20 max items]          │                                │
└──────────────────────────────────────┴────────────────────────────────┘
```

---

## 🎬 Job Details Modal Layout

### When you click a completed video:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Job Details                                Job ID: 12345          [X] │
├────────────────────────────────────────────────────────────────────────┤
│  [Overview] [Assets] [Logs] [Settings]                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ Job Information ──────────────────────────────────────────────┐   │
│  │  Job ID: 12345                                        [Copy 📋]│   │
│  │  Type: Video Generation                                        │   │
│  │  Channel: tech-channel                                         │   │
│  │  Status: [✅ Completed]                                        │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Timestamps ───────────────────────────────────────────────────┐   │
│  │  Created:    Oct 26, 2025 10:30:45 AM                         │   │
│  │  Started:    Oct 26, 2025 10:30:47 AM                         │   │
│  │  Completed:  Oct 26, 2025 10:32:22 AM                         │   │
│  │  Duration:   1m 35s                                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Video Information ────────────────────────────────────────────┐   │
│  │  Title:      Amazing Travel Destinations                       │   │
│  │  Duration:   45s                                               │   │
│  │  Resolution: 1920x1080                                         │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [Close]                            [Share 🔗] [Delete 🗑️]            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Assets Tab View

```
┌────────────────────────────────────────────────────────────────────────┐
│  Job Details                                Job ID: 12345          [X] │
├────────────────────────────────────────────────────────────────────────┤
│  [Overview] ► [Assets] ◄ [Logs] [Settings]                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ Final Video ──────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │                                                         │    │   │
│  │  │         [▶️ Video Player Preview]                       │    │   │
│  │  │                                                         │    │   │
│  │  │  [Play/Pause] [━━━━━━━━━━━━━━━] [Volume] [Fullscreen] │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  │  [📥 Download Video] [📂 Open in Folder]                       │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Script ───────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │ Welcome to our channel! Today we're exploring the      │    │   │
│  │  │ most amazing travel destinations around the world...   │    │   │
│  │  │ [Scrollable script text]                               │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  │  [📋 Copy Script]                                              │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Audio ────────────────────────────────────────────────────────┐   │
│  │  🎵 [Play] [━━━━━━━━━━━] [Volume] 0:00 / 0:45                  │   │
│  │  [📥 Download Audio]                                           │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Images ───────────────────────────────────────────────────────┐   │
│  │  ┌─────────┬─────────┬─────────┐                              │   │
│  │  │ [IMG 1] │ [IMG 2] │ [IMG 3] │  (Click to view full size)   │   │
│  │  └─────────┴─────────┴─────────┘                              │   │
│  │  ┌─────────┬─────────┬─────────┐                              │   │
│  │  │ [IMG 4] │ [IMG 5] │ [IMG 6] │                              │   │
│  │  └─────────┴─────────┴─────────┘                              │   │
│  │  [📥 Download All Images]                                      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [Close]                            [Share 🔗] [Delete 🗑️]            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📜 Logs Tab View

```
┌────────────────────────────────────────────────────────────────────────┐
│  Job Details                                Job ID: 12345          [X] │
├────────────────────────────────────────────────────────────────────────┤
│  [Overview] [Assets] ► [Logs] ◄ [Settings]                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Execution Logs                               [📥 Download Logs]      │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ █ [10:30:45] ℹ️  Starting video generation...                  │   │
│  │ █ [10:30:47] ℹ️  Generating script with Claude API...          │   │
│  │ █ [10:30:52] ✅ Script generated successfully                  │   │
│  │ █ [10:30:53] ℹ️  Generating voice with ElevenLabs...           │   │
│  │ █ [10:31:05] ⚠️  Warning: API rate limit approaching           │   │
│  │ █ [10:31:10] ✅ Voice generation completed                     │   │
│  │ █ [10:31:12] ℹ️  Generating 6 images with Stability AI...     │   │
│  │ █ [10:31:45] ✅ All images generated                           │   │
│  │ █ [10:31:47] ℹ️  Assembling video with FFmpeg...              │   │
│  │ █ [10:32:20] ℹ️  Rendering video...                            │   │
│  │ █ [10:32:22] ✅ Video generation completed successfully        │   │
│  │ █ [10:32:22] 📁 Output: /output/video_12345.mp4              │   │
│  │                                                                │   │
│  │ Color codes:  🟢 Info   🟡 Warning   🔴 Error                 │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  (Scrollable, max height 400px)                                       │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [Close]                            [Share 🔗] [Delete 🗑️]            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Settings Tab View

```
┌────────────────────────────────────────────────────────────────────────┐
│  Job Details                                Job ID: 12345          [X] │
├────────────────────────────────────────────────────────────────────────┤
│  [Overview] [Assets] [Logs] ► [Settings] ◄                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Generation Settings           [📋 Copy Settings] [🔄 Reuse Settings] │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ {                                                              │   │
│  │   "channelId": "tech-channel",                                │   │
│  │   "title": "Amazing Travel Destinations",                     │   │
│  │   "context": "travel destinations review",                    │   │
│  │   "customPrompt": "Create an engaging video about...",        │   │
│  │   "referenceScripts": [                                       │   │
│  │     "script-template-1",                                      │   │
│  │     "script-template-2"                                       │   │
│  │   ],                                                          │   │
│  │   "promptTemplateId": "educational-video",                    │   │
│  │   "personVideoOverlay": {                                     │   │
│  │     "enabled": true,                                          │   │
│  │     "video": "person1.mp4",                                   │   │
│  │     "position": "bottom-right",                               │   │
│  │     "size": "small"                                           │   │
│  │   }                                                           │   │
│  │ }                                                              │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ 💡 Tip: Click "Reuse Settings" to open the Video Generator    │   │
│  │    with these exact settings pre-filled.                      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [Close]                            [Share 🔗] [Delete 🗑️]            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Mobile View (< 768px)

```
┌───────────────────────┐
│     DASHBOARD         │
└───────────────────────┘

┌───────────────────────┐
│  Channels             │
│     [5]               │
└───────────────────────┘

┌───────────────────────┐
│  Active Jobs          │
│     [2]               │
└───────────────────────┘

┌───────────────────────┐
│  Completed            │
│    [123]              │
└───────────────────────┘

┌───────────────────────┐
│  Failed               │
│     [3]               │
└───────────────────────┘

┌───────────────────────┐
│  Videos Per Day       │
│  ┌─────────────────┐  │
│  │   Line Chart    │  │
│  └─────────────────┘  │
└───────────────────────┘

┌───────────────────────┐
│  Processing Times     │
│  ┌─────────────────┐  │
│  │   Bar Chart     │  │
│  └─────────────────┘  │
└───────────────────────┘

┌───────────────────────┐
│  Success Rate         │
│  ┌─────────────────┐  │
│  │  Donut Chart    │  │
│  └─────────────────┘  │
└───────────────────────┘

┌───────────────────────┐
│  Recent Activity      │
│  ✅ Video 1           │
│  ⏱️ Video 2           │
│  ❌ Video 3           │
└───────────────────────┘

┌───────────────────────┐
│  Today's Summary      │
│  Videos: 5            │
│  Time: 12m 35s        │
└───────────────────────┘

(All stacked vertically)
```

---

## 🎨 Color Reference Chart

```
┌────────────────────────────────────────────────────────────────┐
│                      Color Palette                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRIMARY (Blue)     ■ #3b82f6   Charts, Links, Primary Actions │
│                                                                 │
│  SUCCESS (Green)    ■ #10b981   Completed, Success, Fast       │
│                                                                 │
│  WARNING (Yellow)   ■ #f59e0b   Processing, Retry, Warning     │
│                                                                 │
│  ERROR (Red)        ■ #ef4444   Failed, Error, Slow            │
│                                                                 │
│  GRAY SCALE:                                                    │
│  - Text Primary     ■ #1f2937   Headings, Main Text            │
│  - Text Secondary   ■ #6b7280   Descriptions, Labels           │
│  - Background       ■ #f9fafb   Page Background                │
│  - Card Background  ■ #ffffff   Card/Modal Background          │
│  - Border           ■ #e5e7eb   Borders, Dividers              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Icon Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    Icon Usage Guide                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊  Layers         Channels, Groups                            │
│  ⏱️   Clock          Active Jobs, Time, Duration                │
│  ✅  CheckCircle     Completed Jobs, Success                    │
│  ❌  XCircle         Failed Jobs, Errors                        │
│  🎬  Video           Videos, Media                              │
│  👁️   Eye             View, Preview                             │
│  🔄  RefreshCw       Retry, Refresh, Reload                     │
│  📥  Download        Download, Export                           │
│  📋  Copy            Copy to Clipboard                          │
│  🔗  Share2          Share, Link                                │
│  🗑️   Trash2          Delete, Remove                            │
│  📂  Folder          Open Folder, Files                         │
│  🔊  Music           Audio, Sound                               │
│  🖼️   ImageIcon       Images, Photos                            │
│  📄  File            Documents, Files                           │
│  📈  TrendingUp      Growth, Increase, Stats                    │
│  ⭐  Star            Featured, Favorite, Top                    │
│  🎥  Film            Video Length, Media                        │
│  ⚙️   Settings        Configuration, Options                    │
│  🔍  Search          Search, Find                               │
│  ➕  Plus            Add, Create New                            │
│  ✏️   Edit            Edit, Modify                              │
│  ℹ️   Info            Information, Help                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎭 Component Hierarchy

```
Dashboard.jsx
├── Stats Cards (4)
│   ├── Channels (Layers icon, blue)
│   ├── Active Jobs (Clock icon, yellow)
│   ├── Completed (CheckCircle icon, green)
│   └── Failed (Video icon, red)
│
├── AnalyticsCharts.jsx
│   ├── Line Chart (Videos Per Day)
│   ├── Bar Chart (Processing Times)
│   └── Donut Chart (Success Rate)
│
├── RecentActivityFeed.jsx
│   ├── Header (with refresh button)
│   ├── Activity Items (max 20)
│   │   ├── Icon (status-based)
│   │   ├── Title
│   │   ├── Description
│   │   ├── Timestamp
│   │   └── Action Button
│   └── Auto-refresh (10s interval)
│
└── TodaySummary.jsx
    ├── Videos Generated (TrendingUp icon)
    ├── Processing Time (Clock icon)
    ├── Avg Length (Film icon)
    └── Most Used Channel (Star icon)

JobDetailsModal.jsx
├── Header (Title, Job ID, Close)
├── Tab Navigation
│   ├── Overview Tab
│   ├── Assets Tab
│   ├── Logs Tab
│   └── Settings Tab
├── Content Area
│   ├── OverviewTab
│   │   ├── Job Information
│   │   ├── Timestamps
│   │   ├── Video Information
│   │   └── Error Details (if failed)
│   ├── AssetsTab
│   │   ├── Video Player
│   │   ├── Script Viewer
│   │   ├── Audio Player
│   │   └── Image Gallery (with lightbox)
│   ├── LogsTab
│   │   └── Execution Logs (color-coded)
│   └── SettingsTab
│       └── JSON Viewer (with copy/reuse)
└── Footer Actions
    ├── Close Button
    ├── Retry Button (failed jobs)
    ├── Share Button (completed jobs)
    └── Delete Button (completed jobs)
```

---

## 📐 Responsive Grid Layouts

### Desktop Layout (≥ 1024px)
```
Stats Cards:
[Card 1] [Card 2] [Card 3] [Card 4]

Analytics:
[Line Chart    ] [Bar Chart     ]
[Donut Chart              ]

Activity + Summary:
[Activity Feed (66%)    ] [Summary (33%)]
```

### Tablet Layout (768px - 1024px)
```
Stats Cards:
[Card 1] [Card 2]
[Card 3] [Card 4]

Analytics:
[Line Chart         ]
[Bar Chart          ]
[Donut Chart        ]

Activity + Summary:
[Activity Feed      ]
[Summary            ]
```

### Mobile Layout (< 768px)
```
Stats Cards:
[Card 1]
[Card 2]
[Card 3]
[Card 4]

Analytics:
[Line Chart  ]
[Bar Chart   ]
[Donut Chart ]

Activity:
[Feed        ]

Summary:
[Summary     ]
```

---

## 🎬 Animation States

### Loading State
```
┌────────────────────────┐
│  ████░░░░░░░░░░        │  (Animated skeleton)
│  ████████░░░░░░        │  (Gray boxes pulse)
│  ████░░░░░░░░░░        │
└────────────────────────┘
```

### Empty State
```
┌────────────────────────┐
│         📹             │
│   No videos yet        │
│   Start generating!    │
└────────────────────────┘
```

### Error State
```
┌────────────────────────┐
│         ❌             │
│   Failed to load       │
│   [Retry Button]       │
└────────────────────────┘
```

### Processing State
```
┌────────────────────────┐
│    ⏱️ Processing...     │
│  ▓▓▓▓▓▓▓▓░░░░ 65%     │
└────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
User Action
    │
    ▼
┌─────────────────┐
│  React Component│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   dashboardAPI  │ (axios)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend Route  │ (/api/v2/dashboard/...)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │ (dashboardController.js)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   BullMQ Queues │ (getAllQueuesStats)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Format & Send  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update UI      │
└─────────────────┘
```

---

**This visual reference guide should help you understand the complete dashboard layout and structure!** 📊🎨

