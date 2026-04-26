/**
 * Cartoon final assembly — FFmpeg concat + subtitles + music + color grade.
 *
 * Fresh module so the heavy legacy videoProcessingService.js stays
 * untouched. Orchestrates downloads from R2, builds a temp working dir,
 * runs ffmpeg via fluent-ffmpeg, and uploads the result.
 */

const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const r2Service = require('./r2Service');

function escapeFilterPath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function escapeFontToken(name) {
  return String(name || 'Arial').replace(/'/g, "\\'");
}

/**
 * Download a user-uploaded subtitle font from R2 into a temp directory so
 * libass can resolve it via the `fontsdir` option on the subtitles filter.
 *
 * @param {object} settings  subtitleSettings from the project row
 * @param {string} tmpDir    Assembly temp directory
 * @returns {Promise<string|null>}  Absolute path to fonts directory, or null
 */
async function prepareSubtitleFontDir(settings, tmpDir) {
  const key = settings?.customFontKey;
  if (!key || !r2Service.isConfigured()) return null;
  try {
    const fontDir = path.join(tmpDir, 'subtitle-fonts');
    await fs.ensureDir(fontDir);
    const ext = path.extname(key) || '.ttf';
    const localPath = path.join(fontDir, `userfont${ext}`);
    await r2Service.downloadToFile(key, localPath);
    return fontDir;
  } catch (err) {
    console.warn('⚠️  Could not download subtitle font:', err.message);
    return null;
  }
}

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
 * @param {number} [settings.outlineWidth=2]        0–4 when outline is on
 * @param {boolean}[settings.shadow=false]          soft shadow under text
 * @param {boolean}[settings.bold=false]
 * @param {object} [options]
 * @param {string|null} [options.fontsDir]          Directory containing extra .ttf/.otf (custom upload)
 */
function buildSubtitleFilter(srtPath, settings = {}, { fontsDir = null } = {}) {
  const {
    fontName = 'Arial',
    fontSize = 28,
    fontColor = '#FFFFFF',
    position = 'bottom',
    outline = true,
    outlineWidth = 2,
    shadow = false,
    bold = false,
  } = settings;

  const alignment = { bottom: 2, middle: 5, top: 8 }[position] ?? 2;
  const hex = fontColor.replace('#', '').toUpperCase();
  // libass primary colour is &H00BBGGRR
  const colour = `&H00${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`;
  const outlineVal = outline
    ? Math.min(4, Math.max(0, Number(outlineWidth) || 2))
    : 0;
  const shadowVal = shadow ? 2 : 0;
  const boldVal = bold ? -1 : 0;

  const escapedPath = escapeFilterPath(srtPath);
  let filter = `subtitles='${escapedPath}'`;
  if (fontsDir) {
    filter += `:fontsdir='${escapeFilterPath(fontsDir)}'`;
  }
  const fontTok = escapeFontToken(fontName);
  filter += `:force_style='FontName=${fontTok},FontSize=${fontSize},PrimaryColour=${colour},Alignment=${alignment},Outline=${outlineVal},Shadow=${shadowVal},Bold=${boldVal},BorderStyle=1'`;
  return filter;
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

/**
 * Download per-scene voiceover audio (parallel to sceneVideoKeys). Returns
 * an array of {voicePath|null} of the same length as sceneVideoKeys so
 * indices line up.
 */
async function downloadSceneVoices(sceneVoiceKeys, tmpDir) {
  if (!Array.isArray(sceneVoiceKeys)) return [];
  const out = [];
  for (let i = 0; i < sceneVoiceKeys.length; i++) {
    const key = sceneVoiceKeys[i];
    if (!key) {
      out.push(null);
      continue;
    }
    const ext = path.extname(key) || '.mp3';
    const local = path.join(tmpDir, `voice-${String(i).padStart(3, '0')}${ext}`);
    try {
      if (r2Service.isConfigured()) {
        await r2Service.downloadToFile(key, local);
      } else {
        await fs.copy(key, local);
      }
      out.push(local);
    } catch (err) {
      console.warn(`⚠️  Could not download voice for scene ${i}:`, err.message);
      out.push(null);
    }
  }
  return out;
}

/**
 * Probe a media file's duration in seconds via ffprobe. Returns null on
 * failure so callers can fall back to scene.durationSeconds.
 */
async function probeDurationSeconds(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(null);
      const d = Number(data?.format?.duration);
      resolve(Number.isFinite(d) && d > 0 ? d : null);
    });
  });
}

/**
 * Re-mux a single Seedance clip so its audio track is the voiceover mp3
 * (replacing any Seedance-generated audio entirely) and the video runs
 * for exactly the voiceover's duration. This is what makes the final
 * assembly match what the SRT cues assume — they were timed against the
 * voice mp3, not the silent visual.
 *
 * If voicePath is null the original clip is returned untouched.
 *
 * Strategy:
 *   • If voiceDuration <= clipDuration: trim video to voice length.
 *   • If voiceDuration  > clipDuration: freeze last frame via tpad until
 *     it matches voice length (keeps narration audible past the visual).
 */
async function bakeVoiceIntoClip(clipPath, voicePath, outPath) {
  if (!voicePath) {
    await fs.copy(clipPath, outPath);
    return outPath;
  }

  const [clipDur, voiceDur] = await Promise.all([
    probeDurationSeconds(clipPath),
    probeDurationSeconds(voicePath),
  ]);

  // Without reliable duration info, fall back to a simple shortest-track
  // mux so we at least get the voiceover on top.
  if (!clipDur || !voiceDur) {
    await runFfmpeg('voice-mux-fallback', (cmd) => {
      cmd
        .input(clipPath)
        .input(voicePath)
        .outputOptions([
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '20',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
        ])
        .output(outPath);
    });
    return outPath;
  }

  const target = voiceDur;
  const needsPad = voiceDur > clipDur + 0.05;

  await runFfmpeg('voice-mux', (cmd) => {
    cmd.input(clipPath).input(voicePath);
    const vFilters = [];
    if (needsPad) {
      // Hold the last frame for the missing tail; setpts re-anchors PTS
      // so concat downstream still sees a clean monotonic timeline.
      const padSecs = (voiceDur - clipDur).toFixed(3);
      vFilters.push(`tpad=stop_mode=clone:stop_duration=${padSecs}`);
    }
    vFilters.push('setpts=PTS-STARTPTS');
    cmd.complexFilter([`[0:v]${vFilters.join(',')}[v]`]);
    cmd.outputOptions([
      '-map', '[v]',
      '-map', '1:a:0',
      '-t', target.toFixed(3),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
    ]);
    cmd.output(outPath);
  });
  return outPath;
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
 * Probe a video file with ffprobe to detect whether it has any audio
 * stream. Used so we don't try to map a non-existent [0:a] when Seedance
 * was run with `generate_audio=false`.
 */
async function hasAudioStream(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(false);
      const streams = data?.streams || [];
      resolve(streams.some((s) => s.codec_type === 'audio'));
    });
  });
}

/**
 * Wrap an ffmpeg run with verbose logging + promise plumbing. Captures
 * the actual command line and the last 40 lines of stderr so failures
 * give us something usable in logs (instead of just an exit code).
 */
function runFfmpeg(label, build) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    build(cmd);
    const stderrTail = [];
    cmd
      .on('start', (cli) => {
        console.log(`▶️  [assembly:${label}] ${cli}`);
      })
      .on('stderr', (line) => {
        stderrTail.push(line);
        if (stderrTail.length > 40) stderrTail.shift();
      })
      .on('end', () => {
        console.log(`✅ [assembly:${label}] done`);
        resolve();
      })
      .on('error', (err) => {
        const tail = stderrTail.join('\n');
        const detail = tail ? `\n--- ffmpeg stderr (tail) ---\n${tail}\n---` : '';
        reject(new Error(`[assembly:${label}] ${err.message}${detail}`));
      })
      .run();
  });
}

/**
 * Main assembly entry point.
 *
 * @param {object} input
 * @param {string} input.projectId
 * @param {string[]} input.sceneVideoKeys   R2 keys of per-scene video clips, in order
 * @param {Array<string|null>} [input.sceneVoiceKeys]  R2 keys of per-scene voiceover MP3s, parallel to sceneVideoKeys
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
    sceneVoiceKeys = [],
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

  // Avoid Windows 8.3 short-name temp paths (C:\Users\SHAHDU~1\…) — the
  // tilde + apostrophes in subtitles=… filter strings trip libavformat
  // and produce a cryptic "Invalid argument" when opening the output file.
  // Using a project-scoped working dir under <repo>/temp dodges that.
  const baseTmp = path.join(process.cwd(), 'temp', 'cartoon-assembly');
  await fs.ensureDir(baseTmp);
  const tmpDir = await fs.mkdtemp(path.join(baseTmp, `${projectId}-`));

  try {
    const rawClipPaths = await downloadScenes(projectId, sceneVideoKeys, tmpDir);
    const voicePaths = await downloadSceneVoices(sceneVoiceKeys, tmpDir);
    const srtPath = await downloadSrt(subtitlesKey, tmpDir);
    const musicPath = await downloadMusic(musicKey, tmpDir);

    // Replace each Seedance clip's audio with the matching voiceover and
    // pad/trim the visual to the voice duration. This is what actually
    // gets the narration into the final video — the previous pipeline
    // dropped voiceKey on the floor and only mixed background music.
    const clipPaths = [];
    for (let i = 0; i < rawClipPaths.length; i++) {
      const baked = path.join(tmpDir, `scene-${String(i).padStart(3, '0')}-vo.mp4`);
      await bakeVoiceIntoClip(rawClipPaths[i], voicePaths[i] || null, baked);
      clipPaths.push(baked);
    }

    const concatPath = path.join(tmpDir, 'concat.mp4');
    const listPath = buildConcatListFile(tmpDir, clipPaths);
    try {
      await runFfmpeg('concat-copy', (cmd) => {
        cmd
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(concatPath);
      });
    } catch (err) {
      console.warn('⚠️  Lossless concat failed, falling back to re-encode:', err.message);
      const audioPresence = await Promise.all(clipPaths.map(hasAudioStream));
      const allHaveAudio = audioPresence.every(Boolean);

      await runFfmpeg('concat-reencode', (cmd) => {
        clipPaths.forEach((p) => cmd.input(p));
        let filters;
        if (allHaveAudio) {
          filters =
            clipPaths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('') +
            `concat=n=${clipPaths.length}:v=1:a=1[v][a]`;
        } else {
          // Synthesise silent stereo for any clip missing audio so concat
          // sees matching audio streams across all inputs.
          const silentPrefix = clipPaths
            .map((_p, i) =>
              audioPresence[i]
                ? null
                : `anullsrc=channel_layout=stereo:sample_rate=44100[s${i}]`
            )
            .filter(Boolean)
            .join(';');
          const segs = clipPaths
            .map((_p, i) => (audioPresence[i] ? `[${i}:v:0][${i}:a:0]` : `[${i}:v:0][s${i}]`))
            .join('');
          filters =
            (silentPrefix ? silentPrefix + ';' : '') +
            segs +
            `concat=n=${clipPaths.length}:v=1:a=1[v][a]`;
        }
        cmd
          .complexFilter(filters, ['v', 'a'])
          .outputOptions([
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '20',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
          ])
          .output(concatPath);
      });
    }

    const finalPath = path.join(tmpDir, 'final.mp4');
    const subtitleFontsDir = await prepareSubtitleFontDir(subtitleSettings, tmpDir);

    // Probe the concat output rather than guessing — concat may have
    // synthesised silence or copied audio through, depending on path.
    const concatHasAudio = await hasAudioStream(concatPath);

    await runFfmpeg('final', (cmd) => {
      cmd.input(concatPath);
      if (musicPath) cmd.input(musicPath);

      const vFilters = [];
      if (colorGrade) vFilters.push(colorGrade);
      if (srtPath) {
        vFilters.push(
          buildSubtitleFilter(srtPath, subtitleSettings || {}, { fontsDir: subtitleFontsDir })
        );
      }

      const filterComplexParts = [];
      if (vFilters.length > 0) {
        filterComplexParts.push(`[0:v]${vFilters.join(',')}[v]`);
      } else {
        filterComplexParts.push(`[0:v]copy[v]`);
      }

      let audioOutLabel = null;
      if (musicPath && concatHasAudio) {
        // Mix original audio with looped music. Explicit integer for
        // aloop's `size` (some ffmpeg builds reject scientific notation).
        filterComplexParts.push(
          `[1:a]volume=${musicVolume},aloop=loop=-1:size=2147483647[bgm]`
        );
        filterComplexParts.push(
          `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`
        );
        audioOutLabel = '[a]';
      } else if (musicPath && !concatHasAudio) {
        filterComplexParts.push(`[1:a]volume=${musicVolume}[a]`);
        audioOutLabel = '[a]';
      } else if (concatHasAudio) {
        audioOutLabel = '0:a';
      }

      cmd.complexFilter(filterComplexParts);

      const opts = [
        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ];
      if (audioOutLabel) {
        opts.push('-map', audioOutLabel, '-c:a', 'aac', '-b:a', '192k');
      } else {
        opts.push('-an');
      }
      cmd.outputOptions(opts).output(finalPath);
    });

    if (r2Service.isConfigured()) {
      await r2Service.uploadFromPath(outputKey, finalPath, 'video/mp4');
    }

    return { outputKey, localPath: finalPath, tmpDir };
  } catch (err) {
    err.tmpDir = tmpDir;
    throw err;
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
  prepareSubtitleFontDir,
  trimLeading,
  spliceHook,
  cleanupTmpDir,
};
