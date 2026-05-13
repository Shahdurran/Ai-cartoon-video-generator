/**
 * Cartoon final assembly — FFmpeg concat + subtitles + music + color grade.
 *
 * Fresh module so the heavy legacy videoProcessingService.js stays
 * untouched. Orchestrates downloads from R2, builds a temp working dir,
 * runs ffmpeg via fluent-ffmpeg, and uploads the result.
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
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
 * FFmpeg passed through fluent-ffmpeg on Windows sometimes fails with
 * "Error opening output file … Invalid argument" when paths contain only
 * backslashes. Using an absolute path with forward slashes matches how we
 * escape paths inside filter graphs (see escapeFilterPath) and avoids that
 * libavformat quirk for plain -i / output arguments too.
 */
function toFfmpegIoPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function httpGet(url, { redirects = 5, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      // Follow redirects
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        redirects > 0
      ) {
        res.resume();
        return resolve(httpGet(res.headers.location, { redirects: redirects - 1, headers }));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error(`GET ${url} timed out`));
    });
  });
}

/**
 * Fetch a Google Font family's regular weight TTF/OTF and write it into
 * `fontDir`. We hit the public CSS2 endpoint with a Windows User-Agent so
 * Google serves us TTFs (rather than woff2 which libass can't read), parse
 * the first `src: url(…)` from the @font-face block, and download that.
 *
 * Returns the local path of the downloaded font, or null on any failure.
 */
async function downloadGoogleFont(family, fontDir) {
  if (!family) return null;
  // Skip families that ship with libass / OS-default mapping (don't bother
  // hitting Google for plain Arial/Times/Courier).
  const builtIn = new Set(['arial', 'times new roman', 'courier new', 'verdana', 'tahoma']);
  if (builtIn.has(family.toLowerCase())) return null;

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family
    )}:wght@400;700&display=swap`;
    const cssRes = await httpGet(cssUrl, {
      headers: {
        // Force ttf payloads (woff2 default would be unusable by libass).
        'User-Agent':
          'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
      },
    });
    const css = cssRes.body.toString('utf8');
    const m = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?truetype['"]?\)/i)
      || css.match(/src:\s*url\(([^)]+)\)/i);
    if (!m) {
      console.warn(`⚠️  [fonts] could not parse font URL from Google CSS for "${family}"`);
      return null;
    }
    const fontUrl = m[1].trim().replace(/^['"]|['"]$/g, '');
    const fontRes = await httpGet(fontUrl);
    const ext = path.extname(new URL(fontUrl).pathname) || '.ttf';
    const safe = family.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const out = path.join(fontDir, `${safe}${ext}`);
    await fs.writeFile(out, fontRes.body);
    console.log(`📝 [fonts] downloaded "${family}" -> ${out} (${fontRes.body.length} bytes)`);
    return out;
  } catch (err) {
    console.warn(`⚠️  [fonts] could not fetch "${family}" from Google Fonts:`, err.message);
    return null;
  }
}

/**
 * Prepare a directory libass can use to resolve the subtitle font. Handles
 * two cases:
 *   1. customFontKey set → download the user-uploaded font from R2.
 *   2. fontName is a Google Font (e.g. Inter) → download the regular TTF
 *      so the burn-in works on hosts that don't have it system-installed
 *      (Windows dev box, slim Linux containers like Railway).
 *
 * Returns the absolute fonts directory path, or null when nothing was
 * downloaded (libass will then fall back to system fonts).
 */
async function prepareSubtitleFontDir(settings, tmpDir) {
  const fontDir = path.join(tmpDir, 'subtitle-fonts');
  let downloadedAny = false;

  // 1. Custom-uploaded font wins.
  const key = settings?.customFontKey;
  if (key && r2Service.isConfigured()) {
    try {
      await fs.ensureDir(fontDir);
      const ext = path.extname(key) || '.ttf';
      const localPath = path.join(fontDir, `userfont${ext}`);
      await r2Service.downloadToFile(key, localPath);
      console.log(`📝 [fonts] downloaded custom font from R2 -> ${localPath}`);
      downloadedAny = true;
    } catch (err) {
      console.warn('⚠️  [fonts] could not download custom subtitle font:', err.message);
    }
  }

  // 2. Always try Google Fonts for the requested family unless it's a
  // system staple — this is what makes "Inter" actually render on Windows
  // boxes where it isn't installed.
  const family = (settings?.fontName || 'Inter').trim();
  await fs.ensureDir(fontDir);
  const downloaded = await downloadGoogleFont(family, fontDir);
  if (downloaded) downloadedAny = true;

  return downloadedAny ? fontDir : null;
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
 * Download every shot of every multi-shot scene into the temp dir.
 * Returns a parallel array (same length / order as `scenePlans`); for
 * single-shot scenes the value is `null` (caller falls back to the
 * scene-level video key).
 */
async function downloadMultiShotInputs(scenePlans, tmpDir) {
  const out = [];
  for (let i = 0; i < scenePlans.length; i++) {
    const plan = scenePlans[i];
    if (!plan?.shots?.length) {
      out.push(null);
      continue;
    }
    const shotPaths = [];
    for (let j = 0; j < plan.shots.length; j++) {
      const shot = plan.shots[j];
      const local = path.join(
        tmpDir,
        `scene-${String(i).padStart(3, '0')}-shot-${String(j).padStart(2, '0')}-raw.mp4`
      );
      if (r2Service.isConfigured()) {
        await r2Service.downloadToFile(shot.videoKey, local);
      } else {
        await fs.copy(shot.videoKey, local);
      }
      shotPaths.push({ ...shot, localPath: local });
    }
    out.push(shotPaths);
  }
  return out;
}

/**
 * Multi-shot bake: trim each shot to its allocated window so the cuts
 * land at the right beats, hard-cut concatenate them, then mux the
 * scene's voiceover MP3 across the whole concatenated visual as a
 * single continuous audio track. The result is one per-scene MP4 that
 * the rest of the assembler treats exactly like a single-shot scene.
 *
 * Window allocation: equal split of the voice duration across N shots,
 * with the last shot absorbing any rounding drift. For v1 we don't snap
 * to word boundaries -- the audio is one continuous take, so cut points
 * only need to feel rhythmic, not align with phonemes.
 */
async function bakeMultiShotScene(shotInputs, voicePath, sceneIndex, outPath, tmpDir) {
  if (!Array.isArray(shotInputs) || shotInputs.length === 0) {
    throw new Error(`bakeMultiShotScene: no shots for scene ${sceneIndex}`);
  }

  // Determine total duration the visual must cover. With voice we use the
  // voice mp3's duration so narration syncs exactly. Without voice we sum
  // the shots' target durations.
  let totalDur = null;
  if (voicePath) {
    totalDur = await probeDurationSeconds(voicePath);
  }
  if (!totalDur || totalDur <= 0) {
    totalDur = shotInputs.reduce(
      (sum, s) => sum + (Number(s.durationSeconds) || 2.5),
      0
    );
  }

  // Equal split -- last shot absorbs any drift so total exactly matches
  // totalDur. (Equal split is good enough for v1 because the audio is one
  // continuous take; cut points just need to feel rhythmic.)
  const n = shotInputs.length;
  const baseWindow = totalDur / n;
  const windows = shotInputs.map((_, i) =>
    i === n - 1 ? Math.max(0.5, totalDur - baseWindow * (n - 1)) : baseWindow
  );

  // Trim each shot clip to its window, padding with the last frame if the
  // Seedance render came back short. Also strip any Seedance audio --
  // the scene voiceover replaces it across the cuts.
  const trimmed = [];
  for (let i = 0; i < n; i++) {
    const shot = shotInputs[i];
    const winSecs = windows[i];
    const clipDur = await probeDurationSeconds(shot.localPath);
    const needsPad = clipDur && clipDur < winSecs - 0.05;

    const out = path.join(
      tmpDir,
      `scene-${String(sceneIndex).padStart(3, '0')}-shot-${String(i).padStart(2, '0')}-trim.mp4`
    );

    await runFfmpeg(`shot-trim-s${sceneIndex}-${i}`, (cmd) => {
      cmd.input(shot.localPath);
      const vFilters = [];
      if (needsPad) {
        const padSecs = (winSecs - clipDur).toFixed(3);
        vFilters.push(`tpad=stop_mode=clone:stop_duration=${padSecs}`);
      }
      vFilters.push('setpts=PTS-STARTPTS');
      cmd.complexFilter([`[0:v]${vFilters.join(',')}[v]`]);
      cmd.outputOptions([
        '-map', '[v]',
        '-an',
        '-t', winSecs.toFixed(3),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
      ]);
      cmd.output(out);
    });
    trimmed.push(out);
  }

  // Concat the trimmed (audio-stripped) shots. Hard cuts only -- no
  // crossfade (per the user's choice), so the concat demuxer with
  // re-encode is the simplest path that handles mixed encoders.
  const concatVisual = path.join(
    tmpDir,
    `scene-${String(sceneIndex).padStart(3, '0')}-visual.mp4`
  );
  await runFfmpeg(`shot-concat-s${sceneIndex}`, (cmd) => {
    trimmed.forEach((p) => cmd.input(p));
    const filter =
      trimmed.map((_, i) => `[${i}:v:0]`).join('') +
      `concat=n=${trimmed.length}:v=1:a=0[v]`;
    cmd.complexFilter(filter);
    cmd.outputOptions([
      '-map', '[v]',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
    ]);
    cmd.output(concatVisual);
  });

  // Mux the voice mp3 across the concatenated visual. Without voice we
  // just copy the visual and let the downstream concat synthesise silent
  // audio so all scenes have matching audio streams.
  if (voicePath) {
    await runFfmpeg(`shot-mux-s${sceneIndex}`, (cmd) => {
      cmd.input(concatVisual).input(voicePath);
      cmd.outputOptions([
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-t', totalDur.toFixed(3),
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
      ]);
      cmd.output(outPath);
    });
  } else {
    await fs.copy(concatVisual, outPath);
  }

  return outPath;
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
  if (!subtitlesKey) {
    console.log('📝 [assembly] no subtitlesKey -- final cut will have NO captions');
    return null;
  }
  const local = path.join(tmpDir, 'subtitles.srt');
  try {
    if (r2Service.isConfigured()) {
      await r2Service.downloadToFile(subtitlesKey, local);
    } else {
      await fs.copy(subtitlesKey, local);
    }
  } catch (err) {
    console.warn(`⚠️  [assembly] failed to download SRT (${subtitlesKey}): ${err.message}`);
    return null;
  }
  let bytes = 0;
  let cues = 0;
  try {
    const stat = await fs.stat(local);
    bytes = stat.size;
    const text = await fs.readFile(local, 'utf8');
    cues = (text.match(/-->/g) || []).length;
  } catch {
    /* size/cue logging is best-effort */
  }
  console.log(`📝 [assembly] SRT downloaded: ${local} (${bytes} bytes, ${cues} cues)`);
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
    const libassNotes = [];
    cmd
      .on('start', (cli) => {
        console.log(`▶️  [assembly:${label}] ${cli}`);
      })
      .on('stderr', (line) => {
        stderrTail.push(line);
        if (stderrTail.length > 40) stderrTail.shift();
        // Surface anything libass / subtitles related on success too --
        // those warnings (font missing, glyphs not found, codepage
        // fallback) explain "no captions on screen" failures that ffmpeg
        // otherwise considers a clean exit.
        if (
          /libass|fontselect|font_select|Glyph .* not found|font.*not found|Could not load font|Subtitle|subtitles|\[ass /i.test(
            line
          )
        ) {
          libassNotes.push(line);
        }
      })
      .on('end', () => {
        if (libassNotes.length) {
          console.log(
            `📝 [assembly:${label}] libass notes (${libassNotes.length}):\n${libassNotes.slice(-20).join('\n')}`
          );
        }
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
    // Optional, parallel to sceneVideoKeys. When a scene's plan has
    // `shots: [{ videoKey, durationSeconds }]` the assembler renders a
    // multi-shot bake (hard cuts between shots, voice across the cuts)
    // instead of using the single sceneVideoKey. Single-shot scenes keep
    // working with no plan supplied.
    scenePlans = null,
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
    const multiShotInputs = await downloadMultiShotInputs(scenePlans, tmpDir);

    // For each scene: either bake a multi-shot scene (hard cuts between
    // shot videos with voice across the cuts) OR run the legacy
    // bake-voice-into-single-clip path. Both produce a per-scene MP4
    // that the downstream concat treats identically.
    const clipPaths = [];
    for (let i = 0; i < rawClipPaths.length; i++) {
      const baked = path.join(tmpDir, `scene-${String(i).padStart(3, '0')}-vo.mp4`);
      const shots = multiShotInputs[i];
      if (shots && shots.length > 0) {
        await bakeMultiShotScene(shots, voicePaths[i] || null, i, baked, tmpDir);
      } else {
        await bakeVoiceIntoClip(rawClipPaths[i], voicePaths[i] || null, baked);
      }
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
          .complexFilter(filters)
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
        const subFilter = buildSubtitleFilter(srtPath, subtitleSettings || {}, {
          fontsDir: subtitleFontsDir,
        });
        console.log(`📝 [assembly] burning subtitles via filter: ${subFilter}`);
        console.log(
          `📝 [assembly] subtitle fontsdir=${subtitleFontsDir || '(none)'} requested font="${(subtitleSettings && subtitleSettings.fontName) || 'Inter'}"`
        );
        vFilters.push(subFilter);
      } else {
        console.log('📝 [assembly] no SRT path -- skipping subtitles filter');
      }
      // verbose loglevel so libass font-loading warnings reach our stderr
      // capture (silent fallback is what bit us before).
      cmd.outputOptions(['-loglevel', 'verbose']);

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
  await fs.ensureDir(path.dirname(path.resolve(outPath)));
  const inP = toFfmpegIoPath(inputPath);
  const outP = toFfmpegIoPath(outPath);
  await new Promise((resolve, reject) => {
    ffmpeg(inP)
      .inputOptions(['-ss', String(seconds)])
      .outputOptions(['-c', 'copy', '-y'])
      .output(outP)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return outPath;
}

/**
 * Utility: concat hook clip + tail.
 *
 * The concat filter requires every input to have the same stream layout
 * (video + audio in our case). If either source is missing audio --
 * commonly the tail when the original final video was assembled with no
 * voice (FFmpeg emits `-an`) -- referencing `[1:a]` causes
 * "Error opening output files: Invalid argument" with no useful message.
 * We probe both inputs and synthesise a silent audio track for any input
 * that lacks one so the concat always succeeds.
 */
async function spliceHook(hookPath, tailPath, outPath) {
  await fs.ensureDir(path.dirname(path.resolve(outPath)));
  const hookP = toFfmpegIoPath(hookPath);
  const tailP = toFfmpegIoPath(tailPath);
  const outP = toFfmpegIoPath(outPath);

  const [hookHasAudio, tailHasAudio, hookDur, tailDur] = await Promise.all([
    hasAudioStream(hookPath),
    hasAudioStream(tailPath),
    probeDurationSeconds(hookPath),
    probeDurationSeconds(tailPath),
  ]);

  await new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(hookP).input(tailP);

    // Synthesise silent audio inside the filter graph for any input
    // missing it (avoids fluent-ffmpeg's lavfi-input validation). The
    // synthesised stream's duration matches the video so concat aligns.
    const filterParts = [];
    let hookAudioLabel = '0:a';
    let tailAudioLabel = '1:a';

    if (!hookHasAudio) {
      const d = Math.max(0.1, Number(hookDur) || 60);
      filterParts.push(`aevalsrc=0:c=stereo:s=44100:d=${d.toFixed(3)}[ahook]`);
      hookAudioLabel = 'ahook';
    }
    if (!tailHasAudio) {
      const d = Math.max(0.1, Number(tailDur) || 60);
      filterParts.push(`aevalsrc=0:c=stereo:s=44100:d=${d.toFixed(3)}[atail]`);
      tailAudioLabel = 'atail';
    }
    filterParts.push(
      `[0:v][${hookAudioLabel}][1:v][${tailAudioLabel}]concat=n=2:v=1:a=1[v][a]`
    );

    // NOTE: do NOT pass the maps array (2nd arg of complexFilter) when
    // we also include explicit `-map [v] -map [a]` in outputOptions --
    // fluent-ffmpeg appends them and ffmpeg sees the labels twice,
    // producing the cryptic
    //   "Output with label 'v' does not exist ... or was already used"
    //   "Error opening output files: Invalid argument"
    // failure that previously broke every hook variant.
    cmd
      .complexFilter(filterParts)
      .outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-y',
      ])
      .output(outP)
      .on('start', (cli) => console.log(`▶️  [splice-hook] ${cli}`))
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        const tail = String(stderr || '').split(/\r?\n/).slice(-15).join('\n');
        reject(new Error(`${err.message}\nstderr tail:\n${tail}`));
      })
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
  probeDurationSeconds,
  trimLeading,
  spliceHook,
  cleanupTmpDir,
  toFfmpegIoPath,
};
