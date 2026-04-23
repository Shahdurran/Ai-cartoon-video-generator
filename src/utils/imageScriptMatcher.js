/**
 * Image-Script Matcher Utility
 * Matches generated images to script sentences based on timing and content
 */

/**
 * Match images to script sentences based on timing
 * @param {Array} sentences - Script sentences with timing info
 * @param {Array} images - Generated images
 * @param {number} audioDuration - Total audio duration in seconds
 * @returns {Array} Image blocks with sentence mappings
 */
function matchImagesToSentences(sentences, images, audioDuration) {
  if (!sentences || sentences.length === 0) {
    throw new Error('No sentences provided for matching');
  }
  
  if (!images || images.length === 0) {
    throw new Error('No images provided for matching');
  }

  console.log(`\n🔗 Matching ${images.length} images to ${sentences.length} sentences...`);
  
  // Calculate how many sentences per image
  const sentencesPerImage = Math.ceil(sentences.length / images.length);
  console.log(`   Strategy: ~${sentencesPerImage} sentences per image`);
  
  const imageBlocks = [];
  
  for (let i = 0; i < images.length; i++) {
    const startIdx = i * sentencesPerImage;
    const endIdx = Math.min(startIdx + sentencesPerImage, sentences.length);
    
    if (startIdx >= sentences.length) {
      console.warn(`   ⚠️  Image ${i + 1} has no sentences to match (out of range)`);
      continue;
    }
    
    const blockSentences = sentences.slice(startIdx, endIdx);
    const firstSentence = blockSentences[0];
    const lastSentence = blockSentences[blockSentences.length - 1];
    
    // Calculate timing based on sentence positions and total duration
    const startTime = calculateSentenceStartTime(startIdx, sentences.length, audioDuration);
    const endTime = calculateSentenceStartTime(endIdx, sentences.length, audioDuration);
    const duration = endTime - startTime;
    
    imageBlocks.push({
      imageIndex: i,
      section: `Block ${i + 1}`,
      start_sentence: firstSentence.text,
      end_sentence: lastSentence.text,
      start_time: startTime,
      end_time: endTime,
      duration: duration,
      image_url: images[i].imagePath || images[i].path || images[i].url,
      image_prompt: images[i].prompt || '',
      sentences: blockSentences.map((s, idx) => ({
        index: startIdx + idx,
        text: s.text,
        wordCount: s.words || s.text.split(/\s+/).length,
      })),
      sentenceIndices: Array.from({ length: endIdx - startIdx }, (_, idx) => startIdx + idx),
    });
    
    console.log(`   ✅ Block ${i + 1}: Sentences ${startIdx + 1}-${endIdx} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`);
  }
  
  console.log(`   🎯 Created ${imageBlocks.length} image blocks\n`);
  return imageBlocks;
}

/**
 * Calculate start time for a sentence based on its position
 * @param {number} sentenceIndex - Index of the sentence
 * @param {number} totalSentences - Total number of sentences
 * @param {number} totalDuration - Total audio duration
 * @returns {number} Start time in seconds
 */
function calculateSentenceStartTime(sentenceIndex, totalSentences, totalDuration) {
  return (sentenceIndex / totalSentences) * totalDuration;
}

/**
 * Group sentences into blocks for image generation
 * @param {Array} sentences - Script sentences
 * @param {number} desiredImageCount - Number of images to generate
 * @returns {Array} Grouped sentence blocks
 */
function groupSentencesIntoBlocks(sentences, desiredImageCount) {
  if (!sentences || sentences.length === 0) {
    return [];
  }
  
  const sentencesPerBlock = Math.ceil(sentences.length / desiredImageCount);
  const blocks = [];
  
  for (let i = 0; i < desiredImageCount; i++) {
    const startIdx = i * sentencesPerBlock;
    const endIdx = Math.min(startIdx + sentencesPerBlock, sentences.length);
    
    if (startIdx >= sentences.length) break;
    
    const blockSentences = sentences.slice(startIdx, endIdx);
    blocks.push({
      blockIndex: i,
      sentences: blockSentences,
      combinedText: blockSentences.map(s => s.text).join(' '),
      sentenceCount: blockSentences.length,
      wordCount: blockSentences.reduce((sum, s) => sum + (s.words || s.text.split(/\s+/).length), 0),
    });
  }
  
  return blocks;
}

/**
 * Extract main visual subject from a block of text
 * Uses simple keyword extraction (can be enhanced with NLP)
 * @param {string} text - Text to analyze
 * @returns {string} Main subject
 */
function extractMainSubject(text) {
  // Remove common words and punctuation
  const cleanText = text.toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|from|by|about)\b/g, ' ')
    .trim();
  
  // Split into words and find most significant ones
  const words = cleanText.split(/\s+/).filter(w => w.length > 3);
  
  // Take first few significant words as the subject
  const subject = words.slice(0, 5).join(' ');
  
  return subject || 'scene';
}

/**
 * Generate image prompts from sentence blocks using Claude AI
 * @param {Array} sentenceBlocks - Grouped sentence blocks
 * @param {string} imageStyle - Image style (realistic, cinematic, etc.)
 * @returns {Array} Image prompts
 */
function generateImagePromptsFromBlocks(sentenceBlocks, imageStyle = 'realistic, cinematic') {
  // Generate contextual prompts that capture the essence of each block
  return sentenceBlocks.map((block, index) => {
    // Extract key visual elements from the text
    const text = block.combinedText;
    
    // Create a more detailed, context-aware prompt
    // This preserves the narrative context from the script
    const prompt = `${text}, ${imageStyle}, high quality, detailed, professional photography, cinematic lighting, atmospheric, emotionally evocative`;
    
    return {
      blockIndex: index,
      prompt: prompt,
      sourceText: block.combinedText.substring(0, 150) + (block.combinedText.length > 150 ? '...' : ''),
      sentenceCount: block.sentenceCount,
    };
  });
}

/**
 * Validate image-sentence mapping
 * @param {Array} imageBlocks - Image blocks to validate
 * @param {number} totalDuration - Expected total duration
 * @returns {object} Validation result
 */
function validateImageMapping(imageBlocks, totalDuration) {
  const errors = [];
  const warnings = [];
  
  if (!imageBlocks || imageBlocks.length === 0) {
    errors.push('No image blocks provided');
    return { valid: false, errors, warnings };
  }
  
  // Check timing continuity
  for (let i = 0; i < imageBlocks.length; i++) {
    const block = imageBlocks[i];
    
    if (block.start_time < 0) {
      errors.push(`Block ${i + 1}: Negative start time`);
    }
    
    if (block.end_time <= block.start_time) {
      errors.push(`Block ${i + 1}: End time must be after start time`);
    }
    
    if (block.duration <= 0) {
      errors.push(`Block ${i + 1}: Invalid duration`);
    }
    
    if (block.duration < 2) {
      warnings.push(`Block ${i + 1}: Very short duration (${block.duration.toFixed(1)}s)`);
    }
    
    // Check for gaps
    if (i < imageBlocks.length - 1) {
      const nextBlock = imageBlocks[i + 1];
      const gap = nextBlock.start_time - block.end_time;
      
      if (Math.abs(gap) > 0.1) {
        warnings.push(`Gap between block ${i + 1} and ${i + 2}: ${gap.toFixed(2)}s`);
      }
    }
  }
  
  // Check total coverage
  const lastBlock = imageBlocks[imageBlocks.length - 1];
  const coverage = lastBlock.end_time;
  const coveragePercent = (coverage / totalDuration) * 100;
  
  if (coveragePercent < 90) {
    warnings.push(`Low coverage: ${coveragePercent.toFixed(1)}% of total duration`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverage: coveragePercent,
    totalBlocks: imageBlocks.length,
  };
}

module.exports = {
  matchImagesToSentences,
  groupSentencesIntoBlocks,
  extractMainSubject,
  generateImagePromptsFromBlocks,
  validateImageMapping,
  calculateSentenceStartTime,
};

