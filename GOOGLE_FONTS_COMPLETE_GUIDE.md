# Complete Google Fonts Integration Guide

## 🎨 Overview

Your FFmpeg video generator now supports **any Google Font** from the payload! The system automatically detects, downloads, and uses Google Fonts for subtitle rendering with comprehensive fallback mechanisms.

## ✨ Key Features

### 🔄 **Automatic Font Detection & Download**
- **Any Google Font**: Supports any font name from Google Fonts
- **Automatic Download**: Downloads fonts on-demand if not already cached
- **Smart Caching**: Fonts are cached locally after first download
- **Multiple Variants**: Supports different font weights (regular, bold, etc.)

### 🛡️ **Robust Fallback System**
- **System Fonts**: Falls back to system fonts if Google Font fails
- **Multiple Variants**: Tries different font weights if primary fails
- **Error Handling**: Graceful degradation to Arial if all attempts fail

### 🔍 **Font Discovery & Validation**
- **Font Search**: Search for Google Fonts by name
- **Availability Check**: Verify if a font exists on Google Fonts
- **Variant Detection**: Get available font weights for any font

## 🚀 API Endpoints

### 1. **Get Available Fonts**
```http
GET /api/fonts
```

**Response:**
```json
{
  "popularFonts": ["Open Sans", "Roboto", "Lato", ...],
  "installedFonts": ["roboto-regular.ttf", "lato-regular.ttf", ...],
  "systemFonts": ["Arial", "Times New Roman", "Helvetica", ...]
}
```

### 2. **Search Google Fonts**
```http
GET /api/fonts/search?q=roboto
```

**Response:**
```json
{
  "searchTerm": "roboto",
  "matchingFonts": ["Roboto", "Roboto Slab", "Roboto Mono"],
  "totalFound": 3
}
```

### 3. **Check Font Availability**
```http
GET /api/fonts/check/Dancing%20Script
```

**Response:**
```json
{
  "fontName": "Dancing Script",
  "isAvailable": true,
  "variants": ["400", "700"],
  "message": "Font \"Dancing Script\" is available on Google Fonts"
}
```

## 📝 Usage Examples

### Basic Google Font Usage
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "imageUrl": "https://example.com/image.jpg",
  "videoId": "my-video",
  "useSubtitles": true,
  "fontOptions": {
    "fontFamily": "Roboto",
    "fontSize": 24
  }
}
```

### Advanced Font Styling
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "imageUrl": "https://example.com/image.jpg",
  "videoId": "styled-video",
  "useSubtitles": true,
  "fontOptions": {
    "fontFamily": "Dancing Script",
    "fontSize": 28,
    "fontColor": "&HFFD700",
    "outlineColor": "&H000000",
    "backgroundColor": "&H80000000",
    "bold": 1,
    "outline": 3,
    "shadow": 2,
    "alignment": 2,
    "marginV": 40
  }
}
```

### System Font Usage
```json
{
  "fontOptions": {
    "fontFamily": "Arial",
    "fontSize": 20
  }
}
```

## 🎯 Supported Font Types

### ✅ **Google Fonts** (Any Available)
- **Popular**: Roboto, Open Sans, Lato, Montserrat, Source Sans Pro
- **Display**: Oswald, Bebas Neue, Anton, Righteous
- **Script**: Dancing Script, Pacifico, Lobster
- **Serif**: Playfair Display, Merriweather, Crimson Text
- **Monospace**: Roboto Mono, Source Code Pro, Fira Code
- **And Many More**: Any font available on Google Fonts!

### ✅ **System Fonts**
- Arial, Times New Roman, Helvetica, Georgia
- Verdana, Tahoma, Courier New, Comic Sans MS
- Impact, Trebuchet MS, Arial Black, Palatino
- Garamond, Bookman, Avant Garde, Helvetica Neue

## 🔧 Font Options Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fontFamily` | string | "Arial" | **Any Google Font name or system font** |
| `fontSize` | number | 18 | Font size in points |
| `fontColor` | string | "&HFFFFFF" | Font color in hex format (white) |
| `outlineColor` | string | "&H80000000" | Outline color in hex format |
| `backgroundColor` | string | "&H80000000" | Background color in hex format |
| `bold` | number | 1 | Bold (1) or normal (0) |
| `italic` | number | 0 | Italic (1) or normal (0) |
| `outline` | number | 2 | Outline thickness |
| `shadow` | number | 1 | Shadow depth |
| `alignment` | number | 2 | Text alignment (1=left, 2=center, 3=right) |
| `marginV` | number | 30 | Vertical margin from bottom |
| `marginL` | number | 10 | Left margin |
| `marginR` | number | 10 | Right margin |

## 🎨 Popular Google Fonts for Subtitles

### **Clean & Modern**
- **Roboto**: Clean, modern, highly readable
- **Open Sans**: Friendly, approachable, excellent readability
- **Lato**: Elegant, professional, great for long text
- **Source Sans Pro**: Adobe's open-source font, very clean

### **Bold & Impact**
- **Oswald**: Condensed, bold, great for headlines
- **Bebas Neue**: Ultra-bold, perfect for impact
- **Anton**: Strong, condensed, attention-grabbing
- **Righteous**: Rounded, bold, friendly

### **Elegant & Script**
- **Dancing Script**: Handwritten, elegant, personal
- **Pacifico**: Casual script, friendly, relaxed
- **Lobster**: Bold script, eye-catching
- **Playfair Display**: Elegant serif, sophisticated

### **Technical & Monospace**
- **Roboto Mono**: Clean monospace, great for code
- **Source Code Pro**: Adobe's monospace, excellent readability
- **Fira Code**: Programming font with ligatures
- **JetBrains Mono**: Modern monospace, developer-friendly

## 🔄 How It Works

### 1. **Font Detection**
```javascript
// The system automatically detects if a font is:
// - A system font (uses directly)
// - A Google Font (downloads if needed)
// - Unknown (falls back to Arial)
```

### 2. **Download Process**
```javascript
// For Google Fonts:
// 1. Check if already cached
// 2. Query Google Fonts CSS API
// 3. Extract font file URL
// 4. Download .ttf file
// 5. Cache for future use
```

### 3. **Fallback Chain**
```javascript
// Font resolution priority:
// 1. Specified Google Font (downloaded)
// 2. System font (if available)
// 3. Fallback variants (400, normal, regular)
// 4. Default Arial
```

## 🧪 Testing

### Test with Popular Google Fonts
```bash
# Test with Roboto
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d @test-google-fonts.json

# Test with Dancing Script
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d @test-custom-google-font.json
```

### Test Font Search
```bash
# Search for fonts containing "roboto"
curl "http://localhost:3000/api/fonts/search?q=roboto"

# Check if a specific font is available
curl "http://localhost:3000/api/fonts/check/Dancing%20Script"
```

## 🎯 Best Practices

### ✅ **Do**
- Use popular Google Fonts for better performance
- Test font availability before using in production
- Use appropriate font sizes (18-28pt for subtitles)
- Consider contrast with background colors
- Cache fonts locally for faster subsequent requests

### ❌ **Don't**
- Use overly decorative fonts for long text
- Use fonts smaller than 16pt for subtitles
- Use fonts with poor contrast
- Rely on fonts that might not be available
- Use too many different fonts in one video

## 🚀 Performance Tips

### **Font Caching**
- Fonts are automatically cached after first download
- Cached fonts load instantly on subsequent requests
- Cache is stored in `public/fonts/` directory

### **Network Optimization**
- Popular fonts are pre-downloaded during initialization
- Font downloads happen in parallel with other operations
- Failed downloads gracefully fall back to system fonts

### **Memory Management**
- Font cache is managed efficiently
- Old fonts are not automatically cleaned up (manual cleanup required)
- Font files are typically 50-200KB each

## 🔧 Troubleshooting

### **Font Not Loading**
1. Check if font name is spelled correctly
2. Verify font exists on Google Fonts
3. Check network connectivity
4. Look for error messages in console

### **Font Not Displaying**
1. Ensure `useSubtitles: true`
2. Check font file was downloaded successfully
3. Verify font path in FFmpeg command
4. Test with a system font first

### **Performance Issues**
1. Use popular fonts that are likely cached
2. Avoid downloading many fonts simultaneously
3. Check available disk space for font cache
4. Monitor network usage during font downloads

## 📊 Font Statistics

### **Popular Fonts (Pre-downloaded)**
- Open Sans, Roboto, Lato, Montserrat, Source Sans Pro
- These fonts are downloaded during service initialization

### **Font Cache Location**
- **Windows**: `E:\ffmpeg video generator\public\fonts\`
- **Linux/Mac**: `./public/fonts/`

### **File Naming Convention**
- Google Fonts: `font-name-variant.ttf` (e.g., `roboto-regular.ttf`)
- System fonts: No file (handled by operating system)

## 🎉 Conclusion

Your video generator now supports **any Google Font** with:
- ✅ Automatic detection and download
- ✅ Smart caching and fallback systems
- ✅ Comprehensive API for font management
- ✅ Robust error handling
- ✅ Performance optimization

Simply specify any Google Font name in the `fontFamily` parameter, and the system will handle the rest!

---

**Ready to create beautiful videos with any Google Font! 🎨✨**
