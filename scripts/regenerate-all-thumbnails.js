/**
 * Regenerate All Thumbnails
 * Scans all videos in the output folder and generates thumbnails for them
 */

const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const THUMBNAILS_DIR = path.join(OUTPUT_DIR, 'thumbnails');

async function regenerateAllThumbnails() {
  try {
    console.log('🎬 Starting thumbnail regeneration...\n');

    // Ensure thumbnails directory exists
    await fs.ensureDir(THUMBNAILS_DIR);
    console.log(`✅ Thumbnails directory ready: ${THUMBNAILS_DIR}\n`);

    // Get all MP4 files in output directory
    const files = await fs.readdir(OUTPUT_DIR);
    const videoFiles = files.filter(file => 
      file.endsWith('.mp4') && !file.includes('thumbnail')
    );

    console.log(`📹 Found ${videoFiles.length} video file(s)\n`);

    if (videoFiles.length === 0) {
      console.log('ℹ️  No videos found to process');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < videoFiles.length; i++) {
      const videoFile = videoFiles[i];
      const videoPath = path.join(OUTPUT_DIR, videoFile);
      const thumbnailFilename = `${path.basename(videoFile, '.mp4')}.jpg`;
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      console.log(`[${i + 1}/${videoFiles.length}] Processing: ${videoFile}`);

      // Check if thumbnail already exists
      if (await fs.pathExists(thumbnailPath)) {
        console.log(`   ⏭️  Thumbnail already exists, skipping\n`);
        successCount++;
        continue;
      }

      try {
        // Generate thumbnail
        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .screenshots({
              timestamps: ['00:00:02'],
              filename: thumbnailFilename,
              folder: THUMBNAILS_DIR,
              size: '640x?'
            })
            .on('end', () => {
              console.log(`   ✅ Thumbnail generated: ${thumbnailFilename}\n`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`   ❌ Error: ${err.message}\n`);
              reject(err);
            });
        });
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to generate thumbnail for ${videoFile}: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Total videos: ${videoFiles.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
regenerateAllThumbnails()
  .then(() => {
    console.log('\n✅ Thumbnail regeneration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Thumbnail regeneration failed:', error);
    process.exit(1);
  });

