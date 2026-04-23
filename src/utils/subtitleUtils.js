const fs = require("fs-extra");
const path = require("path");

// Updated function to escape subtitle paths specifically for the subtitles filter
function escapeSubtitlePath(filePath) {
  // Convert to forward slashes
  let escapedPath = filePath.replace(/\\/g, "/");

  // Escape special characters that can cause issues in subtitle filters
  // According to FFmpeg docs, we need to escape colons and backslashes in filter context
  escapedPath = escapedPath.replace(/:/g, "\\\\:"); // Double escape for filter context
  escapedPath = escapedPath.replace(/\[/g, "\\\\[");
  escapedPath = escapedPath.replace(/\]/g, "\\\\]");

  return escapedPath;
}

// Function to process SRT content and break into smaller chunks
function parseSRTAndBreakIntoSmallChunks(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Skip the subtitle number (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);

    // Parse time codes
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = timeMatch[1].replace(",", ".");
    const endTime = timeMatch[2].replace(",", ".");

    // Calculate duration in seconds
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    const duration = endSeconds - startSeconds;

    // Join text lines
    const fullText = textLines.join(" ").trim();
    if (!fullText) continue;

    // Break text into smaller chunks if it's longer than a certain length or contains multiple sentences
    const chunks = breakTextIntoChunks(fullText);

    if (chunks.length === 1) {
      // Single chunk, keep as is but with shorter display time if longer than 1.5 seconds
      const maxChunkDuration = Math.min(duration, 2.5); // Max 2.5 seconds per subtitle
      subtitles.push({
        start: secondsToASSTime(startSeconds),
        end: secondsToASSTime(startSeconds + maxChunkDuration),
        text: chunks[0],
      });

      // If there's remaining time, add a small gap
      if (duration > maxChunkDuration + 0.1) {
        subtitles.push({
          start: secondsToASSTime(startSeconds + maxChunkDuration + 0.1),
          end: secondsToASSTime(endSeconds),
          text: chunks[0],
        });
      }
    } else {
      // Multiple chunks - distribute across the time period
      const timePerChunk = duration / chunks.length;

      chunks.forEach((chunk, i) => {
        const chunkStart = startSeconds + i * timePerChunk;
        const chunkEnd =
          i === chunks.length - 1
            ? endSeconds
            : startSeconds + (i + 1) * timePerChunk;

        subtitles.push({
          start: secondsToASSTime(chunkStart),
          end: secondsToASSTime(chunkEnd),
          text: chunk,
        });
      });
    }
  }

  return subtitles;
}

// Helper function to convert time string to seconds
function timeToSeconds(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(":");
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
}

// Helper function to convert seconds to ASS time format
function secondsToASSTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(2, "0")}`;
}

// Function to break text into smaller chunks
function breakTextIntoChunks(text) {
  // First attempt to split by sentences
  const sentenceRegex = /([.!?])\s+/g;
  const sentences = text.split(sentenceRegex).filter(Boolean);

  // Group sentences back together
  const sentenceChunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    if (i + 1 < sentences.length) {
      sentenceChunks.push(sentences[i] + sentences[i + 1]);
    } else {
      sentenceChunks.push(sentences[i]);
    }
  }

  // If there's only one sentence but it's long, break it by commas or other natural breaks
  if (sentenceChunks.length === 1 && sentenceChunks[0].length > 50) {
    const parts = sentenceChunks[0].split(/[,;:]\s+/);

    // If we have multiple parts, use them
    if (parts.length > 1) {
      return parts;
    }

    // As a last resort, break by word count to keep each subtitle to roughly 7-8 words
    if (sentenceChunks[0].split(/\s+/).length > 8) {
      const words = sentenceChunks[0].split(/\s+/);
      const result = [];
      let currentChunk = "";

      for (const word of words) {
        if (currentChunk.split(/\s+/).length >= 7) {
          result.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += ` ${word}`;
      }

      if (currentChunk.trim()) {
        result.push(currentChunk.trim());
      }

      return result;
    }
  }

  return sentenceChunks.length > 0 ? sentenceChunks : [text];
}

/**
 * Convert color format to ASS subtitle format
 * @param {string} color - Color in various formats (#FFFFFF, &HFFFFFF, etc.)
 * @returns {string} - Color in ASS format (&HBBGGRR)
 */
function normalizeColorForASS(color) {
  if (!color) return '&H00FFFFFF';
  
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
      return `&H00${b}${g}${r}`;
    }
  }
  
  // Default to white if format is not recognized
  console.log(`⚠️ Unknown color format: ${color}, using white`);
  return '&H00FFFFFF';
}

// Create ASS file content with proper formatting and font options
function createASSContent(subtitles, fontOptions = {}) {
  // Optimize subtitle timing to prevent flickering
  const optimizedSubtitles = optimizeSubtitleTiming(subtitles);

  // Extract font options with defaults
  // Support both fontColor and primaryColor for backward compatibility
  const {
    fontFamily = 'Arial',
    fontPath = null,
    fontSize = 20,
    fontColor,
    primaryColor,
    outlineColor = '#000000',
    outlineWidth,
    backgroundColor = '#000000',
    bold = 1,
    italic = 0,
    outline,
    shadow = 1,
    alignment = 2,
    marginV = 30,
    marginL = 10,
    marginR = 10,
    animation = { type: 'none', duration: 0.5 }
  } = fontOptions;
  
  // Use primaryColor if fontColor not provided (channel config uses primaryColor)
  const actualFontColor = fontColor || primaryColor || '#FFFFFF';
  const actualOutline = outline !== undefined ? outline : (outlineWidth !== undefined ? outlineWidth : 2);
  
  // Import animation helper
  const { getAnimationTag } = require('./subtitleGenerator');

  // Determine the actual font name to use in ASS
  let actualFontFamily = fontFamily;
  
  // Handle Google Fonts - if we have a fontPath, it means it's a downloaded Google Font
  if (fontPath && fontFamily !== 'Arial') {
    // For Google Fonts, we'll use the font family name as specified
    // FFmpeg with ASS should be able to find fonts if they are properly named
    actualFontFamily = fontFamily;
    console.log(`🎨 Using Google Font: ${fontFamily} (downloaded to: ${fontPath})`);
  } else if (!fontPath && fontFamily !== 'Arial') {
    // If no font path but a custom font family is specified, assume it's a system font
    actualFontFamily = fontFamily;
    console.log(`🎨 Using system font: ${fontFamily}`);
  } else {
    // Default to Arial for reliability
    actualFontFamily = 'Arial';
    console.log(`🎨 Using default font: Arial`);
  }

  // Normalize colors to ASS format
  const normalizedFontColor = normalizeColorForASS(actualFontColor);
  const normalizedOutlineColor = normalizeColorForASS(outlineColor);
  const normalizedBackgroundColor = normalizeColorForASS(backgroundColor);

  console.log(`🎨 ASS Font styling: ${actualFontFamily}, size: ${fontSize}, color: ${normalizedFontColor}, outline: ${normalizedOutlineColor}`);

  // Create ASS header with font information
  let assHeader = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None`;

  // Add font attachment information if we have a Google Font path
  if (fontPath && fontFamily !== 'Arial') {
    const path = require('path');
    const fontFileName = path.basename(fontPath);
    assHeader += `

[Fonts]
fontname: ${fontFileName}`;
  }

  assHeader += `

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${actualFontFamily},${fontSize},${normalizedFontColor},&H000000FF,${normalizedOutlineColor},${normalizedBackgroundColor},${bold},${italic},0,0,100,100,0,0,1,${actualOutline},${shadow},${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let dialogues = "";
  const animationType = animation?.type || 'none';
  const animationDuration = animation?.duration || 0.5;
  
  for (const subtitle of optimizedSubtitles) {
    // Get animation tag if animation is enabled and not 'none'
    let animationTag = '';
    if (animationType && animationType !== 'none') {
      animationTag = getAnimationTag(animationType, animationDuration);
    }
    
    // Combine animation tag with text
    const textWithAnimation = animationTag ? `${animationTag}${subtitle.text}` : subtitle.text;
    
    // Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    dialogues += `Dialogue: 0,${subtitle.start},${subtitle.end},Default,,0,0,0,,${textWithAnimation}\n`;
  }

  return assHeader + dialogues;
}

/**
 * Optimize subtitle timing to prevent flickering and gaps
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Array} - Optimized subtitle array
 */
function optimizeSubtitleTiming(subtitles) {
  if (!subtitles || subtitles.length === 0) {
    return subtitles;
  }

  const optimized = [...subtitles];
  const minDuration = 1.0; // Minimum 1 second duration
  const maxGap = 0.1; // Maximum 100ms gap between subtitles

  for (let i = 0; i < optimized.length; i++) {
    const current = optimized[i];
    const next = optimized[i + 1];

    // Ensure minimum duration
    const startSeconds = timeToSeconds(current.start);
    const endSeconds = timeToSeconds(current.end);
    const duration = endSeconds - startSeconds;

    if (duration < minDuration) {
      // Extend duration to minimum
      const newEndSeconds = startSeconds + minDuration;
      current.end = secondsToTime(newEndSeconds);
    }

    // Handle gaps and overlaps with next subtitle
    if (next) {
      const currentEndSeconds = timeToSeconds(current.end);
      const nextStartSeconds = timeToSeconds(next.start);
      const gap = nextStartSeconds - currentEndSeconds;

      if (gap > maxGap) {
        // Reduce gap by extending current subtitle slightly
        const newEndSeconds = nextStartSeconds - 0.05; // 50ms overlap
        current.end = secondsToTime(newEndSeconds);
      } else if (gap < -0.2) {
        // Large overlap - reduce current subtitle
        const newEndSeconds = nextStartSeconds - 0.05; // 50ms gap
        current.end = secondsToTime(newEndSeconds);
      }
    }
  }

  return optimized;
}


// Convert SRT to ASS format with proper subtitle styling and positioning
async function convertSrtToAss(srtPath, outputDir, fontOptions = {}) {
  const assPath = path.join(outputDir, "subtitles.ass");

  try {
    console.log(
      `Converting SRT to ASS with proper formatting: ${srtPath} -> ${assPath}`
    );
    console.log(`🎨 Using font options:`, fontOptions);

    // Read the SRT file
    const srtContent = fs.readFileSync(srtPath, "utf8");

    // Parse SRT content and break into smaller chunks
    const subtitles = parseSRTAndBreakIntoSmallChunks(srtContent);

    // Create ASS content with proper header and styling using font options
    const assContent = createASSContent(subtitles, fontOptions);

    // Write the ASS file
    fs.writeFileSync(assPath, assContent, "utf8");

    // Verify the ASS file was created and has content
    if (!fs.existsSync(assPath)) {
      throw new Error("ASS file was not created");
    }

    const stats = fs.statSync(assPath);
    if (stats.size === 0) {
      throw new Error("Generated ASS file is empty");
    }

    console.log(
      `Successfully converted subtitles to ASS format (${stats.size} bytes)`
    );
    console.log(
      `Subtitles broken into ${subtitles.length} smaller chunks for better readability`
    );
    console.log(`🎨 Applied font: ${fontOptions.fontFamily || 'Arial'} at ${fontOptions.fontSize || 20}px`);
    return assPath;
  } catch (error) {
    console.error("Error converting SRT to ASS:", error);
    throw error;
  }
}

// Helper function to parse timestamp to seconds
function parseTimestamp(timestamp) {
  const [hours, minutes, seconds] = timestamp.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper function to format seconds to timestamp
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to convert seconds to time format (for ASS timing)
function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(2, "0")}`;
}

// Helper function to identify common words that shouldn't be weighted heavily
function isCommonWord(word) {
  const commonWords = [
    'the', 'and', 'but', 'for', 'are', 'were', 'been', 'have', 'had', 'has', 'will', 'would', 'could', 'should',
    'that', 'this', 'they', 'them', 'their', 'there', 'where', 'when', 'what', 'which', 'while', 'with', 'from',
    'into', 'upon', 'over', 'under', 'about', 'after', 'before', 'during', 'through', 'still', 'even', 'also',
    'very', 'more', 'most', 'much', 'many', 'some', 'such', 'like', 'than', 'only', 'just', 'now', 'then',
    'here', 'never', 'always', 'often', 'again', 'once', 'every', 'each', 'both', 'either', 'neither'
  ];
  return commonWords.includes(word.toLowerCase());
}

// Helper function to find sentence timing in SRT content - Enhanced for seamless transitions
function findSentenceTimingInSRT(srtContent, startSentence, endSentence) {
  try {
    const lines = srtContent.split('\n');
    let startTime = null;
    let endTime = null;
    let foundStart = false;
    let allSubtitles = []; // For debugging
    
    // Normalize sentences for better matching
    const normalizeText = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };
    
    const normalizedStartSentence = normalizeText(startSentence);
    const normalizedEndSentence = normalizeText(endSentence);
    
    console.log(`🔍 PRIMARY FOCUS: Finding start sentence for transition`);
    console.log(`   Start: "${startSentence}"`);
    console.log(`   End: "${endSentence}" (used for context, not transition)`);
    
    // Create search patterns for better matching
    const startWords = normalizedStartSentence.split(' ').filter(word => word.length > 2);
    const startKeywords = startWords.filter(word => word.length > 4 && !isCommonWord(word)); // Filter out common words
    const startImportantWords = startWords.filter(word => word.length > 6); // Very distinctive words
    
    console.log(`   🎯 All words: [${startWords.slice(0, 8).join(', ')}]${startWords.length > 8 ? '...' : ''}`);
    console.log(`   🎯 Key words: [${startKeywords.slice(0, 6).join(', ')}]${startKeywords.length > 6 ? '...' : ''}`);
    console.log(`   🎯 Important words: [${startImportantWords.slice(0, 4).join(', ')}]${startImportantWords.length > 4 ? '...' : ''}`);
    
    // First pass: collect all subtitles for debugging
    let currentSubtitle = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and numbers
      if (!line || /^\d+$/.test(line)) continue;
      
      // Check if this is a timestamp line
      if (line.includes(' --> ')) {
        if (currentSubtitle) {
          allSubtitles.push(currentSubtitle);
        }
        
        const [start, end] = line.split(' --> ');
        currentSubtitle = {
          startTime: start,
          endTime: end,
          text: '',
          normalizedText: ''
        };
      } else if (currentSubtitle) {
        // Accumulate text for this subtitle
        currentSubtitle.text += (currentSubtitle.text ? ' ' : '') + line;
        currentSubtitle.normalizedText = normalizeText(currentSubtitle.text);
      }
    }
    
    // Add the last subtitle
    if (currentSubtitle) {
      allSubtitles.push(currentSubtitle);
    }

    console.log(`📝 Found ${allSubtitles.length} subtitle entries to search through`);

    // Second pass: find start sentence with enhanced matching for transitions
    for (let i = 0; i < allSubtitles.length; i++) {
      const subtitle = allSubtitles[i];
      const { startTime: currentStartTime, endTime: currentEndTime, text: fullText, normalizedText: normalizedFullText } = subtitle;
      
              // PRIORITY: Find start sentence for transition timing (FLEXIBLE MATCHING)
        if (!foundStart) {
          let matchFound = false;
          let matchType = '';
          let matchDetails = '';
          let matchScore = 0;
          
          // Strategy 1: Exact sentence match (highest priority)
          const exactMatch = normalizedFullText.includes(normalizedStartSentence);
          if (exactMatch) {
            matchFound = true;
            matchType = 'exact_sentence';
            matchDetails = `Complete sentence found in subtitle`;
            matchScore = 100;
          }
          
          // Strategy 2A: Character name priority (highest priority for sentence beginnings)
          if (!matchFound) {
            const sentenceStart = normalizedStartSentence.split(' ').slice(0, 4).join(' '); // First 4 words
            const sentenceFirstWords = normalizedStartSentence.split(' ').slice(0, 3).join(' '); // First 3 words
            
            // Check if this subtitle starts with the beginning of our sentence (exact match)
            if (sentenceStart.length >= 10 && normalizedFullText.startsWith(sentenceFirstWords)) {
              matchFound = true;
              matchType = 'exact_sentence_start';
              matchDetails = `Subtitle starts with exact sentence beginning: "${sentenceFirstWords}"`;
              matchScore = 98;
            }
            // Character name matching - be more specific about which names match which subtitles
            else {
              const characterMatches = [];
              if (sentenceStart.includes('king alaric') && normalizedFullText.includes('king') && normalizedFullText.includes('alaric')) {
                characterMatches.push('king alaric');
              }
              if (sentenceStart.includes('rosalind') && normalizedFullText.includes('rosalind')) {
                characterMatches.push('rosalind');
              }
              
              if (characterMatches.length > 0) {
                // Only match if the subtitle actually contains the character name that's in our sentence
                const subtitleContainsMatchingName = characterMatches.some(name => 
                  normalizedFullText.includes(name)
                );
                
                if (subtitleContainsMatchingName) {
                  matchFound = true;
                  matchType = 'character_name_match';
                  matchDetails = `Character name match: [${characterMatches.join(', ')}]`;
                  matchScore = 94;
                }
              }
            }
          }
          
          // Strategy 2B: Strong phrase match (very high priority) - more flexible
          if (!matchFound && startKeywords.length >= 2) {
            const keyPhrase = startKeywords.slice(0, 3).join(' '); // First 3 significant words
            if (keyPhrase.length >= 12 && normalizedFullText.includes(keyPhrase)) {
              matchFound = true;
              matchType = 'strong_phrase';
              matchDetails = `Key phrase match: "${keyPhrase}"`;
              matchScore = 95;
            }
          }
          
          // Strategy 3: Important words match (prioritize sentence beginning)
          if (!matchFound && startImportantWords.length >= 2) {
            const importantMatches = startImportantWords.filter(word => normalizedFullText.includes(word));
            if (importantMatches.length >= 2) {
              // Bonus points if important words appear at the start of the subtitle
              const sentenceStartWords = normalizedStartSentence.split(' ').slice(0, 6);
              const startWordMatches = sentenceStartWords.filter(word => word.length > 3 && normalizedFullText.startsWith(word) || normalizedFullText.indexOf(word) < 20);
              
              if (startWordMatches.length >= 1) {
                matchFound = true;
                matchType = 'important_words_at_start';
                matchDetails = `Important words near subtitle start: [${importantMatches.join(', ')}]`;
                matchScore = 92; // Higher score for words at beginning
              } else {
                matchFound = true;
                matchType = 'important_words';
                matchDetails = `Important words match: [${importantMatches.join(', ')}]`;
                matchScore = 85; // Lower score for words later in subtitle
              }
            }
          }
          
          // Strategy 4: Keyword density match (more flexible)
          if (!matchFound && startKeywords.length >= 2) {
            const keywordMatches = startKeywords.filter(word => normalizedFullText.includes(word));
            const matchRatio = keywordMatches.length / startKeywords.length;
            
            // FLEXIBLE: Require 60% keyword match + at least 2 keywords
            if (matchRatio >= 0.6 && keywordMatches.length >= 2) {
              matchFound = true;
              matchType = 'keyword_density';
              matchDetails = `${(matchRatio * 100).toFixed(0)}% keyword match: [${keywordMatches.join(', ')}]`;
              matchScore = Math.round(matchRatio * 85);
            }
          }
          
          // Strategy 5: Beginning phrase match (more flexible)
          if (!matchFound && normalizedStartSentence.split(' ').length >= 4) {
            const sentenceStart = normalizedStartSentence.split(' ').slice(0, 4).join(' ');
            
            // Check if subtitle starts with or contains the beginning phrase
            if (sentenceStart.length >= 15 && (
                normalizedFullText.startsWith(sentenceStart) || 
                normalizedFullText.includes(' ' + sentenceStart)
              )) {
              matchFound = true;
              matchType = 'beginning_phrase';
              matchDetails = `Sentence beginning match: "${sentenceStart}"`;
              matchScore = 80;
            }
          }
          
          // Strategy 6: Partial long sentence match (for very long sentences)
          if (!matchFound && normalizedStartSentence.split(' ').length >= 8) {
            const midPhrase = normalizedStartSentence.split(' ').slice(2, 6).join(' ');
            if (midPhrase.length >= 15 && normalizedFullText.includes(midPhrase)) {
              matchFound = true;
              matchType = 'partial_sentence';
              matchDetails = `Mid-sentence match: "${midPhrase}"`;
              matchScore = 75;
            }
          }
        
                  if (matchFound) {
            startTime = currentStartTime;
            foundStart = true;
            console.log(`🎯 START TRANSITION found at ${currentStartTime}`);
            console.log(`   📊 Match: ${matchType} (score: ${matchScore}%) - ${matchDetails}`);
            console.log(`   📝 In subtitle: "${fullText}"`);
            console.log(`   🔍 Match strength: ${matchScore >= 90 ? 'VERY HIGH' : matchScore >= 80 ? 'HIGH' : matchScore >= 70 ? 'GOOD' : 'ACCEPTABLE'}`);
            
            // For different confidence levels
            if (matchScore >= 90) {
              console.log(`   ✅ EXCELLENT MATCH - Image will transition precisely at this moment`);
            } else if (matchScore >= 80) {
              console.log(`   ✅ GOOD MATCH - Image transition timing should be accurate`);
            } else if (matchScore >= 70) {
              console.log(`   ✅ DECENT MATCH - Timing should be close`);
            } else {
              console.log(`   ⚠️ ACCEPTABLE MATCH - Timing may be slightly off but better than no match`);
            }
          }
      }
      
      // OPTIONAL: Look for end sentence (used for context, not critical for transitions)
      if (foundStart) {
        let endMatchFound = false;
        
        // Simple end sentence detection (exact or strong partial match)
        if (normalizedFullText.includes(normalizedEndSentence)) {
          endMatchFound = true;
          endTime = currentEndTime;
          console.log(`📍 END CONTEXT found at ${currentEndTime} (exact match)`);
          console.log(`   📝 End subtitle: "${fullText}"`);
          break;
        } else {
          // Keep updating endTime as we progress (fallback for context)
          endTime = currentEndTime;
        }
      }
    }
    
    // Results and confidence assessment for transitions
    let confidence = 'low';
    if (startTime) {
      if (endTime && endTime !== startTime) {
        console.log(`✅ TRANSITION TIMING: Start at ${startTime}, Context end at ${endTime}`);
        confidence = 'high'; // We found the sentence, so confidence is high
      } else {
        console.log(`🎯 TRANSITION TIMING: Start at ${startTime} (end time estimated)`);
        confidence = 'medium';
      }
      console.log(`   🚀 Ready for seamless transition at ${startTime}`);
    } else {
      console.log(`❌ Could not find START SENTENCE for transition timing`);
      console.log(`🔍 WHAT WHISPER ACTUALLY DETECTED (first 8 subtitles):`);
      for (let i = 0; i < Math.min(8, allSubtitles.length); i++) {
        const timing = `${allSubtitles[i].startTime.split(',')[0]} - ${allSubtitles[i].endTime.split(',')[0]}`;
        console.log(`   ${i + 1}. [${timing}] "${allSubtitles[i].text}"`);
      }
      console.log(`💡 MATCHING TIPS:`);
      console.log(`   - Compare your sentence with what Whisper detected above`);
      console.log(`   - Try using shorter, key phrases from your sentence`);
      console.log(`   - Check for punctuation or wording differences`);
      console.log(`   - Ensure the sentence is actually spoken in the audio`);
      
      // Show which words we were looking for
      const startWords = normalizedStartSentence.split(' ').filter(word => word.length > 2);
      const startKeywords = startWords.filter(word => word.length > 4 && !isCommonWord(word));
      console.log(`   - We were looking for key words: [${startKeywords.slice(0, 6).join(', ')}]`);
    }
    
    return { startTime, endTime, confidence };
  } catch (error) {
    console.error("Error finding sentence timing:", error);
    return { startTime: null, endTime: null, confidence: 'error' };
  }
}

/**
 * Validate ASS file format
 * @param {string} filePath - Path to ASS file
 * @returns {boolean} True if file is valid ASS format
 */
async function validateASSFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ ASS file not found: ${filePath}`);
      return false;
    }

    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for required ASS sections
    const hasScriptInfo = content.includes('[Script Info]');
    const hasStyles = content.includes('[V4+ Styles]');
    const hasEvents = content.includes('[Events]');
    
    if (!hasScriptInfo || !hasStyles || !hasEvents) {
      console.warn(`⚠️ Invalid ASS format in ${filePath}`);
      console.warn(`   Script Info: ${hasScriptInfo}, Styles: ${hasStyles}, Events: ${hasEvents}`);
      return false;
    }

    console.log(`✅ ASS file validated successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error validating ASS file:`, error);
    return false;
  }
}

/**
 * Convert hex color to ASS format (&HAABBGGRR - note BGR order)
 * @param {string} hexColor - Color in #RRGGBB format
 * @returns {string} Color in ASS format
 */
function convertColorToASS(hexColor) {
  // Use the one from subtitleGenerator for consistency
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
 * Calculate subtitle position coordinates
 * @param {string} alignment - Alignment string (e.g., 'bottom-center', 'top-left')
 * @param {number} screenWidth - Screen width (default 1920)
 * @param {number} screenHeight - Screen height (default 1080)
 * @returns {object} Position coordinates {x, y}
 */
function calculatePosition(alignment = 'bottom-center', screenWidth = 1920, screenHeight = 1080) {
  const positions = {
    'bottom-center': { x: screenWidth / 2, y: screenHeight * 0.9 },
    'bottom-left': { x: screenWidth * 0.1, y: screenHeight * 0.9 },
    'bottom-right': { x: screenWidth * 0.9, y: screenHeight * 0.9 },
    'center': { x: screenWidth / 2, y: screenHeight / 2 },
    'top-center': { x: screenWidth / 2, y: screenHeight * 0.1 },
    'top-left': { x: screenWidth * 0.1, y: screenHeight * 0.1 },
    'top-right': { x: screenWidth * 0.9, y: screenHeight * 0.1 },
  };

  return positions[alignment] || positions['bottom-center'];
}

module.exports = {
  escapeSubtitlePath,
  convertSrtToAss,
  parseTimestamp,
  formatTimestamp,
  findSentenceTimingInSRT,
  validateASSFile,
  convertColorToASS,
  calculatePosition,
}; 