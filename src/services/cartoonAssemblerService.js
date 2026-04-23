/**
 * Cartoon final assembly — FFmpeg concat + subtitles + music + color grade.
 *
 * Fresh module so the heavy legacy videoProcessingService.js stays
 * untouched. Orchestrates downloads from R2, builds a temp working dir,
 * runs ffmpeg via fluent-ffmpeg, and uploads the result.
 */

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const r2Service = require('./r2Service');

/**
 * Build a libass `subtitles=...:force_style=...` filter from user settings.
 *
 * @param {string} srtPath  Absolute path to SRT file on disk.
 * @param {object} settings
 * @param {string} [settings.fontName='Arial']
 * @param {number} [settings.fontSize=28]
 * @param {string} [settings.fontColor='#FFFFFF']   hex RGB
 * @param {string} [settings.position='bottom']     'top'|'middle'|'bottom'
 * @param {boolean}[settings.outline=true]
 */
function buildSubtitleFilter(srtPath, settings = {}) {
  const {
    fontName = 'Arial',
    fontSize = 28,
    fontColor = '#FFFFFF',
    position = 'bottom',
    outline = true,
  } = settings;

  const alignment = { bottom: 2, middle: 5, top: 8 }[position] ?? 2;
  const hex = fontColor.replace('#', '').toUpperCase();
  // libass primary colour is &H00BBGGRR
  const colour = `&H00${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`;
  const outlineVal = outline ? 2 : 0;

  // Escape colons and backslashes so ffmpeg's filter parser tolerates them.
  const escapedPath = srtPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

  return `subtitles='${escapedPath}':force_style='FontName=${fontName},FontSize=${fontSize},PrimaryColour=${colour},Alignment=${alignment},Outline=${outlineVal},BorderStyle=1'`;
}

function buildConcatListFile(tmpDir, clipPaths) {
  const listPath = path.join(tmpDir, 'concat.txt');
  const content = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, content, 'utf8');
  return listPath;
}

async function downloadScenes(projectId, sceneVideoKeys, tmpDir) {
  const out = [];
  for (let i = 0; i < sceneVideoKeys.length; i++) {
    const key = sceneVideoKeys[i];
    const local = path.join(tmpDir, `scene-${String(i).padStart(3, '0')}.mp4`);
    if (r2Service.isConfigured()) {
      await r2Service.downloadToFile(key, local);
    } else {
      // Local dev fallback: assume key is already a local path.
      await fs.copy(key, local);
    }
    out.push(local);
  }
  return out;
}

async function downloadSrt(subtitlesKey, tmpDir) {
  if (!subtitlesKey) return null;
  const local = path.join(tmpDir, 'subtitles.srt');
  if (r2Service.isConfigured()) {
    await r2Service.downloadToFile(subtitlesKey, local);
  } else {
    await fs.copy(subtitlesKey, local);
  }
  return local;
}

async function downloadMusic(musicKey, tmpDir) {
  if (!musicKey) return null;
  const local = path.join(tmpDir, path.basename(musicKey));
  if (r2Service.isConfigured()) {
    try {
      await r2Service.downloadToFile(musicKey, local);
    } catch (err) {
      console.warn('⚠️  Could not download music track:', err.message);
      return null;
    }
  } else {
    const candidate = path.isAbsolute(musicKey)
      ? musicKey
      : path.join(process.cwd(), musicKey);
    try {
      await fs.copy(candidate, local);
    } catch {
      return null;
    }
  }
  return local;
}

/**
 * Main assembly entry point.
 *
 * @param {object} input
 * @param {string} input.projectId
 * @param {string[]} input.sceneVideoKeys   R2 keys of per-scene video clips, in order
 * @param {string|null} input.subtitlesKey  R2 key of the combined SRT (or null)
 * @param {string|null} input.musicKey      R2 key of background music (or null)
 * @param {number} input.musicVolume        0..1
 * @param {object|null} input.subtitleSettings  { fontName, fontSize, fontColor, position, outline }
 * @param {string|null} input.colorGrade    ffmpeg filter, e.g. 'eq=saturation=1.2:contrast=1.05'
 * @param {string} input.outputKey          R2 key for final MP4
 * @returns {Promise<{outputKey:string, localPath:string}>}
 */
async function assembleFinalVideo(input) {
  const {
    projectId,
    sceneVideoKeys,
    subtitlesKey,
    musicKey,
    musicVolume = 0.15,
    subtitleSettings,
    colorGrade = null,
    outputKey,
  } = input;

  if (!Array.isArray(sceneVideoKeys) || sceneVideoKeys.length === 0) {
    throw new Error('sceneVideoKeys must be non-empty');
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `cartoon-assembly-${projectId}-`));

  try {
    const clipPaths = await downloadScenes(projectId, sceneVideoKeys, tmpDir);
    const srtPath = await downloadSrt(subtitlesKey, tmpDir);
    const musicPath = await downloadMusic(musicKey, tmpDir);

    // Step 1: concat scene clips losslessly where possible. We use the
    // concat demuxer; if the source clips differ in codec params this will
    // fail and we fall back to a re-encoded concat via filter_complex.
    const concatPath = path.join(tmpDir, 'concat.mp4');
    const listPath = buildConcatListFile(tmpDir, clipPaths);
    try {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(concatPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    } catch (err) {
      console.warn('⚠️  Lossless concat failed, falling back to re-encode:', err.message);
      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        clipPaths.forEach((p) => cmd.input(p));
        const filters = clipPaths
          .map((_, i) => `[${i}:v:0][${i}:a:0]`)
          .join('') + `concat=n=${clipPaths.length}:v=1:a=1[v][a]`;
        cmd
          .complexFilter(filters, ['v', 'a'])
          .outputOptions(['-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac'])
          .output(concatPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }

    // Step 2: apply video filters (subtitles + color grade) + mix music.
    const finalPath = path.join(tmpDir, 'final.mp4');

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg().input(concatPath);
      if (musicPath) cmd.input(musicPath);

      const vFilters = [];
      if (colorGrade) vFilters.push(colorGrade);
      if (srtPath) vFilters.push(buildSubtitleFilter(srtPath, subtitleSettings || {}));

      const filterComplexParts = [];
      if (vFilters.length > 0) {
        filterComplexParts.push(`[0:v]${vFilters.join(',')}[v]`);
      } else {
        filterComplexParts.push(`[0:v]copy[v]`);
      }

      if (musicPath) {
        // Mix original audio with music at musicVolume.
        filterComplexParts.push(`[1:a]volume=${musicVolume},aloop=loop=-1:size=2e+09[bgm]`);
        filterComplexParts.push(`[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`);
      }

      cmd.complexFilter(filterComplexParts, musicPath ? ['v', 'a'] : ['v', '0:a']);
      cmd.outputOptions([
        '-map', '[v]',
        '-map', musicPath ? '[a]' : '0:a',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ]);
      cmd
        .output(finalPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    if (r2Service.isConfigured()) {
      await r2Service.uploadFromPath(outputKey, finalPath, 'video/mp4');
    }

    return { outputKey, localPath: finalPath, tmpDir };
  } finally {
    // Caller is responsible for the tmp dir in the error path; we only clean
    // on successful return so debug logs persist on failure.
  }
}

/**
 * Utility: trim the leading N seconds off a video.
 *
 * @returns {Promise<string>} path to trimmed file
 */
async function trimLeading(inputPath, seconds, outPath) {
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(['-ss', String(seconds)])
      .outputOptions(['-c', 'copy'])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return outPath;
}

/**
 * Utility: concat hook clip + tail.
 */
async function spliceHook(hookPath, tailPath, outPath) {
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(hookPath)
      .input(tailPath)
      .complexFilter(
        '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]',
        ['v', 'a']
      )
      .outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return outPath;
}

async function cleanupTmpDir(tmpDir) {
  try { await fs.remove(tmpDir); } catch (_) { /* ignore */ }
}

module.exports = {
  assembleFinalVideo,
  buildSubtitleFilter,
  trimLeading,
  spliceHook,
  cleanupTmpDir,
};
