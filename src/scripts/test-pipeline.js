#!/usr/bin/env node

/**
 * Test the complete video generation pipeline
 * This script tests the end-to-end workflow:
 * Script Generation → Voice Generation → Image Generation → Video Assembly
 */

require('dotenv').config();
const { initializeDirectories } = require('../config/paths.config');
const { setupProcessors } = require('../queues/setupProcessors');
const { getQueue } = require('../queues');

async function testPipeline() {
  console.log('\n' + '='.repeat(80));
  console.log('🎬 VIDEO GENERATION PIPELINE TEST');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Initialize
    console.log('📁 Initializing directories...');
    await initializeDirectories();

    console.log('\n🔧 Setting up queue processors...');
    setupProcessors();

    // Step 2: Create a test pipeline job
    console.log('\n🚀 Creating pipeline job...\n');

    const pipelineQueue = getQueue('pipeline');

    const pipelineJob = await pipelineQueue.add({
      title: 'The Rise and Fall of Ancient Rome',
      context: 'Focus on the economic and political factors that led to both the rise and eventual collapse of the Roman Empire. Highlight key figures like Julius Caesar and Augustus.',
      tone: 'educational',
      length: 'short', // Short script for testing
      numberOfImages: 3, // Only 3 images for faster testing
      imageSettings: {
        aspectRatio: '16:9',
        quality: 'standard',
        style: 'historical, cinematic',
      },
      voiceSettings: {
        // Using mock voice for now
      },
      videoSettings: {
        fps: 30,
        resolution: '1920x1080',
        codec: 'libx264',
      },
    }, {
      priority: 1,
      attempts: 2,
      timeout: 600000, // 10 minutes
    });

    console.log(`✅ Pipeline job created: ${pipelineJob.id}`);
    console.log(`📊 Monitoring progress...\n`);

    // Wait for completion
    const startTime = Date.now();
    console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}\n`);

    // Monitor progress in background
    const progressInterval = setInterval(async () => {
      try {
        const job = await pipelineQueue.getJob(pipelineJob.id);
        if (job) {
          const progress = await job.progress();
          if (progress > 0) {
            console.log(`📊 Overall Progress: ${progress}%`);
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

    console.log('\n' + '='.repeat(80));
    console.log('✅ PIPELINE COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80) + '\n');

    console.log(`⏱️  Total Time: ${duration} seconds`);
    console.log(`📁 Project ID: ${result.projectId}`);
    console.log(`🎬 Video Path: ${result.videoPath}`);
    console.log(`⏰ Video Duration: ${result.duration}s\n`);

    console.log('📊 Step Results:');
    console.log(`   📝 Script: ${result.steps.script.sentences.length} sentences, ~${result.steps.script.estimatedDuration}s`);
    console.log(`   🎙️  Voice: ${result.steps.voice.audioPath}`);
    console.log(`   🎨 Images: ${result.steps.images.successCount}/${result.steps.images.totalCount} generated`);
    console.log(`   🎬 Video: ${result.steps.video.videoPath}\n`);

    console.log('='.repeat(80));
    console.log('🎉 TEST PASSED! Pipeline is working end-to-end!');
    console.log('='.repeat(80) + '\n');

    // Cleanup
    setTimeout(() => {
      console.log('🧹 Cleaning up...');
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ PIPELINE TEST FAILED');
    console.error('='.repeat(80) + '\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('\n' + '='.repeat(80) + '\n');

    process.exit(1);
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
console.log('\n🔍 Starting pipeline test...');
console.log('💡 This will test: Claude API → Mock Voice → Fal.AI Images → FFmpeg Video\n');

testPipeline().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

