/**
 * Normalize a value from process.env: BOM, trim, outer quotes (common when
 * pasting keys into .env files).
 */
function normalizeEnvString(val) {
  if (val === undefined || val === null) return null;
  let s = String(val).replace(/^\uFEFF/, '').trim();
  if (!s) return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s || null;
}

module.exports = { normalizeEnvString };
