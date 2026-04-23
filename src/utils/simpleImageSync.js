/**
 * Simple and reliable image-subtitle synchronization
 * Uses direct timestamp extraction from Whisper SRT files
 */

const { extractTimingFromSRT, debugSubtitleContent, secondsToTimestamp, timestampToSeconds, parseSRTSubtitles } = require('./simpleSubtitleSync');
const { batchExtractTiming } = require('./efficientSentenceMatching');

/**
 * Create fallback timing when sentence matching fails
 * @param {Array} images - Downloaded images
 * @param {string} srtContent - SRT content
 * @param {Object} statistics - Statistics object to update
 * @returns {Array} Processed images with fallback timing
 */
function createFallbackTiming(images, srtContent, statistics) {
  console.log(`🔄 FALLBACK MODE: Creating sequential timing distribution`);
  
  // Get total audio duration from SRT
  const segments = parseSRTSubtitles(srtContent);
  const audioDuration = segments.length > 0 ? segments[segments.length - 1].endSeconds : 60;
  const imageDuration = Math.max(4, audioDuration / images.length);
  
  console.log(`📊 Distributing ${images.length} images across ${audioDuration.toFixed(1)}s (${imageDuration.toFixed(1)}s each)`);
  
  const processedImages = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const startSeconds = i * imageDuration;
    const endSeconds = Math.min(startSeconds + imageDuration, audioDuration);
    const duration = endSeconds - startSeconds;
    
    if (duration >= 2) {
      const result = {
        ...img,
        startTime: secondsToTimestamp(startSeconds),
        endTime: secondsToTimestamp(endSeconds),
        startSeconds,
        endSeconds,
        duration,
        syncMethod: 'sequential_fallback',
        confidence: 'estimated',
        syncQuality: 'fallback',
        foundStart: false,
        foundEnd: false,
        whisperMatched: false
      };
      
      processedImages.push(result);
      statistics.fallbackMatches++;
      console.log(`📍 Image ${i + 1}: ${startSeconds.toFixed(1)}s-${endSeconds.toFixed(1)}s`);
    }
  }
  
  console.log(`✅ FALLBACK COMPLETE: ${processedImages.length} images with sequential timing`);
  return processedImages;
}

/**
 * Optimize image timing to prevent overlaps and ensure minimum durations while preserving section order
 * @param {Array} images - Processed images array
 */
function optimizeImageTimingWithSectionPreservation(images) {
  console.log(`🔧 OPTIMIZING TIMING FOR ${images.length} IMAGES WITH SECTION PRESERVATION...`);
  
  for (let i = 0; i < images.length; i++) {
    const current = images[i];
    const next = images[i + 1];
    
    console.log(`📍 Image ${i + 1}: ${current.section} - ${current.startSeconds.toFixed(1)}s`);
    
    // Handle overlaps - but be more careful with section boundaries
    if (next && current.endSeconds > next.startSeconds) {
      const overlap = current.endSeconds - next.startSeconds;
      console.log(`⚠️ Overlap detected: Image ${i + 1} (${current.section}) → ${i + 2} (${next.section}) (${overlap.toFixed(1)}s)`);
      
      // If different sections, allow some flexibility in timing
      if (current.section !== next.section) {
        console.log(`🔄 Section boundary: ${current.section} → ${next.section}, preserving sentence timing`);
      }
      
      // ALWAYS preserve the next image's precise start timing (sentence synchronization)
      // Cut the current image short to avoid overlap
      current.endSeconds = next.startSeconds - 0.1;
      current.endTime = secondsToTimestamp(current.endSeconds);
      current.duration = current.endSeconds - current.startSeconds;
      console.log(`   🔧 Cut image ${i + 1} short to preserve sentence timing at ${next.startSeconds}s`);
    }
    
    // Ensure minimum duration
    const minDuration = 2.0;
    if (current.duration < minDuration) {
      const extension = minDuration - current.duration;
      if (!next || next.startSeconds - current.endSeconds >= extension) {
        current.endSeconds += extension;
        current.endTime = secondsToTimestamp(current.endSeconds);
        current.duration = minDuration;
        console.log(`   🔧 Extended image ${i + 1} to meet minimum duration`);
      }
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @param {Array} images - Processed images array
 */
function optimizeImageTiming(images) {
  return optimizeImageTimingWithSectionPreservation(images);
}

/**
 * Show final synchronization results
 * @param {Array} processedImages - Successfully processed images
 * @param {Array} failedImages - Failed images
 * @param {Object} statistics - Processing statistics
 */
function showFinalResults(processedImages, failedImages, statistics) {
  console.log(`\n📈 SYNCHRONIZATION RESULTS:`);
  console.log(`   🎯 Perfect matches: ${statistics.perfectMatches} (both start & end found)`);
  console.log(`   ✅ Partial matches: ${statistics.partialMatches} (start found, end estimated)`);
  console.log(`   🔄 Fallback matches: ${statistics.fallbackMatches} (sequential timing)`);
  console.log(`   📊 Success rate: ${processedImages.length}/${processedImages.length + failedImages.length}`);
  
  if (failedImages.length > 0) {
    console.log(`\n❌ FAILED IMAGES:`);
    failedImages.forEach(fail => {
      console.log(`   ${fail.index}. "${fail.section}": ${fail.reason}`);
    });
  }
  
  console.log(`\n🎬 FINAL TIMELINE:`);
  let totalCoverage = 0;
  processedImages.forEach((img, index) => {
    const qualityIcon = img.syncQuality === 'perfect' ? '🟢' : 
                       img.syncQuality === 'good' ? '🟡' : '🔄';
    console.log(`   ${index + 1}. ${qualityIcon} ${img.startSeconds.toFixed(1)}s-${img.endSeconds.toFixed(1)}s: ${img.section} (${img.duration.toFixed(1)}s)`);
    totalCoverage += img.duration;
  });
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   ⏱️ Total coverage: ${totalCoverage.toFixed(1)} seconds`);
  console.log(`   🎯 Method: Direct Whisper timestamp extraction`);
  console.log(`   ⚡ Simple, reliable, and accurate!`);
}

/**
 * Main function: Process dynamic images with simple subtitle synchronization
 * @param {Array} downloadedImages - Array of downloaded images
 * @param {string} srtContent - SRT subtitle content from Whisper
 * @param {Function} findSentenceTimingInSRT - Legacy function (not used)
 * @param {Function} parseTimestamp - Legacy function (not used)
 * @returns {Array} Array of processed images with precise timing
 */
function processDynamicImagesTiming(downloadedImages, srtContent, findSentenceTimingInSRT, parseTimestamp) {
  console.log("🚀 EFFICIENT SUBTITLE-IMAGE SYNCHRONIZATION");
  console.log(`📊 Processing ${downloadedImages.length} images using optimized batch processing`);
  console.log(`⚡ Method: Batch index + search → Extract precise timestamps → Apply to images\n`);
  
  // Show subtitle content for debugging
  debugSubtitleContent(srtContent);
  
  const processedImages = [];
  const failedImages = [];
  const statistics = { perfectMatches: 0, partialMatches: 0, fallbackMatches: 0 };
  
  // Use efficient batch processing for better performance
  const sentencePairs = downloadedImages.map(img => ({
    startSentence: img.start_sentence,
    endSentence: img.end_sentence
  }));
  
  console.log(`🔄 Starting efficient batch sentence matching...`);
  const batchResults = batchExtractTiming(srtContent, sentencePairs);
  console.log(`✅ Batch processing completed!\n`);
  
  // Process each image with the batch results
  for (let index = 0; index < downloadedImages.length; index++) {
    const img = downloadedImages[index];
    const timing = batchResults[index];
    
    console.log(`\n🖼️ === IMAGE ${index + 1}/${downloadedImages.length}: "${img.section}" ===`);
    
    if (timing.foundStart) {
      let endSeconds = timing.endSeconds;
      let endTime = timing.endTime;
      let syncQuality = 'good';
      
      // Handle end timing
      if (timing.foundEnd) {
        syncQuality = 'perfect';
        statistics.perfectMatches++;
        console.log(`🎉 PERFECT SYNC: Both sentences found with exact timestamps!`);
      } else {
        // Estimate end timing based on typical duration
        const estimatedDuration = 6; // 6 seconds default
        endSeconds = timing.startSeconds + estimatedDuration;
        endTime = secondsToTimestamp(endSeconds);
        statistics.partialMatches++;
        console.log(`✅ GOOD SYNC: Start found, end estimated (+${estimatedDuration}s)`);
      }
      
      // Create result
      const duration = endSeconds - timing.startSeconds;
      const result = {
        ...img,
        startTime: timing.startTime,
        endTime: endTime,
        startSeconds: timing.startSeconds,
        endSeconds: endSeconds,
        duration: duration,
        syncMethod: 'direct_timestamp_extraction',
        confidence: timing.confidence,
        syncQuality: syncQuality,
        foundStart: timing.foundStart,
        foundEnd: timing.foundEnd,
        whisperMatched: true
      };
      
      processedImages.push(result);
      console.log(`⏱️ TIMING: ${timing.startTime} → ${endTime} (${duration.toFixed(1)}s)`);
      
    } else {
      // Failed to find in transcript
      failedImages.push({
        index: index + 1,
        section: img.section,
        reason: 'Sentences not found in Whisper transcript'
      });
      console.log(`❌ FAILED: Could not locate sentences in audio transcript`);
    }
  }
  
  // Handle complete failure with fallback
  if (processedImages.length === 0) {
    console.log(`\n🔄 ALL IMAGES FAILED - ACTIVATING FALLBACK`);
    return createFallbackTiming(downloadedImages, srtContent, statistics);
  }
  
  // Preserve original array order while adding an index for tracking
  processedImages.forEach((img, index) => {
    img.originalIndex = downloadedImages.indexOf(downloadedImages.find(original => 
      original.start_sentence === img.start_sentence && original.section === img.section
    ));
  });
  
  // Sort by original index first (to preserve section order), then by start time
  processedImages.sort((a, b) => {
    // First, sort by original index to maintain section order (intro → development → climax)
    if (a.originalIndex !== b.originalIndex) {
      return a.originalIndex - b.originalIndex;
    }
    // If same original index (shouldn't happen), sort by start time
    return a.startSeconds - b.startSeconds;
  });
  
  // Only optimize timing if there are conflicts, but preserve section boundaries
  optimizeImageTimingWithSectionPreservation(processedImages);
  
  // Show final results
  showFinalResults(processedImages, failedImages, statistics);
  
  console.log(`\n✨ SIMPLE SYNCHRONIZATION COMPLETE!\n`);
  return processedImages;
}

module.exports = {
  processDynamicImagesTiming,
  createFallbackTiming,
  optimizeImageTiming,
  optimizeImageTimingWithSectionPreservation,
  showFinalResults
};