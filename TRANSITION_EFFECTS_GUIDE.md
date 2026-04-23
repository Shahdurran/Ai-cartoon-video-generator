# Advanced Image Transition Effects Guide

## Overview

Your FFmpeg video generator now supports **both movement-based and cinematic xfade transition effects**! You can create dynamic videos with zoom, pan, motion effects, plus professional cinematic transitions like wipes, circles, and fades. The system also supports **array-based random selection** for automatic variety.

## Available Transition Types

### Movement Transitions (Applied to Individual Images)

| Transition Type | Effect Description | Visual Result |
|----------------|-------------------|---------------|
| `zoom_in` | Starts at 120% scale and zooms to normal size | Image appears to zoom into focus |
| `zoom_out` | Starts at 80% scale and grows to normal size | Image appears to grow from small to full |
| `pan_left` | Slides from right edge to center | Image moves horizontally left |
| `pan_right` | Slides from left edge to center | Image moves horizontally right |
| `pan_up` | Slides from bottom edge to center | Image moves vertically upward |
| `pan_down` | Slides from top edge to center | Image moves vertically downward |
| `scale` | Gentle breathing/pulsing effect | Image gently scales in rhythm |
| `zoom_rotate_cycle` | Complex animation: zoom in→out→rotate CW→CCW→original | Multi-phase animation with zoom and rotation |
| `none` | No movement (original behavior) | Simple image switching |

### Xfade Transitions (Cinematic Transitions Between Images)

| Transition Type | Effect Description | Visual Result |
|----------------|-------------------|---------------|
| `fade` | Classic crossfade | One image dissolves into the next |
| `wipeleft` | Wipe from right to left | New image wipes across from right |
| `wiperight` | Wipe from left to right | New image wipes across from left |
| `wipeup` | Wipe from bottom to top | New image wipes upward |
| `wipedown` | Wipe from top to bottom | New image wipes downward |
| `circleopen` | Circle opening effect | Circle iris opens to reveal new image |
| `circleclose` | Circle closing effect | Circle iris closes on old image |
| `slideleft` | Slide from left | New image slides in from left edge |
| `slideright` | Slide from right | New image slides in from right edge |
| `slideup` | Slide from bottom | New image slides up from bottom |
| `slidedown` | Slide from top | New image slides down from top |
| `vertopen` | Vertical blinds opening | Vertical bars reveal new image |
| `vertclose` | Vertical blinds closing | Vertical bars hide old image |
| `horzopen` | Horizontal blinds opening | Horizontal bars reveal new image |
| `horzclose` | Horizontal blinds closing | Horizontal bars hide old image |
| `circlecrop` | Circle crop to black | Circular crop effect |
| `rectcrop` | Rectangle crop | Rectangular crop transition |
| `distance` | Distance-based effect | Complex geometric transition |
| `fadeblack` | Fade through black | Two-stage: fade to black, then fade in |
| `fadewhite` | Fade through white | Two-stage: fade to white, then fade in |
| `radial` | Radial transition | Radial geometric effect |
| `smoothleft` | Smooth left transition | Smooth leftward motion |
| `smoothright` | Smooth right transition | Smooth rightward motion |
| `smoothup` | Smooth up transition | Smooth upward motion |
| `smoothdown` | Smooth down transition | Smooth downward motion |

## How to Use

### 1. Basic Usage

Add a `transition_type` field to any image object in your JSON configuration:

```json
{
  "section": "introduction",
  "start_sentence": "Welcome to our presentation",
  "end_sentence": "Let's move to the next topic",
  "image_url": "https://example.com/image.jpg",
  "transition_type": "zoom_in"
}
```

### 2. Complete Example

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "videoId": "my-dynamic-video",
  "useDynamicImages": true,
  "useSubtitles": true,
  "images": [
    {
      "section": "intro",
      "start_sentence": "Welcome everyone",
      "end_sentence": "Let's begin the presentation",
      "image_url": "https://picsum.photos/1792/1024?random=1",
      "transition_type": "zoom_in"
    },
    {
      "section": "main_topic",
      "start_sentence": "Our main focus today",
      "end_sentence": "This concludes the main section",
      "image_url": "https://picsum.photos/1792/1024?random=2", 
      "transition_type": "pan_left"
    },
    {
      "section": "conclusion",
      "start_sentence": "In conclusion",
      "end_sentence": "Thank you for watching",
      "image_url": "https://picsum.photos/1792/1024?random=3",
      "transition_type": "zoom_out"
    }
  ]
}
```

### 3. Array-Based Random Selection (NEW!)

Control which transitions are used for random selection by providing an `available_transitions` array:

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "videoId": "my-video",
  "useDynamicImages": true,
  "available_transitions": ["zoom_in", "fade", "wipeleft", "circleopen"],
  "images": [
    {
      "section": "intro",
      "start_sentence": "Welcome everyone",
      "image_url": "https://example.com/image1.jpg"
      // No transition_type = random from available_transitions array
    },
    {
      "section": "main",
      "start_sentence": "Our main topic",
      "image_url": "https://example.com/image2.jpg",
      "transition_type": "fade"
      // Specific transition overrides random selection
    }
  ]
}
```

### 4. Fully Automatic Random Effects

If you don't specify a `transition_type` and no `available_transitions` array, the system uses a default set:

```json
{
  "section": "surprise_me",
  "start_sentence": "This will have a random effect",
  "end_sentence": "Could be any transition type",
  "image_url": "https://example.com/image.jpg"
  // No transition_type = random from default set
}
```

## Technical Details

### Transition Duration
- **Automatic calculation**: Transition duration is automatically set to maximum 2 seconds or half the image display time, whichever is smaller
- **Example**: If an image shows for 8 seconds, transition will be 2 seconds. If it shows for 3 seconds, transition will be 1.5 seconds

### Image Quality
- All transitions maintain **16:9 aspect ratio** (1920x1080)
- **High-quality scaling** preserves image sharpness
- **Proper padding** ensures images fit correctly without distortion

### Performance
- Transitions use **hardware-accelerated FFmpeg filters** when available
- **Optimized for CPX-51** servers with 16 vCPUs and 32GB RAM
- All effects are **GPU-friendly** and render efficiently

## Testing Your Transitions

Use the included test script to verify transitions work:

```bash
node test-transitions.js
```

This will show you:
- All available transition types
- Example FFmpeg filter commands
- Random transition demonstrations

## Example Files

Five comprehensive example configurations are provided:

1. **`dynamic-images-example.json`** - Updated with transition examples and available_transitions
2. **`transition-effects-demo.json`** - Comprehensive demo of all movement effects
3. **`xfade-transitions-demo.json`** - Showcase of cinematic xfade transitions
4. **`mixed-transitions-demo.json`** - Mixed movement and xfade with array-based selection
5. **`test-transitions.js`** - Test script for verification of all features

## Advanced Tips

### 1. Combining with Effects
Transitions work perfectly with particle effects:

```json
{
  "useEffect": true,
  "effectType": "old_camera",
  "available_transitions": ["fade", "wipeleft", "circleopen"],
  "images": [
    {
      "transition_type": "zoom_in",
      // ... other fields
    }
  ]
}
```

### 2. Strategic Array Selection
- **Documentary style**: `["fade", "wipeleft", "slideup"]` for smooth, professional feel
- **Dynamic presentation**: `["zoom_in", "zoom_out", "circleopen", "wipeleft"]` for energy
- **Artistic video**: `["fadeblack", "fadewhite", "radial", "distance"]` for creativity
- **Corporate/Business**: `["fade", "pan_left", "pan_right"]` for conservative professionalism

### 3. Mixing Strategies
- **Specific + Random**: Set key transitions manually, let others be random
- **Transition families**: Group related effects (all wipes, all circles)
- **Contrast rhythm**: Alternate smooth (fade) with dynamic (zoom) transitions
- **Progressive complexity**: Start simple (fade), build to complex (circle effects)

### 4. Content-Based Selection
- **Landscapes**: `pan_left`, `pan_right`, `wipeleft`, `wiperight`
- **Portraits**: `pan_up`, `pan_down`, `fade`, `zoom_in`
- **Products**: `zoom_in`, `zoom_out`, `circleopen`, `scale`
- **Text/Graphics**: `fade`, `wipeleft`, `slideleft`, `slideright`

### 5. Timing Considerations
- **Short images** (< 4 seconds): `fade`, `none`, or simple wipes
- **Long images** (> 8 seconds): Any effect works well, especially movement
- **Rapid sequences**: Prefer xfade transitions for smoother flow
- **Slow pacing**: Movement transitions add visual interest

### 6. Special Effects: zoom_rotate_cycle
The `zoom_rotate_cycle` effect creates a sophisticated continuous animation:

**Animation Sequence:**
- **Zoom**: Smoothly pulses between 1.0x and 1.1x scale (double sine wave)
- **Rotation**: Smoothly rotates between -5° and +5° (single sine wave)
- **Combined Effect**: Creates a dynamic, breathing-like animation with gentle rotation

**Technical Details:**
- Uses sine wave expressions for smooth, continuous motion
- Zoom effect: `1 + 0.1*sin(2*PI*n/frames)` (creates one zoom cycle)
- Rotation effect: `0.087*sin(PI*n/frames)` (creates one rotation cycle)
- 5° rotation = 0.087 radians

**Best Use Cases:**
- **Product showcases**: Creates dynamic focus on key features
- **Portrait photography**: Adds life to static images
- **Artistic content**: Sophisticated visual interest
- **Longer image displays**: Works best with 6+ second durations

**Example:**
```json
{
  "transition_type": "zoom_rotate_cycle",
  "image_url": "https://example.com/product.jpg"
}
```

## Troubleshooting

### Issue: Effects not visible
- **Solution**: Ensure `useDynamicImages: true` in your configuration
- **Check**: Verify `transition_type` spelling matches exactly

### Issue: Jerky movement
- **Solution**: Use longer image display times (> 4 seconds)
- **Check**: Ensure good image quality (recommended: 1792x1024 or higher)

### Issue: Random effects too varied
- **Solution**: Specify `transition_type` explicitly for each image
- **Alternative**: Use `none` for no movement effects

## Migration from Old System

Your existing configurations will continue to work! 
- **Without `transition_type`**: Defaults to random effects
- **With `transition_type: "none"`**: Behaves exactly like the old system
- **No code changes needed**: Just add `transition_type` where desired

## Support

The advanced transition system is fully integrated with:
- ✅ Whisper sentence timing
- ✅ Subtitle generation  
- ✅ Particle effects
- ✅ Array-based random selection
- ✅ Both movement and xfade transitions
- ✅ All existing features
- ✅ High-performance rendering

## Summary of New Features

### 🎭 Dual Transition System
- **Movement transitions**: Individual image effects (zoom, pan, scale)
- **Xfade transitions**: Cinematic between-image effects (fade, wipe, circle)

### 🎲 Smart Random Selection
- **available_transitions array**: Control which transitions are used randomly
- **Default fallback**: Professional mix if no array provided
- **Override capability**: Specific transitions override random selection

### 📁 Comprehensive Examples
- **5 example files** covering all use cases
- **Mixed transition strategies** for professional results
- **Content-specific recommendations** for different video types

### 🔧 Technical Excellence
- **25+ transition types** from simple to complex
- **Automatic duration calculation** for optimal timing
- **Hardware acceleration** for fast rendering
- **Full backward compatibility** with existing configurations

---

**🎬 Create professional videos with cinematic transitions and intelligent automation!**