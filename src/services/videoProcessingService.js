const fs = require("fs-extra");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

// Import utilities and services
const downloadFile = require("../utils/downloadFile");
const { generateSubtitlesWithWhisper } = require("./test-whisper copy 2");
const { escapeSubtitlePath, convertSrtToAss, parseTimestamp, formatTimestamp } = require("../utils/subtitleUtils");
const { processAudioPipeline } = require("./audioService");
const { getVideoDuration, buildDynamicImageFilters } = require("../utils/videoUtils");
const { sanitizeVideoId, setupRequestCancellationHandlers, cleanupProcess } = require("../utils/processUtils");
const SubtitleService = require("./subtitleService");
const GoogleFontsService = require("./googleFontsService");
const { 
  convertImageToTargetResolution,
  downloadDynamicImages, 
  validateDynamicImages 
} = require("../utils/imageUtils");
const { processDynamicImagesTiming } = require("../utils/simpleImageSync");

// Get server IP for responses (fallback to localhost for development)
function getServerIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // fallback
}

/**
 * Temporarily install font to Windows system fonts directory
 * @param {string} fontPath - Path to the font file
 * @param {string} fontFamily - Font family name
 * @returns {Promise<string>} - Installed font name
 */
async function installFontTemporarily(fontPath, fontFamily) {
  try {
    const fontFileName = path.basename(fontPath);
    const platform = os.platform();
    
    if (platform === 'win32') {
      return await installFontWindows(fontPath, fontFamily, fontFileName);
    } else if (platform === 'linux') {
      return await installFontLinux(fontPath, fontFamily, fontFileName);
    } else {
      console.log(`⚠️ Unsupported platform: ${platform}, using fallback approach`);
      return fontFamily;
    }
  } catch (error) {
    console.error(`❌ Font installation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Install font on Windows
 */
async function installFontWindows(fontPath, fontFamily, fontFileName) {
  // Try user fonts directory first (doesn't require admin)
  const userFontsDir = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts');
  await fs.ensureDir(userFontsDir);
  const userFontPath = path.join(userFontsDir, fontFileName);
  
  // Check if font is already installed in user directory
  if (fs.existsSync(userFontPath)) {
    console.log(`🎨 Font already installed in user directory: ${fontFileName}`);
    return fontFamily;
  }
  
  console.log(`🎨 Installing font to Windows user directory: ${fontFileName}`);
  
  // Copy font to user fonts directory
  await fs.copyFile(fontPath, userFontPath);
  
  // Try to register font with Windows using PowerShell
  try {
    const psCommand = `
      Add-Type -AssemblyName System.Drawing
      $fonts = New-Object System.Drawing.Text.PrivateFontCollection
      $fonts.AddFontFile('${userFontPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}')
      Write-Host "Font registered: $($fonts.Families[0].Name)"
    `;
    const result = await execAsync(`powershell -Command "${psCommand}"`, { timeout: 10000 });
    console.log(`✅ Font registered successfully: ${result.stdout.trim()}`);
  } catch (registerError) {
    console.log(`⚠️ Font registration failed (may still work): ${registerError.message}`);
  }
  
  // Also try Windows Font API registration
  try {
    const regCommand = `reg add "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${fontFamily} (TrueType)" /t REG_SZ /d "${userFontPath}" /f`;
    await execAsync(regCommand, { timeout: 5000 });
    console.log(`✅ Font registered in Windows registry`);
  } catch (regError) {
    console.log(`⚠️ Registry registration failed: ${regError.message}`);
  }
  
  // Store the font path for cleanup later
  if (!global.installedFonts) {
    global.installedFonts = [];
  }
  global.installedFonts.push(userFontPath);
  
  return fontFamily;
}

/**
 * Install font on Linux
 */
async function installFontLinux(fontPath, fontFamily, fontFileName) {
  // Use user fonts directory on Linux
  const userFontsDir = path.join(os.homedir(), '.local', 'share', 'fonts');
  await fs.ensureDir(userFontsDir);
  const userFontPath = path.join(userFontsDir, fontFileName);
  
  // Check if font is already installed
  if (fs.existsSync(userFontPath)) {
    console.log(`🎨 Font already installed in Linux user directory: ${fontFileName}`);
    return fontFamily;
  }
  
  console.log(`🎨 Installing font to Linux user directory: ${fontFileName}`);
  
  // Copy font to user fonts directory
  await fs.copyFile(fontPath, userFontPath);
  
  // Update font cache on Linux
  try {
    await execAsync('fc-cache -f -v', { timeout: 10000 });
    console.log(`✅ Linux font cache updated`);
  } catch (cacheError) {
    console.log(`⚠️ Font cache update failed (may still work): ${cacheError.message}`);
  }
  
  // Verify font is available
  try {
    const result = await execAsync(`fc-list | grep -i "${fontFamily}"`, { timeout: 5000 });
    if (result.stdout.trim()) {
      console.log(`✅ Font verified in Linux font system: ${fontFamily}`);
    } else {
      console.log(`⚠️ Font not found in fc-list, but may still work`);
    }
  } catch (verifyError) {
    console.log(`⚠️ Font verification failed: ${verifyError.message}`);
  }
  
  // Store the font path for cleanup later
  if (!global.installedFonts) {
    global.installedFonts = [];
  }
  global.installedFonts.push(userFontPath);
  
  return fontFamily;
}

/**
 * Cleanup temporarily installed fonts
 */
async function cleanupInstalledFonts() {
  if (!global.installedFonts || global.installedFonts.length === 0) {
    return;
  }
  
  console.log(`🧹 Cleaning up ${global.installedFonts.length} temporarily installed fonts...`);
  const platform = os.platform();
  
  for (const fontPath of global.installedFonts) {
    try {
      if (fs.existsSync(fontPath)) {
        // Remove font file
        await fs.remove(fontPath);
        console.log(`🗑️ Removed font file: ${path.basename(fontPath)}`);
        
        if (platform === 'win32') {
          // Try to remove from Windows registry (best effort)
          try {
            const fontName = path.basename(fontPath, path.extname(fontPath));
            const regCommand = `reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${fontName} (TrueType)" /f`;
            await execAsync(regCommand, { timeout: 3000 });
            console.log(`🗑️ Removed font from Windows registry: ${fontName}`);
          } catch (regError) {
            // Ignore registry cleanup errors
          }
        } else if (platform === 'linux') {
          // Update font cache on Linux after removal
          try {
            await execAsync('fc-cache -f', { timeout: 5000 });
            console.log(`🗑️ Updated Linux font cache after removal`);
          } catch (cacheError) {
            // Ignore cache update errors
          }
        }
      }
    } catch (error) {
      console.error(`⚠️ Failed to remove font ${fontPath}: ${error.message}`);
    }
  }
  
  global.installedFonts = [];
}

/**
 * Process video generation request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Map} activeProcesses - Map of active FFmpeg processes
 * @param {string} effectsDir - Path to effects directory
 * @param {string} __dirname - Root directory path
 * @returns {Promise<void>}
 */
async function processVideoRequest(req, res, activeProcesses, effectsDir, __dirname) {
  const {
    audioUrl,
    imageUrl,
    videoId,
    useEffect = false,
    effectType = 'old_camera', // Default effect type
    particleOpacity = 0.5,
    useSubtitles = true, // Default to true for backward compatibility
    useDynamicImages = false, // New parameter to enable dynamic images mode
    images = null, // Dynamic images array (only used if useDynamicImages is true)
    introVideoUrl = null, // Optional intro video URL to prepend to the generated video
    
    // Legacy parameter (still supported for backward compatibility)
    available_transitions = null, // Array of transition types to randomly choose from
    
    // NEW: Separate effect parameters (optional)
    default_movement_effects, // Array of movement effects for individual images (zoom_in, pan_left, etc.)
    default_transition_effects, // Array of xfade transition effects between images (fade, wipeleft, etc.)
    disable_movement_effects = false, // Set to true to disable all movement effects on images
    
    // NEW: AssemblyAI and Google Fonts support
    useAssemblyAI = true, // Use AssemblyAI for transcription (default: true)
    fontOptions = {} // Google Fonts options
  } = req.body;

  if (!audioUrl || !videoId) {
    throw new Error("audioUrl and videoId are required");
  }

  // Validate image setup based on mode
  if (useDynamicImages) {
    validateDynamicImages(images);
    console.log(`🎬 Dynamic images mode: ${images.length} images configured`);
    console.log(`   Note: imageUrl will be ignored in dynamic images mode`);
  }
  
  if (introVideoUrl) {
    console.log(`🎬 Intro video mode: Video will be prepended to generated content`);
    console.log(`   Intro video URL: ${introVideoUrl}`);
  }
  
  if (useDynamicImages) {
    // Log available effects
    if (disable_movement_effects) {
      console.log(`🎬 Effects configuration:`);
      console.log(`   🚫 Movement effects DISABLED - images will be static`);
    } else if (default_movement_effects || default_transition_effects || available_transitions) {
      console.log(`🎬 Effects configuration:`);
      
      if (default_movement_effects && Array.isArray(default_movement_effects) && default_movement_effects.length > 0) {
        console.log(`   📷 Individual image effects: ${default_movement_effects.join(', ')}`);
      }
      
      if (default_transition_effects && Array.isArray(default_transition_effects) && default_transition_effects.length > 0) {
        console.log(`   🔄 Transition effects between images: ${default_transition_effects.join(', ')}`);
      }
      
      // Legacy support
      if (available_transitions && Array.isArray(available_transitions) && available_transitions.length > 0) {
        console.log(`   🎭 Legacy transitions (mixed mode): ${available_transitions.join(', ')}`);
      }
      
      if (!default_movement_effects && !default_transition_effects && !available_transitions) {
        console.log(`   🎭 No specific effects provided - will use default sets`);
      }
    } else {
      console.log(`🎭 No specific effects provided - will use default sets`);
    }
  } else {
    if (!imageUrl) {
      throw new Error("imageUrl is required when useDynamicImages is false");
    }
    console.log(`🖼️ Single image mode: Using imageUrl throughout entire video`);
    if (images) {
      console.log(`⚠️ Note: images parameter provided but useDynamicImages is false - will use single image mode`);
    }
  }

  const sanitizedVideoId = sanitizeVideoId(videoId);
  const processId = `${Date.now()}_${sanitizedVideoId}`;
  const tempDir = path.join(__dirname, "temp", processId);

  // Setup request cancellation handlers
  const { checkRequestActive, isRequestCanceled } = setupRequestCancellationHandlers(
    req, res, videoId, processId, tempDir, activeProcesses
  );

  let srtPath;
  let assPath; // Declare assPath at the top level

  await fs.ensureDir(tempDir);

  try {
    const imagePath = path.join(tempDir, "background.jpg");
    const audioPath = path.join(tempDir, "audio.mp3");
    const videoFileName = `${sanitizedVideoId}.mp4`;
    const videoPath = path.join(__dirname, "test-output", videoFileName);

    // Ensure test-output directory exists
    await fs.ensureDir(path.join(__dirname, "test-output"));

    // Check if video with same videoId already exists
    if (fs.existsSync(videoPath)) {
      console.log(`Video with ID ${videoId} already exists, will overwrite`);
    }

    // Give the request a moment to establish before checking
    await new Promise(resolve => setTimeout(resolve, 50));
    checkRequestActive();

    // Step 1: Download audio, images, and intro video based on mode
    let downloadedImages = [];
    let introVideoPath = null;
    try {
      console.log("Starting parallel downloads...");
      console.log("Downloading audio from:", audioUrl);

      // Prepare download promises
      const downloadPromises = [
        downloadFile(audioUrl, audioPath).catch((error) => {
          throw new Error(`Failed to download audio: ${error.message}`);
        })
      ];

      // Add intro video download if provided
      if (introVideoUrl) {
        introVideoPath = path.join(tempDir, "intro_video.mp4");
        console.log("Downloading intro video from:", introVideoUrl);
        downloadPromises.push(
          downloadFile(introVideoUrl, introVideoPath).catch((error) => {
            throw new Error(`Failed to download intro video: ${error.message}`);
          })
        );
      }

      if (useDynamicImages) {
        // Dynamic images mode: Download only the dynamic images
        console.log(`Downloading ${images.length} dynamic images...`);
        downloadPromises.push(
          downloadDynamicImages(images, tempDir).then(result => {
            downloadedImages = result;
            return result;
          }).catch((error) => {
            throw new Error(`Failed to download dynamic images: ${error.message}`);
          })
        );
      } else {
        // Single image mode: Download and convert the main image
        console.log("Downloading single image from:", imageUrl);
        const originalImagePath = path.join(tempDir, "background_original.jpg");
        downloadPromises.push(
          downloadFile(imageUrl, originalImagePath).then(async () => {
            // Convert to 1280x720 (16:9)
            await convertImageToTargetResolution(originalImagePath, imagePath);
            // Clean up original
            await fs.remove(originalImagePath);
          }).catch((error) => {
            throw new Error(`Failed to download/convert main image: ${error.message}`);
          })
        );
      }

      // Download all files in parallel
      await Promise.all(downloadPromises);

      checkRequestActive();
      console.log("Downloads completed successfully");
      if (useDynamicImages && downloadedImages.length > 0) {
        console.log(`✅ Downloaded ${downloadedImages.length} dynamic images`);
      }
      if (introVideoPath && fs.existsSync(introVideoPath)) {
        console.log(`✅ Downloaded intro video`);
      }
    } catch (error) {
      console.error("Download error:", error);
      await cleanupProcess(processId, tempDir, activeProcesses);
      if (!isRequestCanceled() && !res.headersSent) {
        res.status(400).json({ error: error.message });
      }
      return;
    }

    checkRequestActive();

    // Step 2: Get audio duration
    let durationInSeconds;
    try {
      durationInSeconds = await getVideoDuration(audioPath);
      if (durationInSeconds <= 0) {
        throw new Error("Could not determine audio duration");
      }
      console.log(`Audio duration: ${durationInSeconds} seconds`);
    } catch (durationError) {
      console.error("Duration error:", durationError);
      await cleanupProcess(processId, tempDir, activeProcesses);
      if (!isRequestCanceled() && !res.headersSent) {
        res.status(500).json({
          error: "Failed to get audio duration: " + durationError.message,
        });
      }
      return;
    }

    checkRequestActive();

    // Step 3: Prepare Google Fonts if needed
    let processedFontOptions = { ...fontOptions };
    if (fontOptions.fontFamily) {
      try {
        const googleFonts = new GoogleFontsService();
        await googleFonts.initializeFonts();
        const fontConfig = await googleFonts.prepareFontForSubtitles(fontOptions.fontFamily);
        processedFontOptions.fontFamily = fontConfig.fontFamily;
        if (fontConfig.fontPath) {
          processedFontOptions.fontPath = fontConfig.fontPath;
        }
        console.log(`Font prepared: ${processedFontOptions.fontFamily}`);
      } catch (fontError) {
        console.error("Font preparation error:", fontError.message);
        console.log("Falling back to default font");
      }
    }

    // Step 4: Generate subtitles (ALWAYS for dynamic images functionality)
    let processedImages = [];
    
    // ALWAYS generate subtitles when dynamic images are used OR when useSubtitles is true
    // This ensures dynamic images can use sentence matching even when subtitles are hidden
    const shouldGenerateSubtitles = useSubtitles || (useDynamicImages && downloadedImages.length > 0);
    
    if (shouldGenerateSubtitles) {
      try {
        if (useSubtitles) {
          console.log(`Generating subtitles with ${useAssemblyAI ? 'AssemblyAI' : 'Whisper'}... (will be displayed)`);
        } else {
          console.log(`Generating subtitles with ${useAssemblyAI ? 'AssemblyAI' : 'Whisper'} for dynamic images sentence matching... (will be hidden)`);
        }
        
        srtPath = await SubtitleService.generateSubtitles(audioPath, tempDir, { useAssemblyAI });
        if (!srtPath || !fs.existsSync(srtPath)) {
          throw new Error("Subtitle generation failed");
        }
        console.log("Subtitles generated at:", srtPath);
        checkRequestActive();

        // Step 3.5: Process dynamic images timing if images are provided
        if (useDynamicImages && downloadedImages.length > 0) {
          const srtContent = await fs.readFile(srtPath, 'utf8');
          
          // Add effect parameters to each image for random selection (only if provided)
          const imagesWithTransitions = downloadedImages.map(img => {
            const imageWithEffects = { ...img };
            
            // Only add default_movement_effects if provided in request and not disabled
            if (default_movement_effects && !disable_movement_effects) {
              imageWithEffects.default_movement_effects = default_movement_effects;
            }
            
            // If movement effects are disabled, set to empty array to prevent any movement
            if (disable_movement_effects) {
              imageWithEffects.default_movement_effects = [];
              console.log(`   🚫 Movement effects disabled for all images`);
            }
            
            // Only add default_transition_effects if provided in request
            if (default_transition_effects) {
              imageWithEffects.default_transition_effects = default_transition_effects;
            }
            
            // Legacy support (for backward compatibility)
            imageWithEffects.available_transitions = available_transitions;
            
            return imageWithEffects;
          });
          
          console.log("🚀 Using efficient batch sentence matching for dynamic images...");
          processedImages = processDynamicImagesTiming(
            imagesWithTransitions, srtContent, null, null, durationInSeconds // Using efficient batch approach with audio duration
          );
        }

        // Step 4: Convert SRT to ASS in parallel (only if subtitles will be displayed)
        if (useSubtitles) {
          try {
            console.log("Converting SRT to ASS format...");
            assPath = await convertSrtToAss(srtPath, tempDir, processedFontOptions);
            console.log("ASS subtitles created at:", assPath);
          } catch (assError) {
            console.error("ASS conversion error:", assError);
            console.log("Will continue with original SRT subtitles");
            assPath = null;
          }
        } else {
          console.log("Skipping ASS conversion as subtitles will not be displayed");
        }
      } catch (subtitleError) {
        console.error("Subtitle generation error:", subtitleError);
        await cleanupProcess(processId, tempDir, activeProcesses);
        if (!isRequestCanceled() && !res.headersSent) {
          res.status(500).json({
            error: "Failed to generate subtitles: " + subtitleError.message,
          });
        }
        return;
      }
    } else if (useDynamicImages && downloadedImages.length > 0) {
      // Process dynamic images with provided timestamps only (fallback when no subtitles)
      console.log("⚠️ WARNING: Dynamic images without subtitle generation - using manual timestamps only");
      const imagesWithTransitions = downloadedImages.map(img => {
        const imageWithEffects = { ...img };
        
        // Only add default_movement_effects if provided in request and not disabled
        if (default_movement_effects && !disable_movement_effects) {
          imageWithEffects.default_movement_effects = default_movement_effects;
        }
        
        // If movement effects are disabled, set to empty array to prevent any movement
        if (disable_movement_effects) {
          imageWithEffects.default_movement_effects = [];
          console.log(`   🚫 Movement effects disabled for all images`);
        }
        
        // Only add default_transition_effects if provided in request
        if (default_transition_effects) {
          imageWithEffects.default_transition_effects = default_transition_effects;
        }
        
        // Legacy support (for backward compatibility)
        imageWithEffects.available_transitions = available_transitions;
        
        return imageWithEffects;
      });
      processedImages = processDynamicImagesManualTiming(imagesWithTransitions, parseTimestamp);
    }

    checkRequestActive();

    console.log(`Video duration will be: ${durationInSeconds} seconds`);

    // Step 5: Check effect overlay
    let useOverlay = false;
    let overlayDuration = 0;
    let effectPath = null;

    if (useEffect) {
      // Map effect types to their file paths
      const effectPaths = {
        'old_camera': path.join(effectsDir, "old_camera.mp4"),
        'bubbles': path.join(effectsDir, "bubbles.mp4"),
        'flashes_stars': path.join(effectsDir, "flashes_stars.mp4"),
        'medium_dust': path.join(effectsDir, "medium_dust.mp4"),
        'small_dust': path.join(effectsDir, "small_dust.mp4")
      };

      effectPath = effectPaths[effectType];
      
      if (effectPath && fs.existsSync(effectPath)) {
        console.log(`Checking ${effectType} effect overlay...`);
        overlayDuration = await getVideoDuration(effectPath);

        if (overlayDuration > 0) {
          useOverlay = true;
          console.log(`${effectType} effect overlay ready - Duration: ${overlayDuration} seconds`);
        } else {
          console.log(`Failed to get ${effectType} overlay duration, continuing without it`);
        }
      } else {
        console.log(`Effect ${effectType} requested but file not found at: ${effectPath}`);
      }
    }

    checkRequestActive();

      // Step 6: FFmpeg render with MAXIMUM CPX-51 OPTIMIZATION
      try {
        console.log("Starting MAXIMUM PERFORMANCE FFmpeg video generation for CPX-51...");

        // Create simplified subtitle file names
        const simpleSubsDir = path.join(tempDir, "subs");
        await fs.ensureDir(simpleSubsDir);

        // Install font temporarily to system if we have a custom font
        let installedFontName = null;
        if (processedFontOptions.fontPath && fs.existsSync(processedFontOptions.fontPath)) {
          try {
            installedFontName = await installFontTemporarily(processedFontOptions.fontPath, processedFontOptions.fontFamily);
            if (installedFontName) {
              console.log(`🎨 Font temporarily installed: ${installedFontName}`);
              // Update font family to use the installed name
              processedFontOptions.fontFamily = installedFontName;
            }
          } catch (fontInstallError) {
            console.error(`⚠️ Font installation failed: ${fontInstallError.message}`);
            console.log(`Using fallback font approach`);
          }
        }

        let finalSubtitlePath;
        // Only set finalSubtitlePath if subtitles should be DISPLAYED (not just generated)
        if (useSubtitles) {
          if (assPath && fs.existsSync(assPath)) {
            finalSubtitlePath = path.join(simpleSubsDir, "subs.ass");
            await fs.copyFile(assPath, finalSubtitlePath);
            console.log("Using ASS subtitles for display");
          } else if (srtPath) {
            finalSubtitlePath = path.join(simpleSubsDir, "subs.srt");
            await fs.copyFile(srtPath, finalSubtitlePath);
            console.log("Using SRT subtitles for display");
          }
        } else {
          // Subtitles were generated but should not be displayed
          finalSubtitlePath = null;
          console.log("Subtitles generated but will be hidden (useSubtitles=false)");
        }

      checkRequestActive();

      // Visual sync tuning
      const visualLeadSeconds = Math.max(0, (req?.body?.visualLeadSeconds ?? 0.6));
      const showFirstImageFromZero = Boolean(req?.body?.showFirstImageFromZero ?? true);

      const success = await generateVideoWithFFmpeg(
        useDynamicImages, processedImages, imagePath, effectPath, audioPath, videoPath,
        useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, durationInSeconds, 
        overlayDuration, processId, activeProcesses, checkRequestActive, isRequestCanceled,
        visualLeadSeconds, showFirstImageFromZero, introVideoPath, processedFontOptions,
        // Pass single image effects parameters for non-dynamic mode
        useDynamicImages ? null : { default_movement_effects, disable_movement_effects }
      );

      // Remove from active processes
      activeProcesses.delete(processId);

      if (!success) {
        if (isRequestCanceled()) {
          console.log("Video generation was canceled by client");
          await cleanupProcess(processId, tempDir, activeProcesses);
          return;
        }
        throw new Error("Video generation failed. Check FFmpeg logs above.");
      }

      checkRequestActive();

      // Verify the generated video
      if (!fs.existsSync(videoPath)) {
        throw new Error("Video file was not created");
      }

      const videoStats = fs.statSync(videoPath);
      if (videoStats.size === 0) {
        throw new Error("Generated video file is empty");
      }

      console.log(`ULTRA-FAST video generation SUCCESS! Size: ${Math.round(videoStats.size / 1024 / 1024)}MB`);
    } catch (ffmpegError) {
      console.error("Video generation error:", ffmpegError);
      await cleanupProcess(processId, tempDir, activeProcesses);
      if (!isRequestCanceled() && !res.headersSent) {
        res.status(500).json({
          error: "Failed to generate video: " + ffmpegError.message,
        });
      }
      return;
    }

    // Step 7: Parallel cleanup
    try {
      const cleanupPromises = [
        fs.remove(tempDir),
        // Clean up whisper temp files
        fs.readdir(path.join(__dirname, "test-output")).then(async (files) => {
          const cleanupTasks = files
            .filter(file => file.startsWith("chunk_") || file === "merged_subtitles.srt")
            .map(file => fs.remove(path.join(__dirname, "test-output", file)));
          return Promise.all(cleanupTasks);
        }).catch(() => {}), // Ignore cleanup errors
        // Clean up temporarily installed fonts
        cleanupInstalledFonts()
      ];

      await Promise.all(cleanupPromises);
      console.log("Parallel cleanup completed");
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    // Final check and response
    if (isRequestCanceled() || res.headersSent) {
      console.log("Request was canceled, not sending response");
      return;
    }

    const SERVER_IP = getServerIP();
    const PORT = process.env.PORT || 3000;
    const videoUrl = `http://${SERVER_IP}:${PORT}/test-output/${videoFileName}`;
    console.log("MAXIMUM PERFORMANCE video generation completed:", videoUrl);
    res.json({
      videoUrl,
      videoId: videoId,
      fileName: videoFileName,
      imageMode: {
        useDynamicImages: useDynamicImages,
        description: useDynamicImages ? "Multiple images with sentence/timestamp timing" : "Single image throughout video",
        dynamicImagesCount: useDynamicImages ? (processedImages ? processedImages.length : 0) : 0
      },
      effectsUsed: {
        effect: useEffect ? effectType : null,
        subtitles: useSubtitles,
        dynamicImages: useDynamicImages ? (processedImages ? processedImages.length : 0) : 0,
        introVideo: introVideoUrl ? true : false
      },
      dynamicImagesInfo: useDynamicImages && processedImages ? processedImages.map(img => ({
        section: img.section,
        timing: `${formatTimestamp(img.startSeconds)} - ${formatTimestamp(img.endSeconds)}`,
        syncMethod: img.syncMethod, // 'sentence_match' or 'manual_timestamp'
        confidence: img.confidence, // 'high', 'medium', 'low', or 'manual'
        recommendedMethod: img.syncMethod === 'sentence_match'
      })) : [],
      performance: "CPX-51 MAXIMUM SPEED MODE",
      transcriptionMethod: useAssemblyAI ? 'AssemblyAI' : 'Local Whisper',
      fontUsed: processedFontOptions.fontFamily || 'Arial',
      introVideo: introVideoUrl ? {
        used: true,
        message: "Intro video was prepended to the generated content"
      } : {
        used: false,
        message: "No intro video provided"
      }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    await cleanupProcess(processId, tempDir, activeProcesses);
    // Clean up any installed fonts
    try {
      await cleanupInstalledFonts();
    } catch (fontCleanupError) {
      console.error("Font cleanup error:", fontCleanupError);
    }
    if (!isRequestCanceled() && !res.headersSent) {
      res.status(500).json({ error: "Video generation failed: " + err.message });
    }
  }
}

/**
 * Generate video with FFmpeg using optimized settings
 */
async function generateVideoWithFFmpeg(
  useDynamicImages, processedImages, imagePath, effectPath, audioPath, videoPath,
  useOverlay, particleOpacity, useSubtitles, finalSubtitlePath, durationInSeconds, 
  overlayDuration, processId, activeProcesses, checkRequestActive, isRequestCanceled,
  visualLeadSeconds, showFirstImageFromZero, introVideoPath = null, processedFontOptions = {},
  singleImageEffects = null
) {
  return new Promise(async (resolve, reject) => {
    try {
      // If intro video is provided, we need to generate the main video first, then concatenate
      if (introVideoPath && fs.existsSync(introVideoPath)) {
        console.log("🎬 Intro video detected - will generate main video first, then concatenate");
        
        // Generate main video first
        const tempMainVideoPath = videoPath.replace('.mp4', '_main_temp.mp4');
        
        // Build filters for main video
        const leadIn = Math.max(0, visualLeadSeconds ?? 0);
        const firstAtZero = Boolean(showFirstImageFromZero ?? false);

        const { videoFilters, inputMapping } = buildDynamicImageFilters(
          useDynamicImages ? processedImages : null,
          durationInSeconds, 
          useOverlay, 
          particleOpacity, 
          useSubtitles, 
          finalSubtitlePath,
          overlayDuration,
          escapeSubtitlePath,
          leadIn,
          firstAtZero,
          processedFontOptions,
          singleImageEffects
        );

        // Generate main video
        console.log(`🎬 Starting main video generation (${durationInSeconds}s)...`);
        const mainVideoSuccess = await generateMainVideo(
          useDynamicImages, processedImages, imagePath, effectPath, audioPath, 
          tempMainVideoPath, useOverlay, videoFilters, inputMapping, durationInSeconds,
          overlayDuration, checkRequestActive, isRequestCanceled, processedFontOptions
        );

        if (!mainVideoSuccess) {
          console.error("❌ Main video generation failed!");
          resolve(false);
          return;
        }

        // Check if main video was actually created and has content
        if (!fs.existsSync(tempMainVideoPath)) {
          console.error("❌ Main video file was not created!");
          resolve(false);
          return;
        }

        const mainVideoStats = fs.statSync(tempMainVideoPath);
        console.log(`✅ Main video generated: ${(mainVideoStats.size / 1024 / 1024).toFixed(2)} MB`);
        
        if (mainVideoStats.size === 0) {
          console.error("❌ Main video file is empty!");
          resolve(false);
          return;
        }

        // Now concatenate intro video with main video
        const concatSuccess = await concatenateVideos(
          introVideoPath, tempMainVideoPath, videoPath, 
          checkRequestActive, isRequestCanceled
        );
        
        // If concatenation failed, try alternative method
        if (!concatSuccess) {
          console.log("🔄 Primary concatenation failed, trying alternative method...");
          const altSuccess = await concatenateVideosAlternative(
            introVideoPath, tempMainVideoPath, videoPath, 
            checkRequestActive, isRequestCanceled
          );
          
          if (fs.existsSync(tempMainVideoPath)) {
            await fs.remove(tempMainVideoPath);
          }
          
          resolve(altSuccess);
          return;
        }

        // Clean up temporary main video
        if (fs.existsSync(tempMainVideoPath)) {
          await fs.remove(tempMainVideoPath);
        }

        resolve(concatSuccess);
        return;
      }

      // No intro video - proceed with normal generation
      const leadIn = Math.max(0, visualLeadSeconds ?? 0);
      const firstAtZero = Boolean(showFirstImageFromZero ?? false);

      const { videoFilters, inputMapping } = buildDynamicImageFilters(
        useDynamicImages ? processedImages : null, // Only pass processed images if dynamic mode is enabled
        durationInSeconds, 
        useOverlay, 
        particleOpacity, 
        useSubtitles, 
        finalSubtitlePath,
        overlayDuration,
        escapeSubtitlePath, // Pass the escape function
        leadIn,
        firstAtZero,
        processedFontOptions,
        // Pass single image effects parameters for non-dynamic mode
        useDynamicImages ? null : singleImageEffects
      );

      console.log(`🎬 Generated ${videoFilters.length} FFmpeg filter operations:`);
      if (useDynamicImages && processedImages && processedImages.length > 0) {
        console.log(`   📊 Dynamic images mode: ${processedImages.length} images with transitions`);
        videoFilters.forEach((filter, index) => {
          console.log(`   ${index + 1}. ${filter}`);
        });
      } else {
        console.log(`   📊 Single image mode with ${videoFilters.length} filter operations`);
      }

    const ffmpegCommand = ffmpeg();

    // Add inputs based on image mode
    if (useDynamicImages && processedImages && processedImages.length > 0) {
      // Dynamic images mode: Add only the dynamic images
      console.log(`🎬 Adding ${processedImages.length} dynamic images to FFmpeg command`);
      for (const img of processedImages) {
        ffmpegCommand
          .input(img.localPath)
          .inputOptions([
            "-loop", "1",
            "-threads", "2"
          ]);
      }
    } else {
      // Single image mode: Add the main image
      ffmpegCommand
        .input(imagePath)
        .inputOptions([
          "-loop", "1",
          "-threads", "4" // Dedicated for image input
        ]);
    }

    // Add overlay input if using effect
    if (useOverlay) {
      const loopsNeeded = Math.ceil(durationInSeconds / overlayDuration);
      ffmpegCommand
        .input(effectPath)
        .inputOptions([
          "-stream_loop", (loopsNeeded - 1).toString(),
          "-threads", "4" // Dedicated for overlay
        ]);
    }

    // Add audio input
    ffmpegCommand
      .input(audioPath)
      .inputOptions(["-threads", "4"]) // Dedicated for audio
      .complexFilter(videoFilters)
      .outputOptions([
        "-map", "[final]", // Always map the final output
        "-map", `${inputMapping}:a`, // Map audio from the correct input
        "-c:v", "libx264",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-t", durationInSeconds.toString(),
        "-y",

        // MAXIMUM CPX-51 PERFORMANCE SETTINGS (16 vCPUs, 32GB RAM)
        "-threads", "16", // Use ALL 16 vCPUs
        "-preset", "ultrafast", // Fastest possible preset
        "-tune", "zerolatency", // Zero latency tuning

        // Aggressive quality reduction for MAXIMUM SPEED
        "-crf", "30", // Higher CRF for speed (still watchable)
        "-profile:v", "baseline", // Fastest profile
        "-level", "3.0",

        // Speed-optimized bitrate settings
        "-maxrate", "1.5M", // Lower for speed
        "-bufsize", "3M",

        // x264 MAXIMUM SPEED parameters
        "-x264-params", [
          "me=dia", // Fastest motion estimation
          "subme=1", // Fastest subpixel estimation
          "ref=1", // Minimum reference frames
          "trellis=0", // Disable trellis
          "aq-mode=0", // Disable adaptive quantization
          "b-adapt=0", // Disable adaptive B-frames
          "weightb=0", // Disable weighted B-frames
          "mixed-refs=0", // Disable mixed references
          "8x8dct=0", // Disable 8x8 DCT
          "fast-pskip=1", // Enable fast P-skip
          "cabac=0", // Use CAVLC (faster)
          "deblock=0:0", // Disable deblocking
          "partitions=none", // Disable partitions
          "direct=spatial", // Fastest direct prediction
          "wpredp=0", // Disable weighted prediction
          "rc-lookahead=10", // Minimal lookahead (default is 40)
          "bframes=0", // No B-frames
          "scenecut=0", // Disable scene cut detection
          "mbtree=0", // Disable macroblock tree
          "no-chroma-me=1", // Disable chroma motion estimation
          "no-mixed-refs=1", // Explicitly disable mixed refs
          "no-8x8dct=1", // Explicitly disable 8x8 DCT
          "aq-strength=0" // Disable adaptive quantization strength
        ].join(":"),

        // GOP settings for speed
        "-g", "120", // Larger GOP for speed
        "-keyint_min", "120",
        "-sc_threshold", "0",

        // Threading and memory optimizations for 32GB RAM
        "-thread_queue_size", "16384", // Large queues for 32GB RAM
        "-max_muxing_queue_size", "32768",
        "-thread_type", "slice+frame",

        // I/O optimizations
        "-analyzeduration", "500000", // Faster analysis
        "-probesize", "500000", // Smaller probe
        "-movflags", "+faststart",

        // Additional speed flags
        "-fflags", "+genpts+igndts", // Generate PTS, ignore DTS
        "-avoid_negative_ts", "make_zero"
      ])
      .output(videoPath)
      .on("start", (cmdline) => {
        console.log("MAXIMUM PERFORMANCE FFmpeg command started");
        console.log("Optimized for CPX-51: 16 vCPUs, 32GB RAM");
      })
      .on("progress", (progress) => {
        if (isRequestCanceled()) {
          console.log("Killing FFmpeg process due to canceled request");
          ffmpegCommand.kill('SIGKILL');
          resolve(false);
          return;
        }

        const percent = progress.percent;
        if (percent && !isNaN(percent) && isFinite(percent)) {
          console.log(`ULTRA-FAST Progress: ${Math.floor(percent)}%`);
        } else if (progress.timemark) {
          console.log(`Processing: ${progress.timemark}`);
        }
      })
      .on("error", (err, stdout, stderr) => {
        if (isRequestCanceled()) {
          console.log("FFmpeg process was killed due to canceled request");
          resolve(false);
        } else {
          console.error("FFmpeg error:", err);
          console.error("FFmpeg stderr:", stderr);
          resolve(false);
        }
      })
      .on("end", () => {
        console.log("MAXIMUM PERFORMANCE video generation completed!");
        resolve(true);
      })
      .run();

      // Track this FFmpeg process
      activeProcesses.set(processId, ffmpegCommand);
    } catch (error) {
      console.error("Error in generateVideoWithFFmpeg:", error);
      resolve(false);
    }
  });
}

/**
 * Generate main video (without intro)
 */
async function generateMainVideo(
  useDynamicImages, processedImages, imagePath, effectPath, audioPath, 
  outputPath, useOverlay, videoFilters, inputMapping, durationInSeconds,
  overlayDuration, checkRequestActive, isRequestCanceled, processedFontOptions = {}
) {
  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg();

    // Add inputs based on image mode
    if (useDynamicImages && processedImages && processedImages.length > 0) {
      // Dynamic images mode: Add only the dynamic images
      console.log(`🎬 Adding ${processedImages.length} dynamic images to FFmpeg command`);
      for (const img of processedImages) {
        ffmpegCommand
          .input(img.localPath)
          .inputOptions([
            "-loop", "1",
            "-threads", "2"
          ]);
      }
    } else {
      // Single image mode: Add the main image
      ffmpegCommand
        .input(imagePath)
        .inputOptions([
          "-loop", "1",
          "-threads", "4" // Dedicated for image input
        ]);
    }

    // Add overlay input if using effect
    if (useOverlay) {
      const loopsNeeded = Math.ceil(durationInSeconds / overlayDuration);
      ffmpegCommand
        .input(effectPath)
        .inputOptions([
          "-stream_loop", (loopsNeeded - 1).toString(),
          "-threads", "4" // Dedicated for overlay
        ]);
    }

    // Add audio input
    ffmpegCommand
      .input(audioPath)
      .inputOptions(["-threads", "4"]) // Dedicated for audio
      .complexFilter(videoFilters)
      .outputOptions([
        "-map", "[final]", // Always map the final output
        "-map", `${inputMapping}:a`, // Map audio from the correct input
        "-c:v", "libx264",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-t", durationInSeconds.toString(),
        "-y",

        // MAXIMUM CPX-51 PERFORMANCE SETTINGS (16 vCPUs, 32GB RAM)
        "-threads", "16", // Use ALL 16 vCPUs
        "-preset", "ultrafast", // Fastest possible preset
        "-tune", "zerolatency", // Zero latency tuning

        // Aggressive quality reduction for MAXIMUM SPEED
        "-crf", "30", // Higher CRF for speed (still watchable)
        "-profile:v", "baseline", // Fastest profile
        "-level", "3.0",

        // Speed-optimized bitrate settings
        "-maxrate", "1.5M", // Lower for speed
        "-bufsize", "3M",

        // x264 MAXIMUM SPEED parameters
        "-x264-params", [
          "me=dia", // Fastest motion estimation
          "subme=1", // Fastest subpixel estimation
          "ref=1", // Minimum reference frames
          "trellis=0", // Disable trellis
          "aq-mode=0", // Disable adaptive quantization
          "b-adapt=0", // Disable adaptive B-frames
          "weightb=0", // Disable weighted B-frames
          "mixed-refs=0", // Disable mixed references
          "8x8dct=0", // Disable 8x8 DCT
          "fast-pskip=1", // Enable fast P-skip
          "cabac=0", // Use CAVLC (faster)
          "deblock=0:0", // Disable deblocking
          "partitions=none", // Disable partitions
          "direct=spatial", // Fastest direct prediction
          "wpredp=0", // Disable weighted prediction
          "rc-lookahead=10", // Minimal lookahead (default is 40)
          "bframes=0", // No B-frames
          "scenecut=0", // Disable scene cut detection
          "mbtree=0", // Disable macroblock tree
          "no-chroma-me=1", // Disable chroma motion estimation
          "no-mixed-refs=1", // Explicitly disable mixed refs
          "no-8x8dct=1", // Explicitly disable 8x8 DCT
          "aq-strength=0" // Disable adaptive quantization strength
        ].join(":"),

        // GOP settings for speed
        "-g", "120", // Larger GOP for speed
        "-keyint_min", "120",
        "-sc_threshold", "0",

        // Threading and memory optimizations for 32GB RAM
        "-thread_queue_size", "16384", // Large queues for 32GB RAM
        "-max_muxing_queue_size", "32768",
        "-thread_type", "slice+frame",

        // I/O optimizations
        "-analyzeduration", "500000", // Faster analysis
        "-probesize", "500000", // Smaller probe
        "-movflags", "+faststart",

        // Additional speed flags
        "-fflags", "+genpts+igndts", // Generate PTS, ignore DTS
        "-avoid_negative_ts", "make_zero"
      ])
      .output(outputPath)
      .on("start", (cmdline) => {
        console.log("🎬 Generating main video...");
      })
      .on("progress", (progress) => {
        if (isRequestCanceled()) {
          console.log("Killing main video FFmpeg process due to canceled request");
          ffmpegCommand.kill('SIGKILL');
          resolve(false);
          return;
        }

        const percent = progress.percent;
        if (percent && !isNaN(percent) && isFinite(percent)) {
          console.log(`Main video progress: ${Math.floor(percent)}%`);
        }
      })
      .on("error", (err, stdout, stderr) => {
        if (isRequestCanceled()) {
          console.log("Main video FFmpeg process was killed due to canceled request");
          resolve(false);
        } else {
          console.error("Main video FFmpeg error:", err);
          console.error("Main video FFmpeg stderr:", stderr);
          resolve(false);
        }
      })
      .on("end", () => {
        console.log("✅ Main video generation completed!");
        resolve(true);
      })
      .run();
  });
}

/**
 * Concatenate intro video with main video
 */
async function concatenateVideos(introVideoPath, mainVideoPath, outputPath, checkRequestActive, isRequestCanceled) {
  return new Promise(async (resolve, reject) => {
    console.log("🎬 Concatenating intro video with main video...");
    
    // Get video info for debugging
    try {
      const fs = require("fs-extra");
      const { getVideoDuration } = require("../utils/videoUtils");
      
      const introSize = (fs.statSync(introVideoPath).size / 1024 / 1024).toFixed(2);
      const mainSize = (fs.statSync(mainVideoPath).size / 1024 / 1024).toFixed(2);
      
      console.log(`📹 Intro video: ${path.basename(introVideoPath)} (${introSize} MB)`);
      console.log(`📹 Main video: ${path.basename(mainVideoPath)} (${mainSize} MB)`);
      
      // Get video durations
      try {
        const introDuration = await getVideoDuration(introVideoPath);
        const mainDuration = await getVideoDuration(mainVideoPath);
        console.log(`⏱️ Intro duration: ${introDuration.toFixed(2)}s`);
        console.log(`⏱️ Main duration: ${mainDuration.toFixed(2)}s`);
        console.log(`⏱️ Total expected duration: ${(introDuration + mainDuration).toFixed(2)}s`);
      } catch (durationErr) {
        console.log("Could not get video durations:", durationErr.message);
      }
    } catch (err) {
      console.log("Could not get video file info:", err.message);
    }
    
    console.log("🔧 Normalizing resolutions to 1298x720 for compatibility...");
    
    const ffmpegCommand = ffmpeg()
      .input(introVideoPath)
      .input(mainVideoPath)
      .outputOptions([
        // Normalize both videos to 1298x720 before concatenation
        "-filter_complex", 
        "[0:v]scale=1298:720:force_original_aspect_ratio=decrease,pad=1298:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];" +
        "[1:v]scale=1298:720:force_original_aspect_ratio=decrease,pad=1298:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];" +
        "[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]",
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "fast", // Use fast preset for concatenation
        "-y"
      ])
      .output(outputPath)
      .on("start", (cmdline) => {
        console.log("🎬 Starting video concatenation...");
      })
      .on("progress", (progress) => {
        if (isRequestCanceled()) {
          console.log("Killing concatenation FFmpeg process due to canceled request");
          ffmpegCommand.kill('SIGKILL');
          resolve(false);
          return;
        }

        const percent = progress.percent;
        if (percent && !isNaN(percent) && isFinite(percent)) {
          console.log(`Concatenation progress: ${Math.floor(percent)}%`);
        }
      })
      .on("error", (err, stdout, stderr) => {
        if (isRequestCanceled()) {
          console.log("Concatenation FFmpeg process was killed due to canceled request");
          resolve(false);
        } else {
          console.error("Concatenation FFmpeg error:", err);
          console.error("Concatenation FFmpeg stderr:", stderr);
          
          // Check for common concatenation issues
          if (stderr && stderr.includes("parameters (size")) {
            console.error("❌ Resolution mismatch detected between intro and main video");
            console.error("💡 The system attempted to normalize both videos to 1298x720");
          }
          if (stderr && stderr.includes("Input link") && stderr.includes("do not match")) {
            console.error("❌ Video format compatibility issue detected");
          }
          
          resolve(false);
        }
      })
      .on("end", async () => {
        console.log("✅ Video concatenation completed!");
        
        // Validate final video
        try {
          if (fs.existsSync(outputPath)) {
            const finalStats = fs.statSync(outputPath);
            console.log(`📹 Final video: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
            
            const { getVideoDuration } = require("../utils/videoUtils");
            const finalDuration = await getVideoDuration(outputPath);
            console.log(`⏱️ Final video duration: ${finalDuration.toFixed(2)}s`);
            
            if (finalDuration < 1) {
              console.error("❌ Warning: Final video is very short!");
            }
          } else {
            console.error("❌ Final video file was not created!");
          }
        } catch (validationErr) {
          console.log("Could not validate final video:", validationErr.message);
        }
        
        resolve(true);
      })
      .run();
  });
}

/**
 * Alternative concatenation method using file list approach
 */
async function concatenateVideosAlternative(introVideoPath, mainVideoPath, outputPath, checkRequestActive, isRequestCanceled) {
  return new Promise(async (resolve, reject) => {
    console.log("🔄 Using alternative concatenation method (file list approach)...");
    
    try {
      const fs = require("fs-extra");
      const tempDir = path.dirname(outputPath);
      
      // Create temporary normalized videos
      const normalizedIntroPath = path.join(tempDir, "intro_normalized.mp4");
      const normalizedMainPath = path.join(tempDir, "main_normalized.mp4");
      
      console.log("🔧 Step 1: Normalizing intro video to 1298x720...");
      
      // Normalize intro video
      const introNormalizeSuccess = await new Promise((resolveNorm, rejectNorm) => {
        ffmpeg(introVideoPath)
          .outputOptions([
            "-vf", "scale=1298:720:force_original_aspect_ratio=decrease,pad=1298:720:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-y"
          ])
          .output(normalizedIntroPath)
          .on("end", () => resolveNorm(true))
          .on("error", (err) => {
            console.error("Intro normalization error:", err.message);
            resolveNorm(false);
          })
          .run();
      });
      
      if (!introNormalizeSuccess) {
        resolve(false);
        return;
      }
      
      console.log("🔧 Step 2: Normalizing main video to 1298x720...");
      
      // Normalize main video  
      const mainNormalizeSuccess = await new Promise((resolveNorm, rejectNorm) => {
        ffmpeg(mainVideoPath)
          .outputOptions([
            "-vf", "scale=1298:720:force_original_aspect_ratio=decrease,pad=1298:720:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", 
            "-c:a", "aac",
            "-preset", "fast",
            "-y"
          ])
          .output(normalizedMainPath)
          .on("end", () => resolveNorm(true))
          .on("error", (err) => {
            console.error("Main normalization error:", err.message);
            resolveNorm(false);
          })
          .run();
      });
      
      if (!mainNormalizeSuccess) {
        // Cleanup
        if (fs.existsSync(normalizedIntroPath)) await fs.remove(normalizedIntroPath);
        resolve(false);
        return;
      }
      
      console.log("🔧 Step 3: Concatenating normalized videos...");
      
      // Create concat list file
      const concatListPath = path.join(tempDir, "concat_list.txt");
      const concatContent = `file '${normalizedIntroPath.replace(/\\/g, '/')}'
file '${normalizedMainPath.replace(/\\/g, '/')}'`;
      
      await fs.writeFile(concatListPath, concatContent);
      
      // Concatenate using concat demuxer
      const concatSuccess = await new Promise((resolveConcat, rejectConcat) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .outputOptions([
            "-c", "copy", // Copy streams without re-encoding for speed
            "-y"
          ])
          .output(outputPath)
          .on("start", () => {
            console.log("🎬 Starting alternative concatenation...");
          })
          .on("progress", (progress) => {
            if (isRequestCanceled()) {
              return;
            }
            const percent = progress.percent;
            if (percent && !isNaN(percent) && isFinite(percent)) {
              console.log(`Alternative concatenation progress: ${Math.floor(percent)}%`);
            }
          })
          .on("error", (err, stdout, stderr) => {
            console.error("Alternative concatenation error:", err.message);
            resolveConcat(false);
          })
          .on("end", () => {
            console.log("✅ Alternative concatenation completed!");
            resolveConcat(true);
          })
          .run();
      });
      
      // Cleanup temporary files
      try {
        if (fs.existsSync(normalizedIntroPath)) await fs.remove(normalizedIntroPath);
        if (fs.existsSync(normalizedMainPath)) await fs.remove(normalizedMainPath);
        if (fs.existsSync(concatListPath)) await fs.remove(concatListPath);
      } catch (cleanupErr) {
        console.log("Cleanup warning:", cleanupErr.message);
      }
      
      resolve(concatSuccess);
      
    } catch (error) {
      console.error("Alternative concatenation setup error:", error);
      resolve(false);
    }
  });
}

module.exports = {
  processVideoRequest
}; 