const fs = require('fs-extra');
const path = require('path');

/**
 * Generate SRT subtitle file from script sentences
 * @param {Object} options - Generation options
 * @param {Array} options.sentences - Array of sentence objects with text
 * @param {number} options.voiceDuration - Total audio duration in seconds
 * @param {Object} options.subtitleSettings - Subtitle styling settings
 * @param {string} options.outputPath - Path to save the SRT file
 * @returns {Promise<string>} Path to generated SRT file
 */
async function generateSubtitles({ sentences, voiceDuration, subtitleSettings = {}, outputPath }) {
  if (!sentences || sentences.length === 0) {
    throw new Error('No sentences provided for subtitle generation');
  }

  if (!voiceDuration || voiceDuration <= 0) {
    throw new Error('Invalid voice duration');
  }

  console.log(`\n📝 Generating subtitles for ${sentences.length} sentences over ${voiceDuration}s`);

  // Calculate timing for each sentence
  const timedSentences = calculateSentenceTiming(sentences, voiceDuration);

  // Generate SRT content
  const srtContent = generateSRTContent(timedSentences);

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Write SRT file
  await fs.writeFile(outputPath, srtContent, 'utf8');

  console.log(`✅ Subtitles generated: ${outputPath}`);
  console.log(`   📊 ${timedSentences.length} subtitle entries`);
  console.log(`   ⏱️  Duration: ${voiceDuration}s`);

  return outputPath;
}

/**
 * Calculate timing for each sentence based on audio duration
 * @param {Array} sentences - Array of sentence objects
 * @param {number} totalDuration - Total audio duration in seconds
 * @returns {Array} Array of sentences with start and end times
 */
function calculateSentenceTiming(sentences, totalDuration) {
  const timedSentences = [];
  
  // Calculate total word count for proportional timing
  const totalWords = sentences.reduce((sum, s) => {
    const wordCount = s.text.trim().split(/\s+/).length;
    return sum + wordCount;
  }, 0);

  console.log(`   📊 Total words: ${totalWords}`);

  let currentTime = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const wordCount = sentence.text.trim().split(/\s+/).length;
    
    // Calculate duration based on word count proportion
    // This gives more time to longer sentences
    const proportion = wordCount / totalWords;
    let duration = totalDuration * proportion;
    
    // Ensure minimum and maximum duration per sentence
    const minDuration = 1.5; // At least 1.5 seconds
    const maxDuration = 10.0; // At most 10 seconds
    duration = Math.max(minDuration, Math.min(maxDuration, duration));

    // Adjust if this would exceed total duration
    if (i === sentences.length - 1) {
      // Last sentence gets remaining time
      duration = totalDuration - currentTime;
    } else if (currentTime + duration > totalDuration) {
      // Adjust if we're running over
      duration = totalDuration - currentTime;
    }

    const startTime = currentTime;
    const endTime = Math.min(currentTime + duration, totalDuration);

    timedSentences.push({
      index: i + 1,
      text: sentence.text.trim(),
      startTime,
      endTime,
      duration: endTime - startTime,
      wordCount,
    });

    currentTime = endTime;
  }

  // Log timing details
  console.log(`   ⏱️  Sentence timing breakdown:`);
  timedSentences.forEach((s, i) => {
    if (i < 3 || i >= timedSentences.length - 1) {
      console.log(`      ${s.index}. ${formatSRTTime(s.startTime)} → ${formatSRTTime(s.endTime)} (${s.duration.toFixed(1)}s, ${s.wordCount} words)`);
    } else if (i === 3) {
      console.log(`      ... (${timedSentences.length - 4} more) ...`);
    }
  });

  return timedSentences;
}

/**
 * Generate SRT formatted content
 * @param {Array} timedSentences - Sentences with timing information
 * @returns {string} SRT formatted content
 */
function generateSRTContent(timedSentences) {
  const srtBlocks = timedSentences.map(sentence => {
    const startTime = formatSRTTime(sentence.startTime);
    const endTime = formatSRTTime(sentence.endTime);
    
    return `${sentence.index}\n${startTime} --> ${endTime}\n${sentence.text}\n`;
  });

  return srtBlocks.join('\n');
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${padZero(hours, 2)}:${padZero(minutes, 2)}:${padZero(secs, 2)},${padZero(milliseconds, 3)}`;
}

/**
 * Pad number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} size - Desired size
 * @returns {string} Padded string
 */
function padZero(num, size) {
  return num.toString().padStart(size, '0');
}

/**
 * Convert hex color to ASS format (&HAABBGGRR - note BGR order)
 * @param {string} hexColor - Color in #RRGGBB format
 * @returns {string} Color in ASS format
 */
function convertColorToASS(hexColor) {
  if (!hexColor || !hexColor.startsWith('#')) {
    return '&H00FFFFFF'; // Default to white
  }

  const hex = hexColor.substring(1);
  if (hex.length === 6) {
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);
    // ASS format is &HAABBGGRR (alpha, blue, green, red)
    return `&H00${b}${g}${r}`.toUpperCase();
  }

  return '&H00FFFFFF';
}

/**
 * Get animation tag for ASS subtitles
 * @param {string} animationType - Type of animation (none, fadeIn, slideUp, etc.)
 * @param {number} duration - Animation duration in seconds
 * @param {number} screenWidth - Screen width (default 1920)
 * @param {number} screenHeight - Screen height (default 1080)
 * @returns {string} ASS animation tags
 */
function getAnimationTag(animationType, duration = 0.5, screenWidth = 1920, screenHeight = 1080) {
  const durationMs = Math.round(duration * 1000);
  
  // Calculate center position (subtitle alignment 2 = bottom center)
  const centerX = screenWidth / 2;
  const centerY = screenHeight * 0.9; // Bottom 10% from top

  switch (animationType) {
    case 'fadeIn':
      // Fade in from transparent to opaque
      return `{\\fad(${durationMs},0)}`;
    
    case 'slideUp':
      // Slide up from below
      const startY = centerY + 50;
      return `{\\move(${centerX},${startY},${centerX},${centerY},0,${durationMs})}`;
    
    case 'slideLeft':
      // Slide in from right
      const startXRight = centerX + 100;
      return `{\\move(${startXRight},${centerY},${centerX},${centerY},0,${durationMs})}`;
    
    case 'slideRight':
      // Slide in from left
      const startXLeft = centerX - 100;
      return `{\\move(${startXLeft},${centerY},${centerX},${centerY},0,${durationMs})}`;
    
    case 'zoomIn':
      // Zoom in effect (start at 50% scale, grow to 100%)
      return `{\\t(0,${durationMs},\\fscx100\\fscy100)\\fscx50\\fscy50}`;
    
    case 'bounceIn':
      // Bounce effect using multiple transforms
      const bounce1 = Math.round(durationMs * 0.6);
      const bounce2 = Math.round(durationMs * 0.8);
      return `{\\t(0,${bounce1},\\fscx120\\fscy120)\\t(${bounce1},${bounce2},\\fscx95\\fscy95)\\t(${bounce2},${durationMs},\\fscx100\\fscy100)\\fscx50\\fscy50}`;
    
    case 'none':
    default:
      return '';
  }
}

/**
 * Generate ASS subtitle file with advanced styling and animations
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Path to generated ASS file
 */
async function generateASSSubtitles({ sentences, voiceDuration, subtitleSettings = {}, outputPath }) {
  console.log(`\n📝 Generating ASS subtitles with animations...`);
  
  // Calculate timing
  const timedSentences = calculateSentenceTiming(sentences, voiceDuration);

  // Extract styling options with support for hex colors
  const {
    fontFamily = 'Arial',
    fontSize = 32,
    primaryColor = '#FFFFFF',
    outlineColor = '#000000',
    outlineWidth = 3,
    bold = false,
    animation = { type: 'none', duration: 0.5 }
  } = subtitleSettings;

  // Convert colors to ASS format
  const assPrimaryColor = convertColorToASS(primaryColor);
  const assOutlineColor = convertColorToASS(outlineColor);
  const backgroundColor = '&H80000000'; // Semi-transparent black

  // Convert bold to ASS format
  const boldValue = bold ? -1 : 0;

  console.log(`   🎨 Font: ${fontFamily}, Size: ${fontSize}`);
  console.log(`   🎨 Colors: Primary=${assPrimaryColor}, Outline=${assOutlineColor}`);
  console.log(`   ✨ Animation: ${animation.type}, Duration: ${animation.duration}s`);

  // Create ASS header
  let assContent = `[Script Info]
Title: Generated Subtitles with Animations
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${assPrimaryColor},&H000000FF,${assOutlineColor},${backgroundColor},${boldValue},0,0,0,100,100,0,0,1,${outlineWidth},1,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add dialogue entries with animation tags
  const animationType = animation?.type || 'none';
  const animationDuration = animation?.duration || 0.5;

  timedSentences.forEach(sentence => {
    const startTime = formatASSTime(sentence.startTime);
    const endTime = formatASSTime(sentence.endTime);
    
    // Get animation tag if animation is enabled
    const animationTag = getAnimationTag(animationType, animationDuration);
    
    // Combine animation tag with text
    const textWithAnimation = animationTag ? `${animationTag}${sentence.text}` : sentence.text;
    
    assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${textWithAnimation}\n`;
  });

  // Write ASS file
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, assContent, 'utf8');

  console.log(`✅ ASS subtitles generated: ${outputPath}`);
  console.log(`   📊 ${timedSentences.length} subtitle entries with ${animationType} animation`);

  return outputPath;
}

/**
 * Format seconds to ASS time format (H:MM:SS.cc)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatASSTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${padZero(minutes, 2)}:${padZero(secs, 2)}.${padZero(centiseconds, 2)}`;
}

module.exports = {
  generateSubtitles,
  generateASSSubtitles,
  calculateSentenceTiming,
  formatSRTTime,
  formatASSTime,
  getAnimationTag,
  convertColorToASS,
};


