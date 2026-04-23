# Prompt Template System - Visual Guide 🎨

## 🖼️ UI Components Overview

### 1. Template Library (Browse & Select)
```
┌─────────────────────────────────────────────────────────────┐
│ 🗎 Prompt Template Library                              ✕   │
│ Select a template for your video                            │
├─────────────────────────────────────────────────────────────┤
│ 🔍 [Search templates...]  [Category ▼]                     │
│ [+ Create New] [↑ Import]                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│ │ 🔒 High      │  │ Educational  │  │ Dramatic     │      │
│ │ Retention    │  │ Deep Dive    │  │ History      │      │
│ │ [Entertainment]│  │ [Education]  │  │ [History]    │      │
│ │ dramatic·med │  │ inform·long  │  │ dramatic·med │      │
│ │ #viral #hooks│  │ #tutorial    │  │ #epic #story │      │
│ │              │  │              │  │              │      │
│ │ Create high  │  │ Clear teach- │  │ Epic narra-  │      │
│ │ retention... │  │ ing with...  │  │ tion with... │      │
│ │ [▶ Show more]│  │ [▶ Show more]│  │ [▶ Show more]│      │
│ │              │  │              │  │              │      │
│ │ [Use Template]│  │ [Use Template]│  │ [Use Template]│      │
│ └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│ Showing 6 of 6 templates                          [Close]   │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Grid layout (3 columns on desktop)
- Color-coded category badges
- System templates show 🔒 lock icon
- Expandable previews
- Search and filter
- One-click selection

---

### 2. Template Editor (Create/Edit)
```
┌─────────────────────────────────────────────────────────────┐
│ 🗎 Create New Template                                  ✕   │
│ Define custom prompt instructions for script generation     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Template Name *                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g., High Retention History                         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Category          │ Tone                                     │
│ [History     ▼]  │ [Dramatic    ▼]                         │
│                                                              │
│ Target Length                                                │
│ [Short (30-60s)] [Medium (60-120s)] [Long (2-5min)]        │
│                                                              │
│ Tags                                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Add tags...                                    [Add] │   │
│ └──────────────────────────────────────────────────────┘   │
│ [viral ✕] [history ✕] [dramatic ✕]                         │
│                                                              │
│ Custom Prompt Instructions * [👁 Preview]                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Create a highly engaging video that:                 │   │
│ │                                                       │   │
│ │ 1. HOOK: Start with shocking statement...            │   │
│ │ 2. PACING: Use short punchy sentences...             │   │
│ │ 3. STRUCTURE: Build tension gradually...             │   │
│ │                                                       │   │
│ │ Use variables: {TOPIC}, {TONE}, {LENGTH}             │   │
│ └──────────────────────────────────────────────────────┘   │
│ 245 words · 1,523 characters                                 │
│                                                              │
│ 💡 Template Tips:                                           │
│ • Be specific about structure and style                     │
│ • Include examples of what you want                         │
│ • Use variables for dynamic content                         │
│                                                              │
│                                          [Cancel] [💾 Save]  │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- All template fields in one form
- Character/word count
- Preview mode
- Custom category creation
- Tag management
- Best practice tips

---

### 3. Channel Form Integration
```
┌─────────────────────────────────────────────────────────────┐
│ Create/Edit Channel                                          │
├─────────────────────────────────────────────────────────────┤
│ ... (other channel settings) ...                            │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ 🗎 Prompt Template                   [Browse Templates →]   │
│ Choose a template to define script style and approach       │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ✓ Selected: Dramatic History            🔒 System ✕ │   │
│ │   [History] dramatic · medium                        │   │
│ │                                                       │   │
│ │   [▶ Show Template Prompt]                           │   │
│ │   ┌─────────────────────────────────────────────┐   │   │
│ │   │ Create epic historical narrative that:     │   │   │
│ │   │ • Uses present tense for immediacy         │   │   │
│ │   │ • Focuses on human stories                 │   │   │
│ │   │ • Builds tension toward pivotal moments    │   │   │
│ │   └─────────────────────────────────────────────┘   │   │
│ │                                                       │   │
│ │   [✏️ Customize for this channel]                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ 📚 Reference Scripts                 [Browse Templates →]   │
│ ... (reference scripts section) ...                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Template selector in channel settings
- Shows selected template info
- Expandable preview
- Customize button to override
- Clear template option

---

### 4. Video Generator Integration
```
┌─────────────────────────────────────────────────────────────┐
│ Generate Video                                               │
├─────────────────────────────────────────────────────────────┤
│ Channel: [Epic History ▼]                                   │
│                                                              │
│ Title: [The Fall of Constantinople]                         │
│ Context: [Focus on the final days...]                       │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ 🗎 Prompt Template                                          │
│                                                              │
│ ☑ Use Channel's Prompt Template                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ✓ Dramatic History                                   │   │
│ │   [History] dramatic · medium                        │   │
│ │   [▶ Show Template Instructions]                     │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ OR                                                           │
│                                                              │
│ ☐ Use Channel's Prompt Template                            │
│ [🗎 Select Different Template]                              │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ ... (other video settings) ...                              │
│                                                              │
│                                          [🎬 Generate Video] │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Checkbox to use channel template
- Override option per video
- Template info display
- Expandable instructions preview

---

## 🎨 Color Scheme

### Category Colors:
```
History:      🔵 Blue    (bg-blue-500)
Science:      🟢 Green   (bg-green-500)
Education:    🟣 Purple  (bg-purple-500)
Entertainment: 🩷 Pink   (bg-pink-500)
Documentary:  🟡 Yellow  (bg-yellow-500)
Custom:       ⚫ Gray    (bg-gray-500)
```

### Status Indicators:
```
System Template:  🔒 Yellow badge "System"
User Template:    No badge
Selected:         ✓ Blue/green checkmark
Locked:           🔒 Lock icon
```

---

## 📱 Responsive Design

### Desktop (>1024px):
- 3 columns for template cards
- Full modals (max-w-6xl)
- Side-by-side form fields

### Tablet (768-1024px):
- 2 columns for template cards
- Slightly smaller modals
- Some fields stack vertically

### Mobile (<768px):
- 1 column for template cards
- Full-width modals
- All fields stack vertically
- Touch-friendly buttons

---

## 🔄 User Flow Diagram

```
                    START
                      │
         ┌────────────┴────────────┐
         │                         │
    Create Channel            Generate Video
         │                         │
         │                    Select Channel
         │                         │
         │                         ├─→ Has Template? ─No─→ Use Default
         │                         │         │
         │                        Yes        │
         ↓                         ↓         │
  [Browse Templates]      [Use Channel Template?]
         │                         │
    ┌────┴────┐              ┌────┴────┐
    │         │              │         │
  Search   Filter           Yes       No
    │         │              │         │
    └────┬────┘              │    [Select Different]
         │                   │         │
    [View Preview]           │         ↓
         │                   │    [Browse Templates]
         ↓                   │         │
  [Use Template]             │         ↓
         │                   │    [Select Template]
         ↓                   │         │
  Save to Channel            └────┬────┘
         │                        │
         ↓                        ↓
    TEMPLATE SAVED      TEMPLATE APPLIED TO VIDEO
                               │
                               ↓
                        Claude Generates Script
                               │
                               ↓
                          Video Created!
```

---

## 🎯 Template Selection Matrix

```
┌────────────────┬──────────┬─────────┬──────────────────────────┐
│ Video Type     │ Template │ Tone    │ Best For                 │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ Viral History  │ Dramatic │ Dramatic│ Epic historical events   │
│                │ History  │         │ with emotional impact    │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ Short Viral    │ Fast-    │ Energetic│ TikTok, Shorts, Reels  │
│                │ Paced    │         │ Quick information        │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ Tutorial       │ Educational│ Informative│ Teaching, How-to    │
│                │ Deep Dive│         │ Step-by-step guides      │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ True Crime     │ Mystery & │ Mysterious│ Unsolved cases,       │
│                │ Intrigue │         │ investigations           │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ Documentary    │ Documentary│ Authoritative│ Long-form,       │
│                │ Style    │         │ well-researched content  │
├────────────────┼──────────┼─────────┼──────────────────────────┤
│ Any Viral      │ High     │ Dramatic│ Maximum retention,       │
│                │ Retention│         │ keeps viewers watching   │
└────────────────┴──────────┴─────────┴──────────────────────────┘
```

---

## 🛠️ Template Creation Workflow

```
STEP 1: Open Editor
  │
  ├─→ From Library: "Create New Template" button
  │
  └─→ From Channel Form: "Browse Templates" → "Create New"

STEP 2: Basic Info
  │
  ├─→ Enter template name (unique, required)
  ├─→ Select category (or create custom)
  ├─→ Choose tone (9 options)
  └─→ Select length (short/medium/long)

STEP 3: Tags
  │
  ├─→ Type tag name
  ├─→ Press Enter or click "Add"
  └─→ Tags appear as removable chips

STEP 4: Write Prompt
  │
  ├─→ Write detailed instructions
  ├─→ Use variables: {TOPIC}, {TONE}, {LENGTH}
  ├─→ Monitor word/character count
  └─→ Toggle preview to see formatting

STEP 5: Review & Save
  │
  ├─→ Check tips section
  ├─→ Ensure all required fields filled
  ├─→ Click "Save Template"
  └─→ Template now available everywhere!

RESULT: Template appears in library
```

---

## 🔍 Search & Filter Examples

### Search Examples:
```
Search: "viral"
  → Finds: "High Retention Storytelling"
  → Tags include "viral"

Search: "history"
  → Finds: "Dramatic History"
  → Name contains "history"
  → Category is "History"

Search: "educational"
  → Finds: "Educational Deep Dive"
  → Tone is "educational"
```

### Filter Examples:
```
Category: "History"
  → Shows only History templates

Category: "Entertainment"
  → Shows: High Retention, Mystery, Fast-Paced

Category: "All Categories"
  → Shows everything
```

---

## 💾 Import/Export Flow

### Export:
```
1. Open Template Library
2. Find template to export
3. Click export icon (⬇)
4. JSON file downloads
   → Format: "Template-Name.json"
```

### Import:
```
1. Open Template Library
2. Click "Import" button (⬆)
3. Select JSON file
4. Template validates and imports
5. Appears in library immediately
```

### JSON Format:
```json
{
  "name": "My Custom Template",
  "category": "Custom",
  "customPrompt": "Instructions here...",
  "tone": "casual",
  "length": "medium",
  "tags": ["custom", "test"],
  "exportedAt": "2025-01-01T00:00:00.000Z",
  "version": "1.0"
}
```

---

## 🎬 Real-World Examples

### Example 1: History Channel Setup
```
Channel: "Epic History Shorts"
Template: Dramatic History
Custom Prompt: (none - use template as-is)

Video 1: "Battle of Thermopylae"
  → Uses channel template ✓
  → Dramatic, epic narration

Video 2: "How Rome Fell"
  → Uses channel template ✓
  → Same dramatic style

Video 3: "Quick Facts: Napoleon"
  → Override with "Fast-Paced Entertainment"
  → This one is quick & snappy, not dramatic
```

### Example 2: Educational Creator
```
Channel: "Science Made Simple"
Template: Educational Deep Dive
Custom Prompt: "Add: Use analogies from everyday life"

Video 1: "How DNA Works"
  → Uses channel template ✓
  → Clear teaching + custom analogies

Video 2: "Quantum Physics Basics"
  → Uses channel template ✓
  → Same clear style
```

### Example 3: Multi-Style Channel
```
Channel: "Story Time"
Template: (none)

Video 1: "Mystery of the Lost City"
  → Select: Mystery & Intrigue
  → Suspenseful storytelling

Video 2: "Epic Medieval Battle"
  → Select: Dramatic History
  → Epic narration

Video 3: "Quick Tale: Greek Myths"
  → Select: Fast-Paced Entertainment
  → Quick, energetic
```

---

## 🎨 Design Tokens

### Spacing:
```
Card padding:       p-4  (1rem)
Section margin:     mb-6 (1.5rem)
Button padding:     px-4 py-2
Modal padding:      p-6
```

### Typography:
```
Title:              text-2xl font-bold
Heading:            text-lg font-semibold
Body:               text-sm text-gray-600
Badge:              text-xs
```

### Borders:
```
Card border:        border border-gray-200 rounded-lg
Active card:        border-2 border-blue-500
Dashed empty:       border-2 border-dashed
```

### Transitions:
```
All buttons:        transition-colors duration-200
Hovers:             hover:bg-gray-100
Active states:      active:scale-95
```

---

## 📊 Component Hierarchy

```
App
├── Channels Page
│   └── ChannelForm
│       ├── Basic Settings
│       ├── Voice Settings
│       ├── Visual Settings
│       ├── [NEW] Prompt Template Section
│       │   └── PromptTemplateLibrary (modal)
│       │       └── PromptTemplateEditor (nested modal)
│       ├── Reference Scripts Section
│       └── Effects Settings
│
└── Generate Page
    └── VideoGenerator
        ├── Channel Selector
        ├── Title & Context
        ├── [NEW] Prompt Template Section
        │   └── PromptTemplateLibrary (modal)
        ├── Reference Scripts Section
        └── Video Settings
```

---

## 🚀 Quick Reference: What Users See

### Channel Creator:
1. **"Browse Templates"** button in channel form
2. **Beautiful card grid** with 6 default templates
3. **Click template** → sees preview
4. **"Use Template"** → template saved to channel
5. All future videos use this style automatically ✅

### Video Creator:
1. Select channel → **template auto-loaded** ✅
2. See **"✓ Using: Dramatic History"**
3. Option to **override for this video**
4. Generate → **script matches template style** ✅

### Advanced User:
1. **Create custom templates** for specific needs
2. **Duplicate & modify** system templates
3. **Export/share** templates as JSON
4. **Import** templates from others
5. Build **template library** over time

---

**The UI is intuitive, beautiful, and powerful. Users can get started with defaults or create unlimited custom templates!** 🎉

