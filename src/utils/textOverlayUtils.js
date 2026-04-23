const fs = require('fs-extra');
const path = require('path');

/**
 * Escape text for FFmpeg drawtext filter
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeFFmpegText(text) {
  if (!text) return '';
  
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Calculate text overlay position coordinates
 * @param {string} position - Position identifier
 * @param {number} videoWidth - Video width in pixels
 * @param {number} videoHeight - Video height in pixels
 * @returns {object} Position coordinates {x, y}
 */
function calculateTextPosition(position, videoWidth = 1920, videoHeight = 1080) {
  const margin = 50; // pixels from edge
  
  const positions = {
    'top-left': { x: margin, y: margin },
    'top-center': { x: '(w-text_w)/2', y: margin },
    'top-right': { x: `w-text_w-${margin}`, y: margin },
    'middle-left': { x: margin, y: '(h-text_h)/2' },
    'center': { x: '(w-text_w)/2', y: '(h-text_h)/2' },
    'middle-right': { x: `w-text_w-${margin}`, y: '(h-text_h)/2' },
    'bottom-left': { x: margin, y: `h-text_h-${margin}` },
    'bottom-center': { x: '(w-text_w)/2', y: `h-text_h-${margin}` },
    'bottom-right': { x: `w-text_w-${margin}`, y: `h-text_h-${margin}` }
  };
  
  return positions[position] || positions['bottom-right'];
}

/**
 * Get font file path for FFmpeg
 * @param {string} fontFamily - Font family name
 * @returns {string} Path to font file
 */
function getFontPath(fontFamily) {
  // Common font paths (Linux/Windows compatible)
  const fontPaths = {
    'Arial': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    'Helvetica': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    'Roboto': './public/fonts/roboto-regular.ttf',
    'Open Sans': './public/fonts/open-sans-regular.ttf',
    'Montserrat': './public/fonts/montserrat-regular.ttf',
    'Poppins': './public/fonts/poppins-regular.ttf',
    'Impact': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'Bebas Neue': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  };
  
  let fontPath = fontPaths[fontFamily];
  
  // Check if font file exists
  if (fontPath && fs.existsSync(fontPath)) {
    return fontPath;
  }
  
  // Try Windows font path
  const windowsFontPath = `C:\\Windows\\Fonts\\${fontFamily.replace(/\s/g, '')}.ttf`;
  if (fs.existsSync(windowsFontPath)) {
    return windowsFontPath;
  }
  
  // Fallback to DejaVu Sans
  const fallbackPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  if (fs.existsSync(fallbackPath)) {
    console.warn(`   ⚠️  Font '${fontFamily}' not found, using DejaVu Sans`);
    return fallbackPath;
  }
  
  // Last resort: use fontfile without path (system will search)
  console.warn(`   ⚠️  Font '${fontFamily}' not found, FFmpeg will use system default`);
  return fontFamily;
}

/**
 * Build FFmpeg drawtext filter for a text overlay
 * @param {object} overlay - Text overlay configuration
 * @param {number} videoWidth - Video width
 * @param {number} videoHeight - Video height
 * @param {number} videoDuration - Video duration in seconds
 * @returns {string} FFmpeg drawtext filter string
 */
function buildTextOverlayFilter(overlay, videoWidth = 1920, videoHeight = 1080, videoDuration = 60) {
  const { text, position, font, background, timing } = overlay;
  
  // Escape text
  const escapedText = escapeFFmpegText(text);
  
  // Calculate position
  const pos = calculateTextPosition(position, videoWidth, videoHeight);
  
  // Get font path and escape it for FFmpeg (especially important on Windows)
  const fontPath = getFontPath(font.family);
  // Escape backslashes for Windows paths
  const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  
  // Build base drawtext filter
  let filter = `drawtext=text='${escapedText}'`;
  filter += `:fontfile='${escapedFontPath}'`;
  filter += `:fontsize=${font.size}`;
  filter += `:fontcolor=${font.color}`;
  filter += `:x=${pos.x}`;
  filter += `:y=${pos.y}`;
  
  // Font weight (only if supported)
  if (font.weight === 'bold') {
    // Use bold font variant if available, otherwise skip fontweight
    // fontweight parameter is not supported in all FFmpeg builds
  }
  
  // Background box
  if (background.enabled) {
    const opacity = (background.opacity / 100).toFixed(2);
    filter += `:box=1`;
    filter += `:boxcolor=${background.color}@${opacity}`;
    filter += `:boxborderw=${background.padding}`;
  }
  
  // Timing
  if (timing.type === 'custom' && timing.start !== undefined && timing.end !== undefined) {
    filter += `:enable='between(t,${timing.start},${timing.end})'`;
  }
  
  return filter;
}

/**
 * Build all text overlay filters for FFmpeg
 * @param {array} textOverlays - Array of text overlay configurations
 * @param {number} videoWidth - Video width
 * @param {number} videoHeight - Video height
 * @param {number} videoDuration - Video duration in seconds
 * @returns {array} Array of drawtext filter strings
 */
function buildAllTextOverlayFilters(textOverlays = [], videoWidth = 1920, videoHeight = 1080, videoDuration = 60) {
  if (!textOverlays || textOverlays.length === 0) {
    return [];
  }
  
  const filters = [];
  
  textOverlays.forEach((overlay, index) => {
    if (!overlay.text || overlay.text.trim() === '') {
      console.warn(`   ⚠️  Skipping empty text overlay at index ${index}`);
      return;
    }
    
    try {
      const filter = buildTextOverlayFilter(overlay, videoWidth, videoHeight, videoDuration);
      filters.push(filter);
      console.log(`   ✅ Built text overlay filter ${index + 1}/${textOverlays.length}: "${overlay.text.substring(0, 30)}${overlay.text.length > 30 ? '...' : ''}"`);
    } catch (error) {
      console.error(`   ❌ Error building text overlay filter ${index}:`, error.message);
    }
  });
  
  return filters;
}

/**
 * Validate text overlays configuration
 * @param {array} textOverlays - Array of text overlay configurations
 * @returns {object} Validation result {valid, errors}
 */
function validateTextOverlays(textOverlays) {
  const errors = [];
  
  if (!Array.isArray(textOverlays)) {
    return { valid: false, errors: ['textOverlays must be an array'] };
  }
  
  textOverlays.forEach((overlay, index) => {
    if (!overlay.text) {
      errors.push(`Overlay ${index}: text is required`);
    }
    
    if (!overlay.position) {
      errors.push(`Overlay ${index}: position is required`);
    }
    
    if (!overlay.font || !overlay.font.family || !overlay.font.size) {
      errors.push(`Overlay ${index}: font configuration is incomplete`);
    }
    
    if (overlay.timing && overlay.timing.type === 'custom') {
      if (overlay.timing.start === undefined || overlay.timing.end === undefined) {
        errors.push(`Overlay ${index}: custom timing requires start and end times`);
      } else if (overlay.timing.end <= overlay.timing.start) {
        errors.push(`Overlay ${index}: end time must be greater than start time`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  escapeFFmpegText,
  calculateTextPosition,
  getFontPath,
  buildTextOverlayFilter,
  buildAllTextOverlayFilters,
  validateTextOverlays,
};

