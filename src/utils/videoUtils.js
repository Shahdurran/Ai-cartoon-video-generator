const ffmpeg = require("fluent-ffmpeg");

/**
 * Get simple font directory path for FFmpeg filters
 * @param {string} fontPath - Path to font file
 * @returns {string} - Simple font directory path
 */
function getFontDir(fontPath) {
  if (!fontPath) return '';
  
  const path = require('path');
  const fontDir = path.dirname(fontPath);
  
  // Make relative to current working directory if it's absolute
  let simplePath;
  if (path.isAbsolute(fontDir)) {
    const relativePath = path.relative(process.cwd(), fontDir);
    simplePath = relativePath || '.';
  } else {
    simplePath = fontDir;
  }
  
  // Convert all backslashes to forward slashes (works on both Windows and Unix)
  simplePath = simplePath.replace(/\\/g, '/');
  
  return simplePath;
}

/**
 * Convert color format to ASS subtitle format
 * @param {string} color - Color in various formats (#FFFFFF, &HFFFFFF, etc.)
 * @returns {string} - Color in ASS format (&HBBGGRR)
 */
function normalizeColor(color) {
  if (!color) return '&HFFFFFF';
  
  // If already in ASS format, return as is
  if (color.startsWith('&H')) {
    return color;
  }
  
  // Convert from hex format (#FFFFFF or #FFF)
  if (color.startsWith('#')) {
    let hex = color.substring(1);
    
    // Handle short hex format (#FFF -> #FFFFFF)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    // Convert RGB to BGR for ASS format
    if (hex.length === 6) {
      const r = hex.substring(0, 2);
      const g = hex.substring(2, 4);
      const b = hex.substring(4, 6);
      return `&H${b}${g}${r}`;
    }
  }
  
  // Default to white if format is not recognized
  console.log(`⚠️ Unknown color format: ${color}, using white`);
  return '&HFFFFFF';
}

/**
 * Build font style string for subtitle rendering
 * @param {Object} fontOptions - Font configuration options
 * @returns {string} - FFmpeg font style string
 */
function buildFontStyle(fontOptions = {}) {
  const {
    fontFamily = 'Arial',
    fontPath = null,
    fontSize = 18,
    fontColor = '#FFFFFF',
    outlineColor = '#000000',
    backgroundColor = '#000000',
    bold = 1,
    italic = 0,
    outline = 2,
    shadow = 1,
    alignment = 2,
    marginV = 30,
    marginL = 10,
    marginR = 10
  } = fontOptions;

  // Normalize colors to ASS format
  const normalizedFontColor = normalizeColor(fontColor);
  const normalizedOutlineColor = normalizeColor(outlineColor);
  const normalizedBackgroundColor = normalizeColor(backgroundColor);

  console.log(`🎨 Font styling: ${fontFamily}, size: ${fontSize}, color: ${normalizedFontColor}, outline: ${normalizedOutlineColor}`);
  if (fontPath) {
    console.log(`🎨 Using custom font file: ${fontPath}`);
  }

  const styleOptions = [
    `FontName=${fontFamily}`,
    `FontSize=${fontSize}`,
    `PrimaryColour=${normalizedFontColor}`,
    `OutlineColour=${normalizedOutlineColor}`,
    `BackColour=${normalizedBackgroundColor}`,
    `Bold=${bold}`,
    `Italic=${italic}`,
    `Outline=${outline}`,
    `Shadow=${shadow}`,
    `Alignment=${alignment}`,
    `MarginV=${marginV}`,
    `MarginL=${marginL}`,
    `MarginR=${marginR}`
  ];

  return styleOptions.join(',');
}

/**
 * Get video duration in seconds
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} Duration in seconds
 */
async function getVideoDuration(videoPath) {
  try {
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    return parseFloat(metadata.format.duration) || 0;
  } catch (error) {
    console.error("Error getting video duration:", error);
    return 0;
  }
}

/**
 * Available transition types for dynamic images
 */
const TRANSITION_TYPES = {
  // Movement-based transitions (applied to individual images)
  NONE: 'none',           // Simple overlay (original behavior)
  ZOOM_IN: 'zoom_in',     // Start large and zoom in
  ZOOM_OUT: 'zoom_out',   // Start small and zoom out
  ZOOM_IN_ROTATE: 'zoom_in_rotate',     // Zoom in with 105% rotation
  ZOOM_OUT_ROTATE: 'zoom_out_rotate',   // Zoom out with 105% rotation
  PAN_LEFT: 'pan_left',   // Move from right to left
  PAN_RIGHT: 'pan_right', // Move from left to right
  PAN_UP: 'pan_up',       // Move from bottom to top
  PAN_DOWN: 'pan_down',   // Move from top to bottom
  SCALE: 'scale',         // Scale transition
  ZOOM_ROTATE_CYCLE: 'zoom_rotate_cycle', // Zoom in→out→rotate CW→CCW→original

  // FFmpeg xfade transitions (between images)
  FADE: 'fade',           // Classic crossfade
  WIPELEFT: 'wipeleft',   // Wipe from right to left
  WIPERIGHT: 'wiperight', // Wipe from left to right
  WIPEUP: 'wipeup',       // Wipe from bottom to top
  WIPEDOWN: 'wipedown',   // Wipe from top to bottom
  CIRCLEOPEN: 'circleopen', // Circle opening effect
  CIRCLECLOSE: 'circleclose', // Circle closing effect
  SLIDELEFT: 'slideleft', // Slide from left
  SLIDERIGHT: 'slideright', // Slide from right
  SLIDEUP: 'slideup',     // Slide from bottom
  SLIDEDOWN: 'slidedown', // Slide from top
  VERTOPEN: 'vertopen',   // Vertical open
  VERTCLOSE: 'vertclose', // Vertical close
  HORZOPEN: 'horzopen',   // Horizontal open
  HORZCLOSE: 'horzclose', // Horizontal close
  CIRCLECROP: 'circlecrop', // Circle crop to black
  RECTCROP: 'rectcrop',   // Rectangle crop
  DISTANCE: 'distance',   // Distance effect
  FADEBLACK: 'fadeblack', // Fade through black
  FADEWHITE: 'fadewhite', // Fade through white
  RADIAL: 'radial',       // Radial effect
  SMOOTHLEFT: 'smoothleft', // Smooth left
  SMOOTHRIGHT: 'smoothright', // Smooth right
  SMOOTHUP: 'smoothup',   // Smooth up
  SMOOTHDOWN: 'smoothdown' // Smooth down
};


/**
 * Generate transition effect filter for an image - COMPLETELY FIXED VERSION
 * Uses simplified FFmpeg expressions to avoid syntax errors
 * @param {string} inputLabel - Input image label
 * @param {string} outputLabel - Output label for the effect
 * @param {string} transitionType - Type of transition
 * @param {number} duration - Duration of the image display
 * @param {number} startTime - Start time of the image
 * @returns {string} FFmpeg filter string
 */
function generateTransitionEffect(inputLabel, outputLabel, transitionType, duration, startTime) {
  // Make effects run continuously throughout the entire image duration (no pauses)
  const effectDuration = duration; // Use 100% of image duration - no pauses
  const fps = 25; // Match the input image frame rate
  const effectFrames = Math.ceil(effectDuration * fps);

  console.log(`🌿 Continuous effect timing: duration=${duration}s, effectDuration=${effectDuration}s, frames=${effectFrames}`);

  // Randomly decide whether to add rotation (50% chance for more variety)
  const addRotation = Math.random() < 0.5;
  // Reduced rotation to 1% (PI*0.01) for more subtle effect
  const rotationFilter = addRotation ? `,rotate='PI*0.01*sin(2*PI*t/${effectDuration})':c=none:ow=1298:oh=720` : '';

  console.log(`🎲 Image effect: ${transitionType}${addRotation ? ' + rotation (1%)' : ' (no rotation)'}`);

  // Calculate cycle frames for seamless loops - slower pace
  const cyclesPerDuration = Math.max(1, Math.floor(effectDuration / 6)); // Slower: 1 cycle per 6 seconds
  const framesPerCycle = Math.floor(effectFrames / cyclesPerDuration);
  
  console.log(`Cycle calculation: ${cyclesPerDuration} cycles, ${framesPerCycle} frames per cycle`);

  switch (transitionType) {
    case TRANSITION_TYPES.ZOOM_IN:
      // Simple triangle wave using mod for smooth zoom cycles
      const zoomInExpr = `1+0.12*abs(2*mod(on/${framesPerCycle},1)-1)`;
      return `[${inputLabel}]zoompan=z='${zoomInExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps}${rotationFilter}[${outputLabel}]`;

    case TRANSITION_TYPES.ZOOM_OUT:
      // Inverted triangle wave for zoom out effect
      const zoomOutExpr = `1.12-0.12*abs(2*mod(on/${framesPerCycle},1)-1)`;
      return `[${inputLabel}]zoompan=z='${zoomOutExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps}${rotationFilter}[${outputLabel}]`;

    case TRANSITION_TYPES.ZOOM_IN_ROTATE:
      // Continuous zoom with rotation, no pauses
      const zoomInRotExpr = `1+0.12*abs(2*mod(on/${framesPerCycle},1)-1)`;
      const rotInExpr = `PI*0.02*sin(2*PI*n/${framesPerCycle})`;
      return `[${inputLabel}]zoompan=z='${zoomInRotExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps},rotate='${rotInExpr}':c=none:ow=1298:oh=720[${outputLabel}]`;

    case TRANSITION_TYPES.ZOOM_OUT_ROTATE:
      // Continuous zoom out with rotation, no pauses
      const zoomOutRotExpr = `1.12-0.12*abs(2*mod(on/${framesPerCycle},1)-1)`;
      const rotOutExpr = `PI*0.02*sin(2*PI*n/${framesPerCycle})`;
      return `[${inputLabel}]zoompan=z='${zoomOutRotExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps},rotate='${rotOutExpr}':c=none:ow=1298:oh=720[${outputLabel}]`;

    case TRANSITION_TYPES.PAN_LEFT:
      // Simple linear pan left using sine wave
      return `[${inputLabel}]zoompan=z=1.3:x='iw/2-(iw/zoom/2)+(iw*0.15)*sin(PI*on/${effectFrames})':y='ih/2-(ih/zoom/2)':d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;

    case TRANSITION_TYPES.PAN_RIGHT:
      // Simple linear pan right using sine wave
      return `[${inputLabel}]zoompan=z=1.3:x='iw/2-(iw/zoom/2)-(iw*0.15)*sin(PI*on/${effectFrames})':y='ih/2-(ih/zoom/2)':d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;

    case TRANSITION_TYPES.PAN_UP:
      // Simple linear pan up using sine wave
      return `[${inputLabel}]zoompan=z=1.3:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+(ih*0.2)*sin(PI*on/${effectFrames})':d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;

    case TRANSITION_TYPES.PAN_DOWN:
      // Simple linear pan down using sine wave
      return `[${inputLabel}]zoompan=z=1.3:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-(ih*0.2)*sin(PI*on/${effectFrames})':d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;

    case TRANSITION_TYPES.SCALE:
      // Simple breathing effect using triangle wave
      const breathingExpr = `1+0.15*abs(2*mod(on/${framesPerCycle},1)-1)`;
      return `[${inputLabel}]zoompan=z='${breathingExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;

    case TRANSITION_TYPES.ZOOM_ROTATE_CYCLE:
      // Complex pattern with smooth transitions
      const shouldRotateInCycle = Math.random() < 0.6; // 60% chance for rotation phases
      
      if (shouldRotateInCycle) {
        // Complex pattern with smooth zoom cycles and rotation
        const slowCycleFrames = Math.floor(framesPerCycle * 1.8); // Even slower for smoother effect
        // Triangle wave for smooth zoom without pauses
        const complexZoomExpr = `1+0.15*abs(2*mod(on/${slowCycleFrames},1)-1)`;
        // Smooth rotation with triangle wave modulation
        const complexRotExpr = `PI*0.02*sin(2*PI*n/${slowCycleFrames})*abs(2*mod(n/${framesPerCycle},1)-1)`;
        
        console.log(`Complex cycle with rotation: slow=${slowCycleFrames}, normal=${framesPerCycle}`);
        return `[${inputLabel}]zoompan=z='${complexZoomExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps},rotate='${complexRotExpr}':c=none:ow=1298:oh=720[${outputLabel}]`;
      } else {
        // Simple continuous zoom cycles with triangle wave - no pauses
        const simpleZoomExpr = `1+0.15*abs(2*mod(on/${framesPerCycle},1)-1)`;
        console.log(`Simple continuous zoom cycles: frames per cycle=${framesPerCycle}`);
        return `[${inputLabel}]zoompan=z='${simpleZoomExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;
      }

    case TRANSITION_TYPES.FADE:
      // Simple fade in effect
      return `[${inputLabel}]fade=t=in:st=0:d=2[${outputLabel}]`;

    case TRANSITION_TYPES.NONE:
      // No effect, just pass through with proper scaling
      console.log(`⚠️ WARNING: Using NONE effect for ${inputLabel}`);
      return `[${inputLabel}]scale=1298:720[${outputLabel}]`;

    default:
      // Fallback to simple continuous gentle zoom cycle
      console.error(`❌ ERROR: Unknown movement effect "${transitionType}" for ${inputLabel}, falling back to continuous zoom cycle`);
      const fallbackZoomExpr = `1+0.15*abs(2*mod(on/${framesPerCycle},1)-1)`;
      return `[${inputLabel}]zoompan=z='${fallbackZoomExpr}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${effectFrames}:s=1298x720:fps=${fps}[${outputLabel}]`;
  }
}
/**
 * Check if transition type is an xfade transition
 * @param {string} transitionType - Transition type to check
 * @returns {boolean} True if xfade transition
 */
function isXfadeTransition(transitionType) {
  const xfadeTransitions = [
    TRANSITION_TYPES.FADE, TRANSITION_TYPES.WIPELEFT, TRANSITION_TYPES.WIPERIGHT,
    TRANSITION_TYPES.WIPEUP, TRANSITION_TYPES.WIPEDOWN, TRANSITION_TYPES.CIRCLEOPEN,
    TRANSITION_TYPES.CIRCLECLOSE, TRANSITION_TYPES.SLIDELEFT, TRANSITION_TYPES.SLIDERIGHT,
    TRANSITION_TYPES.SLIDEUP, TRANSITION_TYPES.SLIDEDOWN, TRANSITION_TYPES.VERTOPEN,
    TRANSITION_TYPES.VERTCLOSE, TRANSITION_TYPES.HORZOPEN, TRANSITION_TYPES.HORZCLOSE,
    TRANSITION_TYPES.CIRCLECROP, TRANSITION_TYPES.RECTCROP, TRANSITION_TYPES.DISTANCE,
    TRANSITION_TYPES.FADEBLACK, TRANSITION_TYPES.FADEWHITE, TRANSITION_TYPES.RADIAL,
    TRANSITION_TYPES.SMOOTHLEFT, TRANSITION_TYPES.SMOOTHRIGHT, TRANSITION_TYPES.SMOOTHUP,
    TRANSITION_TYPES.SMOOTHDOWN
  ];
  return xfadeTransitions.includes(transitionType);
}

/**
 * Get random transition type from specified list or default list
 * @param {Array} transitionTypes - Optional array of transition types to choose from
 * @returns {string} Random transition type
 */
function getRandomTransition(transitionTypes = null) {
  let transitions;

  if (transitionTypes && Array.isArray(transitionTypes) && transitionTypes.length > 0) {
    // Use provided transition types
    transitions = transitionTypes.filter(type => Object.values(TRANSITION_TYPES).includes(type));
    if (transitions.length === 0) {
      console.warn('No valid transition types provided, using default set');
      transitions = getDefaultTransitions();
    }
  } else {
    // Use default transition types
    transitions = getDefaultTransitions();
  }

  return transitions[Math.floor(Math.random() * transitions.length)];
}

/**
 * Get default transition types (limited to 3 specified types)
 * @returns {Array} Array of default transition types
 */
function getDefaultTransitions() {
  return [
    TRANSITION_TYPES.SMOOTHLEFT,
    TRANSITION_TYPES.SMOOTHRIGHT,
    TRANSITION_TYPES.FADEBLACK
  ];
}

/**
 * Get random movement effect from specified list or default list
 * @param {Array} movementEffects - Optional array of movement effect types to choose from
 * @returns {string} Random movement effect type
 */
function getRandomMovementEffect(movementEffects = null) {
  const defaultMovementEffects = [
    TRANSITION_TYPES.ZOOM_IN,
    TRANSITION_TYPES.ZOOM_OUT,
    TRANSITION_TYPES.ZOOM_ROTATE_CYCLE
    // Always use zoom effects, rotation will be randomly added
  ];

  let effects;

  if (movementEffects && Array.isArray(movementEffects)) {
    if (movementEffects.length === 0) {
      console.log(`📋 Empty movement effects array provided - no movement effects will be applied`);
      return TRANSITION_TYPES.NONE;
    }

    console.log(`📋 Input movement effects: [${movementEffects.join(', ')}]`);

    // Filter to only include valid movement effect types (exclude NONE unless explicitly requested)
    effects = movementEffects.filter(type => {
      const isValid = Object.values(TRANSITION_TYPES).includes(type);
      const isNotXfade = !isXfadeTransition(type);
      const isNotNone = type !== TRANSITION_TYPES.NONE;
      console.log(`   ${type}: valid=${isValid}, notXfade=${isNotXfade}, notNone=${isNotNone}`);
      return isValid && isNotXfade && isNotNone;
    });

    console.log(`✅ Filtered movement effects: [${effects.join(', ')}]`);

    if (effects.length === 0) {
      console.warn('❌ No valid movement effects found in provided array, using defaults');
      effects = defaultMovementEffects;
    }
  } else {
    console.log(`📋 No movement effects provided, using defaults`);
    effects = defaultMovementEffects;
  }

  console.log(`🎲 Final available movement effects: [${effects.join(', ')}]`);

  if (effects.length === 0) {
    console.error('❌ CRITICAL: No movement effects available! Falling back to zoom_out');
    return TRANSITION_TYPES.ZOOM_OUT;
  }

  const selectedEffect = effects[Math.floor(Math.random() * effects.length)];
  console.log(`🎯 Selected movement effect: ${selectedEffect}`);
  return selectedEffect;
}

/**
 * Get random xfade transition from specified list or default list
 * @param {Array} transitionEffects - Optional array of xfade transition types to choose from
 * @returns {string} Random xfade transition type
 */
function getRandomXfadeTransition(transitionEffects = null) {
  const defaultTransitionEffects = [
    TRANSITION_TYPES.SMOOTHLEFT,
    TRANSITION_TYPES.SMOOTHRIGHT,
    TRANSITION_TYPES.FADEBLACK
  ];

  let effects;

  if (transitionEffects && Array.isArray(transitionEffects) && transitionEffects.length > 0) {
    // Filter to only include valid xfade transition types
    effects = transitionEffects.filter(type => Object.values(TRANSITION_TYPES).includes(type) && isXfadeTransition(type));

    if (effects.length === 0) {
      console.warn('No valid transition effects found in provided array, using defaults');
      effects = defaultTransitionEffects;
    }
  } else {
    effects = defaultTransitionEffects;
  }

  return effects[Math.floor(Math.random() * effects.length)];
}

/**
 * Build FFmpeg filters for dynamic images with movement-based transitions and aspect ratio preservation
 * @param {Array} processedImages - Array of processed images with timing
 * @param {number} durationInSeconds - Video duration
 * @param {boolean} useOverlay - Whether to use overlay effects
 * @param {number} particleOpacity - Opacity for particle effects
 * @param {boolean} useSubtitles - Whether to include subtitles
 * @param {string} finalSubtitlePath - Path to subtitle file
 * @param {number} overlayDuration - Duration of overlay effect
 * @param {Function} escapeSubtitlePath - Function to escape subtitle paths
 * @param {number} timingOffsetSeconds - Lead-in to show images earlier (to reduce perceived lag)
 * @param {boolean} showFirstImageFromZero - If true, first image appears at t=0 regardless of start time
 * @returns {Object} Object containing videoFilters array and inputMapping number
 */
function buildDynamicImageFilters(processedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, overlayDuration = 0, escapeSubtitlePath = null, timingOffsetSeconds = 0, showFirstImageFromZero = false, fontOptions = {}, singleImageEffects = null) {
  if (!processedImages || processedImages.length === 0) {
    // No dynamic images, use single image logic with optional movement effects
    let videoFilters = [];

    // Scale 1536x1024 (3:2) to fit width 1280px, then center crop to 1298x720 (maximum width usage)
    const scaleFilter = "scale=1298:-1,crop=1298:720";

    // Check if we should apply movement effects to the single image
    let shouldApplyMovementEffects = false;
    let movementEffect = null;
    
    if (singleImageEffects) {
      const { default_movement_effects, disable_movement_effects } = singleImageEffects;
      
      if (!disable_movement_effects && default_movement_effects && Array.isArray(default_movement_effects) && default_movement_effects.length > 0) {
        shouldApplyMovementEffects = true;
        movementEffect = getRandomMovementEffect(default_movement_effects);
        console.log(`🎬 Single image mode: Applying movement effect: ${movementEffect}`);
      } else if (disable_movement_effects) {
        console.log(`🚫 Single image mode: Movement effects disabled`);
      } else {
        console.log(`📷 Single image mode: No movement effects specified, using static image`);
      }
    }

    if (useOverlay) {
      // Apply movement effect to background if specified, otherwise use basic scaling
      if (shouldApplyMovementEffects && movementEffect && movementEffect !== TRANSITION_TYPES.NONE) {
        // First scale the image
        videoFilters.push(`[0:v]${scaleFilter}[scaled_bg]`);
        
        // Apply movement effect
        const transitionFilter = generateTransitionEffect(
          'scaled_bg',
          'bg',
          movementEffect,
          durationInSeconds,
          0
        );
        videoFilters.push(transitionFilter);
      } else {
        // No movement effects, use basic scaling
        videoFilters.push(`[0:v]${scaleFilter}[bg]`);
      }
      
      // Optimized overlay filters with proper input/output labels and aspect ratio preservation
      videoFilters.push(
        `[1:v]scale=1298:720:flags=fast_bilinear,format=yuva420p,colorchannelmixer=aa=${particleOpacity}[overlay]`
      );
      videoFilters.push("[bg][overlay]blend=all_mode=screen:all_opacity=0.5[blended]");

      // Add subtitles to the blended result if enabled
      if (useSubtitles && finalSubtitlePath) {
        const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
        // Always use subtitles filter for better font control
        const fontStyle = buildFontStyle(fontOptions);
        console.log(`🎨 Using subtitles filter with font: ${fontOptions.fontFamily || 'default'}`);
        
        let subtitleFilter = `[blended]subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
        videoFilters.push(subtitleFilter);
      } else {
        videoFilters.push("[blended]null[final]");
      }
    } else {
      // Simple background with optional movement effects and subtitles
      if (shouldApplyMovementEffects && movementEffect && movementEffect !== TRANSITION_TYPES.NONE) {
        // First scale the image
        videoFilters.push(`[0:v]${scaleFilter}[scaled_img]`);
        
        // Apply movement effect
        const transitionFilter = generateTransitionEffect(
          'scaled_img',
          'movement_img',
          movementEffect,
          durationInSeconds,
          0
        );
        videoFilters.push(transitionFilter);
        
        // Add subtitles if enabled
        if (useSubtitles && finalSubtitlePath) {
          const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
          const isASSFile = finalSubtitlePath.toLowerCase().endsWith('.ass');
          
          if (isASSFile) {
            console.log(`🎨 Using ASS file with embedded styles (font: ${fontOptions.fontFamily || 'from ASS'})`);
            let subtitleFilter = `[movement_img]subtitles=${escapedSubPath}[final]`;
            videoFilters.push(subtitleFilter);
          } else {
            const fontStyle = buildFontStyle(fontOptions);
            console.log(`🎨 Using SRT file with force_style (font: ${fontOptions.fontFamily || 'default'})`);
            let subtitleFilter = `[movement_img]subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
            videoFilters.push(subtitleFilter);
          }
        } else {
          videoFilters.push("[movement_img]null[final]");
        }
      } else {
        // No movement effects, use basic scaling with optional subtitles
        if (useSubtitles && finalSubtitlePath) {
          const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
          const isASSFile = finalSubtitlePath.toLowerCase().endsWith('.ass');
          
          if (isASSFile) {
            console.log(`🎨 Using ASS file with embedded styles (font: ${fontOptions.fontFamily || 'from ASS'})`);
            let subtitleFilter = `[0:v]${scaleFilter},subtitles=${escapedSubPath}[final]`;
            videoFilters.push(subtitleFilter);
          } else {
            const fontStyle = buildFontStyle(fontOptions);
            console.log(`🎨 Using SRT file with force_style (font: ${fontOptions.fontFamily || 'default'})`);
            let subtitleFilter = `[0:v]${scaleFilter},subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
            videoFilters.push(subtitleFilter);
          }
        } else {
          videoFilters.push(`[0:v]${scaleFilter}[final]`);
        }
      }
    }

    return { videoFilters, inputMapping: useOverlay ? 2 : 1 };
  }

  // Dynamic images mode - create seamless sequential transitions
  let videoFilters = [];
  let inputIndex = 0;

  if (processedImages.length === 0) {
    throw new Error("No processed images available for dynamic mode");
  }

  console.log(`🎬 Building dynamic image transitions for ${processedImages.length} images`);

  // Scale 1536x1024 (3:2) to fit width 1280px, then center crop to 1298x720 (maximum width usage)
  const scaleFilter = "scale=1298:-1,crop=1298:720";

  // Sort images by start time to ensure proper sequence
  const sortedImages = [...processedImages].sort((a, b) => a.startSeconds - b.startSeconds);

  // Determine which mode to use based on parameters
  console.log(`🔍 Checking for separate effects parameters...`);
  console.log(`   First image default_movement_effects:`, sortedImages[0]?.default_movement_effects);
  console.log(`   First image default_transition_effects:`, sortedImages[0]?.default_transition_effects);

  const hasNewSeparateEffects = sortedImages.some(img =>
    img.default_movement_effects || img.default_transition_effects ||
    img.movement_effect || img.transition_to_next
  );

  console.log(`🎯 hasNewSeparateEffects: ${hasNewSeparateEffects}`);

  if (hasNewSeparateEffects) {
    // NEW: Use combined mode with separate movement and transition effects
    console.log(`🎬 Using combined mode: movement effects + xfade transitions`);
    return buildCombinedEffects(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds, showFirstImageFromZero, fontOptions);
  } else {
    // LEGACY: Determine if we have any xfade transitions for backward compatibility
    const hasXfadeTransitions = sortedImages.some(img => {
      const transitionType = img.transition_type || getRandomTransition(img.available_transitions);
      return isXfadeTransition(transitionType);
    });

    if (hasXfadeTransitions) {
      console.log(`🔄 Using legacy xfade transition mode`);
      return buildXfadeTransitions(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds, showFirstImageFromZero, fontOptions);
    } else {
      console.log(`🎭 Using legacy movement transition mode`);
      return buildMovementTransitions(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds, showFirstImageFromZero, fontOptions);
    }
  }
}

/**
 * Build xfade transitions between images
 * @param {Array} sortedImages - Sorted images array
 * @param {number} durationInSeconds - Video duration
 * @param {boolean} useOverlay - Whether to use overlay effects
 * @param {number} particleOpacity - Particle opacity
 * @param {boolean} useSubtitles - Whether to use subtitles
 * @param {string} finalSubtitlePath - Subtitle path
 * @param {Function} escapeSubtitlePath - Path escape function
 * @param {string} scaleFilter - Scale filter string
 * @returns {Object} Filters and input mapping
 */
function buildXfadeTransitions(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds = 0, showFirstImageFromZero = false, fontOptions = {}) {
  let videoFilters = [];
  let inputIndex = 0;

  console.log(`🔄 Building xfade transitions between ${sortedImages.length} images`);
  if (timingOffsetSeconds && timingOffsetSeconds !== 0) {
    console.log(`⏱️ Applying timing offset (lead-in): ${timingOffsetSeconds}s`);
  }

  // Scale all images first
  for (let i = 0; i < sortedImages.length; i++) {
    videoFilters.push(`[${inputIndex}:v]${scaleFilter}[scaled_img_${i}]`);
    inputIndex++;
  }

  // Create a black background and overlay the first image at the correct time
  let currentLabel;

  if (sortedImages.length > 0) {
    const firstImg = sortedImages[0];
    console.log(`🎬 First image timing: Will appear at ${firstImg.startSeconds}s`);

    // Create a black background that transitions to the first image at the correct time
    videoFilters.push(`color=c=black:s=1298x720:d=${durationInSeconds}[bg]`);
    const firstStartAdjRaw = Math.max(0, (firstImg.startSeconds || 0) - (timingOffsetSeconds || 0));
    const firstStartAdj = showFirstImageFromZero ? 0 : firstStartAdjRaw;
    const firstEnableExpr = `enable='gte(t,${firstStartAdj})'`;
    videoFilters.push(`[bg][scaled_img_0]overlay=0:0:${firstEnableExpr}[base_0]`);
    currentLabel = "base_0";

    console.log(`🔄 First image overlay: Image 1 activates at ${firstImg.startSeconds}s`);
  }

  // Create xfade transitions between consecutive images
  for (let i = 1; i < sortedImages.length; i++) {
    const transitionType = sortedImages[i].transition_type || getRandomTransition(sortedImages[i].available_transitions);
    const transitionStart = sortedImages[i].startSeconds;
    const transitionStartAdj = Math.max(0, (transitionStart || 0) - (timingOffsetSeconds || 0));

    // Calculate transition duration with safety checks
    const imageDuration = sortedImages[i].endSeconds - sortedImages[i].startSeconds;
    let transitionDuration = Math.min(1.0, Math.max(0.1, imageDuration / 3)); // Minimum 0.1s, maximum 1.0s

    // Ensure transition duration doesn't exceed the time available before transition start
    const availableTime = transitionStartAdj;
    if (transitionDuration > availableTime) {
      transitionDuration = Math.max(0.1, availableTime * 0.8); // Use 80% of available time, min 0.1s
    }

    // Calculate offset ensuring it's never negative
    const offset = Math.max(0, transitionStartAdj - transitionDuration);

    const nextLabel = i === sortedImages.length - 1 ? "xfade_final" : `xfade_${i}`;

    console.log(`🔄 Xfade ${i}: "${transitionType}" at ${transitionStartAdj}s (${transitionDuration}s duration, offset=${offset}s)`);

    // Create xfade filter
    videoFilters.push(
      `[${currentLabel}][scaled_img_${i}]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}[${nextLabel}]`
    );

    currentLabel = nextLabel;
  }

  // If only one image, the timing is already handled above
  if (sortedImages.length === 1) {
    videoFilters.push(`[${currentLabel}]null[xfade_final]`);
  }

  // Handle overlay effects
  if (useOverlay) {
    videoFilters.push(
      `[${inputIndex}:v]scale=1298:720:flags=fast_bilinear,format=yuva420p,colorchannelmixer=aa=${particleOpacity}[overlay]`
    );
    videoFilters.push(`[${currentLabel}][overlay]blend=all_mode=screen:all_opacity=0.5[blended]`);
    currentLabel = "blended";
    inputIndex++;
  }

  // Add subtitles
  if (useSubtitles && finalSubtitlePath) {
    const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
    
    // Check if this is an ASS file (which has embedded styles)
    const isASSFile = finalSubtitlePath.toLowerCase().endsWith('.ass');
    
    if (isASSFile) {
      // For ASS files, use embedded styles (don't force_style)
      console.log(`🎨 Using ASS file with embedded styles (font: ${fontOptions.fontFamily || 'from ASS'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}[final]`;
      videoFilters.push(subtitleFilter);
    } else {
      // For SRT files, apply force_style
      const fontStyle = buildFontStyle(fontOptions);
      console.log(`🎨 Using SRT file with force_style (font: ${fontOptions.fontFamily || 'default'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
      videoFilters.push(subtitleFilter);
    }
  } else {
    videoFilters.push(`[${currentLabel}]null[final]`);
  }

  console.log(`✅ Built ${videoFilters.length} xfade filter operations`);
  return { videoFilters, inputMapping: inputIndex };
}

/**
 * Build movement-based transitions for images
 * @param {Array} sortedImages - Sorted images array
 * @param {number} durationInSeconds - Video duration
 * @param {boolean} useOverlay - Whether to use overlay effects
 * @param {number} particleOpacity - Particle opacity
 * @param {boolean} useSubtitles - Whether to use subtitles
 * @param {string} finalSubtitlePath - Subtitle path
 * @param {Function} escapeSubtitlePath - Path escape function
 * @param {string} scaleFilter - Scale filter string
 * @returns {Object} Filters and input mapping
 */
function buildMovementTransitions(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds = 0, showFirstImageFromZero = false, fontOptions = {}) {
  let videoFilters = [];
  let inputIndex = 0;

  console.log(`🎭 Building movement transitions for ${sortedImages.length} images`);
  if (timingOffsetSeconds && timingOffsetSeconds !== 0) {
    console.log(`⏱️ Applying timing offset (lead-in): ${timingOffsetSeconds}s`);
  }

  // Scale and apply movement effects to all images
  for (let i = 0; i < sortedImages.length; i++) {
    const img = sortedImages[i];
    const transitionType = img.transition_type || getRandomTransition(img.available_transitions);
    const duration = img.endSeconds - img.startSeconds;

    console.log(`📷 Image ${i + 1}: ${img.startSeconds}s - ${img.section} (${transitionType})`);

    // Scale image first
    videoFilters.push(`[${inputIndex}:v]${scaleFilter}[base_img_${i}]`);

    // Apply movement effect
    const transitionFilter = generateTransitionEffect(
      `base_img_${i}`,
      `scaled_img_${i}`,
      transitionType,
      duration,
      img.startSeconds
    );
    videoFilters.push(transitionFilter);

    inputIndex++;
  }

  // Create sequential overlays with proper timing for ALL images, including the first one
  let currentLabel;

  // Handle the first image with proper timing control
  if (sortedImages.length > 0) {
    const firstImg = sortedImages[0];
    console.log(`🎬 First image timing: Will appear at ${firstImg.startSeconds}s`);

    // Create a black background that transitions to the first image at the correct time
    videoFilters.push(`color=c=black:s=1298x720:d=${durationInSeconds}[bg]`);
    const firstStartAdjRaw = Math.max(0, (firstImg.startSeconds || 0) - (timingOffsetSeconds || 0));
    const firstStartAdj = showFirstImageFromZero ? 0 : firstStartAdjRaw;
    const firstEnableExpr = `enable='gte(t,${firstStartAdj})'`;
    videoFilters.push(`[bg][scaled_img_0]overlay=0:0:${firstEnableExpr}[base_0]`);
    currentLabel = "base_0";

    console.log(`🔄 First image overlay: Image 1 activates at ${firstImg.startSeconds}s`);
  }

  for (let i = 1; i < sortedImages.length; i++) {
    const img = sortedImages[i];
    const nextLabel = i === sortedImages.length - 1 ? "movement_final" : `movement_${i}`;

    const startAdj = Math.max(0, (img.startSeconds || 0) - (timingOffsetSeconds || 0));
    const enableExpr = `enable='gte(t,${startAdj})'`;
    videoFilters.push(`[${currentLabel}][scaled_img_${i}]overlay=0:0:${enableExpr}[${nextLabel}]`);

    console.log(`🔄 Movement overlay ${i}: Image ${i + 1} activates at ${img.startSeconds}s`);
    currentLabel = nextLabel;
  }

  // If only one image, the timing is already handled above
  if (sortedImages.length === 1) {
    videoFilters.push(`[${currentLabel}]null[movement_final]`);
  }

  // Handle overlay effects
  if (useOverlay) {
    videoFilters.push(
      `[${inputIndex}:v]scale=1298:720:flags=fast_bilinear,format=yuva420p,colorchannelmixer=aa=${particleOpacity}[overlay]`
    );
    videoFilters.push(`[${currentLabel}][overlay]blend=all_mode=screen:all_opacity=0.5[blended]`);
    currentLabel = "blended";
    inputIndex++;
  }

  // Add subtitles
  if (useSubtitles && finalSubtitlePath) {
    const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
    
    // Check if this is an ASS file (which has embedded styles)
    const isASSFile = finalSubtitlePath.toLowerCase().endsWith('.ass');
    
    if (isASSFile) {
      // For ASS files, use embedded styles (don't force_style)
      console.log(`🎨 Using ASS file with embedded styles (font: ${fontOptions.fontFamily || 'from ASS'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}[final]`;
      videoFilters.push(subtitleFilter);
    } else {
      // For SRT files, apply force_style
      const fontStyle = buildFontStyle(fontOptions);
      console.log(`🎨 Using SRT file with force_style (font: ${fontOptions.fontFamily || 'default'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
      videoFilters.push(subtitleFilter);
    }
  } else {
    videoFilters.push(`[${currentLabel}]null[final]`);
  }

  console.log(`✅ Built ${videoFilters.length} movement filter operations`);
  return { videoFilters, inputMapping: inputIndex };
}

/**
 * Build combined effects: movement effects on individual images WITH xfade transitions between them
 * @param {Array} sortedImages - Sorted images array
 * @param {number} durationInSeconds - Video duration
 * @param {boolean} useOverlay - Whether to use overlay effects
 * @param {number} particleOpacity - Particle opacity
 * @param {boolean} useSubtitles - Whether to use subtitles
 * @param {string} finalSubtitlePath - Subtitle path
 * @param {Function} escapeSubtitlePath - Path escape function
 * @param {string} scaleFilter - Scale filter string
 * @returns {Object} Filters and input mapping
 */
/**
 * Build combined effects: movement effects on individual images WITH xfade transitions between them
 * FIXED: Removes timing conflicts that cause first image shaking
 */
function buildCombinedEffects(sortedImages, durationInSeconds, useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, escapeSubtitlePath, scaleFilter, timingOffsetSeconds = 0, showFirstImageFromZero = false, fontOptions = {}) {
  let videoFilters = [];
  let inputIndex = 0;

  console.log(`🎬 Building combined effects for ${sortedImages.length} images`);
  console.log(`   📷 Individual image movement effects + 🔄 xfade transitions between images`);
  if (timingOffsetSeconds && timingOffsetSeconds !== 0) {
    console.log(`⏱️ Applying timing offset (lead-in): ${timingOffsetSeconds}s`);
  }

  // Step 1: Scale and apply movement effects to all images
  for (let i = 0; i < sortedImages.length; i++) {
    const img = sortedImages[i];

    // Determine movement effect for this image
    let movementEffect;
    if (img.movement_effect) {
      movementEffect = img.movement_effect;
      console.log(`📌 Image ${i + 1}: Using specific movement_effect: ${movementEffect}`);
    } else {
      console.log(`🎲 Image ${i + 1}: Selecting random from default_movement_effects:`, img.default_movement_effects);
      movementEffect = getRandomMovementEffect(img.default_movement_effects);
    }

    // Safety check to ensure we always have a movement effect
    if (!movementEffect || movementEffect === TRANSITION_TYPES.NONE) {
      console.log(`⚠️ Image ${i + 1}: No movement effect or NONE detected, using static image`);
      // For NONE, we'll just pass the image through without movement effects
      videoFilters.push(`[${inputIndex}:v]${scaleFilter}[movement_img_${i}]`);
      inputIndex++;
      continue;
    }

    const duration = img.endSeconds - img.startSeconds;
    console.log(`📷 Image ${i + 1}: ${img.startSeconds}s - ${img.section} (movement: ${movementEffect}, duration: ${duration}s)`);

    // Scale image first
    videoFilters.push(`[${inputIndex}:v]${scaleFilter}[base_img_${i}]`);

    // FIXED: Apply movement effect WITHOUT additional timing constraints
    // The movement effect should handle its own timing internally
    const transitionFilter = generateTransitionEffect(
      `base_img_${i}`,
      `movement_img_${i}`,
      movementEffect,
      duration,
      0 // Start immediately - timing will be handled by overlay logic
    );

    if (!transitionFilter || transitionFilter.trim() === '') {
      console.error(`❌ Image ${i + 1}: Empty movement filter! Using fallback`);
      const fallbackEffectDuration = Math.min(3.0, Math.max(1.0, duration * 0.4));
      const fallbackFrames = Math.ceil(fallbackEffectDuration * 25);
      const fallbackFilter = `[base_img_${i}]zoompan=z='1+0.08*sin(2*PI*n/${fallbackFrames})':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${fallbackFrames}:s=1298x720:fps=25[movement_img_${i}]`;
      videoFilters.push(fallbackFilter);
    } else {
      videoFilters.push(transitionFilter);
    }

    inputIndex++;
  }

  // Step 2: Create smooth transitions between images
  let currentLabel;

  if (sortedImages.length > 0) {
    const firstImg = sortedImages[0];
    console.log(`🎬 First image timing: Will appear at ${firstImg.startSeconds}s`);

    // FIXED: Use more stable approach for first image
    if (showFirstImageFromZero || firstImg.startSeconds <= 0.1) {
      // Start immediately without black background transition
      videoFilters.push(`[movement_img_0]null[base_0]`);
      console.log(`🔄 First image: Starting immediately without black background`);
    } else {
      // Create black background with clean transition
      videoFilters.push(`color=c=black:s=1298x720:d=${durationInSeconds}:rate=25[bg]`);
      const firstStartAdjRaw = Math.max(0, (firstImg.startSeconds || 0) - (timingOffsetSeconds || 0));
      const firstStartAdj = showFirstImageFromZero ? 0 : firstStartAdjRaw;
      
      // FIXED: Use blend instead of overlay for smoother transition
      const blendExpr = `enable='gte(t,${firstStartAdj})'`;
      videoFilters.push(`[bg][movement_img_0]blend=all_mode=normal:all_opacity=1:${blendExpr}[base_0]`);
      console.log(`🔄 First image: Clean blend transition at ${firstStartAdj}s`);
    }
    currentLabel = "base_0";
  }

  // Step 3: Create xfade transitions between movement-enhanced images
  for (let i = 1; i < sortedImages.length; i++) {
    const img = sortedImages[i];

    // Determine transition effect
    let transitionEffect;
    if (sortedImages[i - 1].transition_to_next) {
      transitionEffect = sortedImages[i - 1].transition_to_next;
    } else {
      transitionEffect = getRandomXfadeTransition(img.default_transition_effects);
    }

    const transitionStart = img.startSeconds;
    const transitionStartAdj = Math.max(0, (transitionStart || 0) - (timingOffsetSeconds || 0));

    // FIXED: More conservative transition duration calculation
    const imageDuration = img.endSeconds - img.startSeconds;
    let transitionDuration = Math.min(0.8, Math.max(0.2, imageDuration / 4)); // More conservative

    const availableTime = transitionStartAdj;
    if (transitionDuration > availableTime) {
      transitionDuration = Math.max(0.2, availableTime * 0.7);
    }

    // FIXED: Ensure offset is calculated correctly
    const offset = Math.max(0.1, transitionStartAdj - transitionDuration);
    const nextLabel = i === sortedImages.length - 1 ? "combined_final" : `combined_${i}`;

    console.log(`🔄 Transition ${i}: "${transitionEffect}" at ${transitionStartAdj}s (${transitionDuration}s duration, offset=${offset}s)`);

    videoFilters.push(
      `[${currentLabel}][movement_img_${i}]xfade=transition=${transitionEffect}:duration=${transitionDuration}:offset=${offset}[${nextLabel}]`
    );

    currentLabel = nextLabel;
  }

  // Handle single image case
  if (sortedImages.length === 1) {
    videoFilters.push(`[${currentLabel}]null[combined_final]`);
  }

  // Step 4: Add overlay effect if enabled
  if (useOverlay) {
    const overlayInputIndex = inputIndex;
    videoFilters.push(
      `[${overlayInputIndex}:v]scale=1298:720:flags=fast_bilinear,format=yuva420p,colorchannelmixer=aa=${particleOpacity}[overlay]`
    );
    videoFilters.push(`[combined_final][overlay]blend=all_mode=screen:all_opacity=${particleOpacity}[blended]`);
    currentLabel = "blended";
    inputIndex++;
  } else {
    currentLabel = "combined_final";
  }

  // Step 5: Add subtitles
  if (useSubtitles && finalSubtitlePath) {
    const escapedSubPath = escapeSubtitlePath ? escapeSubtitlePath(finalSubtitlePath) : finalSubtitlePath;
    
    // Check if this is an ASS file (which has embedded styles)
    const isASSFile = finalSubtitlePath.toLowerCase().endsWith('.ass');
    
    if (isASSFile) {
      // For ASS files, use embedded styles (don't force_style)
      console.log(`🎨 Using ASS file with embedded styles (font: ${fontOptions.fontFamily || 'from ASS'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}[final]`;
      videoFilters.push(subtitleFilter);
    } else {
      // For SRT files, apply force_style
      const fontStyle = buildFontStyle(fontOptions);
      console.log(`🎨 Using SRT file with force_style (font: ${fontOptions.fontFamily || 'default'})`);
      let subtitleFilter = `[${currentLabel}]subtitles=${escapedSubPath}:force_style='${fontStyle}'[final]`;
      videoFilters.push(subtitleFilter);
    }
  } else {
    videoFilters.push(`[${currentLabel}]null[final]`);
  }

  console.log(`✅ Built ${videoFilters.length} combined effect operations`);
  return { videoFilters, inputMapping: inputIndex };
}

module.exports = {
  getVideoDuration,
  buildDynamicImageFilters,
  buildXfadeTransitions,
  buildMovementTransitions,
  buildCombinedEffects,
  TRANSITION_TYPES,
  generateTransitionEffect,
  getRandomTransition,
  getRandomMovementEffect,
  getRandomXfadeTransition,
  getDefaultTransitions,
  isXfadeTransition
}; 