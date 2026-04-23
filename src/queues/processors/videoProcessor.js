const VideoService = require('../../services/videoService');
const AudioService = require('../../services/audioService');
const StorageService = require('../../services/storageService');
const { generateSubtitles, generateASSSubtitles, formatASSTime } = require('../../utils/subtitleGenerator');
const { convertSrtToAss, validateASSFile } = require('../../utils/subtitleUtils');
const { selectVideosForRotation } = require('../../utils/videoBank');
const { paths, getTempDir } = require('../../config/paths.config');
const path = require('path');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
const { buildDynamicImageFilters, getVideoDuration } = require('../../utils/videoUtils');
const { escapeSubtitlePath } = require('../../utils/subtitleUtils');
const personVideoLibrary = require('../../utils/personVideoLibrary');
const { buildAllTextOverlayFilters, validateTextOverlays } = require('../../utils/textOverlayUtils');
const { generateSubtitlesWithWhisper } = require('../../services/test-whisper');

/**
 * Video processing processor
 * Handles both TYPE_1 (background videos) and TYPE_2 (image slideshows)
 * @param {object} job - Bull job object
 */
async function processVideoGeneration(job) {
  const { 
    projectId,
    audioPath,
    images = [],
    script,
    sentences = [],
    settings = {},
    channelConfig = {},
    type = 'TYPE_2', // Default to image slideshow
  } = job.data;

  try {
    await job.progress(5);

    const videoService = new VideoService();
    const storageService = new StorageService();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 VIDEO PROCESSOR - Job ${job.id}`);
    console.log(`   Project: ${projectId}`);
    console.log(`   Type: ${type}`);
    console.log(`   Images: ${images.length}`);
    console.log(`   Audio: ${audioPath}`);
    console.log(`${'='.repeat(70)}\n`);

    // Create temp directory for this job
    const tempDir = getTempDir(job.id);
    await fs.ensureDir(tempDir);

    await job.progress(10);

    // === STEP 1: Get audio duration ===
    console.log(`🎵 Getting audio duration...`);
    const audioDuration = await getVideoDuration(audioPath);
    console.log(`   ✅ Audio duration: ${audioDuration.toFixed(2)}s`);

    await job.progress(12);

    // === STEP 1.5: Mix background music with narration (if configured) ===
    let finalAudioPath = audioPath;
    const audioConfig = channelConfig.audio || {};
    
    // Check for multiple music tracks (new format)
    if (audioConfig.musicTracks && audioConfig.musicTracks.length > 0) {
      console.log(`\n🎵 Mixing ${audioConfig.musicTracks.length} background music track(s) with narration...`);
      
      const mixedAudioPath = path.join(tempDir, 'mixed_audio.mp3');
      
      try {
        await AudioService.mixMultipleMusicTracks(
          audioPath,
          audioConfig.musicTracks,
          audioDuration,
          mixedAudioPath
        );
        
        // Use mixed audio for video generation
        finalAudioPath = mixedAudioPath;
        console.log(`   ✅ Multi-track audio mixing complete`);
      } catch (error) {
        console.error(`   ❌ Error mixing multiple music tracks:`, error.message);
        console.warn(`   ⚠️  Continuing with narration only (no background music)`);
      }
    }
    // Check for single background music (old format - backward compatibility)
    else if (audioConfig.backgroundMusic) {
      console.log(`\n🎵 Mixing single background music track with narration...`);
      console.log(`   Music: ${audioConfig.backgroundMusic.title || audioConfig.backgroundMusic.filename}`);
      
      const mixedAudioPath = path.join(tempDir, 'mixed_audio.mp3');
      const musicPath = audioConfig.backgroundMusic.path || audioConfig.backgroundMusic.filename;
      
      try {
        await AudioService.mixSingleMusicTrack(
          audioPath,
          musicPath,
          {
            volume: audioConfig.backgroundMusic.volume || audioConfig.volume || 30,
            fadeIn: audioConfig.backgroundMusic.fadeIn || audioConfig.fadeIn || 2,
            fadeOut: audioConfig.backgroundMusic.fadeOut || audioConfig.fadeOut || 2,
            loop: audioConfig.backgroundMusic.loop !== undefined ? audioConfig.backgroundMusic.loop : (audioConfig.loop !== undefined ? audioConfig.loop : true),
          },
          audioDuration,
          mixedAudioPath
        );
        
        // Use mixed audio for video generation
        finalAudioPath = mixedAudioPath;
        console.log(`   ✅ Audio mixing complete`);
      } catch (error) {
        console.error(`   ❌ Error mixing audio:`, error.message);
        console.warn(`   ⚠️  Continuing with narration only (no background music)`);
      }
    } else {
      console.log(`   ℹ️  No background music configured - using narration only`);
    }

    await job.progress(15);

    // === STEP 2: Generate subtitles ===
    console.log(`\n📝 Generating subtitles with AssemblyAI transcription...`);
    
    // Check if animations are enabled
    const subtitleSettings = channelConfig.subtitleSettings || channelConfig.subtitles || settings.subtitles || {};
    const hasAnimation = subtitleSettings.animation?.type && subtitleSettings.animation?.type !== 'none';
    
    let subtitlePath;
    
    // Use AssemblyAI to generate accurate, synced subtitles from audio
    console.log(`   🎤 Transcribing audio with AssemblyAI for accurate word-level timing...`);
    const AssemblyAIService = require('../../services/assemblyAIService');
    const assemblyAI = new AssemblyAIService();
    
    let assemblyAISrtPath;
    try {
      assemblyAISrtPath = await assemblyAI.transcribeAudio(finalAudioPath, tempDir);
    } catch (aiError) {
      console.warn(`   ⚠️  AssemblyAI failed: ${aiError.message}`);
      assemblyAISrtPath = null;
    }
    
    if (assemblyAISrtPath && await fs.pathExists(assemblyAISrtPath)) {
      console.log(`   ✅ AssemblyAI transcription complete with accurate word-level timestamps`);
      
      // Map channel subtitle settings to the format expected by convertSrtToAss
      // Include ALL settings including animation
      const fontOptions = {
        fontFamily: subtitleSettings.fontFamily || 'Arial',
        fontSize: subtitleSettings.fontSize || 32,
        fontColor: subtitleSettings.primaryColor || '#FFFFFF',
        outlineColor: subtitleSettings.outlineColor || '#000000',
        outlineWidth: subtitleSettings.outlineWidth || 3,
        bold: subtitleSettings.bold || false,
        animation: subtitleSettings.animation || { type: 'none', duration: 0.5 },
      };
      
      console.log(`   🎨 Applying subtitle settings from channel config:`);
      console.log(`      Font: ${fontOptions.fontFamily}, Size: ${fontOptions.fontSize}`);
      console.log(`      Color: ${fontOptions.fontColor}, Outline: ${fontOptions.outlineColor}`);
      console.log(`      Animation: ${fontOptions.animation.type}, Duration: ${fontOptions.animation.duration}s`);
      
      // Always convert to ASS for styling (with or without animations)
      if (hasAnimation) {
        console.log(`   ✨ Converting to ASS with ${subtitleSettings.animation.type} animation`);
      } else {
        console.log(`   📝 Converting to ASS for styled subtitles (no animation)`);
      }
      
      subtitlePath = await convertSrtToAss(assemblyAISrtPath, tempDir, fontOptions);
      
      // Validate ASS file
      const isValid = await validateASSFile(subtitlePath);
      if (!isValid) {
        console.warn(`   ⚠️  ASS validation failed, using SRT`);
        subtitlePath = assemblyAISrtPath;
      }
    } else {
      // Fallback to estimation-based subtitles if AssemblyAI fails
      console.warn(`   ⚠️  AssemblyAI transcription failed, falling back to estimation`);
      
      if (hasAnimation) {
        // Generate ASS subtitles directly with animations
        console.log(`   ✨ Animations enabled: ${subtitleSettings.animation.type}`);
        const assPath = path.join(tempDir, 'subtitles.ass');
        
        if (sentences && sentences.length > 0) {
          await generateASSSubtitles({
            sentences,
            voiceDuration: audioDuration,
            subtitleSettings,
            outputPath: assPath,
          });
          
          // Validate ASS file
          const isValid = await validateASSFile(assPath);
          if (!isValid) {
            console.warn(`   ⚠️  ASS validation failed, falling back to SRT`);
            // Fallback to SRT
            const srtPath = path.join(tempDir, 'subtitles.srt');
            await generateSubtitles({
              sentences,
              voiceDuration: audioDuration,
              subtitleSettings,
              outputPath: srtPath,
            });
            subtitlePath = await convertSrtToAss(srtPath, tempDir, subtitleSettings);
          } else {
            subtitlePath = assPath;
          }
        } else {
          console.warn(`   ⚠️  No sentences provided, creating dummy ASS subtitle`);
          const dummyASS = `[Script Info]
Title: Dummy Subtitle
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${formatASSTime(audioDuration)},Default,,0,0,0,,${script || 'Generated Video'}
`;
          await fs.writeFile(assPath, dummyASS, 'utf8');
          subtitlePath = assPath;
        }
      } else {
        // No animations - use standard SRT to ASS conversion
        console.log(`   📝 No animations - using standard subtitles`);
        const srtPath = path.join(tempDir, 'subtitles.srt');
        
        if (sentences && sentences.length > 0) {
          await generateSubtitles({
            sentences,
            voiceDuration: audioDuration,
            subtitleSettings,
            outputPath: srtPath,
          });
        } else {
          console.warn(`   ⚠️  No sentences provided, creating dummy subtitle`);
          await fs.writeFile(srtPath, `1\n00:00:00,000 --> ${formatDuration(audioDuration)}\n${script || 'Generated Video'}\n`);
        }

        // Convert SRT to ASS for better styling
        subtitlePath = await convertSrtToAss(srtPath, tempDir, subtitleSettings);
      }
    }
    
    console.log(`   ✅ Subtitle file ready: ${path.basename(subtitlePath)}`);
    await job.progress(25);

    // === STEP 3: Generate video based on type ===
    const timestamp = Date.now();
    const outputPath = path.join(paths.output, `video_${timestamp}.mp4`);

    let result;
    
    if (type === 'TYPE_1') {
      // Background videos with overlay
      result = await createBackgroundVideo({
        job,
        audioPath: finalAudioPath, // Use mixed audio if available
        audioDuration,
        subtitlePath,
        outputPath,
        images,
        channelConfig,
        settings,
        tempDir,
      });
    } else {
      // TYPE_2: Image slideshow (default)
      result = await createImageSlideshow({
        job,
        audioPath: finalAudioPath, // Use mixed audio if available
        audioDuration,
        subtitlePath,
        outputPath,
        images,
        channelConfig,
        settings,
        tempDir,
      });
    }

    await job.progress(95);

    // === STEP 4: Save to project ===
    if (projectId) {
      try {
        const project = await storageService.getProject(projectId);
        project.videoPath = outputPath;
        project.videoDuration = audioDuration;
        project.videoMetadata = {
          type,
          effectsUsed: result.effectsUsed,
          resolution: settings.resolution || '1920x1080',
          fps: settings.fps || 30,
          processedAt: new Date().toISOString(),
        };
        await storageService.saveProject(project);
        console.log(`   ✅ Project updated: ${projectId}`);
        
        // Generate thumbnail for the video
        try {
          const thumbnailDir = path.join(paths.output, 'thumbnails');
          await fs.ensureDir(thumbnailDir);
          const thumbnailFilename = `${path.basename(outputPath, '.mp4')}.jpg`;
          const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
          
          await new Promise((resolve, reject) => {
            ffmpeg(outputPath)
              .screenshots({
                timestamps: ['00:00:02'],
                filename: thumbnailFilename,
                folder: thumbnailDir,
                size: '640x?'
              })
              .on('end', () => {
                console.log(`   ✅ Thumbnail generated: ${thumbnailFilename}`);
                resolve();
              })
              .on('error', reject);
          });
        } catch (thumbErr) {
          console.error(`   ⚠️  Failed to generate thumbnail:`, thumbErr.message);
          // Don't fail the whole job if thumbnail generation fails
        }
      } catch (err) {
        console.error(`   ⚠️  Failed to update project:`, err.message);
      }
    }

    // Clean up temp directory
    try {
      await fs.remove(tempDir);
      console.log(`   🧹 Cleaned up temp directory`);
    } catch (cleanupErr) {
      console.error(`   ⚠️  Failed to cleanup temp:`, cleanupErr.message);
    }

    await job.progress(100);

    console.log(`\n✅ VIDEO GENERATION COMPLETE`);
    console.log(`   📁 Output: ${outputPath}`);
    console.log(`   ⏱️  Duration: ${audioDuration.toFixed(2)}s\n`);

    return {
      success: true,
      videoPath: outputPath,
      duration: audioDuration,
      effectsUsed: result.effectsUsed,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`\n❌ Video generation failed for job ${job.id}:`, error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Create image slideshow video (TYPE_2)
 */
async function createImageSlideshow({ job, audioPath, audioDuration, subtitlePath, outputPath, images, channelConfig, settings, tempDir }) {
  console.log(`\n📷 Creating image slideshow...`);
  console.log(`   Images: ${images.length}`);
  console.log(`   Duration: ${audioDuration}s`);

  await job.progress(30);

  if (images.length === 0) {
    throw new Error('No images provided for slideshow');
  }

  // Download/prepare images and extract timing information
  const imagePaths = [];
  const imageTimings = []; // Store start/end times from image blocks if available
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let imagePath;

    if (img.imagePath && await fs.pathExists(img.imagePath)) {
      imagePath = img.imagePath;
    } else if (img.path && await fs.pathExists(img.path)) {
      imagePath = img.path;
    } else if (img.localPath && await fs.pathExists(img.localPath)) {
      imagePath = img.localPath;
    } else if (img.url) {
      // Download if URL provided
      const downloadPath = path.join(tempDir, `image_${i}.png`);
      const downloadFile = require('../../utils/downloadFile');
      await downloadFile(img.url, downloadPath);
      imagePath = downloadPath;
    } else {
      throw new Error(`Invalid image data at index ${i}: ${JSON.stringify(Object.keys(img))}`);
    }

    imagePaths.push(imagePath);
    
    // Extract timing from image block if available
    if (img.block && img.block.start_time !== undefined && img.block.end_time !== undefined) {
      imageTimings.push({
        startTime: img.block.start_time,
        endTime: img.block.end_time,
        duration: img.block.duration || (img.block.end_time - img.block.start_time),
      });
      console.log(`   ✅ Image ${i + 1}: ${path.basename(imagePath)} (${img.block.start_time.toFixed(1)}s - ${img.block.end_time.toFixed(1)}s)`);
    } else {
      // Fallback: equal duration for each image
      const imageDuration = audioDuration / images.length;
      imageTimings.push({
        startTime: i * imageDuration,
        endTime: (i + 1) * imageDuration,
        duration: imageDuration,
      });
      console.log(`   ✅ Image ${i + 1}: ${path.basename(imagePath)} (equal split: ${imageDuration.toFixed(2)}s)`);
    }
  }

  await job.progress(40);

  // Build FFmpeg command for slideshow
  console.log(`\n🎬 Building FFmpeg command...`);

  // Determine effects from channel configuration
  const overlayEffect = channelConfig.effects?.overlay || null;
  const effectOpacity = channelConfig.effects?.particleOpacity || 0.3;

  let effectPath = null;
  let useOverlay = false;
  let overlayDuration = 0;

  if (overlayEffect) {
    // Use the specified overlay effect from channel config
    effectPath = path.join(paths.effects, `${overlayEffect}.mp4`);
    if (await fs.pathExists(effectPath)) {
      overlayDuration = await getVideoDuration(effectPath);
      useOverlay = true;
      console.log(`   ✨ Using overlay effect: ${overlayEffect} (opacity: ${effectOpacity})`);
    } else {
      console.warn(`   ⚠️  Effect file not found: ${overlayEffect}.mp4`);
    }
  } else {
    console.log(`   ℹ️  No overlay effect configured`);
  }

  await job.progress(50);

  // Get movement and transition effects from channel configuration
  // Use exactly what's configured - no defaults if user hasn't selected any
  const movementEffects = channelConfig.effects?.movementEffects || [];
  const transitionEffects = channelConfig.effects?.transitionEffects || [];
  
  if (movementEffects.length > 0) {
    console.log(`   🎭 Movement effects: ${movementEffects.join(', ')}`);
  } else {
    console.log(`   🎭 Movement effects: None selected`);
  }
  
  if (transitionEffects.length > 0) {
    console.log(`   🎬 Transition effects: ${transitionEffects.join(', ')}`);
  } else {
    console.log(`   🎬 Transition effects: None selected`);
  }

  // Use existing videoUtils to build dynamic image filters with sentence-matched timing
  const processedImages = imagePaths.map((imgPath, i) => ({
    localPath: imgPath,
    startSeconds: imageTimings[i].startTime,
    endSeconds: imageTimings[i].endTime,
    section: `image_${i + 1}`,
    default_movement_effects: movementEffects,
    default_transition_effects: transitionEffects,
  }));

  const { videoFilters, inputMapping } = buildDynamicImageFilters(
    processedImages,
    audioDuration,
    useOverlay,
    effectOpacity,
    true, // use subtitles
    subtitlePath,
    overlayDuration,
    escapeSubtitlePath,
    0, // no timing offset
    false, // don't show first from zero
    channelConfig.subtitles || {}
  );

  console.log(`   📊 Generated ${videoFilters.length} filter operations`);

  await job.progress(60);

  // Execute FFmpeg
  console.log(`\n🎥 Executing FFmpeg...`);
  await executeFFmpegWithProgress(
    imagePaths,
    audioPath,
    effectPath,
    outputPath,
    videoFilters,
    inputMapping,
    audioDuration,
    useOverlay,
    job,
    channelConfig
  );

  return {
    effectsUsed: {
      overlay: useOverlay ? overlayEffect : null,
      transitions: true,
      subtitles: true,
    },
  };
}

/**
 * Create background video with overlays (TYPE_1)
 */
async function createBackgroundVideo({ job, audioPath, audioDuration, subtitlePath, outputPath, images, channelConfig, settings, tempDir }) {
  console.log(`\n🎞️  Creating background video...`);
  console.log(`   Duration: ${audioDuration}s`);

  await job.progress(30);

  // Determine number of video segments needed
  const segmentDuration = channelConfig.videoBank?.segmentDuration || 10; // 10s per segment
  const segmentCount = Math.ceil(audioDuration / segmentDuration);

  console.log(`   📹 Need ${segmentCount} video segments (~${segmentDuration}s each)`);

  // Select background videos
  let selectedVideos;
  
  // Check if custom videos are specified in channel config
  if (channelConfig.visualSettings?.type1?.backgroundVideos && channelConfig.visualSettings.type1.backgroundVideos.length > 0) {
    console.log(`   📚 Using ${channelConfig.visualSettings.type1.backgroundVideos.length} videos from channel configuration`);
    
    // Use configured videos
    let configVideos = channelConfig.visualSettings.type1.backgroundVideos;
    
    // Apply shuffle if enabled
    if (channelConfig.visualSettings.type1.shuffleVideos) {
      configVideos = [...configVideos].sort(() => Math.random() - 0.5);
      console.log(`   🔀 Videos shuffled`);
    }
    
    // Limit to maxVideosToUse if specified
    const maxVideos = channelConfig.visualSettings.type1.maxVideosToUse || configVideos.length;
    configVideos = configVideos.slice(0, maxVideos);
    
    // If we need more segments than videos, repeat as needed
    selectedVideos = [];
    for (let i = 0; i < segmentCount; i++) {
      const videoIndex = i % configVideos.length;
      selectedVideos.push({
        ...configVideos[videoIndex],
        segmentIndex: i,
        targetDuration: segmentDuration,
      });
    }
    
    console.log(`   ✅ Using ${selectedVideos.length} video segments from ${configVideos.length} configured videos`);
  } else {
    // Fall back to automatic selection from video bank
    console.log(`   🎲 No configured videos, selecting from video bank automatically`);
    selectedVideos = await selectVideosForRotation(segmentCount, segmentDuration);
  }

  await job.progress(40);

  // Log selected videos for debugging
  console.log(`   📋 Selected videos for concatenation:`);
  selectedVideos.forEach((v, i) => {
    console.log(`      ${i + 1}. ${path.basename(v.path)} (${v.targetDuration}s)`);
  });
  
  // Store video info for FFmpeg filter-based concatenation
  const videoInfo = {
    videos: selectedVideos,
    segmentDuration,
    totalSegments: selectedVideos.length,
  };

  console.log(`   ✅ Video concatenation prepared (${selectedVideos.length} segments, ${segmentDuration}s each)`);

  // Determine overlay type
  const overlayType = channelConfig.overlay?.type || 'none'; // 'static-image', 'looped-person', 'none'
  const overlayImage = overlayType === 'static-image' && images.length > 0 ? images[0] : null;

  await job.progress(50);

  // Build FFmpeg command for background video
  console.log(`\n🎬 Building FFmpeg command for background video...`);

  // Pass video info for filter-based concatenation
  await executeBackgroundVideoFFmpeg(
    videoInfo,
    audioPath,
    subtitlePath,
    outputPath,
    audioDuration,
    overlayImage,
    channelConfig,
    job
  );

  return {
    effectsUsed: {
      backgroundVideos: selectedVideos.length,
      overlay: overlayType,
      subtitles: true,
    },
  };
}

/**
 * Execute FFmpeg for image slideshow with progress tracking
 */
async function executeFFmpegWithProgress(imagePaths, audioPath, effectPath, outputPath, videoFilters, inputMapping, duration, useOverlay, job, channelConfig) {
  return new Promise(async (resolve, reject) => {
    const command = ffmpeg();
    let audioInputIndex = inputMapping;

    // Add image inputs
    imagePaths.forEach(imgPath => {
      command.input(imgPath).inputOptions(['-loop', '1', '-t', duration.toString()]);
    });

    // Add effect overlay if needed
    if (useOverlay && effectPath) {
      const loopsNeeded = Math.ceil(duration / 10); // Assuming 10s effect
      command.input(effectPath).inputOptions(['-stream_loop', (loopsNeeded - 1).toString()]);
    }

    // Add voice audio
    command.input(audioPath);

    // Check for background music
    const music = channelConfig?.audio?.backgroundMusic;
    let hasMusicInput = false;
    let musicInputIndex = -1;

    if (music && music.path && await fs.pathExists(music.path)) {
      console.log(`\n🎵 Adding background music...`);
      console.log(`   Music: ${music.filename}`);
      console.log(`   Volume: ${music.volume || 30}%`);
      console.log(`   Loop: ${music.loop ? 'Yes' : 'No'}`);
      console.log(`   Fade In: ${music.fadeIn || 0}s`);
      console.log(`   Fade Out: ${music.fadeOut || 0}s`);

      // Determine if we need to loop the music
      if (music.loop && music.duration && music.duration < duration) {
        // Music needs to loop
        command.input(music.path).inputOptions(['-stream_loop', '-1']);
      } else {
        command.input(music.path);
      }

      hasMusicInput = true;
      musicInputIndex = audioInputIndex + 1;
    }

    // Update video filters and create audio filter
    const allFilters = [...videoFilters];
    
    if (hasMusicInput) {
      // Build audio mixing filter
      const musicVolume = (music.volume || 30) / 100;
      const fadeIn = music.fadeIn || 0;
      const fadeOut = music.fadeOut || 0;
      const fadeOutStart = Math.max(0, duration - fadeOut);

      // Music filter: volume, fade in/out, trim to duration
      let musicFilter = `[${musicInputIndex}:a]volume=${musicVolume}`;
      if (fadeIn > 0) {
        musicFilter += `,afade=t=in:st=0:d=${fadeIn}`;
      }
      if (fadeOut > 0) {
        musicFilter += `,afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
      }
      musicFilter += `,atrim=duration=${duration}[music]`;
      allFilters.push(musicFilter);

      // Mix voice and music
      allFilters.push(`[${audioInputIndex}:a][music]amix=inputs=2:duration=first:dropout_transition=2[audio]`);
    }

    // Apply filters
    command.complexFilter(allFilters);

    // Output options with GPU acceleration
    // Using NVIDIA NVENC for 10-50x faster encoding on RTX GPUs
    const outputOpts = [
      '-map', '[final]',
      '-map', hasMusicInput ? '[audio]' : `${inputMapping}:a`,
      '-c:v', 'h264_nvenc', // NVIDIA GPU encoding
      '-preset', 'fast', // Use 'fast' preset (p1-p7 presets may not work on all systems)
      '-b:v', '5M', // Target bitrate 5 Mbps
      '-maxrate', '8M', // Max bitrate spike
      '-bufsize', '10M', // Buffer for bitrate management
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p', // Most compatible pixel format
      '-shortest',
      '-t', duration.toString(),
      '-y'
    ];

    command
      .outputOptions(outputOpts)
      .output(outputPath);

    // Track progress
    command.on('start', (cmdline) => {
      console.log(`   🔧 FFmpeg command: ${cmdline.substring(0, 100)}...`);
    });

    command.on('progress', (progress) => {
      if (progress.percent) {
        const percent = Math.min(99, Math.max(60, Math.round(progress.percent)));
        job.progress(percent).catch(() => {});
        console.log(`   📊 Progress: ${Math.floor(progress.percent)}%`);
      }
    });

    command.on('error', (err, stdout, stderr) => {
      console.error(`   ❌ FFmpeg error:`, err.message);
      console.error(`   stderr:`, stderr);
      reject(err);
    });

    command.on('end', () => {
      console.log(`   ✅ FFmpeg completed successfully`);
      resolve();
    });

    command.run();
  });
}

/**
 * Execute FFmpeg for background video with overlays
 */
async function executeBackgroundVideoFFmpeg(videoInfo, audioPath, subtitlePath, outputPath, duration, overlayImage, channelConfig, job) {
  return new Promise(async (resolve, reject) => {
    try {
      const command = ffmpeg();
      const { videos, segmentDuration } = videoInfo;

      // Add all background videos as separate inputs
      console.log(`   📥 Adding ${videos.length} video inputs...`);
      videos.forEach((video, index) => {
        command.input(video.path);
        console.log(`      Input ${index}: ${path.basename(video.path)}`);
      });

      let currentInputIndex = videos.length; // Track where we are in input indices
      
      // Check for person video overlay
      const personOverlay = channelConfig?.visualSettings?.type1?.personVideoOverlay;
      let hasPersonOverlay = false;
      let personOverlayFilter = null;
      let personVideoIndex = -1;

      console.log(`\n🔍 Checking for person overlay...`);
      console.log(`   Person overlay config:`, JSON.stringify(personOverlay, null, 2));

      if (personOverlay && personOverlay.path) {
        // Verify person video file exists
        console.log(`   📂 Checking if path exists: ${personOverlay.path}`);
        const pathExists = await fs.pathExists(personOverlay.path);
        console.log(`   ✓ Path exists: ${pathExists}`);
        
        if (pathExists) {
          console.log(`\n👤 Applying person video overlay...`);
          console.log(`   Video: ${personOverlay.filename}`);
          console.log(`   Position: ${personOverlay.position}`);
          console.log(`   Scale: ${personOverlay.scale}%`);
          console.log(`   Opacity: ${personOverlay.opacity}%`);
          if (personOverlay.chromaKey?.enabled) {
            console.log(`   🎨 Green screen enabled: ${personOverlay.chromaKey.color}`);
          }

          // Add person video as input
          command.input(personOverlay.path);
          personVideoIndex = currentInputIndex;
          currentInputIndex++;
          
          // Generate overlay filter (will use personVideoIndex instead of hardcoded 1)
          personOverlayFilter = personVideoLibrary.generateOverlayFilter(
            personOverlay,
            duration,
            1920,
            1080,
            personVideoIndex // Pass the actual input index
          );
          
          hasPersonOverlay = true;
          await job.progress(40);
        } else {
          console.warn(`   ⚠️  Person overlay video not found: ${personOverlay.path}`);
          console.warn(`   ⚠️  Continuing without person overlay`);
        }
      } else if (personOverlay && !personOverlay.path) {
        console.warn(`   ⚠️  Person overlay is configured but has no path property!`);
        console.warn(`   ⚠️  Overlay data:`, JSON.stringify(personOverlay, null, 2));
        console.warn(`   ⚠️  Continuing without person overlay`);
      } else {
        console.log(`   ℹ️  No person overlay configured for this video`);
      }

      // Add voice audio
      command.input(audioPath);
      let voiceAudioIndex = currentInputIndex;
      currentInputIndex++;

      // Check for background music
      const music = channelConfig?.audio?.backgroundMusic;
      let hasMusicInput = false;
      let musicInputIndex = -1;

      if (music && music.path && await fs.pathExists(music.path)) {
        console.log(`\n🎵 Adding background music...`);
        console.log(`   Music: ${music.filename}`);
        console.log(`   Volume: ${music.volume || 30}%`);
        console.log(`   Loop: ${music.loop ? 'Yes' : 'No'}`);
        console.log(`   Fade In: ${music.fadeIn || 0}s`);
        console.log(`   Fade Out: ${music.fadeOut || 0}s`);

        // Determine if we need to loop the music
        if (music.loop && music.duration && music.duration < duration) {
          // Music needs to loop
          command.input(music.path).inputOptions(['-stream_loop', '-1']);
        } else {
          command.input(music.path);
        }

        hasMusicInput = true;
        musicInputIndex = currentInputIndex;
        currentInputIndex++;
      }

      // Build filter chain
      const filters = [];
      
      console.log(`\n🎬 Building video concatenation filter...`);
      
      // Process each video: scale, trim to segment duration, and setpts
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const trimDuration = video.targetDuration || segmentDuration;
        filters.push(
          `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,` +
          `pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,` +
          `trim=duration=${trimDuration},setpts=PTS-STARTPTS[v${i}]`
        );
        console.log(`      Video ${i}: trimmed to ${trimDuration}s`);
      }
      
      // Concatenate all processed videos
      const concatInputs = videos.map((_, i) => `[v${i}]`).join('');
      filters.push(`${concatInputs}concat=n=${videos.length}:v=1:a=0[bg]`);
      console.log(`   ✅ Concatenating ${videos.length} video segments`);

      // Apply person overlay if present
      let currentVideoLabel = 'bg';
      
      if (hasPersonOverlay && personOverlayFilter) {
        console.log(`   🎬 Building person overlay filter chain...`);
        
        // Add person video processing filters
        filters.push(...personOverlayFilter.filters);
        
        // Overlay person video on background
        const overlayFilter = `[bg][${personOverlayFilter.personLabel}]overlay=${personOverlayFilter.position.x}:${personOverlayFilter.position.y}:shortest=1[bg_with_person]`;
        filters.push(overlayFilter);
        currentVideoLabel = 'bg_with_person';
        
        console.log(`   ✅ Person overlay filter chain ready`);
        await job.progress(45);
      }

      // Check for sound wave overlay
      const soundWaveLibrary = require('../../utils/soundWaveLibrary');
      const soundWaveOverlay = channelConfig?.visualSettings?.type1?.soundWaveOverlay;

      let soundWaveOverlayFilter = null;
      let soundWaveIndex = -1;

      if (soundWaveOverlay && soundWaveOverlay.path) {
        // Verify sound wave file exists
        if (await fs.pathExists(soundWaveOverlay.path)) {
          console.log(`\n🌊 Applying sound wave overlay...`);
          console.log(`   Wave: ${soundWaveOverlay.filename}`);
          console.log(`   Position: ${soundWaveOverlay.position}`);
          console.log(`   Scale: ${soundWaveOverlay.scale}%`);
          console.log(`   Opacity: ${soundWaveOverlay.opacity}%`);

          // Add sound wave as input
          command.input(soundWaveOverlay.path);
          soundWaveIndex = currentInputIndex;
          currentInputIndex++;
          
          // Generate overlay filter
          soundWaveOverlayFilter = soundWaveLibrary.generateOverlayFilter(
            soundWaveOverlay,
            duration,
            1920,
            1080,
            soundWaveIndex
          );
          
          // Add sound wave processing filters
          filters.push(...soundWaveOverlayFilter.filters);
          
          // Overlay sound wave on current video
          const waveOverlayFilter = `[${currentVideoLabel}][${soundWaveOverlayFilter.waveLabel}]overlay=${soundWaveOverlayFilter.position.x}:${soundWaveOverlayFilter.position.y}:shortest=1[with_wave]`;
          filters.push(waveOverlayFilter);
          currentVideoLabel = 'with_wave';
          
          console.log(`   ✅ Sound wave overlay filter chain ready`);
          await job.progress(47);
        } else {
          console.warn(`   ⚠️  Sound wave file not found: ${soundWaveOverlay.path}`);
          console.warn(`   ⚠️  Continuing without sound wave overlay`);
        }
      }

      // Add subtitles
      const escapedSubPath = escapeSubtitlePath(subtitlePath);
      filters.push(`[${currentVideoLabel}]subtitles=${escapedSubPath}[with_subs]`);
      currentVideoLabel = 'with_subs';

      // Add custom text overlays (TYPE_1 only)
      const textOverlays = channelConfig?.visualSettings?.type1?.textOverlays || [];
      if (textOverlays.length > 0) {
        console.log(`\n📝 Adding ${textOverlays.length} custom text overlays...`);
        
        // Validate text overlays
        const validation = validateTextOverlays(textOverlays);
        if (!validation.valid) {
          console.warn(`   ⚠️  Text overlay validation failed:`, validation.errors);
          console.warn(`   ⚠️  Skipping text overlays`);
        } else {
          // Build text overlay filters
          const textFilters = buildAllTextOverlayFilters(textOverlays, 1920, 1080, duration);
          
          // Apply text overlays sequentially
          textFilters.forEach((textFilter, index) => {
            const inputLabel = index === 0 ? currentVideoLabel : `text_${index}`;
            const outputLabel = index === textFilters.length - 1 ? 'final' : `text_${index + 1}`;
            filters.push(`[${inputLabel}]${textFilter}[${outputLabel}]`);
          });
          
          if (textFilters.length > 0) {
            currentVideoLabel = 'final';
          }
          
          console.log(`   ✅ Text overlays added successfully`);
        }
      }

      // If no text overlays were added, rename with_subs to final
      if (currentVideoLabel === 'with_subs') {
        // Replace the last filter to output as [final]
        const lastFilter = filters.pop();
        filters.push(lastFilter.replace('[with_subs]', '[final]'));
        currentVideoLabel = 'final';
      }

      // Add audio mixing if background music is present
      if (hasMusicInput) {
        // Build audio mixing filter
        const musicVolume = (music.volume || 30) / 100;
        const fadeIn = music.fadeIn || 0;
        const fadeOut = music.fadeOut || 0;
        const fadeOutStart = Math.max(0, duration - fadeOut);

        // Music filter: volume, fade in/out, trim to duration
        let musicFilter = `[${musicInputIndex}:a]volume=${musicVolume}`;
        if (fadeIn > 0) {
          musicFilter += `,afade=t=in:st=0:d=${fadeIn}`;
        }
        if (fadeOut > 0) {
          musicFilter += `,afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
        }
        musicFilter += `,atrim=duration=${duration}[music]`;
        filters.push(musicFilter);

        // Mix voice and music
        filters.push(`[${voiceAudioIndex}:a][music]amix=inputs=2:duration=first:dropout_transition=2[audio]`);
      }

      command.complexFilter(filters);

      // Output options with GPU acceleration
      // Using NVIDIA NVENC for 10-50x faster encoding on RTX GPUs
      const outputOpts = [
        '-map', '[final]',
        '-map', hasMusicInput ? '[audio]' : `${voiceAudioIndex}:a`,
        '-c:v', 'h264_nvenc', // NVIDIA GPU encoding
        '-preset', 'fast', // Use 'fast' preset (p1-p7 presets may not work on all systems)
        '-b:v', '5M', // Target bitrate 5 Mbps
        '-maxrate', '8M', // Max bitrate spike
        '-bufsize', '10M', // Buffer for bitrate management
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p', // Most compatible pixel format
        '-shortest',
        '-t', duration.toString(),
        '-y'
      ];

      command
        .outputOptions(outputOpts)
        .output(outputPath);

      // Track progress
      command.on('start', (cmdline) => {
        console.log(`   🔧 FFmpeg command: ${cmdline.substring(0, 150)}...`);
      });

      command.on('progress', (progress) => {
        if (progress.percent) {
          const percent = Math.min(99, Math.max(60, Math.round(progress.percent)));
          job.progress(percent).catch(() => {});
        }
      });

      command.on('error', (err, stdout, stderr) => {
        if (hasPersonOverlay) {
          console.error(`   ❌ Person overlay failed: ${err.message}`);
          console.error(`   stderr:`, stderr?.substring(0, 500));
        }
        reject(err);
      });

      command.on('end', () => {
        if (hasPersonOverlay) {
          console.log(`   ✅ Person overlay applied successfully`);
        }
        resolve();
      });

      command.run();
    } catch (error) {
      console.error(`   ❌ Error in executeBackgroundVideoFFmpeg:`, error.message);
      reject(error);
    }
  });
}

/**
 * Format duration in SRT format
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(num, size = 2) {
  return num.toString().padStart(size, '0');
}

module.exports = {
  processVideoGeneration,
};
