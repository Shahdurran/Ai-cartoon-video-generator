const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import the TranscriptionCorrector from your first file
// Make sure to export it from paste.txt or create a separate module
const { TranscriptionCorrector, applyCorrectionToSRT } = require('./transcription-corrector'); // Adjust path as needed

// Optimized configuration for speed with spell checking
const CONFIG = {
  MODEL_SIZE: 'tiny',
  CHUNK_DURATION: 240, // 4 minutes - optimal balance
  TIMEOUT_PER_CHUNK: 600000, // 10 minutes timeout
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  PARALLEL_CHUNKS: 2, // Process 2 chunks simultaneously
  MAX_CHARS_PER_LINE: 42,
  MIN_SEGMENT_DURATION: 1.0,
  MAX_SEGMENT_DURATION: 5.0,
};

const TEST_AUDIO_PATH = 'D:/ffmpeg video generator/LOS NOBLES LA HUMILLARON POR SU EMBARAZOHASTA QUE UN HOMBRE DE HONOR LE OFRECIÓ SU NOMBRE.mp3';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

// Initialize the corrector
const corrector = new TranscriptionCorrector();

async function validateAndPrepareAudio(inputPath) {
  try {
    console.log('🔍 Analyzing audio...');
    const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`);
    const info = JSON.parse(stdout);
    const audioStream = info.streams.find(s => s.codec_type === 'audio');
    
    if (!audioStream) throw new Error('No audio stream found');
    
    const duration = parseFloat(info.format.duration);
    const channels = audioStream.channels;
    const sampleRate = audioStream.sample_rate;
    
    console.log(`📊 ${Math.floor(duration / 60)}:${(duration % 60).toFixed(0).padStart(2, '0')} | ${channels}ch | ${sampleRate}Hz`);
    
    return { duration, channels, sampleRate, valid: true };
  } catch (error) {
    console.log('❌ Audio analysis failed:', error.message);
    return { valid: false };
  }
}

async function preprocessAudio(inputPath, outputPath) {
  try {
    console.log('🔄 Preprocessing audio...');
    
    const preprocessCommand = [
      'ffmpeg -i', `"${inputPath}"`,
      '-ac', CONFIG.CHANNELS,
      '-ar', CONFIG.SAMPLE_RATE,
      '-acodec pcm_s16le',
      '-af "volume=0.9,highpass=f=80,lowpass=f=8000"',
      `"${outputPath}"`,
      '-y -loglevel warning'
    ].join(' ');
    
    await execAsync(preprocessCommand, { timeout: 300000 });
    console.log('✅ Audio preprocessed');
    return true;
  } catch (error) {
    console.log('⚠️ Using original audio:', error.message);
    return false;
  }
}

async function splitAudioIntoChunks(audioPath, duration) {
  if (duration <= CONFIG.CHUNK_DURATION) {
    console.log('📄 Audio short enough, no splitting needed');
    return [{ path: audioPath, start: 0, duration, index: 0 }];
  }
  
  const totalChunks = Math.ceil(duration / CONFIG.CHUNK_DURATION);
  console.log(`✂️ Splitting into ${totalChunks} chunks...`);
  
  const chunks = [];
  const chunkDir = path.join(OUTPUT_DIR, 'chunks');
  await fs.ensureDir(chunkDir);
  
  // Create all chunks in parallel for speed
  const chunkPromises = [];
  let currentStart = 0;
  let chunkIndex = 0;
  
  while (currentStart < duration) {
    const chunkDuration = Math.min(CONFIG.CHUNK_DURATION, duration - currentStart);
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(3, '0')}.wav`);
    
    const chunkPromise = (async (start, dur, index, path) => {
      try {
        const splitCommand = [
          'ffmpeg -i', `"${audioPath}"`,
          '-ss', start,
          '-t', dur,
          '-ac', CONFIG.CHANNELS,
          '-ar', CONFIG.SAMPLE_RATE,
          `-acodec pcm_s16le "${path}"`,
          '-y -loglevel error'
        ].join(' ');
        
        await execAsync(splitCommand, { timeout: 180000 });
        
        const stats = await fs.stat(path);
        if (stats.size > 0) {
          console.log(`  ✓ Chunk ${index + 1}/${totalChunks}`);
          return { path, start, duration: dur, index, totalChunks };
        }
      } catch (err) {
        console.log(`  ❌ Chunk ${index + 1} failed`);
      }
      return null;
    })(currentStart, chunkDuration, chunkIndex, chunkPath);
    
    chunkPromises.push(chunkPromise);
    currentStart += chunkDuration;
    chunkIndex++;
  }
  
  const results = await Promise.all(chunkPromises);
  const validChunks = results.filter(chunk => chunk !== null);
  
  console.log(`✅ Created ${validChunks.length} valid chunks`);
  return validChunks;
}

async function transcribeChunk(chunk, pythonPath) {
  const chunkName = path.basename(chunk.path, '.wav');
  const outputPath = path.join(OUTPUT_DIR, `${chunkName}.srt`);
  
  try {
    console.log(`🎯 Transcribing chunk ${chunk.index + 1}/${chunk.totalChunks}...`);
    
    // Simplified Python script - spell checking will be done in Node.js
    const transcribeScript = `
import sys
import os
import time
import re

# Disable CUDA for faster startup
os.environ["CUDA_VISIBLE_DEVICES"] = ""

print("Starting optimized transcription...")
script_start_time = time.time()

try:
    from faster_whisper import WhisperModel
    use_faster = True
    print("Using faster-whisper")
except ImportError:
    import whisper
    use_faster = False
    print("Using standard whisper")

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def split_long_segments(text, max_chars=${CONFIG.MAX_CHARS_PER_LINE}):
    """Fast text splitting"""
    if len(text) <= max_chars:
        return [text]
    
    # Split on sentence boundaries first
    sentences = re.split(r'(?<=[.!?])\\s+', text)
    if len(sentences) == 1:
        # Split on commas if no sentences
        sentences = re.split(r'(?<=,)\\s+', text)
    
    parts = []
    current = ""
    
    for sentence in sentences:
        if len(current + sentence) <= max_chars:
            current += (" " if current else "") + sentence
        else:
            if current:
                parts.append(current)
            current = sentence
    
    if current:
        parts.append(current)
    
    return parts if parts else [text]

def process_segments(segments):
    """Process segments with optimized splitting"""
    processed = []
    
    for segment in segments:
        text = segment.get('text', '').strip()
        if not text:
            continue
            
        start_time = segment.get('start', 0)
        end_time = segment.get('end', start_time + 3)
        duration = end_time - start_time
        
        # Split long segments
        text_parts = split_long_segments(text)
        
        if len(text_parts) == 1:
            processed.append({
                'start': start_time,
                'end': end_time,
                'text': text_parts[0]
            })
        else:
            # Distribute time across parts
            part_duration = duration / len(text_parts)
            for i, part in enumerate(text_parts):
                part_start = start_time + (i * part_duration)
                part_end = part_start + part_duration
                processed.append({
                    'start': part_start,
                    'end': part_end,
                    'text': part
                })
    
    return processed

# Main transcription
audio_path = r"${chunk.path.replace(/\\/g, '\\\\')}"
output_path = r"${outputPath.replace(/\\/g, '\\\\')}"

print(f"Processing: {os.path.basename(audio_path)}")

try:
    if use_faster:
        # Faster Whisper with optimized settings
        model = WhisperModel("${CONFIG.MODEL_SIZE}", device="cpu", compute_type="int8")
        
        segments, info = model.transcribe(
            audio_path,
            beam_size=2,
            best_of=2,
            temperature=0.0,
            condition_on_previous_text=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=300)
        )
        
        print(f"Language: {info.language} ({info.language_probability:.2f})")
        
        # Convert to list for processing
        segment_list = []
        for segment in segments:
            if segment.text.strip():
                segment_list.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': segment.text.strip()
                })
        
    else:
        # Standard Whisper with optimized settings
        model = whisper.load_model("${CONFIG.MODEL_SIZE}")
        
        result = model.transcribe(
            audio_path,
            fp16=False,
            verbose=False,
            condition_on_previous_text=True,
            temperature=0.0
        )
        
        print(f"Language: {result.get('language', 'unknown')}")
        
        segment_list = []
        for segment in result.get('segments', []):
            if segment.get('text', '').strip():
                segment_list.append({
                    'start': segment['start'],
                    'end': segment['end'],
                    'text': segment['text'].strip()
                })
    
    print(f"Processing {len(segment_list)} segments...")
    
    # Process segments (basic cleaning, no spell checking here)
    processed_segments = process_segments(segment_list)
    
    # Generate SRT content
    srt_content = ""
    for i, segment in enumerate(processed_segments, 1):
        start_time = format_time(segment['start'])
        end_time = format_time(segment['end'])
        text = segment['text']
        
        srt_content += f"{i}\\n{start_time} --> {end_time}\\n{text}\\n\\n"
    
    if not srt_content:
        print("No speech detected")
        srt_content = "1\\n00:00:00,000 --> 00:00:05,000\\n[No speech detected]\\n\\n"
    
    # Save output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    
    processing_time = time.time() - script_start_time
    print(f"Completed in {processing_time:.1f}s")
    print(f"SUCCESS: {output_path}")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
`;

    const scriptPath = path.join(__dirname, `transcribe_${chunk.index}.py`);
    await fs.writeFile(scriptPath, transcribeScript);
    
    const startTime = Date.now();
    
    const { stdout, stderr } = await execAsync(`"${pythonPath}" "${scriptPath}"`, {
      timeout: CONFIG.TIMEOUT_PER_CHUNK,
      env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
      maxBuffer: 10 * 1024 * 1024
    });
    
    if (stdout) {
      const lines = stdout.split('\n').filter(line => line.trim());
      console.log(`  ${lines[lines.length - 1] || 'Processing...'}`);
    }
    if (stderr && !stderr.includes('warning')) {
      console.log(`  Warnings: ${stderr.substring(0, 200)}`);
    }
    
    const processingTime = (Date.now() - startTime) / 1000;
    const speedRatio = chunk.duration / processingTime;
    console.log(`✅ Chunk ${chunk.index + 1} done in ${processingTime.toFixed(1)}s (${speedRatio.toFixed(1)}x)`);
    
    // Verify and apply spell corrections
    try {
      await fs.access(outputPath);
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Empty output file');
      }
      
      let content = await fs.readFile(outputPath, 'utf8');
      if (!content.trim()) {
        throw new Error('No content in output file');
      }
      
      // Apply spell corrections using TranscriptionCorrector
      console.log(`  🔤 Applying spell corrections...`);
      const correctedContent = applyCorrectionToSRT(content, corrector);
      
      // Write corrected content back
      await fs.writeFile(outputPath, correctedContent, 'utf8');
      console.log(`  ✅ Spell corrections applied`);
      
    } catch (err) {
      console.log(`⚠️ Output verification failed for chunk ${chunk.index + 1}`);
      return { success: false, chunk };
    }
    
    // Cleanup
    await fs.remove(scriptPath);
    
    return { success: true, outputPath, chunk };
    
  } catch (error) {
    console.log(`❌ Chunk ${chunk.index + 1} failed:`, error.message);
    return { success: false, chunk };
  }
}

async function transcribeChunksInParallel(chunks, pythonPath) {
  console.log(`🚀 Processing ${chunks.length} chunks (${CONFIG.PARALLEL_CHUNKS} parallel)...`);
  
  const results = [];
  
  // Process chunks in batches for parallel execution
  for (let i = 0; i < chunks.length; i += CONFIG.PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + CONFIG.PARALLEL_CHUNKS);
    const batchNumber = Math.floor(i / CONFIG.PARALLEL_CHUNKS) + 1;
    const totalBatches = Math.ceil(chunks.length / CONFIG.PARALLEL_CHUNKS);
    
    console.log(`\n--- Batch ${batchNumber}/${totalBatches} ---`);
    
    // Execute batch in parallel
    const batchPromises = batch.map(chunk => transcribeChunk(chunk, pythonPath));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Brief pause between batches to prevent overwhelming the system
    if (i + CONFIG.PARALLEL_CHUNKS < chunks.length) {
      console.log('⏳ Brief pause...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 Results: ${successful.length}/${chunks.length} successful`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.map(f => f.chunk.index + 1).join(', ')}`);
  }
  
  return successful;
}

async function mergeSubtitles(successfulResults, originalDuration) {
  console.log('\n🔗 Merging subtitles...');
  
  // Sort by chunk index
  successfulResults.sort((a, b) => a.chunk.index - b.chunk.index);
  
  let mergedContent = "";
  let globalIndex = 1;
  
  for (const result of successfulResults) {
    try {
      const chunkContent = await fs.readFile(result.outputPath, 'utf8');
      if (!chunkContent?.trim()) continue;
      
      const lines = chunkContent.trim().split('\n');
      const timeOffset = result.chunk.start;
      
      let i = 0;
      while (i < lines.length) {
        // Skip empty lines
        while (i < lines.length && !lines[i].trim()) i++;
        if (i >= lines.length) break;
        
        // Skip index line
        i++;
        if (i >= lines.length) break;
        
        // Process time line
        let timeLine = lines[i++];
        if (!timeLine?.includes('-->')) continue;
        
        // Collect text lines
        let textLines = [];
        while (i < lines.length && lines[i].trim()) {
          textLines.push(lines[i++]);
        }
        
        if (textLines.length === 0) continue;
        
        // Adjust timestamps
        const adjustedTimeLine = timeLine.replace(
          /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g,
          (match, h, m, s, ms) => {
            const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
            const adjustedSeconds = totalSeconds + timeOffset;
            const newH = Math.floor(adjustedSeconds / 3600);
            const newM = Math.floor((adjustedSeconds % 3600) / 60);
            const newS = Math.floor(adjustedSeconds % 60);
            const newMs = Math.floor((adjustedSeconds % 1) * 1000);
            return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}:${newS.toString().padStart(2, '0')},${newMs.toString().padStart(3, '0')}`;
          }
        );
        
        mergedContent += `${globalIndex}\n${adjustedTimeLine}\n${textLines.join('\n')}\n\n`;
        globalIndex++;
      }
    } catch (error) {
      console.log(`⚠️ Error processing chunk ${result.chunk.index + 1}:`, error.message);
    }
  }
  
  if (!mergedContent.trim()) {
    console.log('❌ No subtitles generated!');
    return null;
  }
  
  // Apply final spell corrections to the merged content
  console.log('🔤 Applying final spell corrections to merged subtitles...');
  const finalCorrectedContent = applyCorrectionToSRT(mergedContent, corrector);
  
  const finalPath = path.join(OUTPUT_DIR, 'merged_subtitles.srt');
  await fs.writeFile(finalPath, finalCorrectedContent);
  
  const stats = await fs.stat(finalPath);
  console.log(`✅ Merged subtitles: ${finalPath}`);
  console.log(`📄 ${(stats.size / 1024).toFixed(1)} KB, ${globalIndex - 1} subtitles`);
  
  return finalPath;
}

async function findPythonPath() {
  const possiblePaths = [
    path.join(__dirname, 'whisper-venv', 'Scripts', 'python.exe'),
    path.join(__dirname, 'whisper-venv', 'bin', 'python'),
    'python',
    'python3'
  ];
  
  for (const pythonPath of possiblePaths) {
    try {
      await execAsync(`"${pythonPath}" --version`, { timeout: 5000 });
      console.log(`✅ Python found: ${pythonPath}`);
      return pythonPath;
    } catch (err) {
      // Continue to next path
    }
  }
  
  console.log('❌ Python not found. Please install Python.');
  return possiblePaths[0];
}

async function checkWhisperInstallation(pythonPath) {
  try {
    console.log('Checking Whisper...');
    
    // Check faster-whisper first (preferred)
    try {
      await execAsync(`"${pythonPath}" -c "from faster_whisper import WhisperModel; print('Faster Whisper available')"`, { timeout: 10000 });
      console.log('✅ Faster Whisper available');
      return true;
    } catch (err) {
      // Fall back to standard whisper
      await execAsync(`"${pythonPath}" -c "import whisper; print('Standard Whisper available')"`, { timeout: 10000 });
      console.log('✅ Standard Whisper available');
      return true;
    }
  } catch (err) {
    console.log('❌ Whisper not installed!');
    console.log('Install with: pip install -U faster-whisper openai-whisper');
    return false;
  }
}

// Add method to dynamically add corrections
function addCustomCorrections(customCorrections) {
  Object.entries(customCorrections).forEach(([wrong, correct]) => {
    corrector.addCorrection(wrong, correct);
  });
  console.log(`✅ Added ${Object.keys(customCorrections).length} custom corrections`);
}

// Add method to test corrections
function testCorrections() {
  console.log('\n🧪 Testing spell corrections...');
  corrector.testCorrections();
}

async function generateSubtitlesWithWhisper(audioPath, outputDir, customCorrections = {}) {
  const startTime = Date.now();
  
  try {
    console.log('=== Optimized Whisper Subtitle Generator with Advanced Spell Checking ===');
    console.log(`🎵 File: ${path.basename(audioPath)}`);
    console.log(`📁 Output: ${outputDir}`);
    console.log(`🔧 Model: ${CONFIG.MODEL_SIZE}, Chunks: ${CONFIG.CHUNK_DURATION}s, Parallel: ${CONFIG.PARALLEL_CHUNKS}`);
    
    await fs.ensureDir(outputDir);
    
    // Add custom corrections if provided
    if (Object.keys(customCorrections).length > 0) {
      addCustomCorrections(customCorrections);
    }
    
    // Check prerequisites
    const pythonPath = await findPythonPath();
    const whisperInstalled = await checkWhisperInstallation(pythonPath);
    if (!whisperInstalled) {
      console.log('❌ Cannot continue without Whisper');
      return null;
    }
    
    // Validate audio
    const audioInfo = await validateAndPrepareAudio(audioPath);
    if (!audioInfo.valid) {
      console.log('❌ Invalid audio file');
      return null;
    }
    
    // Preprocess if needed
    let workingAudioPath = audioPath;
    if (audioInfo.channels > 1 || audioInfo.sampleRate !== CONFIG.SAMPLE_RATE) {
      const preprocessedPath = path.join(outputDir, 'preprocessed.wav');
      const preprocessed = await preprocessAudio(audioPath, preprocessedPath);
      if (preprocessed) {
        workingAudioPath = preprocessedPath;
      }
    }
    
    // Split into chunks
    const chunks = await splitAudioIntoChunks(workingAudioPath, audioInfo.duration);
    if (chunks.length === 0) {
      console.log('❌ No chunks created');
      return null;
    }
    
    // Transcribe chunks
    const successful = await transcribeChunksInParallel(chunks, pythonPath);
    if (successful.length === 0) {
      console.log('❌ No chunks transcribed successfully');
      return null;
    }
    
    // Merge results
    const mergedPath = await mergeSubtitles(successful, audioInfo.duration);
    if (!mergedPath) {
      console.log('❌ Failed to merge subtitles');
      return null;
    }
    
    // Success summary
    const totalTime = (Date.now() - startTime) / 1000;
    const speedRatio = audioInfo.duration / totalTime;
    const coverage = (successful.length / chunks.length * 100);
    
    console.log('\n🎉 SUCCESS!');
    console.log(`⏱️ Processing time: ${Math.floor(totalTime / 60)}:${(totalTime % 60).toFixed(0).padStart(2, '0')}`);
    console.log(`🚀 Speed: ${speedRatio.toFixed(1)}x realtime`);
    console.log(`📊 Coverage: ${coverage.toFixed(1)}%`);
    console.log(`📝 Advanced spell checking applied at chunk and merge levels`);
    
    return mergedPath;
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    return null;
  }
}

// Export functions and corrector for external use
module.exports = { 
  generateSubtitlesWithWhisper, 
  corrector, 
  addCustomCorrections, 
  testCorrections 
};

// Run if called directly
if (require.main === module) {
  // Test corrections first
  testCorrections();
  
  // Example of adding custom corrections
  const customCorrections = {
    'llamarcadas': 'ya marcadas',
    'Marriqueza': 'más riqueza'
  };
  
  generateSubtitlesWithWhisper(TEST_AUDIO_PATH, OUTPUT_DIR, customCorrections)
    .then(result => {
      if (result) {
        console.log(`\n✅ Subtitles generated: ${result}`);
        process.exit(0);
      } else {
        console.log('\n❌ Failed to generate subtitles');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('💥 Unhandled error:', err);
      process.exit(1);
    });
}