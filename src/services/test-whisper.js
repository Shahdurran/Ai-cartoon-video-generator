const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration for handling long audio files
// Enhanced configuration with better accuracy settings
const CONFIG = {
  // Use small model instead of tiny for better accuracy
  MODEL_SIZE: 'base', // Changed from 'tiny' - much better accuracy with moderate speed cost
  
  // Split long audio into manageable chunks
  CHUNK_DURATION: 300, // 5 minutes per chunk
  
  // Longer timeout for each chunk due to better model
  TIMEOUT_PER_CHUNK: 600000, // 10 minutes per chunk (increased for better model)
  
  // Audio optimization
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  
  // Process chunks in parallel (reduce for better accuracy)
  PARALLEL_CHUNKS: 1, // Reduced to 1 for better accuracy and less resource competition
  
  // Subtitle settings
  MAX_CHARS_PER_LINE: 40,
  MIN_SEGMENT_DURATION: 1.0,
  MAX_SEGMENT_DURATION: 3.0,
  
  // Grammar correction settings
  ENABLE_GRAMMAR_CORRECTION: true,
  ENABLE_SPELL_CHECK: true
};

// Your audio file path - Make sure this path is correct
const TEST_AUDIO_PATH = 'D:/ffmpeg video generator/LOS NOBLES LA HUMILLARON POR SU EMBARAZOHASTA QUE UN HOMBRE DE HONOR LE OFRECIÓ SU NOMBRE.mp3';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

async function validateAndPrepareAudio(inputPath) {
  try {
    console.log('Analyzing audio file...');
    // Ensure proper quoting for paths with spaces
    const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`);
    const info = JSON.parse(stdout);
    
    const audioStream = info.streams.find(s => s.codec_type === 'audio');
    if (!audioStream) {
      throw new Error('No audio stream found');
    }
    
    const duration = parseFloat(info.format.duration);
    const channels = audioStream.channels;
    const sampleRate = audioStream.sample_rate;
    
    console.log(`📊 Audio Info:`);
    console.log(`  Duration: ${Math.floor(duration / 60)}:${(duration % 60).toFixed(0).padStart(2, '0')} (${duration.toFixed(1)}s)`);
    console.log(`  Channels: ${channels}`);
    console.log(`  Sample Rate: ${sampleRate}Hz`);
    console.log(`  Codec: ${audioStream.codec_name}`);
    
    return { duration, channels, sampleRate, valid: true };
  } catch (error) {
    console.log('❌ Audio analysis failed:', error.message);
    // Check if file exists
    try {
      await fs.access(inputPath);
      console.log('✓ File exists but analysis failed');
    } catch (err) {
      console.log('❌ File does not exist or is not accessible');
    }
    return { valid: false };
  }
}

async function preprocessAudio(inputPath, outputPath) {
  try {
    console.log('🔄 Preprocessing audio for faster processing...');
    console.log('   - Converting to mono');
    console.log('   - Reducing to 16kHz sample rate');
    console.log('   - Normalizing volume');
    
    const preprocessCommand = [
      'ffmpeg -i', `"${inputPath}"`,
      '-ac', CONFIG.CHANNELS,
      '-ar', CONFIG.SAMPLE_RATE,
      '-acodec pcm_s16le',
      '-af "volume=0.95"', // Slight volume normalization
      `"${outputPath}"`,
      '-y'
    ].join(' ');
    
    await execAsync(preprocessCommand, { timeout: 600000 }); // 10 min timeout for preprocessing (increased)
    console.log('✅ Audio preprocessing completed');
    return true;
  } catch (error) {
    console.log('❌ Audio preprocessing failed:', error.message);
    console.log('   Will try with original file...');
    return false;
  }
}

async function splitAudioIntoChunks(audioPath, duration) {
  if (duration <= CONFIG.CHUNK_DURATION) {
    console.log('📄 Audio is short enough, no splitting needed');
    return [{ path: audioPath, start: 0, duration, index: 0 }];
  }
  
  console.log(`✂️  Splitting ${Math.floor(duration / 60)}:${(duration % 60).toFixed(0).padStart(2, '0')} audio into ${CONFIG.CHUNK_DURATION / 60} minute chunks...`);
  
  const chunks = [];
  const chunkDir = path.join(OUTPUT_DIR, 'chunks');
  await fs.ensureDir(chunkDir);
  
  let currentStart = 0;
  let chunkIndex = 0;
  
  while (currentStart < duration) {
    const chunkDuration = Math.min(CONFIG.CHUNK_DURATION, duration - currentStart);
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(3, '0')}.wav`);
    
    console.log(`  Creating chunk ${chunkIndex + 1}: ${Math.floor(currentStart / 60)}:${(currentStart % 60).toFixed(0).padStart(2, '0')} - ${Math.floor((currentStart + chunkDuration) / 60)}:${((currentStart + chunkDuration) % 60).toFixed(0).padStart(2, '0')}`);
    
    const splitCommand = [
      'ffmpeg -i', `"${audioPath}"`,
      '-ss', currentStart,
      '-t', chunkDuration,
      '-ac', CONFIG.CHANNELS,
      '-ar', CONFIG.SAMPLE_RATE,
      '-acodec pcm_s16le',
      `"${chunkPath}"`,
      '-y'
    ].join(' ');
    
    await execAsync(splitCommand, { timeout: 180000 }); // 3 min timeout per split (increased)
    
    // Verify the chunk was created correctly
    try {
      await fs.access(chunkPath);
      const stats = await fs.stat(chunkPath);
      if (stats.size > 0) {
        chunks.push({
          path: chunkPath,
          start: currentStart,
          duration: chunkDuration,
          index: chunkIndex
        });
      } else {
        console.log(`⚠️ Warning: Chunk ${chunkIndex + 1} was created but is empty`);
      }
    } catch (err) {
      console.log(`⚠️ Warning: Failed to create chunk ${chunkIndex + 1}`);
    }
    
    currentStart += chunkDuration;
    chunkIndex++;
  }
  
  console.log(`✅ Created ${chunks.length} chunks`);
  return chunks;
}

async function transcribeChunk(chunk, pythonPath) {
  const chunkName = path.basename(chunk.path, '.wav');
  const outputPath = path.join(OUTPUT_DIR, `${chunkName}.srt`);
  
  try {
    console.log(`🎯 Transcribing chunk ${chunk.index + 1} (${Math.floor(chunk.duration / 60)}:${(chunk.duration % 60).toFixed(0).padStart(2, '0')})...`);
    
    // Use faster-whisper with optimized settings
    const transcribeScript = `
import sys
import os
import time
import re
os.environ["CUDA_VISIBLE_DEVICES"] = ""

print("Starting transcription...")
start_time = time.time()  # Ensure this is a float

try:
    from faster_whisper import WhisperModel
    print("Using faster-whisper")
    use_faster = True
except ImportError:
    print("faster-whisper not available, falling back to whisper")
    import whisper
    use_faster = False

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# Function to split long lines into shorter segments
def split_long_text(text, max_chars_per_line=${CONFIG.MAX_CHARS_PER_LINE}):
    if len(text) <= max_chars_per_line:
        return [text]
    
    # Try to split at punctuation or spaces intelligently
    parts = []
    remaining = text.strip()
    
    while len(remaining) > max_chars_per_line:
        # Look for punctuation followed by space within the limit
        split_point = -1
        for punct in ['. ', '! ', '? ', '; ', ', ']:
            pos = remaining[:max_chars_per_line].rfind(punct)
            if pos > split_point:
                split_point = pos + len(punct) - 1  # End at the punctuation
        
        # If no punctuation found, look for the last space
        if split_point == -1:
            split_point = remaining[:max_chars_per_line].rfind(' ')
        
        # If still no good split point, just cut at the max
        if split_point == -1:
            split_point = max_chars_per_line
        
        parts.append(remaining[:split_point+1].strip())
        remaining = remaining[split_point+1:].strip()
    
    if remaining:
        parts.append(remaining)
    
    return parts

# Break long segments into smaller pieces
def break_into_smaller_segments(segments, min_duration=${CONFIG.MIN_SEGMENT_DURATION}, max_duration=${CONFIG.MAX_SEGMENT_DURATION}):
    new_segments = []
    
    for segment in segments:
        segment_text = segment["text"].strip()
        start_time = segment["start"]
        end_time = segment["end"]
        duration = end_time - start_time
        
        # If segment is already short or empty, keep as is
        if duration <= max_duration or not segment_text:
            new_segments.append(segment)
            continue
        
        # Split text into manageable chunks
        text_parts = split_long_text(segment_text)
        num_parts = len(text_parts)
        
        if num_parts == 1:
            # Only one part but still too long, try to split by sentences
            sentence_pattern = r'(?<=[.!?])\s+'
            sentences = re.split(sentence_pattern, segment_text)
            if len(sentences) > 1:
                text_parts = sentences
                num_parts = len(text_parts)
        
        # Calculate time for each part 
        if num_parts > 1:
            time_per_part = duration / num_parts
            for i, part in enumerate(text_parts):
                part_start = start_time + (i * time_per_part)
                part_end = part_start + time_per_part
                new_segments.append({
                    "start": part_start,
                    "end": part_end,
                    "text": part.strip()
                })
        else:
            # If we can't split by text naturally, create even time slices
            num_slices = max(2, int(duration / max_duration))
            slice_duration = duration / num_slices
            
            for i in range(num_slices):
                slice_start = start_time + (i * slice_duration)
                slice_end = slice_start + slice_duration
                
                if i < num_slices - 1:
                    # For middle segments, use ellipsis to show continuation
                    slice_text = segment_text + " ..."
                else:
                    slice_text = segment_text
                
                new_segments.append({
                    "start": slice_start,
                    "end": slice_end,
                    "text": slice_text
                })
    
    return new_segments

audio_path = r"${chunk.path.replace(/\\/g, '\\\\')}"
output_path = r"${outputPath.replace(/\\/g, '\\\\')}"

print(f"Processing audio: {audio_path}")
print(f"Output will be saved to: {output_path}")

try:
    if use_faster:
        # Optimized faster-whisper
        print(f"Loading {os.path.basename(audio_path)} with faster-whisper...")
        model = WhisperModel("${CONFIG.MODEL_SIZE}", device="cpu", compute_type="int8")
        print("Model loaded, starting transcription...")
        segments, info = model.transcribe(
            audio_path,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            condition_on_previous_text=False,
            word_timestamps=True,
            vad_filter=True
        )
        
        # Convert segments to list for processing
        segment_list = []
        for segment in segments:
            segment_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            
        # Break longer segments into smaller chunks
        print("Breaking down segments into smaller chunks...")
        smaller_segments = break_into_smaller_segments(segment_list)
        print(f"Original segments: {len(segment_list)}, Smaller segments: {len(smaller_segments)}")
        
        srt_content = ""
        
        print("Processing segments...")
        for i, segment in enumerate(smaller_segments, 1):
            start_time_seg = format_time(segment["start"])
            end_time_seg = format_time(segment["end"])
            text = segment["text"].strip()
            if text:  # Only add non-empty segments
                srt_content += f"{i}\\n{start_time_seg} --> {end_time_seg}\\n{text}\\n\\n"
        
        print(f"Created {len(smaller_segments)} segments")
    else:
        # Fallback to openai-whisper
        print(f"Loading {os.path.basename(audio_path)} with whisper...")
        model = whisper.load_model("${CONFIG.MODEL_SIZE}")
        print("Model loaded, starting transcription...")
        result = model.transcribe(audio_path, fp16=False, verbose=False)
        
        # Convert whisper results to standard format
        segment_list = result["segments"]
        
        # Break longer segments into smaller chunks
        print("Breaking down segments into smaller chunks...")
        smaller_segments = break_into_smaller_segments(segment_list)
        print(f"Original segments: {len(segment_list)}, Smaller segments: {len(smaller_segments)}")
        
        srt_content = ""
        
        print("Processing segments...")
        for i, segment in enumerate(smaller_segments, 1):
            start_time_seg = format_time(segment["start"])
            end_time_seg = format_time(segment["end"])
            text = segment["text"].strip()
            if text:  # Only add non-empty segments
                srt_content += f"{i}\\n{start_time_seg} --> {end_time_seg}\\n{text}\\n\\n"
        
        print(f"Created {len(smaller_segments)} segments")
    
    if not srt_content:
        print("WARNING: No speech detected in this chunk")
        srt_content = "1\\n00:00:00,000 --> 00:00:05,000\\n[No speech detected in this section]\\n\\n"
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    
    end_time = time.time()  # This is also a float
    duration = end_time - start_time  # Now this will work correctly
    print(f"Transcription completed in {duration:.1f} seconds")
    print(f"SUCCESS: {output_path}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
`;

    const scriptPath = path.join(__dirname, `transcribe_chunk_${chunk.index}.py`);
    await fs.writeFile(scriptPath, transcribeScript);
    
    const startTime = Date.now();
    console.log(`  Running python script for chunk ${chunk.index + 1}...`);
    
    // Execute with better handling of output
    const { stdout, stderr } = await execAsync(`"${pythonPath}" "${scriptPath}"`, {
      timeout: CONFIG.TIMEOUT_PER_CHUNK,
      env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for output
    });
    
    // Log stdout for debugging
    if (stdout) console.log(`  Python output: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
    if (stderr) console.log(`  Python errors: ${stderr}`);
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    const speedRatio = chunk.duration / processingTime;
    
    console.log(`✅ Chunk ${chunk.index + 1} completed in ${processingTime.toFixed(1)}s (${speedRatio.toFixed(1)}x speed)`);
    
    // Verify output file exists and has content
    try {
      await fs.access(outputPath);
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        console.log(`⚠️ Warning: Transcript file for chunk ${chunk.index + 1} exists but is empty`);
        return { success: false, chunk };
      }
      const content = await fs.readFile(outputPath, 'utf8');
      if (content.trim() === '') {
        console.log(`⚠️ Warning: Transcript file for chunk ${chunk.index + 1} has no content`);
        return { success: false, chunk };
      }
    } catch (err) {
      console.log(`⚠️ Warning: Transcript file for chunk ${chunk.index + 1} was not created`);
      return { success: false, chunk };
    }
    
    // Clean up script
    await fs.remove(scriptPath);
    
    return { success: true, outputPath, chunk };
  } catch (error) {
    console.log(`❌ Chunk ${chunk.index + 1} failed:`, error.message);
    return { success: false, chunk };
  }
}

async function transcribeChunksInParallel(chunks, pythonPath) {
  console.log(`🚀 Transcribing ${chunks.length} chunks (${CONFIG.PARALLEL_CHUNKS} at a time)...`);
  
  const results = [];
  
  for (let i = 0; i < chunks.length; i += CONFIG.PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + CONFIG.PARALLEL_CHUNKS);
    console.log(`\n--- Processing batch ${Math.floor(i / CONFIG.PARALLEL_CHUNKS) + 1}/${Math.ceil(chunks.length / CONFIG.PARALLEL_CHUNKS)} ---`);
    
    const batchPromises = batch.map(chunk => transcribeChunk(chunk, pythonPath));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Brief pause between batches
    if (i + CONFIG.PARALLEL_CHUNKS < chunks.length) {
      console.log('⏸️  Brief pause before next batch...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased pause to 5 seconds
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 Results: ${successful.length}/${chunks.length} chunks successful`);
  if (failed.length > 0) {
    console.log(`❌ Failed chunks: ${failed.map(f => f.chunk.index + 1).join(', ')}`);
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
      console.log(`  Processing subtitle file: ${result.outputPath}`);
      const chunkContent = await fs.readFile(result.outputPath, 'utf8');
      
      if (!chunkContent || chunkContent.trim() === '') {
        console.log(`  ⚠️ Warning: Empty subtitle file for chunk ${result.chunk.index + 1}`);
        continue;
      }
      
      const lines = chunkContent.trim().split('\n');
      const timeOffset = result.chunk.start;
      
      let i = 0;
      while (i < lines.length) {
        // Find a valid subtitle entry (index number followed by timestamps)
        let indexLine = lines[i++];
        if (!indexLine || indexLine.trim() === '') continue;
        
        let timeLine = lines[i++];
        if (!timeLine || !timeLine.includes('-->')) {
          i--; // Go back and look for proper time line
          continue;
        }
        
        // Collect text lines until we find an empty line or end of file
        let textLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i++]);
        }
        
        // Skip empty line
        i++;
        
        if (textLines.length === 0) continue;
        
        // Adjust timestamps with offset
        const adjustedTimeLine = timeLine.replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, (match, h, m, s, ms) => {
          const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
          const adjustedSeconds = totalSeconds + timeOffset;
          
          const newH = Math.floor(adjustedSeconds / 3600);
          const newM = Math.floor((adjustedSeconds % 3600) / 60);
          const newS = Math.floor(adjustedSeconds % 60);
          const newMs = Math.floor((adjustedSeconds % 1) * 1000);
          
          return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}:${newS.toString().padStart(2, '0')},${newMs.toString().padStart(3, '0')}`;
        });
        
        mergedContent += `${globalIndex}\n${adjustedTimeLine}\n${textLines.join('\n')}\n\n`;
        globalIndex++;
      }
    } catch (error) {
      console.log(`  ❌ Error processing subtitle file for chunk ${result.chunk.index + 1}:`, error.message);
    }
  }
  
  if (mergedContent.trim() === '') {
    console.log('❌ No subtitles were generated! Check logs above for errors.');
    return null;
  }
  
  const finalPath = path.join(OUTPUT_DIR, 'merged_subtitles.srt');
  await fs.writeFile(finalPath, mergedContent);
  
  const stats = await fs.stat(finalPath);
  console.log(`✅ Merged subtitles saved: ${finalPath}`);
  console.log(`📄 File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📝 Total subtitles: ${globalIndex - 1}`);
  
  return finalPath;
}

async function findPythonPath() {
  const possiblePaths = [
    path.join(__dirname, 'whisper-venv', 'Scripts', 'python.exe'), // Windows venv
    path.join(__dirname, 'whisper-venv', 'bin', 'python'),         // Unix venv
    'python',                                                      // System python
    'python3'                                                      // System python3
  ];
  
  for (const pythonPath of possiblePaths) {
    try {
      await execAsync(`"${pythonPath}" --version`);
      console.log(`✅ Found Python: ${pythonPath}`);
      return pythonPath;
    } catch (err) {
      // Try next path
    }
  }
  
  console.log('❌ Could not find Python. Please verify your Python installation.');
  return possiblePaths[0]; // Return default path and hope for the best
}

async function checkWhisperInstallation(pythonPath) {
  try {
    console.log('Checking Whisper installation...');
    await execAsync(`"${pythonPath}" -c "import whisper; print('OpenAI Whisper is installed')"`, { timeout: 10000 });
    console.log('✅ OpenAI Whisper is installed');
    return true;
  } catch (err) {
    try {
      await execAsync(`"${pythonPath}" -c "from faster_whisper import WhisperModel; print('Faster Whisper is installed')"`, { timeout: 10000 });
      console.log('✅ Faster Whisper is installed');
      return true;
    } catch (err2) {
      console.log('❌ Neither OpenAI Whisper nor Faster Whisper are installed!');
      console.log('   Please install one of them:');
      console.log('   - pip install -U openai-whisper');
      console.log('   - pip install -U faster-whisper');
      return false;
    }
  }
}

async function generateSubtitlesWithWhisper(audioPath, outputDir) {
  const startTime = Date.now();
  try {
    console.log('=== Long Audio Whisper Transcriber ===');
    console.log(`🎵 File: ${path.basename(audioPath)}`);
    console.log(`📁 Output: ${outputDir}`);
    console.log(`🔧 Model: ${CONFIG.MODEL_SIZE} (optimized for speed)`);
    console.log(`⚡ Chunk size: ${CONFIG.CHUNK_DURATION / 60} minutes`);

    await fs.ensureDir(outputDir);

    // Step 1: Find Python and check Whisper installation
    const pythonPath = await findPythonPath();
    const whisperInstalled = await checkWhisperInstallation(pythonPath);
    if (!whisperInstalled) {
      console.log('❌ Cannot continue without Whisper installed');
      return null;
    }

    // Step 2: Validate audio
    const audioInfo = await validateAndPrepareAudio(audioPath);
    if (!audioInfo.valid) {
      console.log('❌ Cannot process this audio file');
      return null;
    }

    // Step 3: Preprocess audio if needed
    let workingAudioPath = audioPath;
    const preprocessedPath = path.join(outputDir, 'preprocessed_audio.wav');

    if (audioInfo.channels > 1 || audioInfo.sampleRate !== CONFIG.SAMPLE_RATE) {
      const preprocessed = await preprocessAudio(audioPath, preprocessedPath);
      if (preprocessed) {
        workingAudioPath = preprocessedPath;
      }
    }

    // Step 4: Split into chunks
    const chunks = await splitAudioIntoChunks(workingAudioPath, audioInfo.duration);
    
    if (chunks.length === 0) {
      console.log('❌ No audio chunks were created, cannot continue');
      return null;
    }

    // Step 5: Transcribe chunks
    const successful = await transcribeChunksInParallel(chunks, pythonPath);

    // Step 6: Merge results
    if (successful.length > 0) {
      const mergedPath = await mergeSubtitles(successful, audioInfo.duration);
      if (!mergedPath) {
        console.log('❌ Failed to merge subtitles');
        return null;
      }
      
      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      const speedRatio = audioInfo.duration / totalTime;
      console.log('\n🎉 SUCCESS!');
      console.log(`⏱️  Total processing time: ${Math.floor(totalTime / 60)}:${(totalTime % 60).toFixed(0).padStart(2, '0')}`);
      console.log(`🚀 Speed ratio: ${speedRatio.toFixed(1)}x realtime`);
      console.log(`📊 Coverage: ${(successful.length / chunks.length * 100).toFixed(1)}%`);
      return mergedPath;
    } else {
      console.log('\n❌ No chunks were successfully transcribed');
      return null;
    }
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    return null;
  }
}

// If this script is run directly (not imported)
if (require.main === module) {
  // Run the main function
  generateSubtitlesWithWhisper(TEST_AUDIO_PATH, OUTPUT_DIR)
    .then(result => {
      if (result) {
        console.log(`✅ Subtitles generated successfully: ${result}`);
        process.exit(0);
      } else {
        console.log('❌ Failed to generate subtitles');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('💥 Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = { generateSubtitlesWithWhisper };