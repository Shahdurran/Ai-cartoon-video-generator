/**
 * SRT utilities.
 *
 * - formatSRT(words, options): group AssemblyAI word-level timestamps into
 *   subtitle cues based on max line length and max lines per cue.
 * - offsetSRT(srt, offsetMs): shift every timestamp in an SRT string by N ms.
 * - concatSRT([srt1, srt2, ...], [durations]): join per-scene SRTs into a
 *   single timeline by adding cumulative offsets.
 */

function msToSrtTime(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const millis = ms - totalSeconds * 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(millis, 3)}`;
}

function srtTimeToMs(t) {
  const [hms, ms] = t.split(',');
  const [h, m, s] = hms.split(':').map(Number);
  return ((h * 3600 + m * 60 + s) * 1000) + Number(ms);
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

/**
 * Group AssemblyAI words into cues.
 *
 * @param {Array<{text:string,start:number,end:number}>} words - ms timestamps
 * @param {object} options
 * @param {number} [options.maxCharsPerLine=32]
 * @param {number} [options.maxLines=2]
 * @param {number} [options.maxCueDurationMs=4000]
 * @returns {string} SRT content
 */
function formatSRT(words, options = {}) {
  const {
    maxCharsPerLine = 32,
    maxLines = 2,
    maxCueDurationMs = 4000,
  } = options;

  if (!Array.isArray(words) || words.length === 0) return '';

  const cues = [];
  let currentLines = [''];
  let currentStart = words[0].start;
  let currentEnd = words[0].end;

  function flushCue() {
    if (currentLines.every((l) => !l.trim())) return;
    cues.push({
      start: currentStart,
      end: currentEnd,
      text: currentLines.map((l) => l.trim()).filter(Boolean).join('\n'),
    });
    currentLines = [''];
  }

  for (const w of words) {
    const word = (w.text || '').trim();
    if (!word) continue;

    const lastLine = currentLines[currentLines.length - 1];
    const candidate = lastLine ? `${lastLine} ${word}` : word;

    // Starting a new cue group?
    if (currentLines[0] === '') {
      currentStart = w.start;
    }

    const cueWouldBeTooLong = (w.end - currentStart) > maxCueDurationMs;

    if (cueWouldBeTooLong) {
      flushCue();
      currentLines = [word];
      currentStart = w.start;
      currentEnd = w.end;
      continue;
    }

    if (candidate.length <= maxCharsPerLine) {
      currentLines[currentLines.length - 1] = candidate;
      currentEnd = w.end;
    } else {
      // Line full — start a new one, or flush cue if we're out of lines.
      if (currentLines.length >= maxLines) {
        flushCue();
        currentLines = [word];
        currentStart = w.start;
      } else {
        currentLines.push(word);
      }
      currentEnd = w.end;
    }
  }

  flushCue();

  return cues
    .map((c, i) => `${i + 1}\n${msToSrtTime(c.start)} --> ${msToSrtTime(c.end)}\n${c.text}\n`)
    .join('\n');
}

function offsetSRT(srt, offsetMs) {
  if (!srt) return '';
  return srt.replace(
    /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/g,
    (_m, start, end) =>
      `${msToSrtTime(srtTimeToMs(start) + offsetMs)} --> ${msToSrtTime(srtTimeToMs(end) + offsetMs)}`
  );
}

function concatSRT(srts, sceneDurationsSeconds) {
  let offsetMs = 0;
  const parts = [];
  let cueIndex = 1;
  for (let i = 0; i < srts.length; i++) {
    const shifted = offsetSRT(srts[i] || '', offsetMs);
    // Renumber cues to be globally unique.
    const renumbered = shifted.replace(/^\d+$/gm, () => String(cueIndex++));
    parts.push(renumbered.trim());
    offsetMs += Math.round((sceneDurationsSeconds[i] || 0) * 1000);
  }
  return parts.filter(Boolean).join('\n\n') + '\n';
}

module.exports = { formatSRT, offsetSRT, concatSRT, msToSrtTime, srtTimeToMs };
