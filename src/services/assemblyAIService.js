const { AssemblyAI } = require('assemblyai');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');

class AssemblyAIService {
  constructor() {
    this.client = new AssemblyAI({
      apiKey: '0792df5d958b42139214976e8509df68'
    });
  }

  /**
   * Transcribe audio file using AssemblyAI
   * @param {string} audioPath - Path to the audio file
   * @param {string} outputDir - Directory to save the SRT file
   * @returns {string} - Path to the generated SRT file
   */
  async transcribeAudio(audioPath, outputDir) {
    try {
      console.log('🎯 Starting AssemblyAI transcription...');
      console.log(`📄 Audio file: ${path.basename(audioPath)}`);

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      // Upload and transcribe the audio file
      const transcript = await this.client.transcripts.transcribe({
        audio: audioPath,
        speech_model: 'best',
        language_detection: true,
        punctuate: true,
        format_text: true
      });

      if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Generate SRT content from transcript
      const srtContent = this.generateSRTFromTranscript(transcript);
      
      // Save SRT file
      const srtPath = path.join(outputDir, 'assemblyai_subtitles.srt');
      await fs.writeFile(srtPath, srtContent, 'utf8');

      console.log('✅ AssemblyAI transcription completed successfully');
      console.log(`📝 Generated ${this.countSubtitles(srtContent)} subtitle segments`);
      console.log(`💾 Saved to: ${srtPath}`);

      return srtPath;
    } catch (error) {
      console.error('❌ AssemblyAI transcription failed:', error.message);
      throw error;
    }
  }

  /**
   * Convert AssemblyAI transcript to SRT format
   * @param {Object} transcript - AssemblyAI transcript object
   * @returns {string} - SRT formatted content
   */
  generateSRTFromTranscript(transcript) {
    if (!transcript.words || transcript.words.length === 0) {
      // Fallback to full text if words are not available
      return this.generateBasicSRT(transcript.text, transcript.audio_duration);
    }

    let srtContent = '';
    let segmentIndex = 1;
    let currentSegment = {
      words: [],
      start: null,
      end: null
    };

    const maxWordsPerSegment = 8;
    const maxSegmentDuration = 5000; // 5 seconds in milliseconds
    const minSegmentDuration = 1000; // 1 second minimum to prevent flickering

    for (const word of transcript.words) {
      // Start new segment if this is the first word
      if (currentSegment.start === null) {
        currentSegment.start = word.start;
      }

      currentSegment.words.push(word);
      currentSegment.end = word.end;

      // Check if we should end this segment
      const segmentDuration = currentSegment.end - currentSegment.start;
      const shouldEndSegment = 
        currentSegment.words.length >= maxWordsPerSegment ||
        segmentDuration >= maxSegmentDuration ||
        (this.isPunctuation(word.text) && segmentDuration >= minSegmentDuration);

      if (shouldEndSegment) {
        // Create SRT entry
        const text = currentSegment.words.map(w => w.text).join(' ').trim();
        if (text) {
          const startTime = this.millisecondsToSRTTime(currentSegment.start);
          const endTime = this.millisecondsToSRTTime(currentSegment.end);
          
          srtContent += `${segmentIndex}\n`;
          srtContent += `${startTime} --> ${endTime}\n`;
          srtContent += `${text}\n\n`;
          
          segmentIndex++;
        }

        // Reset for next segment - ensure continuity by starting next segment immediately
        currentSegment = {
          words: [],
          start: word.end, // Start next segment exactly where this one ended
          end: null
        };
      }
    }

    // Handle any remaining words
    if (currentSegment.words.length > 0) {
      const text = currentSegment.words.map(w => w.text).join(' ').trim();
      if (text) {
        const startTime = this.millisecondsToSRTTime(currentSegment.start);
        const endTime = this.millisecondsToSRTTime(currentSegment.end);
        
        srtContent += `${segmentIndex}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${text}\n\n`;
      }
    }

    // Post-process to ensure no gaps and smooth transitions
    return this.optimizeSubtitleTiming(srtContent);
  }

  /**
   * Generate basic SRT when word-level timestamps aren't available
   * @param {string} text - Full transcript text
   * @param {number} duration - Audio duration in milliseconds
   * @returns {string} - SRT formatted content
   */
  generateBasicSRT(text, duration) {
    if (!text || !text.trim()) {
      return '1\n00:00:00,000 --> 00:00:05,000\n[No speech detected]\n\n';
    }

    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segmentDuration = duration / sentences.length;
    
    let srtContent = '';
    
    sentences.forEach((sentence, index) => {
      const startTime = this.millisecondsToSRTTime(index * segmentDuration);
      const endTime = this.millisecondsToSRTTime((index + 1) * segmentDuration);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${sentence.trim()}\n\n`;
    });

    return srtContent;
  }

  /**
   * Check if a word ends with punctuation
   * @param {string} text - Word text
   * @returns {boolean} - True if word ends with punctuation
   */
  isPunctuation(text) {
    return /[.!?;,]$/.test(text.trim());
  }

  /**
   * Convert milliseconds to SRT time format (HH:MM:SS,mmm)
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} - SRT formatted time
   */
  millisecondsToSRTTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = Math.floor(milliseconds % 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Count number of subtitle segments in SRT content
   * @param {string} srtContent - SRT formatted content
   * @returns {number} - Number of subtitle segments
   */
  countSubtitles(srtContent) {
    return (srtContent.match(/^\d+$/gm) || []).length;
  }

  /**
   * Optimize subtitle timing to prevent flickering and gaps
   * @param {string} srtContent - SRT formatted content
   * @returns {string} - Optimized SRT content
   */
  optimizeSubtitleTiming(srtContent) {
    if (!srtContent || srtContent.trim() === '') {
      return srtContent;
    }

    const lines = srtContent.trim().split('\n');
    const segments = [];
    let currentSegment = null;

    // Parse segments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.match(/^\d+$/)) {
        // Index line
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = {
          index: parseInt(line),
          startTime: null,
          endTime: null,
          text: []
        };
      } else if (line.includes('-->') && currentSegment) {
        // Time line
        const [start, end] = line.split(' --> ');
        currentSegment.startTime = this.parseSRTTime(start.trim());
        currentSegment.endTime = this.parseSRTTime(end.trim());
      } else if (line && currentSegment) {
        // Text line
        currentSegment.text.push(line);
      }
    }
    
    if (currentSegment) {
      segments.push(currentSegment);
    }

    // Optimize timing
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];
      
      // Ensure minimum duration (prevent flickering)
      const duration = current.endTime - current.startTime;
      if (duration < 1000) { // Less than 1 second
        current.endTime = current.startTime + 1000;
      }
      
      // Ensure no gaps (prevent flickering)
      if (current.endTime < next.startTime) {
        // Add small overlap to prevent gaps
        const gap = next.startTime - current.endTime;
        if (gap > 100) { // More than 100ms gap
          current.endTime = next.startTime - 50; // 50ms overlap
        }
      }
      
      // Ensure no overlaps (prevent double subtitles)
      if (current.endTime > next.startTime) {
        const overlap = current.endTime - next.startTime;
        if (overlap > 200) { // More than 200ms overlap
          current.endTime = next.startTime - 50; // 50ms gap
        }
      }
    }

    // Rebuild SRT content
    let optimizedContent = '';
    for (const segment of segments) {
      optimizedContent += `${segment.index}\n`;
      optimizedContent += `${this.millisecondsToSRTTime(segment.startTime)} --> ${this.millisecondsToSRTTime(segment.endTime)}\n`;
      optimizedContent += `${segment.text.join('\n')}\n\n`;
    }

    return optimizedContent;
  }

  /**
   * Parse SRT time format to milliseconds
   * @param {string} srtTime - SRT time format (HH:MM:SS,mmm)
   * @returns {number} - Time in milliseconds
   */
  parseSRTTime(srtTime) {
    const [time, ms] = srtTime.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms);
  }
}

module.exports = AssemblyAIService;
