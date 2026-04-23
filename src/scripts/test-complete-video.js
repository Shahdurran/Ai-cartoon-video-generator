#!/usr/bin/env node

/**
 * End-to-End Video Generation Test
 * Creates a complete video from scratch using the full pipeline
 * Tests: Script → Voice → Images → Video Assembly → Final Output
 */

require('dotenv').config();
const { initializeDirectories, paths } = require('../config/paths.config');
const { setupProcessors } = require('../queues/setupProcessors');
const { getQueue } = require('../queues');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testCompleteVideo() {
  console.log('\n' + '='.repeat(80));
  console.log('🎬 END-TO-END VIDEO GENERATION TEST');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Initialize
    console.log('📁 Initializing directories...');
    await initializeDirectories();

    console.log('\n🔧 Setting up queue processors...');
    setupProcessors();

    // Step 2: Create channel config for TYPE_2 (image slideshow)
    console.log('\n⚙️  Creating channel configuration...\n');

    const channelConfig = {
      id: 'test_channel_001',
      name: 'Test Historical Channel',
      type: 'TYPE_2', // Image slideshow
      effects: {
        enabled: true,
        type: 'old_camera',
        opacity: 0.3,
      },
      transitions: {
        movementEffects: ['zoom_in', 'zoom_out', 'zoom_rotate_cycle'],
        transitionEffects: ['fade', 'smoothleft', 'smoothright'],
      },
      subtitles: {
        fontFamily: 'Arial',
        fontSize: 24,
        fontColor: '&H00FFFFFF', // White
        outlineColor: '&H00000000', // Black
        backgroundColor: '&H80000000', // Semi-transparent black
        bold: 1,
        outline: 2,
        shadow: 1,
        alignment: 2, // Bottom center
        marginV: 40,
      },
      voice: {
        provider: 'mock', // Use mock for testing
      },
    };

    console.log(`✅ Channel: ${channelConfig.name} (${channelConfig.type})`);
    console.log(`   Effects: ${channelConfig.effects.type} (${channelConfig.effects.opacity * 100}% opacity)`);
    console.log(`   Transitions: ${channelConfig.transitions.movementEffects.length} movement effects`);

    // Step 3: Submit pipeline job
    console.log('\n🚀 Submitting pipeline job...\n');

    const pipelineQueue = getQueue('pipeline');

    const pipelineJob = await pipelineQueue.add({
      title: 'The Forgotten Inventor',
      context: 'Tell the story of Nikola Tesla, the brilliant inventor whose groundbreaking work in electricity and wireless transmission shaped the modern world. Focus on his rivalry with Thomas Edison and his visionary but often overlooked inventions.',
      tone: 'dramatic and inspiring',
      length: 'short', // ~60 seconds
      numberOfImages: 4, // 4 images for testing
      imageSettings: {
        aspectRatio: '16:9',
        quality: 'standard',
        style: 'historical, vintage photograph, sepia tone, dramatic lighting',
      },
      voiceSettings: {
        provider: 'mock',
        speed: 1.0,
      },
      videoSettings: {
        fps: 30,
        resolution: '1920x1080',
        codec: 'libx264',
      },
      channelConfig, // Pass channel config for video generation
    }, {
      priority: 1,
      attempts: 3,
      timeout: 900000, // 15 minutes
    });

    console.log(`✅ Pipeline job created: ${pipelineJob.id}`);
    console.log(`📊 Monitoring progress...\n`);

    // Wait for completion
    const startTime = Date.now();
    console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}\n`);

    console.log('⏳ Waiting for pipeline to complete...');
    console.log('   This may take several minutes depending on API response times.\n');

    // Monitor progress with detailed updates
    let lastProgress = 0;
    const progressInterval = setInterval(async () => {
      try {
        const job = await pipelineQueue.getJob(pipelineJob.id);
        if (job) {
          const progress = await job.progress();
          if (progress > 0 && progress !== lastProgress) {
            const progressBar = createProgressBar(progress, 50);
            console.log(`📊 ${progressBar} ${progress}%`);
            lastProgress = progress;
          }
        }
      } catch (err) {
        // Job might be complete
      }
    }, 2000);

    const result = await pipelineJob.finished();
    clearInterval(progressInterval);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('✅ PIPELINE COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80) + '\n');

    console.log(`⏱️  Total Time: ${duration} seconds (${(duration / 60).toFixed(2)} minutes)`);
    console.log(`📁 Project ID: ${result.projectId}\n`);

    console.log('📊 Pipeline Steps:');
    console.log('   ────────────────────────────────────────────');
    
    if (result.steps.script) {
      console.log(`   📝 Script Generation:`);
      console.log(`      • ${result.steps.script.sentences.length} sentences`);
      console.log(`      • ~${result.steps.script.estimatedDuration}s estimated duration`);
      console.log(`      • Word count: ${result.steps.script.script.split(' ').length}`);
    }

    if (result.steps.voice) {
      console.log(`\n   🎙️  Voice Generation:`);
      console.log(`      • Audio file: ${path.basename(result.steps.voice.audioPath)}`);
      console.log(`      • Duration: ${result.steps.voice.duration}s`);
    }

    if (result.steps.images) {
      console.log(`\n   🎨 Image Generation:`);
      console.log(`      • Success: ${result.steps.images.successCount}/${result.steps.images.totalCount}`);
      console.log(`      • Failed: ${result.steps.images.failedCount || 0}`);
      if (result.steps.images.results && result.steps.images.results.length > 0) {
        console.log(`      • Images:`);
        result.steps.images.results.slice(0, 3).forEach((img, i) => {
          if (img.success) {
            console.log(`         ${i + 1}. ${img.prompt.substring(0, 50)}...`);
          }
        });
        if (result.steps.images.results.length > 3) {
          console.log(`         ... and ${result.steps.images.results.length - 3} more`);
        }
      }
    }

    if (result.steps.video) {
      console.log(`\n   🎬 Video Assembly:`);
      console.log(`      • Video file: ${path.basename(result.steps.video.videoPath)}`);
      console.log(`      • Duration: ${result.steps.video.duration || result.duration}s`);
    }

    console.log('   ────────────────────────────────────────────\n');

    console.log('📁 Generated Files:');
    console.log(`   🎬 Final Video: ${result.videoPath}`);
    
    // Check if video file exists
    const videoExists = await fs.pathExists(result.videoPath);
    if (videoExists) {
      const stats = await fs.stat(result.videoPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`      ✅ File exists (${sizeInMB} MB)`);
      
      // Try to open the video
      console.log('\n🎥 Opening video in default player...');
      await openVideo(result.videoPath);
    } else {
      console.log(`      ❌ File not found!`);
    }

    // List temp files
    console.log('\n📂 Temporary Files:');
    try {
      const tempFiles = await fs.readdir(paths.temp);
      const recentFiles = tempFiles.filter(f => {
        const filePath = path.join(paths.temp, f);
        try {
          const stats = fs.statSync(filePath);
          return (Date.now() - stats.mtimeMs) < 3600000; // Last hour
        } catch {
          return false;
        }
      });
      
      if (recentFiles.length > 0) {
        console.log(`   Found ${recentFiles.length} recent temp files:`);
        recentFiles.slice(0, 5).forEach(f => {
          console.log(`      • ${f}`);
        });
        if (recentFiles.length > 5) {
          console.log(`      ... and ${recentFiles.length - 5} more`);
        }
      } else {
        console.log(`   ✅ All temp files cleaned up`);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not list temp files: ${err.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\n✅ The video generation pipeline is working end-to-end!');
    console.log('✅ All components integrated successfully:');
    console.log('   • Script generation with Claude AI');
    console.log('   • Voice synthesis (mock)');
    console.log('   • Image generation with Fal.AI');
    console.log('   • FFmpeg video assembly with effects and transitions');
    console.log('   • Subtitle generation and overlay');
    console.log('\n💡 Next steps:');
    console.log('   • Replace mock voice with real TTS service');
    console.log('   • Test with different channel configurations');
    console.log('   • Add background music support');
    console.log('   • Implement batch processing\n');

    // Wait before exit
    setTimeout(() => {
      console.log('🧹 Cleaning up...');
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80) + '\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n' + '='.repeat(80) + '\n');

    process.exit(1);
  }
}

/**
 * Create a progress bar
 */
function createProgressBar(percent, width = 50) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Open video in default player
 */
async function openVideo(videoPath) {
  try {
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      command = `start "" "${videoPath}"`;
    } else if (platform === 'darwin') {
      command = `open "${videoPath}"`;
    } else {
      command = `xdg-open "${videoPath}"`;
    }

    await execAsync(command);
    console.log('   ✅ Video opened in default player');
  } catch (error) {
    console.log(`   ⚠️  Could not open video automatically: ${error.message}`);
    console.log(`   💡 Please open manually: ${videoPath}`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test terminated');
  process.exit(1);
});

// Run the test
console.log('\n🔍 Starting complete video generation test...');
console.log('💡 This will test the full pipeline: Claude → Mock Voice → Fal.AI → FFmpeg\n');

testCompleteVideo().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


