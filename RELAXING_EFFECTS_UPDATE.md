# Relaxing Video Effects Update

## Changes Made

### 1. Slowed Down Zoom and Rotation Effects

**Before:**
- Effect duration: 1-3 seconds (40% of image duration)
- Zoom intensity: 0.2 (20% zoom in/out)
- Rotation intensity: PI*1.05 (105% rotation)
- Rotation frequency: 50% chance

**After (Updated):**
- Effect duration: 100% of image duration (continuous, no pauses)
- Zoom intensity: 0.2 (20% zoom in/out) - smoother movement
- Rotation intensity: PI*0.02 (2% rotation) - very subtle rotation
- Rotation frequency: 50% chance - more variety
- Speed: 1 cycle per 4 seconds (much slower, more relaxing)

### 2. Fixed Image Scaling to Cover Full Screen

**Before:**
```javascript
// Created black bars on sides/top/bottom
scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black
```

**After:**
```javascript
// Crops image to cover full screen without black bars
scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720
```

### 3. Updated ZOOM_ROTATE_CYCLE Effect

**Before:**
- 4 zoom cycles per effect duration
- 5° rotation (0.087 radians)
- 50% chance of rotation

**After (Updated):**
- 1-2 zoom cycles per effect duration with 15-20% zoom intensity (much slower, more relaxing)
- 2% rotation (0.035 radians) - very subtle rotation
- 50% chance of rotation - more variety
- Complex cycles: 50% slower than basic cycles

## Files Modified

1. `src/utils/videoUtils.js` - Updated effect timing and intensity
2. `src/utils/imageUtils.js` - Updated image scaling to crop instead of pad
3. `relaxing-video-example.json` - New example configuration

## Result

The video effects are now much more suitable for relaxing content:
- **Slower, gentler movements** that don't distract from the content
- **Subtle rotations** that add life without being jarring
- **Full screen coverage** with no black bars
- **Longer effect durations** that create a more meditative experience

## Usage

Use the new `relaxing-video-example.json` configuration to test the updated effects, or apply these changes to your existing configurations.
