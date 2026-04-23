# Subtitle Color Configuration Guide

## 🎨 Overview

This guide explains how to properly configure subtitle colors to ensure they are visible and readable in your generated videos.

## ❌ **Common Issue: Black/Invisible Subtitles**

### **Problem**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",
    "outlineColor": "#FFFFFF"
  }
}
```

**Result**: Completely black or invisible subtitles because both text and outline are the same color.

### **Solution**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",
    "outlineColor": "#000000"
  }
}
```

**Result**: White text with black outline for maximum visibility.

## 🎯 **Color Format Support**

The system now supports multiple color formats:

### **Hex Format (Recommended)**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",      // White text
    "outlineColor": "#000000",   // Black outline
    "backgroundColor": "#000000" // Black background
  }
}
```

### **Short Hex Format**
```json
{
  "fontOptions": {
    "fontColor": "#FFF",         // White text (short form)
    "outlineColor": "#000"       // Black outline (short form)
  }
}
```

### **ASS Format (Advanced)**
```json
{
  "fontOptions": {
    "fontColor": "&HFFFFFF",     // White text (BGR format)
    "outlineColor": "&H000000"   // Black outline (BGR format)
  }
}
```

## 🌈 **Recommended Color Combinations**

### **High Contrast (Best Visibility)**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",      // White text
    "outlineColor": "#000000",   // Black outline
    "backgroundColor": "#80000000", // Semi-transparent black background
    "outline": 3,
    "shadow": 1
  }
}
```

### **Classic White on Black**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",      // White text
    "outlineColor": "#000000",   // Black outline
    "outline": 2,
    "shadow": 1
  }
}
```

### **Yellow on Black (High Visibility)**
```json
{
  "fontOptions": {
    "fontColor": "#FFFF00",      // Yellow text
    "outlineColor": "#000000",   // Black outline
    "outline": 2,
    "shadow": 1
  }
}
```

### **Cyan on Black (Modern Look)**
```json
{
  "fontOptions": {
    "fontColor": "#00FFFF",      // Cyan text
    "outlineColor": "#000000",   // Black outline
    "outline": 2,
    "shadow": 1
  }
}
```

### **White on Blue (Professional)**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",      // White text
    "outlineColor": "#000080",   // Dark blue outline
    "outline": 2,
    "shadow": 1
  }
}
```

## 🎬 **Color Guidelines by Content Type**

### **Dramatic/Serious Content**
```json
{
  "fontOptions": {
    "fontColor": "#FFFFFF",
    "outlineColor": "#000000",
    "outline": 3,
    "shadow": 2
  }
}
```

### **Light/Comedy Content**
```json
{
  "fontOptions": {
    "fontColor": "#FFFF00",
    "outlineColor": "#000000",
    "outline": 2,
    "shadow": 1
  }
}
```

### **Technical/Educational Content**
```json
{
  "fontOptions": {
    "fontColor": "#00FFFF",
    "outlineColor": "#000000",
    "outline": 2,
    "shadow": 1
  }
}
```

### **Gaming/Modern Content**
```json
{
  "fontOptions": {
    "fontColor": "#00FF00",
    "outlineColor": "#000000",
    "outline": 2,
    "shadow": 1
  }
}
```

## 🔧 **Complete Font Options Reference**

```json
{
  "fontOptions": {
    "fontFamily": "Roboto",           // Font name (Google Font or system font)
    "fontSize": 24,                   // Font size in points
    "fontColor": "#FFFFFF",           // Text color (hex format)
    "outlineColor": "#000000",        // Outline color (hex format)
    "backgroundColor": "#80000000",   // Background color (hex format with alpha)
    "bold": 1,                        // Bold (1) or normal (0)
    "italic": 0,                      // Italic (1) or normal (0)
    "outline": 2,                     // Outline thickness (0-4)
    "shadow": 1,                      // Shadow depth (0-4)
    "alignment": 2,                   // Alignment (1=left, 2=center, 3=right)
    "marginV": 30,                    // Vertical margin from bottom
    "marginL": 10,                    // Left margin
    "marginR": 10                     // Right margin
  }
}
```

## 🎨 **Color Conversion Examples**

| Input Format | Output Format | Description |
|--------------|---------------|-------------|
| `#FFFFFF` | `&HFFFFFF` | White text |
| `#000000` | `&H000000` | Black outline |
| `#FF0000` | `&H0000FF` | Red text (RGB→BGR) |
| `#00FF00` | `&H00FF00` | Green text |
| `#0000FF` | `&HFF0000` | Blue text (RGB→BGR) |
| `#FFFF00` | `&H00FFFF` | Yellow text |
| `#FF00FF` | `&HFF00FF` | Magenta text |
| `#00FFFF` | `&HFFFF00` | Cyan text |

## 🚨 **Common Mistakes to Avoid**

### ❌ **Same Color for Text and Outline**
```json
{
  "fontColor": "#FFFFFF",
  "outlineColor": "#FFFFFF"  // Same as text - will be invisible!
}
```

### ❌ **No Contrast**
```json
{
  "fontColor": "#808080",    // Gray text
  "outlineColor": "#808080"  // Gray outline - poor visibility
}
```

### ❌ **Wrong Color Format**
```json
{
  "fontColor": "white",      // Text format not supported
  "outlineColor": "black"    // Text format not supported
}
```

### ❌ **Missing Outline**
```json
{
  "fontColor": "#FFFFFF",
  "outlineColor": "#000000",
  "outline": 0               // No outline - text may be hard to read
}
```

## ✅ **Best Practices**

### **1. Always Use Contrast**
- Light text on dark outline
- Dark text on light outline
- Never use the same color for both

### **2. Test Your Colors**
- Preview with different background colors
- Ensure readability in various lighting conditions
- Consider colorblind accessibility

### **3. Use Appropriate Thickness**
- `outline: 2-3` for most content
- `outline: 1` for subtle effects
- `outline: 4` for maximum visibility

### **4. Consider Background**
- Use semi-transparent background for busy scenes
- Adjust colors based on video content
- Test with actual video backgrounds

## 🧪 **Testing Your Colors**

### **Quick Test Request**
```json
{
  "audioUrl": "your-audio-url",
  "imageUrl": "your-image-url",
  "videoId": "color-test",
  "useSubtitles": true,
  "fontOptions": {
    "fontFamily": "Arial",
    "fontSize": 24,
    "fontColor": "#FFFFFF",
    "outlineColor": "#000000",
    "outline": 2,
    "shadow": 1
  }
}
```

### **Color Comparison Test**
Create multiple test videos with different color combinations to find the best one for your content.

## 🎯 **Your Fixed Request**

Here's your corrected request with proper color configuration:

```json
{
  "fontOptions": {
    "fontFamily": "SUSE Mono",
    "fontSize": 24,
    "fontColor": "#FFFFFF",        // White text
    "outlineColor": "#000000",     // Black outline (FIXED!)
    "backgroundColor": "#80000000", // Semi-transparent black background
    "bold": 1,
    "outline": 3,
    "shadow": 1,
    "alignment": 2,
    "marginV": 30,
    "marginL": 10,
    "marginR": 10
  }
}
```

**Key Changes:**
- ✅ `outlineColor` changed from `#FFFFFF` to `#000000`
- ✅ Added `backgroundColor` for better visibility
- ✅ Added `shadow` for enhanced readability
- ✅ Used proper hex color format

This should give you white text with a black outline that will be clearly visible against any background! 🎉
