const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs-extra");
const downloadFile = require("./downloadFile");
const { extractTimingFromSRT, debugSubtitleContent } = require("./simpleSubtitleSync");


/**
 * Convert 1536x1024 (3:2) images to 1298x720 (custom 16:9) with maximum width usage
 * @param {string} inputPath - Path to the input image
 * @param {string} outputPath - Path to save the converted image
 * @returns {Promise<string>} Path to the converted image
 */
async function convertImageToTargetResolution(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Converting 1536x1024 image to 1298x720 with maximum width: ${path.basename(inputPath)}`);
    
    ffmpeg(inputPath)
      .outputOptions([
        // Scale 1536x1024 (3:2) to fit width 1298px, then center crop to 1298x720 (maximum width usage)
        "-vf", "scale=1298:-1,crop=1298:720",
        "-frames:v", "1", // Only process one frame for static images
        "-q:v", "2", // High quality JPEG
        "-y" // Overwrite output file
      ])
      .output(outputPath)
      .on("start", () => {
        console.log(`   📐 Scaling: 1536x1024 → 1298x866 → center crop to 1298x720 (max width)`);
      })
      .on("end", () => {
        console.log(`   ✅ Conversion complete: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`   ❌ Conversion failed for ${path.basename(inputPath)}:`, err.message);
        reject(new Error(`Image conversion failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Helper function to download dynamic images
 * @param {Array} images - Array of image objects with image_url and other properties
 * @param {string} tempDir - Temporary directory to download images to
 * @returns {Promise<Array>} Array of downloaded images with localPath property
 */
async function downloadDynamicImages(images, tempDir) {
  if (!images || images.length === 0) return [];
  
  console.log(`📥 Downloading ${images.length} dynamic images...`);
  
  const downloadPromises = images.map(async (img, index) => {
    const maxRetries = 2; // Simple retry for individual images
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Retrying image ${index + 1} (attempt ${attempt}/${maxRetries})`);
        }
        
        const imageExtension = path.extname(new URL(img.image_url).pathname) || '.jpg';
        const downloadPath = path.join(tempDir, `dynamic_image_${index}_original${imageExtension}`);
        const convertedPath = path.join(tempDir, `dynamic_image_${index}_1298x720.jpg`);
        
        // Step 1: Download original image
        await downloadFile(img.image_url, downloadPath);
        
        // Step 2: Convert to 1298x720 (custom 16:9)
        await convertImageToTargetResolution(downloadPath, convertedPath);
        
        // Step 3: Clean up original downloaded file
        await fs.remove(downloadPath);
        
        return {
          ...img,
          localPath: convertedPath,
          originalPath: downloadPath,
          index: index
        };
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for image ${index + 1}:`, error.message);
        
        // Clean up any partial files before retry
        try {
          const imageExtension = path.extname(new URL(img.image_url).pathname) || '.jpg';
          const downloadPath = path.join(tempDir, `dynamic_image_${index}_original${imageExtension}`);
          const convertedPath = path.join(tempDir, `dynamic_image_${index}_1298x720.jpg`);
          
          if (fs.existsSync(downloadPath)) await fs.remove(downloadPath);
          if (fs.existsSync(convertedPath)) await fs.remove(convertedPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // All retries failed
    console.error(`❌ All ${maxRetries} attempts failed for image ${index + 1}`);
    throw new Error(`Failed to download/convert image ${index + 1} after ${maxRetries} attempts: ${lastError.message}`);
  });
  
  // Use Promise.allSettled to allow some images to fail while others succeed
  const results = await Promise.allSettled(downloadPromises);
  
  const downloadedImages = [];
  const failedImages = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      downloadedImages.push(result.value);
    } else {
      failedImages.push({ index: index + 1, error: result.reason.message });
      console.error(`❌ Image ${index + 1} failed permanently: ${result.reason.message}`);
    }
  });
  
  if (downloadedImages.length === 0) {
    throw new Error(`All ${images.length} images failed to download. Check your image URLs and network connection.`);
  }
  
  if (failedImages.length > 0) {
    console.log(`⚠️ ${failedImages.length}/${images.length} images failed, continuing with ${downloadedImages.length} successful images`);
  }
  
  console.log(`✅ Downloaded and converted ${downloadedImages.length}/${images.length} dynamic images to 1298x720 (custom 16:9)`);
  
  return downloadedImages;
}

/**
 * Validate dynamic images configuration (without timestamps)
 * @param {Array} images - Array of image objects to validate
 * @throws {Error} If validation fails
 */
function validateDynamicImages(images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new Error("When useDynamicImages is true, images parameter must be a non-empty array");
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    
    // Check for required fields (flexible for different image formats)
    if (!img.section) {
      throw new Error(`Image object at index ${i} is missing required field: section`);
    }
    
    // Check for image URL (flexible field names)
    if (!img.image_url && !img.url) {
      throw new Error(`Image object at index ${i} is missing required field: image_url or url`);
    }
    
    // Check for timing information (sentence-based OR timestamp-based)
    const hasSentenceTiming = img.start_sentence && img.end_sentence;
    const hasTimestampTiming = img.startTime && img.endTime;
    const hasOldTimestampTiming = img.timestamp_start && img.timestamp_end;
    
    if (!hasSentenceTiming && !hasTimestampTiming && !hasOldTimestampTiming) {
      throw new Error(`Image object at index ${i} must have either:
        - Sentence timing: start_sentence AND end_sentence
        - Timestamp timing: startTime AND endTime  
        - Legacy timestamp timing: timestamp_start AND timestamp_end`);
    }
    
    // Validate sentence timing if provided
    if (hasSentenceTiming) {
      if (img.start_sentence.trim().length < 3) {
        throw new Error(`Image object at index ${i}: start_sentence is too short. Must be at least 10 characters.`);
      }
      
      if (img.end_sentence.trim().length < 3) {
        throw new Error(`Image object at index ${i}: end_sentence is too short. Must be at least 10 characters.`);
      }
    }
    
    // NEW: Validate separate effect fields (optional)
    if (img.movement_effect) {
      const validMovementEffects = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'scale', 'none'];
      if (!validMovementEffects.includes(img.movement_effect)) {
        throw new Error(`Image object at index ${i}: invalid movement_effect "${img.movement_effect}". Valid values: ${validMovementEffects.join(', ')}`);
      }
    }
    
    if (img.transition_to_next) {
      const validTransitions = ['fade', 'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'circleopen', 'circleclose', 'slideleft', 'slideright', 'slideup', 'slidedown', 'vertopen', 'vertclose', 'horzopen', 'horzclose', 'circlecrop', 'rectcrop', 'distance', 'fadeblack', 'fadewhite', 'radial', 'smoothleft', 'smoothright', 'smoothup', 'smoothdown'];
      if (!validTransitions.includes(img.transition_to_next)) {
        throw new Error(`Image object at index ${i}: invalid transition_to_next "${img.transition_to_next}". Valid values: ${validTransitions.join(', ')}`);
      }
    }
    
    // Validate legacy transition_type field (still supported)
    if (img.transition_type) {
      const allValidEffects = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'scale', 'none', 'fade', 'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'circleopen', 'circleclose', 'slideleft', 'slideright', 'slideup', 'slidedown', 'vertopen', 'vertclose', 'horzopen', 'horzclose', 'circlecrop', 'rectcrop', 'distance', 'fadeblack', 'fadewhite', 'radial', 'smoothleft', 'smoothright', 'smoothup', 'smoothdown'];
      if (!allValidEffects.includes(img.transition_type)) {
        throw new Error(`Image object at index ${i}: invalid transition_type "${img.transition_type}". Valid values: ${allValidEffects.join(', ')}`);
      }
    }
  }
}

/**
 * Process dynamic images timing with SRT content for seamless transitions (Whisper-only)
 * @param {Array} downloadedImages - Array of downloaded images
 * @param {string} srtContent - SRT subtitle content for timing lookup
 * @param {Function} findSentenceTimingInSRT - Function to find sentence timing
 * @param {Function} parseTimestamp - Function to parse timestamp strings
 * @returns {Array} Array of processed images with timing information
 */
function processDynamicImagesTiming(downloadedImages, srtContent, findSentenceTimingInSRT, parseTimestamp, audioDurationInSeconds = null) {
  console.log("🔍 Processing dynamic images for seamless transitions (Whisper-only)...");
  console.log(`📊 Processing ${downloadedImages.length} images using ONLY Whisper sentence matching`);
  console.log(`🎯 NO FALLBACK: Images will only show when exact sentences are found in audio\n`);
  
  const processedImages = [];
  const failedImages = [];
  
  for (let index = 0; index < downloadedImages.length; index++) {
    const img = downloadedImages[index];
    console.log(`🖼️ Processing Image ${index + 1}/${downloadedImages.length}: "${img.section}"`);
    console.log(`   🎬 REQUIRED sentence: "${img.start_sentence}"`);
    console.log(`   📝 Context end: "${img.end_sentence}"`);
    
    // STRICT: Only use Whisper sentence matching - no fallbacks
    const sentenceTiming = findSentenceTimingInSRT(srtContent, img.start_sentence, img.end_sentence);
    
    if (sentenceTiming.startTime) {
      // SUCCESS: Found the sentence in Whisper transcript
      const finalStartTime = sentenceTiming.startTime;
      const startSeconds = parseTimestamp(finalStartTime.split(',')[0]);
      
      // Validation: ensure timing makes sense
      if (startSeconds >= 0) {
        const result = {
          ...img,
          finalStartTime,
          finalEndTime: null, // Will be calculated dynamically
          startSeconds: startSeconds,
          endSeconds: null, // Will be set based on next image or video end
          syncMethod: 'sentence_match',
          confidence: sentenceTiming.confidence,
          whisperMatched: true
        };
        
        processedImages.push(result);
        console.log(`   ✅ WHISPER SUCCESS: Transition at ${finalStartTime} (${startSeconds.toFixed(1)}s)`);
        console.log(`   🎯 Confidence: ${sentenceTiming.confidence.toUpperCase()}`);
        console.log(`   📍 Image will appear when this sentence is spoken\n`);
      } else {
        console.log(`   ❌ INVALID TIMING: Negative start time ${startSeconds}s`);
        failedImages.push({ index: index + 1, section: img.section, reason: 'Invalid timing from Whisper' });
      }
    } else {
      // FAILURE: Could not find sentence in Whisper transcript
      console.log(`   ❌ WHISPER MISS: Could not find start sentence in audio transcript`);
      console.log(`   🔍 This means the sentence "${img.start_sentence}" was not detected by Whisper`);
      console.log(`   💡 SOLUTIONS:`);
      console.log(`      - Check if the sentence is spoken exactly as written`);
      console.log(`      - Try shorter, simpler phrases`);
      console.log(`      - Check for typos or punctuation differences`);
      console.log(`      - Ensure audio quality is good for Whisper transcription\n`);
      
      failedImages.push({ 
        index: index + 1, 
        section: img.section, 
        reason: 'Sentence not found in Whisper transcript',
        sentence: img.start_sentence.substring(0, 50) + "..."
      });
    }
  }
  
  // Check results
  if (failedImages.length > 0) {
    console.log(`❌ PROCESSING ERRORS - ${failedImages.length} images failed:`);
    failedImages.forEach(fail => {
      console.log(`   ${fail.index}. "${fail.section}": ${fail.reason}`);
      if (fail.sentence) {
        console.log(`      Sentence: "${fail.sentence}"`);
      }
    });
    
    if (processedImages.length === 0) {
      throw new Error(`❌ NO IMAGES PROCESSED: All ${downloadedImages.length} images failed sentence matching. Please check that your start_sentence values match exactly what is spoken in the audio.`);
    } else {
      console.log(`⚠️ WARNING: Only ${processedImages.length}/${downloadedImages.length} images will be used`);
      console.log(`🎯 CONTINUING with ${processedImages.length} successfully matched images...\n`);
    }
  } else {
    console.log(`✅ ALL IMAGES MATCHED: ${processedImages.length}/${downloadedImages.length} images found in Whisper transcript\n`);
  }
  
  // Sort by start time for proper sequence
  processedImages.sort((a, b) => a.startSeconds - b.startSeconds);
  
  // Calculate end times based on next image's start time for seamless transitions
  for (let i = 0; i < processedImages.length; i++) {
    const current = processedImages[i];
    const next = processedImages[i + 1];
    
    if (next) {
      current.endSeconds = next.startSeconds;
      current.finalEndTime = next.finalStartTime;
    } else {
      // Last image shows until the end of the audio
      if (audioDurationInSeconds && audioDurationInSeconds > current.startSeconds) {
        current.endSeconds = audioDurationInSeconds; // Show until the end of the audio
        current.finalEndTime = formatTimestamp(current.endSeconds) + ',000';
      } else {
        // Fallback if no audio duration provided
        current.endSeconds = current.startSeconds + Math.max(5, 10); // Show for 10 seconds minimum
        current.finalEndTime = formatTimestamp(current.endSeconds) + ',000';
      }
    }
    
    const duration = current.endSeconds - current.startSeconds;
    console.log(`🎯 Final transition ${i + 1}: "${current.section}" shows ${current.startSeconds.toFixed(1)}s → ${current.endSeconds.toFixed(1)}s (${duration.toFixed(1)}s)`);
  }
  
  console.log(`\n📋 WHISPER-ONLY TRANSITION SUMMARY:`);
  console.log(`   Successfully processed: ${processedImages.length} images`);
  console.log(`   Failed to match: ${failedImages.length} images`);
  console.log(`   Method: 100% Whisper sentence detection`);
  
  // Show final seamless timeline
  console.log(`\n🎬 WHISPER-BASED TIMELINE (seamless transitions):`);
  let totalCoverage = 0;
  processedImages.forEach((img, index) => {
    const confIcon = img.confidence === 'high' ? '🟢' : img.confidence === 'medium' ? '🟡' : '🔴';
    const duration = img.endSeconds - img.startSeconds;
    console.log(`   ${index + 1}. 🎯${confIcon} ${img.startSeconds.toFixed(1)}s → ${img.endSeconds.toFixed(1)}s: ${img.section} (${duration.toFixed(1)}s, ${img.confidence})`);
    totalCoverage += duration;
  });
  
  console.log(`   📊 Total coverage: ${totalCoverage.toFixed(1)}s`);
  console.log(`   🎯 Images transition exactly when sentences are spoken!`);
  
  if (processedImages.length < downloadedImages.length) {
    console.log(`\n💡 OPTIMIZATION TIP: ${failedImages.length} images weren't matched.`);
    console.log(`   Try shorter, more distinctive phrases from the failed sentences.`);
    console.log(`   Check the Whisper transcript above to see exactly what was detected.`);
  }
  
  console.log(``);
  
  return processedImages;
}

// Helper function to format timestamp (declare locally since we need it)
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Process dynamic images without subtitles (requires subtitles for accurate timing)
 * @param {Array} downloadedImages - Array of downloaded images  
 * @param {Function} parseTimestamp - Function to parse timestamp strings
 * @returns {Array} Array of processed images with timing information
 */
function processDynamicImagesManualTiming(downloadedImages, parseTimestamp) {
  console.log("❌ ERROR: Dynamic images require subtitles for accurate sentence timing");
  console.log(`📊 Attempted to process ${downloadedImages.length} images without subtitle timing`);
  console.log(`🎯 SOLUTION: Enable subtitles (useSubtitles: true) for Whisper-based sentence detection\n`);
  
  throw new Error(`Dynamic images require subtitles to be enabled. Without Whisper transcription, we cannot accurately detect when sentences are spoken. Please set useSubtitles: true in your request.`);
}

module.exports = {
  convertImageToTargetResolution,
  downloadDynamicImages,
  validateDynamicImages,
  processDynamicImagesTiming,
  processDynamicImagesManualTiming
}; 