# FFmpeg Video Generator

A Node.js application that generates videos from audio files and images, with automatic subtitle generation using Whisper.

## Features

- Generate videos from audio files and images
- Automatic subtitle generation using Whisper
- Support for particle effects overlay
- Configurable video settings
- Clean and modular codebase

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed on your system
- Python 3.7+ with Whisper installed

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ffmpeg-video-generator.git
cd ffmpeg-video-generator
```

2. Install dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install -U openai-whisper
# or
pip install -U faster-whisper
```

4. Create necessary directories:
```bash
mkdir -p public/videos public/effects temp test-output
```

## Usage

1. Start the server:
```bash
npm start
```

2. Send a POST request to `http://localhost:3000/generate-video` with the following JSON body:
```json
{
  "audioUrl": "URL_TO_AUDIO_FILE",
  "imageUrl": "URL_TO_IMAGE_FILE",
  "useParticleEffect": true,
  "particleOpacity": 0.5
}
```

3. The server will respond with a video URL when generation is complete:
```json
{
  "videoUrl": "http://localhost:3000/test-output/video_1234567890.mp4",
  "effectsUsed": {
    "particleOverlay": true,
    "subtitles": true
  }
}
```

## Image Modes

Choose between two image modes for your videos:

### 1. 🖼️ Single Image Mode (Default)
Uses one image throughout the entire video.

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "imageUrl": "https://example.com/background.jpg",
  "videoId": "my-video",
  "useDynamicImages": false,
  "useSubtitles": true
}
```

### 2. 🎬 Dynamic Images Mode  
Multiple images that change during the video based on specific sentences or timestamps. **Note: `imageUrl` is ignored in this mode.**

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "videoId": "my-video",
  "useDynamicImages": true,
  "useSubtitles": true,
  "images": [
    {
      "section": "intro",
      "start_sentence": "Welcome to our presentation",
      "end_sentence": "Let's begin with the first topic",
      "timestamp_start": "00:00:00",
      "timestamp_end": "00:00:07",
      "image_url": "https://example.com/intro-image.jpg"
    },
    {
      "section": "main_content",
      "start_sentence": "Now let's discuss the main topic",
      "end_sentence": "This concludes our main discussion",
      "timestamp_start": "00:00:08",
      "timestamp_end": "00:00:20",
      "image_url": "https://example.com/main-image.jpg"
    }
  ]
}
```

### How It Works

1. **🎯 RECOMMENDED: Sentence Matching**: With subtitles enabled, Whisper analyzes your audio and provides precise timing for when each sentence is spoken. This is **much more accurate** than manual timestamps.

2. **🎭 Hidden Subtitle Generation**: When `useSubtitles: false` but `useDynamicImages: true`, subtitles are still generated behind the scenes for accurate sentence matching, but they remain hidden from the final video output.

3. **⚠️ Fallback: Manual Timestamps**: If sentence matching fails or both subtitles and dynamic images are disabled, the system uses your provided timestamps. This is less accurate due to natural speech variations.

4. **🔄 Smart Matching**: The system uses multiple strategies:
   - **Exact Match**: Finds your exact sentence in subtitles
   - **Partial Match**: Matches first/last few words if exact match fails  
   - **Keyword Match**: Finds sentences with 2+ matching keywords

5. **🖼️ Image Transitions**: Images overlay the background at precisely timed moments.

### Parameters

**Common Parameters:**
- `audioUrl`: URL of the audio file (required)
- `imageUrl`: URL of the background image (required when `useDynamicImages: false`, ignored when `useDynamicImages: true`)
- `videoId`: Unique identifier for the video (required)
- `useDynamicImages`: Boolean - `true` for dynamic images, `false` for single image (default: `false`)
- `useSubtitles`: Boolean - Controls subtitle display visibility. When `false`, subtitles are still generated behind the scenes for dynamic images sentence matching but hidden from video output (default: `true`)

**Dynamic Images Mode Only:**
- `images`: Array of image objects (required when `useDynamicImages: true`)

**Image Object Fields (Dynamic Mode):**
- `section`: String identifier for organization (required)
- `start_sentence`: Exact text where the image should start showing (required)
- `end_sentence`: Exact text where the image should end showing (required)  
- `timestamp_start`: Start time in HH:MM:SS format (required)
- `timestamp_end`: End time in HH:MM:SS format (required)
- `image_url`: URL of the image to download and use (required)

### Response

The response will include information about the image mode used:

**Single Image Mode Response:**
```json
{
  "videoUrl": "http://server:3000/test-output/video.mp4",
  "videoId": "my-video",
  "fileName": "video.mp4",
  "imageMode": {
    "useDynamicImages": false,
    "description": "Single image throughout video",
    "dynamicImagesCount": 0
  },
  "effectsUsed": {
    "effect": null,
    "subtitles": true,
    "dynamicImages": 0
  },
  "dynamicImagesInfo": []
}
```

**Dynamic Images Mode Response:**
```json
{
  "videoUrl": "http://server:3000/test-output/video.mp4",
  "videoId": "my-video",
  "fileName": "video.mp4",
  "imageMode": {
    "useDynamicImages": true,
    "description": "Multiple images with sentence/timestamp timing",
    "dynamicImagesCount": 2
  },
  "effectsUsed": {
    "effect": null,
    "subtitles": true,
    "dynamicImages": 2
  },
  "dynamicImagesInfo": [
    {
      "section": "intro",
      "timing": "00:00:00 - 00:00:07",
      "syncMethod": "sentence_match",
      "confidence": "high",
      "recommendedMethod": true
    },
    {
      "section": "main_content", 
      "timing": "00:00:08 - 00:00:20",
      "syncMethod": "manual_timestamp",
      "confidence": "manual",
      "recommendedMethod": false
    }
  ]
}
```

### 💡 Best Practices

**🎯 For Perfect Synchronization:**
- **Always enable subtitles** (`"useSubtitles": true`) for Whisper-based timing
- Use **exact phrases** from your audio for `start_sentence` and `end_sentence`
- Make sentences **specific and unique** (avoid common words like "the", "and")
- Test with 3-5 word phrases first, then expand if needed

**📝 Sentence Writing Tips:**
- ✅ Good: "Welcome to our presentation today"
- ✅ Good: "Now let's discuss the main topic" 
- ❌ Avoid: "Hello" (too short)
- ❌ Avoid: "This is very important" (too generic)

**🖼️ Image Quality:**
- Use high-resolution images (1280x720 or higher)
- Images are automatically scaled to 1280x720
- Consider image content visibility over video duration

**⚠️ Timestamps as Backup Only:**
- Manual timestamps are **less accurate** than Whisper sentence matching
- Use them only when sentence matching fails
- Natural speech pace varies - timestamps may be off by several seconds

## Project Structure

```
ffmpeg-video-generator/
├── src/
│   ├── config/         # Configuration settings
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── routes/         # API routes
├── public/
│   ├── videos/         # Generated videos
│   └── effects/        # Video effects
├── temp/               # Temporary files
├── test-output/        # Test output directory
├── app.js             # Main application file
└── package.json
```

## Configuration

Configuration settings can be modified in `src/config/config.js`:

- Video settings (resolution, duration limits)
- Whisper settings (model size, chunk duration)
- Server settings (port, directories)

## License

MIT 