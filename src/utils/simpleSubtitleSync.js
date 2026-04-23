/**
 * Simple and reliable subtitle-image synchronization
 * Extracts exact timestamps from Whisper-generated SRT files
 */

/**
 * Parse SRT content into structured subtitle segments
 * @param {string} srtContent - Raw SRT content from Whisper
 * @returns {Array} Array of subtitle segments with timing and text
 */
function parseSRTSubtitles(srtContent) {
  const segments = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // Skip subtitle number (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);
    
    // Parse timestamp line: "00:00:11,000 --> 00:00:13,000"
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    
    const startTime = timeMatch[1];
    const endTime = timeMatch[2];
    const text = textLines.join(' ').trim();
    
    if (text) {
      segments.push({
        startTime,
        endTime,
        startSeconds: timestampToSeconds(startTime),
        endSeconds: timestampToSeconds(endTime),
        text,
        normalizedText: normalizeText(text)
      });
    }
  }
  
  return segments;
}

/**
 * Convert timestamp string to seconds
 * @param {string} timestamp - Format: "00:01:23,456"
 * @returns {number} Time in seconds
 */
function timestampToSeconds(timestamp) {
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + (parseInt(ms) / 1000);
}

/**
 * Convert seconds to timestamp string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timestamp "00:01:23,456"
 */
function secondsToTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Normalize text for better matching
 * @param {string} text - Raw text
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best matching subtitle segment for a given sentence
 * Prioritizes finding the BEGINNING of sentences split across multiple segments
 * @param {Array} segments - Parsed subtitle segments
 * @param {string} targetSentence - Sentence to find
 * @returns {Object|null} Best matching segment or null
 */
function findBestMatch(segments, targetSentence) {
  if (!targetSentence || targetSentence.trim() === '') {
    return null;
  }
  
  const normalizedTarget = normalizeText(targetSentence);
  const targetWords = normalizedTarget.split(' ').filter(word => word.length > 1);
  
  // Get the first few important words (sentence beginning)
  const firstWords = targetWords.slice(0, 8); // Increased from 5 to 8 for better matching
  const allWords = targetWords.slice(0, 15); // Increased from 10 to 15 for better coverage
  
  // Filter out very common words for better matching
  const commonWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'as', 'and', 'or', 'but', 'his', 'her', 'he', 'she', 'it', 'was', 'were', 'had', 'has'];
  const uniqueFirstWords = firstWords.filter(word => !commonWords.includes(word) && word.length > 1); // Reduced from 2 to 1
  const uniqueAllWords = allWords.filter(word => !commonWords.includes(word) && word.length > 1); // Reduced from 2 to 1
  
  let bestMatch = null;
  let bestScore = 0;
  
  console.log(`🔍 Looking for: "${targetSentence.substring(0, 60)}..."`);
  console.log(`📝 Unique words: [${uniqueFirstWords.slice(0, 4).join(', ')}]`);
  
  for (const segment of segments) {
    let score = 0;
    let matchType = '';
    
    // Strategy 1A: Check if this segment contains the very first words (HIGHEST PRIORITY)
    const veryFirstWords = uniqueFirstWords.slice(0, 3); // Increased from 2 to 3 for better matching
    const veryFirstInSegment = veryFirstWords.filter(word => segment.normalizedText.includes(word)).length;
    const veryFirstRatio = veryFirstWords.length > 0 ? veryFirstInSegment / veryFirstWords.length : 0;
    
    if (veryFirstInSegment >= 1 && veryFirstRatio >= 0.3) { // Reduced from 0.5 to 0.3 for more flexibility
      // Give very high score for the actual sentence beginning
      score = 98 + (veryFirstRatio * 2);
      matchType = `sentence_start_${Math.round(veryFirstRatio * 100)}%`;
    }
    // Strategy 1B: Unique sentence beginning match (95-100 points)
    else {
      const uniqueFirstInSegment = uniqueFirstWords.filter(word => segment.normalizedText.includes(word)).length;
      const uniqueFirstRatio = uniqueFirstWords.length > 0 ? uniqueFirstInSegment / uniqueFirstWords.length : 0;
      
      if (uniqueFirstInSegment >= 1 && uniqueFirstRatio >= 0.4) { // Reduced thresholds for more flexibility
        score = 90 + (uniqueFirstRatio * 5);
        matchType = `unique_beginning_${Math.round(uniqueFirstRatio * 100)}%`;
      }
    }
    // Strategy 2: Strong unique word overlap (80-90 points)
    if (score === 0) {
      const uniqueFirstInSegment = uniqueFirstWords.filter(word => segment.normalizedText.includes(word)).length;
      if (uniqueFirstInSegment >= 1) {
        const uniqueAllInSegment = uniqueAllWords.filter(word => segment.normalizedText.includes(word)).length;
        const uniqueAllRatio = uniqueAllWords.length > 0 ? uniqueAllInSegment / uniqueAllWords.length : 0;
        
        if (uniqueAllRatio >= 0.25) { // Reduced from 0.4 to 0.25 for more flexibility
          score = 75 + (uniqueAllRatio * 15);
          matchType = `unique_overlap_${Math.round(uniqueAllRatio * 100)}%`;
        }
      }
    }
    // Strategy 3: Fallback to regular words if no unique matches
    if (score === 0) {
      const firstWordsInSegment = firstWords.filter(word => segment.normalizedText.includes(word)).length;
      const firstWordsRatio = firstWordsInSegment / firstWords.length;
      
      if (firstWordsInSegment >= 2 && firstWordsRatio >= 0.4) { // Reduced thresholds for more flexibility
        score = 65 + (firstWordsRatio * 10);
        matchType = `fallback_beginning_${Math.round(firstWordsRatio * 100)}%`;
      }
    }
    
    // Strategy 4: Proper noun/name match (60-70 points) - dynamic fallback option
    if (score === 0) {
      // Extract potential proper nouns (capitalized words) from both target and segment
      const extractProperNouns = (text) => {
        return text.split(' ')
          .filter(word => word.length > 2 && /^[A-Z][a-z]/.test(word))
          .map(word => word.toLowerCase())
          .filter(word => !['the', 'and', 'but', 'for', 'with', 'from'].includes(word));
      };
      
      const targetProperNouns = extractProperNouns(targetSentence);
      const segmentProperNouns = extractProperNouns(segment.text);
      const commonProperNouns = targetProperNouns.filter(noun => segmentProperNouns.includes(noun));
      
      if (commonProperNouns.length > 0) {
        score = 60 + (commonProperNouns.length * 5);
        matchType = `proper_noun_match_${commonProperNouns.length}`;
      }
    }
    
    // Bonus for segment appearing early in subtitle (sentence beginnings are usually first)
    const segmentIndex = segments.indexOf(segment);
    if (score > 0 && segmentIndex < segments.length / 3) {
      score += 5; // Small bonus for early segments
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        segment,
        score,
        matchType
      };
    }
  }
  
  if (bestMatch && bestMatch.score >= 50) { // Reduced threshold from 60 to 50 for more flexibility
    console.log(`✅ FOUND: "${bestMatch.segment.text}" (${bestMatch.score.toFixed(1)}% - ${bestMatch.matchType})`);
    console.log(`⏱️ TIMING: ${bestMatch.segment.startTime} → ${bestMatch.segment.endTime}`);
    return bestMatch.segment;
  } else {
    console.log(`❌ NOT FOUND: Best match only ${bestMatch ? bestMatch.score.toFixed(1) : 0}%`);
    return null;
  }
}

/**
 * Extract precise timing for start and end sentences from SRT subtitles
 * @param {string} srtContent - SRT content from Whisper
 * @param {string} startSentence - Sentence to find start timing for
 * @param {string} endSentence - Sentence to find end timing for
 * @returns {Object} Timing information
 */
function extractTimingFromSRT(srtContent, startSentence, endSentence) {
  console.log('\n🎯 EXTRACTING PRECISE TIMING FROM WHISPER SUBTITLES');
  
  // Parse all subtitle segments
  const segments = parseSRTSubtitles(srtContent);
  console.log(`📚 Parsed ${segments.length} subtitle segments from Whisper`);
  
  // Find start sentence
  console.log('\n🟢 FINDING START SENTENCE:');
  const startMatch = findBestMatch(segments, startSentence);
  
  // Find end sentence  
  console.log('\n🔴 FINDING END SENTENCE:');
  const endMatch = findBestMatch(segments, endSentence);
  
  // Build result
  const result = {
    startTime: startMatch ? startMatch.startTime : null,
    endTime: endMatch ? endMatch.endTime : null,
    startSeconds: startMatch ? startMatch.startSeconds : null,
    endSeconds: endMatch ? endMatch.endSeconds : null,
    foundStart: !!startMatch,
    foundEnd: !!endMatch,
    confidence: 'unknown'
  };
  
  // Determine confidence level
  if (result.foundStart && result.foundEnd) {
    result.confidence = 'high';
    const duration = result.endSeconds - result.startSeconds;
    console.log(`\n🎉 PERFECT TIMING EXTRACTED!`);
    console.log(`⏱️ Duration: ${duration.toFixed(1)} seconds (${result.startTime} → ${result.endTime})`);
  } else if (result.foundStart) {
    result.confidence = 'medium';
    console.log(`\n✅ START TIMING EXTRACTED (end estimated)`);
    console.log(`⏱️ Start: ${result.startTime}`);
  } else {
    result.confidence = 'low';
    console.log(`\n❌ TIMING EXTRACTION FAILED`);
  }
  
  return result;
}

/**
 * Show debug information about subtitle content
 * @param {string} srtContent - SRT content
 */
function debugSubtitleContent(srtContent) {
  const segments = parseSRTSubtitles(srtContent);
  
  console.log('\n📋 WHISPER TRANSCRIPT SUMMARY:');
  console.log(`Total segments: ${segments.length}`);
  
  if (segments.length > 0) {
    const totalDuration = segments[segments.length - 1].endSeconds - segments[0].startSeconds;
    console.log(`Duration: ${totalDuration.toFixed(1)} seconds`);
    
    console.log('\n📝 FIRST 10 SEGMENTS:');
    segments.slice(0, 10).forEach((seg, i) => {
      console.log(`   ${i + 1}. [${seg.startTime.split(',')[0]}] "${seg.text}"`);
    });
    
    if (segments.length > 10) {
      console.log(`   ... and ${segments.length - 10} more segments`);
    }
  }
}

module.exports = {
  extractTimingFromSRT,
  parseSRTSubtitles,
  debugSubtitleContent,
  timestampToSeconds,
  secondsToTimestamp,
  findBestMatch,
  normalizeText
};