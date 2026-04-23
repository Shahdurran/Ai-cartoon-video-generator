/**
 * Efficient Sentence Matching for Longer Subtitles
 * Optimized algorithms for matching sentences with audio transcripts
 */

const { parseSRTSubtitles, normalizeText, timestampToSeconds, secondsToTimestamp } = require('./simpleSubtitleSync');

/**
 * Create efficient text search index from subtitle segments
 * @param {Array} segments - Parsed subtitle segments
 * @returns {Object} Search index with word mappings
 */
function createTextSearchIndex(segments) {
    const wordIndex = new Map(); // word -> segments containing it
    const phraseIndex = new Map(); // phrase -> segments containing it
    const characterIndex = new Map(); // character name -> segments
    
    segments.forEach((segment, index) => {
        const words = segment.normalizedText.split(/\s+/).filter(w => w.length > 0);
        
        // Index individual words
        words.forEach(word => {
            if (!wordIndex.has(word)) {
                wordIndex.set(word, []);
            }
            wordIndex.get(word).push({ segment, index });
        });
        
        // Index character names (capitalized words at sentence start)
        const sentences = segment.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        sentences.forEach(sentence => {
            const trimmed = sentence.trim();
            const firstWord = trimmed.split(/\s+/)[0];
            if (firstWord && /^[A-Z][a-z]+$/.test(firstWord)) {
                if (!characterIndex.has(firstWord.toLowerCase())) {
                    characterIndex.set(firstWord.toLowerCase(), []);
                }
                characterIndex.get(firstWord.toLowerCase()).push({ segment, index, sentence: trimmed });
            }
        });
        
        // Index 3-4 word phrases for better matching
        for (let i = 0; i <= words.length - 3; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (!phraseIndex.has(phrase)) {
                phraseIndex.set(phrase, []);
            }
            phraseIndex.get(phrase).push({ segment, index, position: i });
        }
    });
    
    return {
        wordIndex,
        phraseIndex,
        characterIndex,
        totalSegments: segments.length
    };
}

/**
 * Fast fuzzy string matching using edit distance
 * @param {string} a - First string
 * @param {string} b - Second string
 * @param {number} maxDistance - Maximum allowed edit distance
 * @returns {number} Edit distance or Infinity if over maxDistance
 */
function fastEditDistance(a, b, maxDistance = 5) {
    const lenA = a.length;
    const lenB = b.length;
    
    // Early exit if length difference is too large
    if (Math.abs(lenA - lenB) > maxDistance) {
        return Infinity;
    }
    
    // Use only the necessary part of the DP matrix
    let prev = new Array(lenB + 1);
    let curr = new Array(lenB + 1);
    
    // Initialize first row
    for (let j = 0; j <= lenB; j++) {
        prev[j] = j;
    }
    
    for (let i = 1; i <= lenA; i++) {
        curr[0] = i;
        let minInRow = i;
        
        for (let j = 1; j <= lenB; j++) {
            if (a[i - 1] === b[j - 1]) {
                curr[j] = prev[j - 1];
            } else {
                curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
            }
            minInRow = Math.min(minInRow, curr[j]);
        }
        
        // Early exit if minimum in this row exceeds maxDistance
        if (minInRow > maxDistance) {
            return Infinity;
        }
        
        // Swap arrays
        const temp = prev;
        prev = curr;
        curr = temp;
    }
    
    return prev[lenB];
}

/**
 * Find sentence matches using multiple efficient strategies
 * @param {Object} searchIndex - Pre-built search index
 * @param {Array} segments - All subtitle segments
 * @param {string} targetSentence - Sentence to find
 * @returns {Array} Array of match candidates with scores
 */
function findEfficientMatches(searchIndex, segments, targetSentence) {
    if (!targetSentence || targetSentence.trim() === '') {
        return [];
    }
    
    const normalizedTarget = normalizeText(targetSentence);
    const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = [...new Set(targetWords)];
    const importantWords = uniqueWords.filter(w => w.length > 4);
    const veryImportantWords = uniqueWords.filter(w => w.length > 6);
    
    console.log(`🔍 Searching for: "${targetSentence.substring(0, 60)}..."`);
    console.log(`   📊 Words: ${targetWords.length}, Unique: ${uniqueWords.length}, Important: ${importantWords.length}`);
    
    const candidates = new Set();
    const scores = new Map();
    
    // Strategy 1: Character name detection (highest priority)
    const firstWord = targetWords[0];
    if (firstWord && firstWord.length > 2) {
        const characterMatches = searchIndex.characterIndex.get(firstWord.toLowerCase()) || [];
        characterMatches.forEach(match => {
            candidates.add(match.index);
            scores.set(match.index, (scores.get(match.index) || 0) + 50);
        });
        
        if (characterMatches.length > 0) {
            console.log(`   👤 Found ${characterMatches.length} character name matches for "${firstWord}"`);
        }
    }
    
    // Strategy 2: Important word intersection
    const importantCandidates = new Set();
    importantWords.forEach(word => {
        const wordMatches = searchIndex.wordIndex.get(word) || [];
        wordMatches.forEach(match => {
            importantCandidates.add(match.index);
        });
    });
    
    if (importantCandidates.size > 0) {
        console.log(`   🎯 Found ${importantCandidates.size} segments with important words`);
        importantCandidates.forEach(idx => candidates.add(idx));
    }
    
    // Strategy 3: Phrase matching
    if (targetWords.length >= 3) {
        for (let i = 0; i <= targetWords.length - 3; i++) {
            const phrase = targetWords.slice(i, i + 3).join(' ');
            const phraseMatches = searchIndex.phraseIndex.get(phrase) || [];
            phraseMatches.forEach(match => {
                candidates.add(match.index);
                scores.set(match.index, (scores.get(match.index) || 0) + 30);
            });
        }
    }
    
    // Strategy 4: Fuzzy matching on promising candidates
    const results = [];
    const candidateArray = Array.from(candidates);
    
    console.log(`   🔍 Evaluating ${candidateArray.length} candidate segments...`);
    
    candidateArray.forEach(segmentIndex => {
        const segment = segments[segmentIndex];
        let score = scores.get(segmentIndex) || 0;
        
        // Word overlap scoring
        const segmentWords = segment.normalizedText.split(/\s+/);
        const commonWords = uniqueWords.filter(word => segmentWords.includes(word));
        const wordOverlapRatio = commonWords.length / uniqueWords.length;
        score += wordOverlapRatio * 40;
        
        // Important word bonus
        const commonImportantWords = importantWords.filter(word => segmentWords.includes(word));
        if (commonImportantWords.length > 0) {
            score += (commonImportantWords.length / importantWords.length) * 20;
        }
        
        // Position bonus (prefer earlier matches for narrative flow)
        const positionBonus = Math.max(0, 10 - (segmentIndex / segments.length) * 10);
        score += positionBonus;
        
        // Fuzzy matching for similar sentences
        const editDistance = fastEditDistance(
            normalizedTarget.substring(0, 100), 
            segment.normalizedText.substring(0, 100),
            10
        );
        
        if (editDistance < 10) {
            score += (10 - editDistance) * 2;
        }
        
        // Check for sentence boundaries (prefer complete sentences)
        if (segment.text.includes('.') || segment.text.includes('!') || segment.text.includes('?')) {
            score += 5;
        }
        
        results.push({
            segment,
            segmentIndex,
            score,
            wordOverlapRatio,
            commonWords: commonWords.length,
            editDistance: editDistance === Infinity ? 'high' : editDistance,
            startTime: segment.startTime,
            endTime: segment.endTime,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds
        });
    });
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Log top candidates
    console.log(`   📈 Top 3 matches:`);
    results.slice(0, 3).forEach((result, idx) => {
        console.log(`      ${idx + 1}. Score: ${result.score.toFixed(1)}, ` +
                   `Words: ${result.commonWords}/${uniqueWords.length}, ` +
                   `Time: ${result.startTime}`);
    });
    
    return results;
}

/**
 * Efficient sentence timing extraction with optimized algorithms
 * @param {string} srtContent - SRT subtitle content
 * @param {string} startSentence - Start sentence to find
 * @param {string} endSentence - End sentence to find
 * @returns {Object} Timing information with enhanced details
 */
function extractTimingEfficient(srtContent, startSentence, endSentence) {
    console.log('\n🚀 EFFICIENT SENTENCE TIMING EXTRACTION');
    
    const startTime = Date.now();
    
    // Parse segments
    const segments = parseSRTSubtitles(srtContent);
    console.log(`📚 Processing ${segments.length} subtitle segments`);
    
    // Build search index
    console.log('🔧 Building search index...');
    const indexStartTime = Date.now();
    const searchIndex = createTextSearchIndex(segments);
    const indexTime = Date.now() - indexStartTime;
    console.log(`   ✅ Index built in ${indexTime}ms`);
    console.log(`   📊 Words indexed: ${searchIndex.wordIndex.size}, Phrases: ${searchIndex.phraseIndex.size}`);
    
    // Find start sentence
    console.log('\n🟢 FINDING START SENTENCE:');
    const startMatches = findEfficientMatches(searchIndex, segments, startSentence);
    const startMatch = startMatches.length > 0 ? startMatches[0] : null;
    
    // Find end sentence
    console.log('\n🔴 FINDING END SENTENCE:');
    const endMatches = findEfficientMatches(searchIndex, segments, endSentence);
    const endMatch = endMatches.length > 0 ? endMatches[0] : null;
    
    // Build result
    const result = {
        startTime: startMatch ? startMatch.startTime : null,
        endTime: endMatch ? endMatch.endTime : null,
        startSeconds: startMatch ? startMatch.startSeconds : null,
        endSeconds: endMatch ? endMatch.endSeconds : null,
        foundStart: !!startMatch,
        foundEnd: !!endMatch,
        confidence: 'unknown',
        startScore: startMatch ? startMatch.score : 0,
        endScore: endMatch ? endMatch.score : 0,
        processingTime: Date.now() - startTime,
        indexingTime: indexTime,
        searchTime: Date.now() - startTime - indexTime
    };
    
    // Determine confidence
    if (result.foundStart && result.foundEnd) {
        const avgScore = (result.startScore + result.endScore) / 2;
        if (avgScore > 70) {
            result.confidence = 'very_high';
        } else if (avgScore > 50) {
            result.confidence = 'high';
        } else {
            result.confidence = 'medium';
        }
        
        const duration = result.endSeconds - result.startSeconds;
        console.log(`\n🎉 PERFECT MATCH FOUND!`);
        console.log(`⏱️  Duration: ${duration.toFixed(1)}s (${result.startTime} → ${result.endTime})`);
        console.log(`📊 Scores: Start ${result.startScore.toFixed(1)}, End ${result.endScore.toFixed(1)}`);
        console.log(`⚡ Processing: ${result.processingTime}ms (index: ${result.indexingTime}ms, search: ${result.searchTime}ms)`);
    } else if (result.foundStart) {
        result.confidence = result.startScore > 50 ? 'medium' : 'low';
        console.log(`\n✅ START FOUND: ${result.startTime} (score: ${result.startScore.toFixed(1)})`);
        console.log(`⚡ Processing: ${result.processingTime}ms`);
    } else {
        result.confidence = 'none';
        console.log(`\n❌ NO MATCHES FOUND`);
        console.log(`⚡ Processing: ${result.processingTime}ms`);
    }
    
    return result;
}

/**
 * Batch process multiple sentences efficiently (reuses search index)
 * @param {string} srtContent - SRT subtitle content
 * @param {Array} sentencePairs - Array of {startSentence, endSentence} objects
 * @returns {Array} Array of timing results
 */
function batchExtractTiming(srtContent, sentencePairs) {
    console.log('\n🚀 BATCH EFFICIENT TIMING EXTRACTION');
    console.log(`📊 Processing ${sentencePairs.length} sentence pairs`);
    
    const totalStartTime = Date.now();
    
    // Parse and index once
    const segments = parseSRTSubtitles(srtContent);
    const searchIndex = createTextSearchIndex(segments);
    
    const indexingTime = Date.now() - totalStartTime;
    console.log(`✅ Pre-processing completed in ${indexingTime}ms`);
    
    const results = [];
    
    sentencePairs.forEach((pair, index) => {
        console.log(`\n[${index + 1}/${sentencePairs.length}] Processing sentence pair...`);
        
        const pairStartTime = Date.now();
        
        // Find start and end using existing index
        const startMatches = findEfficientMatches(searchIndex, segments, pair.startSentence);
        const endMatches = findEfficientMatches(searchIndex, segments, pair.endSentence);
        
        const startMatch = startMatches.length > 0 ? startMatches[0] : null;
        const endMatch = endMatches.length > 0 ? endMatches[0] : null;
        
        const pairResult = {
            index,
            startSentence: pair.startSentence,
            endSentence: pair.endSentence,
            startTime: startMatch ? startMatch.startTime : null,
            endTime: endMatch ? endMatch.endTime : null,
            startSeconds: startMatch ? startMatch.startSeconds : null,
            endSeconds: endMatch ? endMatch.endSeconds : null,
            foundStart: !!startMatch,
            foundEnd: !!endMatch,
            startScore: startMatch ? startMatch.score : 0,
            endScore: endMatch ? endMatch.score : 0,
            processingTime: Date.now() - pairStartTime
        };
        
        // Determine confidence
        if (pairResult.foundStart && pairResult.foundEnd) {
            const avgScore = (pairResult.startScore + pairResult.endScore) / 2;
            pairResult.confidence = avgScore > 70 ? 'very_high' : avgScore > 50 ? 'high' : 'medium';
        } else if (pairResult.foundStart) {
            pairResult.confidence = pairResult.startScore > 50 ? 'medium' : 'low';
        } else {
            pairResult.confidence = 'none';
        }
        
        results.push(pairResult);
        
        console.log(`   ${pairResult.foundStart && pairResult.foundEnd ? '✅' : pairResult.foundStart ? '⚠️' : '❌'} ` +
                   `Confidence: ${pairResult.confidence}, Time: ${pairResult.processingTime}ms`);
    });
    
    const totalTime = Date.now() - totalStartTime;
    const searchTime = totalTime - indexingTime;
    
    console.log(`\n📊 BATCH PROCESSING COMPLETE:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Indexing: ${indexingTime}ms`);
    console.log(`   Searching: ${searchTime}ms`);
    console.log(`   Average per pair: ${(searchTime / sentencePairs.length).toFixed(1)}ms`);
    console.log(`   Success rate: ${(results.filter(r => r.foundStart).length / results.length * 100).toFixed(1)}%`);
    
    return results;
}

module.exports = {
    createTextSearchIndex,
    findEfficientMatches,
    extractTimingEfficient,
    batchExtractTiming,
    fastEditDistance
};