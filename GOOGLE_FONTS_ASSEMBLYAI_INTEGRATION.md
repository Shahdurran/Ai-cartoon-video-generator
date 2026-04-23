# Google Fonts & AssemblyAI Integration Guide

This document explains the new features added to the FFmpeg Video Generator:

1. **Google Fonts Support** for customizable subtitle styling
2. **AssemblyAI Integration** for high-quality audio transcription

## 🎨 Google Fonts Support

### Overview
The system now supports Google Fonts for subtitle rendering, allowing you to customize the appearance of subtitles with professional typography.

### Features
- Automatic download of Google Fonts
- Support for popular fonts optimized for video subtitles
- Fallback to system fonts if Google Fonts fail to load
- Comprehensive font styling options

### Usage in API Request

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "imageUrl": "https://example.com/background.jpg",
  "fontOptions": {
    "fontFamily": "Roboto",
    "fontSize": 20,
    "fontColor": "&HFFFFFF",
    "outlineColor": "&H000000",
    "backgroundColor": "&H80000000",
    "bold": 1,
    "italic": 0,
    "outline": 2,
    "shadow": 1,
    "alignment": 2,
    "marginV": 40,
    "marginL": 20,
    "marginR": 20
  }
}
```

### Font Options Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fontFamily` | string | "Arial" | Name of the Google Font or system font |
| `fontSize` | number | 18 | Font size in points |
| `fontColor` | string | "&HFFFFFF" | Font color in hex format (white) |
| `outlineColor` | string | "&H80000000" | Outline color in hex format (black with transparency) |
| `backgroundColor` | string | "&H80000000" | Background color for subtitle box |
| `bold` | number | 1 | Bold text (1 = bold, 0 = normal) |
| `italic` | number | 0 | Italic text (1 = italic, 0 = normal) |
| `outline` | number | 2 | Outline thickness |
| `shadow` | number | 1 | Shadow effect |
| `alignment` | number | 2 | Text alignment (2 = bottom center) |
| `marginV` | number | 30 | Vertical margin from edge |
| `marginL` | number | 10 | Left margin |
| `marginR` | number | 10 | Right margin |

### Color Format
Colors use ASS/SSA format: `&HAARRGGBB`
- AA = Alpha (transparency): 00 = opaque, FF = transparent
- RR = Red component
- GG = Green component  
- BB = Blue component

Examples:
- `&HFFFFFF` = White
- `&H000000` = Black
- `&HFF0000` = Red
- `&H80000000` = Black with 50% transparency

### Popular Fonts Available
- Open Sans
- Roboto
- Lato
- Montserrat
- Source Sans Pro
- Oswald
- Raleway
- PT Sans
- Ubuntu
- Nunito
- Playfair Display
- Merriweather
- Poppins
- Dancing Script
- Pacifico

### Get Available Fonts
```
GET /api/fonts
```

Response:
```json
{
  "popularFonts": ["Open Sans", "Roboto", "Lato", ...],
  "installedFonts": ["Open Sans", "Roboto", ...],
  "systemFonts": ["Arial", "Times New Roman", "Helvetica", ...]
}
```

## 🎤 AssemblyAI Integration

### Overview
AssemblyAI provides high-quality speech-to-text transcription with better accuracy than local Whisper models, especially for:
- Multiple languages
- Noisy audio
- Different accents and speaking styles
- Proper punctuation and formatting

### Features
- Automatic language detection
- High-accuracy transcription
- Proper punctuation and text formatting
- Word-level timestamps for precise subtitle timing
- Fallback to local Whisper if AssemblyAI fails

### Configuration
The AssemblyAI API key is configured in the service:
```javascript
// src/services/assemblyAIService.js
const client = new AssemblyAI({
  apiKey: '0792df5d958b42139214976e8509df68'
});
```

### Usage in API Request

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "imageUrl": "https://example.com/background.jpg",
  "useAssemblyAI": true
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `useAssemblyAI` | boolean | true | Use AssemblyAI for transcription (false = use local Whisper) |

### Transcription Features
- **Speech Model**: Uses AssemblyAI's "best" model for highest accuracy
- **Language Detection**: Automatically detects the spoken language
- **Punctuation**: Adds proper punctuation to transcripts
- **Text Formatting**: Formats text for better readability
- **Word Timestamps**: Provides precise timing for each word
- **Subtitle Generation**: Automatically creates properly timed SRT subtitles

### Subtitle Timing Logic
- Maximum 8 words per subtitle segment
- Maximum 5 seconds per segment
- Segments end naturally at punctuation marks
- Proper timing based on word-level timestamps

## 🚀 Complete API Example

### Enhanced Endpoint (Recommended)
```bash
curl -X POST http://localhost:3000/api/generate-video-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "imageUrl": "https://example.com/background.jpg",
    "useParticleEffect": true,
    "particleOpacity": 0.7,
    "useAssemblyAI": true,
    "fontOptions": {
      "fontFamily": "Roboto",
      "fontSize": 22,
      "fontColor": "&HFFFFFF",
      "outlineColor": "&H000000",
      "bold": 1,
      "outline": 3,
      "alignment": 2,
      "marginV": 50
    }
  }'
```

### Legacy Endpoint (Now Enhanced)
The original `/generate-video` endpoint now also supports AssemblyAI and Google Fonts:
```bash
curl -X POST http://localhost:3000/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/audio.mp3",
    "imageUrl": "https://example.com/background.jpg",
    "videoId": "my-video-123",
    "useAssemblyAI": true,
    "fontOptions": {
      "fontFamily": "Roboto",
      "fontSize": 22,
      "fontColor": "&HFFFFFF",
      "outlineColor": "&H000000",
      "bold": 1,
      "outline": 3,
      "alignment": 2,
      "marginV": 50
    }
  }'
```

### Response
```json
{
  "videoUrl": "http://localhost:3000/test-output/video_1642123456789.mp4",
  "effectsUsed": {
    "particleOverlay": true,
    "subtitles": true
  },
  "transcriptionMethod": "AssemblyAI",
  "fontUsed": "Roboto"
}
```

## 🔧 Technical Implementation

### Services Added
1. **AssemblyAIService** (`src/services/assemblyAIService.js`)
   - Handles audio transcription via AssemblyAI API
   - Converts transcripts to SRT format
   - Manages word-level timing

2. **GoogleFontsService** (`src/services/googleFontsService.js`)
   - Downloads Google Fonts automatically
   - Caches fonts for reuse
   - Provides font validation and fallbacks

### Modified Services
1. **SubtitleService** - Now supports both AssemblyAI and local Whisper
2. **VideoService** - Enhanced with Google Fonts support and custom styling
3. **VideoController** - Updated to handle new parameters

### New Routes
- `GET /api/fonts` - Get list of available fonts

## 🎯 Benefits

### Google Fonts Integration
- **Professional Typography**: Access to hundreds of high-quality fonts
- **Better Readability**: Fonts optimized for video content
- **Brand Consistency**: Use specific fonts to match brand guidelines
- **Automatic Management**: Fonts are downloaded and cached automatically

### AssemblyAI Integration
- **Higher Accuracy**: Better transcription quality than local models
- **Language Support**: Automatic language detection and support
- **Speed**: Faster processing than local Whisper models
- **Reliability**: Cloud-based service with high uptime
- **Professional Quality**: Proper punctuation and formatting

## 🔄 Fallback Behavior

### Font Fallbacks
1. Try to use specified Google Font
2. If download fails, fall back to system font
3. If system font unavailable, use Arial

### Transcription Fallbacks
1. Try AssemblyAI transcription
2. If AssemblyAI fails, fall back to local Whisper
3. Error handling for both methods

## 📝 Notes

- Google Fonts are cached locally after first download
- AssemblyAI requires internet connection
- Font files are stored in `public/fonts/` directory
- All subtitle timing is optimized for readability
- Color values use ASS/SSA format for FFmpeg compatibility
