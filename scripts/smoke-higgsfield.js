/**
 * Quick smoke test for the Higgsfield Soul integration. Submits one
 * generation and prints the time + image URL. Run with `node scripts/smoke-higgsfield.js`.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const higgsfield = require('../src/services/higgsfieldImageService');

async function main() {
  if (!higgsfield.isConfigured()) {
    console.error('❌ HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET missing in .env');
    process.exit(1);
  }
  console.log('→ Submitting Higgsfield Soul test generation…');
  const t0 = Date.now();
  const result = await higgsfield.generateOne({
    prompt: 'A friendly cartoon mascot waving in a sunlit park, vibrant colours, flat illustration',
    aspectRatio: '16:9',
    resolution: '720p',
  });
  console.log(`✅ Done in ${result.elapsedMs}ms (total wall ${Date.now() - t0}ms)`);
  console.log(`   request_id: ${result.requestId}`);
  console.log(`   url: ${result.url}`);
}

main().catch((err) => {
  console.error('❌ Higgsfield smoke failed:', err.message);
  process.exit(1);
});
