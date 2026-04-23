const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Cache for music metadata
let musicCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Music library path
const MUSIC_LIBRARY_PATH = path.join(process.cwd(), 'music-library');

/**
 * Ensure music library directory exists
 */
async function ensureMusicLibraryDir() {
  await fs.ensureDir(MUSIC_LIBRARY_PATH);
}

/**
 * Scan music library for audio files
 * @returns {Promise<Array>} Array of audio file paths
 */
async function scanMusicLibrary() {
  console.log(`🎵 Scanning music library: ${MUSIC_LIBRARY_PATH}`);

  try {
    const exists = await fs.pathExists(MUSIC_LIBRARY_PATH);
    if (!exists) {
      console.warn(`⚠️  Music library directory doesn't exist: ${MUSIC_LIBRARY_PATH}`);
      await fs.ensureDir(MUSIC_LIBRARY_PATH);
      return [];
    }

    const files = await fs.readdir(MUSIC_LIBRARY_PATH);
    
    // Filter for audio files
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const audioFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return audioExtensions.includes(ext);
      })
      .map(file => path.join(MUSIC_LIBRARY_PATH, file));

    console.log(`   ✅ Found ${audioFiles.length} audio files`);
    
    return audioFiles;
  } catch (error) {
    console.error(`❌ Error scanning music library:`, error.message);
    return [];
  }
}

/**
 * Get audio metadata using ffprobe
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Audio metadata
 */
async function getMusicMetadata(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, async (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const format = metadata.format;
        const duration = parseFloat(format.duration) || 0;
        const fileStats = await fs.stat(audioPath);

        // Extract tags if available
        const tags = format.tags || {};
        const title = tags.title || tags.TITLE || path.basename(audioPath, path.extname(audioPath));
        const artist = tags.artist || tags.ARTIST || 'Unknown Artist';
        const album = tags.album || tags.ALBUM || '';

        resolve({
          path: audioPath,
          filename: path.basename(audioPath),
          title,
          artist,
          album,
          duration,
          format: format.format_name || path.extname(audioPath).substring(1),
          bitrate: parseInt(format.bit_rate) || 0,
          sampleRate: audioStream ? audioStream.sample_rate : 0,
          channels: audioStream ? audioStream.channels : 0,
          size: format.size || fileStats.size || 0,
          addedAt: fileStats.birthtime || fileStats.mtime,
        });
      } catch (parseError) {
        reject(new Error(`Failed to parse metadata for ${audioPath}: ${parseError.message}`));
      }
    });
  });
}

/**
 * Generate waveform visualization for audio file (optional)
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path to save waveform image
 * @returns {Promise<string>} Path to generated waveform image
 */
async function generateMusicWaveform(audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Generate a simple waveform using ffmpeg
    ffmpeg(audioPath)
      .complexFilter([
        '[0:a]showwavespic=s=640x120:colors=#3b82f6[wave]'
      ])
      .map('[wave]')
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`Failed to generate waveform for ${path.basename(audioPath)}:`, err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Cache music list with metadata
 * @param {boolean} forceRefresh - Force refresh cache even if not expired
 * @returns {Promise<Object>} Cached music data
 */
async function cacheMusicList(forceRefresh = false) {
  const now = Date.now();

  // Return cached data if available and not expired
  if (!forceRefresh && musicCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log(`📦 Using cached music list (age: ${Math.round((now - cacheTimestamp) / 1000)}s)`);
    return musicCache;
  }

  console.log(`🔄 Refreshing music library cache...`);

  // Ensure directory exists
  await ensureMusicLibraryDir();

  // Scan for music files
  const audioFiles = await scanMusicLibrary();

  if (audioFiles.length === 0) {
    musicCache = {
      music: [],
      totalDuration: 0,
      totalCount: 0,
      totalSize: 0,
      cachedAt: new Date().toISOString(),
    };
    cacheTimestamp = now;
    return musicCache;
  }

  // Get metadata for all music files
  console.log(`📊 Analyzing ${audioFiles.length} music files...`);
  const musicList = [];
  let failedCount = 0;

  for (let i = 0; i < audioFiles.length; i++) {
    const audioPath = audioFiles[i];
    try {
      const metadata = await getMusicMetadata(audioPath);
      musicList.push(metadata);
      
      if ((i + 1) % 5 === 0 || i === audioFiles.length - 1) {
        console.log(`   🎵 Processed ${i + 1}/${audioFiles.length} music files...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to get metadata for ${path.basename(audioPath)}:`, error.message);
      failedCount++;
    }
  }

  // Calculate totals
  const totalDuration = musicList.reduce((sum, m) => sum + m.duration, 0);
  const totalSize = musicList.reduce((sum, m) => sum + m.size, 0);

  musicCache = {
    music: musicList,
    totalDuration,
    totalCount: musicList.length,
    totalSize,
    failedCount,
    cachedAt: new Date().toISOString(),
  };
  cacheTimestamp = now;

  console.log(`✅ Music library cache updated:`);
  console.log(`   🎵 ${musicList.length} music files`);
  console.log(`   ⏱️  ${Math.round(totalDuration)}s total duration`);
  console.log(`   💾 ${(totalSize / (1024 * 1024)).toFixed(2)} MB total size`);
  if (failedCount > 0) {
    console.log(`   ⚠️  ${failedCount} files failed to analyze`);
  }

  return musicCache;
}

/**
 * Get music by filename
 * @param {string} filename - Music filename
 * @returns {Promise<Object|null>} Music metadata or null
 */
async function getMusicByFilename(filename) {
  const cache = await cacheMusicList();
  return cache.music.find(m => m.filename === filename) || null;
}

/**
 * Clear the music cache
 */
function clearCache() {
  musicCache = null;
  cacheTimestamp = null;
  console.log('🗑️  Music cache cleared');
}

/**
 * Validate audio file format
 * @param {string} filePath - Path to audio file
 * @returns {Promise<boolean>} True if valid audio file
 */
async function validateAudioFile(filePath) {
  try {
    await getMusicMetadata(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  scanMusicLibrary,
  getMusicMetadata,
  generateMusicWaveform,
  cacheMusicList,
  getMusicByFilename,
  clearCache,
  validateAudioFile,
  ensureMusicLibraryDir,
  MUSIC_LIBRARY_PATH,
};

