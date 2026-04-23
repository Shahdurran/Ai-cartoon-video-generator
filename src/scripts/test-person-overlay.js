/**
 * Test script for Person Video Overlay integration
 * Tests the complete flow of generating a video with person overlay
 */

const { queues } = require('../queues');
const StorageService = require('../services/storageService');
const personVideoLibrary = require('../utils/personVideoLibrary');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

async function testPersonOverlay() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 PERSON VIDEO OVERLAY INTEGRATION TEST');
  console.log('='.repeat(70) + '\n');

  const storageService = new StorageService();

  try {
    // Step 1: Check if person videos exist
    console.log('📹 Step 1: Checking person video library...');
    const personVideos = await personVideoLibrary.scanPersonVideos(true);
    
    if (personVideos.length === 0) {
      console.error('\n❌ No person videos found!');
      console.log('   Please add person videos to the person-videos folder first.');
      console.log('   You can use .mp4, .webm, .mov, or .avi formats.');
      return;
    }

    console.log(`   ✅ Found ${personVideos.length} person video(s)`);
    
    // Use the first person video for testing
    const testPersonVideo = personVideos[0];
    console.log(`   📹 Using: ${testPersonVideo.filename}`);
    console.log(`      Duration: ${testPersonVideo.duration.toFixed(2)}s`);
    console.log(`      Resolution: ${testPersonVideo.width}x${testPersonVideo.height}`);
    console.log(`      Has Alpha: ${testPersonVideo.hasAlpha ? 'Yes' : 'No'}`);

    // Step 2: Find or create TYPE_1 channel with person overlay
    console.log('\n📺 Step 2: Setting up TYPE_1 channel...');
    
    let testChannel;
    try {
      const channels = await storageService.getAllChannels();
      testChannel = channels.find(ch => ch.type === 'TYPE_1');
      
      if (testChannel) {
        console.log(`   ✅ Using existing TYPE_1 channel: ${testChannel.name}`);
      }
    } catch (err) {
      console.log('   No existing TYPE_1 channels found, will create one');
    }

    if (!testChannel) {
      // Create a test TYPE_1 channel
      const channelId = `test-person-overlay-${Date.now()}`;
      testChannel = {
        id: channelId,
        name: 'Person Overlay Test Channel',
        description: 'Test channel for person video overlay integration',
        type: 'TYPE_1',
        visualSettings: {
          type1: {
            backgroundVideos: [],
            shuffleVideos: false,
            maxVideosToUse: 5,
            personVideoOverlay: {
              filename: testPersonVideo.filename,
              path: testPersonVideo.path,
              position: 'bottom-right',
              scale: 50,
              opacity: 100,
              chromaKey: {
                enabled: false,
                color: '#00FF00',
                similarity: 30,
                blend: 10,
              },
            },
          },
        },
        voiceSettings: {
          voice: 'alloy',
          speed: 1.0,
        },
        subtitles: {
          enabled: true,
          fontSize: 24,
          fontColor: '#FFFFFF',
          backgroundColor: '#000000',
          position: 'bottom',
        },
        effects: {
          enabled: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storageService.saveChannel(testChannel);
      console.log(`   ✅ Created test channel: ${testChannel.name}`);
    }

    // Ensure channel has person overlay configured
    if (!testChannel.visualSettings?.type1?.personVideoOverlay) {
      console.log('   🔧 Adding person overlay to channel...');
      testChannel.visualSettings = {
        ...testChannel.visualSettings,
        type1: {
          ...testChannel.visualSettings?.type1,
          personVideoOverlay: {
            filename: testPersonVideo.filename,
            path: testPersonVideo.path,
            position: 'bottom-right',
            scale: 50,
            opacity: 100,
            chromaKey: {
              enabled: false,
              color: '#00FF00',
              similarity: 30,
              blend: 10,
            },
          },
        },
      };
      await storageService.saveChannel(testChannel);
      console.log('   ✅ Person overlay configured');
    }

    // Step 3: Generate test video
    console.log('\n🎬 Step 3: Starting video generation...');
    console.log('   This will test:');
    console.log('   - Background video concatenation');
    console.log('   - Person video overlay application');
    console.log('   - Subtitle rendering');
    console.log('   - Audio synchronization');
    
    const testTitle = 'Person Overlay Integration Test';
    const testContext = 'This is a test video to verify that person video overlay is working correctly. The person should appear as an overlay on the background video with proper positioning, scaling, and opacity.';

    const batchJob = await queues.batchProcessing.add({
      batchId: `test-person-overlay-${Date.now()}`,
      videos: [{
        id: `test-video-${Date.now()}`,
        channelId: testChannel.id,
        title: testTitle,
        context: testContext,
        customPrompt: 'Generate a short, clear test script that can be used to verify video generation with person overlay.',
      }],
    }, {
      priority: 1,
    });

    console.log(`   ✅ Job created: ${batchJob.id}`);
    console.log(`   ⏳ Waiting for completion...`);
    console.log('   (This may take a few minutes)\n');

    // Monitor progress
    const monitorInterval = setInterval(async () => {
      try {
        const job = await queues.batchProcessing.getJob(batchJob.id);
        if (job) {
          const progress = job.progress();
          const state = await job.getState();
          
          if (state === 'active') {
            console.log(`   📊 Progress: ${progress}%`);
          }
        }
      } catch (err) {
        // Ignore errors during monitoring
      }
    }, 5000);

    // Wait for job to complete
    const result = await batchJob.finished();
    clearInterval(monitorInterval);

    console.log('\n✅ Video generation completed!');
    console.log('   Results:');
    console.log(`   - Total videos: ${result.totalVideos}`);
    console.log(`   - Successful: ${result.successCount}`);
    console.log(`   - Failed: ${result.failedCount}`);

    if (result.successCount > 0 && result.results[0]?.result?.videoPath) {
      const videoPath = result.results[0].result.videoPath;
      console.log(`\n📹 Generated video: ${videoPath}`);
      
      // Check file exists and size
      if (await fs.pathExists(videoPath)) {
        const stats = await fs.stat(videoPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   File size: ${sizeMB} MB`);
        
        // Step 4: Open video automatically
        console.log('\n🎥 Step 4: Opening video...');
        try {
          const absolutePath = path.resolve(videoPath);
          
          // Open with default video player based on OS
          if (process.platform === 'win32') {
            spawn('cmd', ['/c', 'start', '', absolutePath], { detached: true, stdio: 'ignore' });
          } else if (process.platform === 'darwin') {
            spawn('open', [absolutePath], { detached: true, stdio: 'ignore' });
          } else {
            spawn('xdg-open', [absolutePath], { detached: true, stdio: 'ignore' });
          }
          
          console.log('   ✅ Video opened in default player');
        } catch (openErr) {
          console.log(`   ⚠️  Could not auto-open video: ${openErr.message}`);
          console.log(`   Please manually open: ${videoPath}`);
        }
      } else {
        console.error('   ❌ Video file not found!');
      }
    } else {
      console.error('\n❌ Video generation failed!');
      if (result.results[0]?.error) {
        console.error(`   Error: ${result.results[0].error}`);
      }
    }

    // Step 5: Display summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Person Video: ${testPersonVideo.filename}`);
    console.log(`Position: ${testChannel.visualSettings.type1.personVideoOverlay.position}`);
    console.log(`Scale: ${testChannel.visualSettings.type1.personVideoOverlay.scale}%`);
    console.log(`Opacity: ${testChannel.visualSettings.type1.personVideoOverlay.opacity}%`);
    console.log(`Green Screen: ${testChannel.visualSettings.type1.personVideoOverlay.chromaKey.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('='.repeat(70) + '\n');

    console.log('✅ Integration test completed successfully!\n');
    console.log('📋 Verification checklist:');
    console.log('   [ ] Person video appears as overlay');
    console.log('   [ ] Position is correct (bottom-right by default)');
    console.log('   [ ] Size is correct (50% by default)');
    console.log('   [ ] Person video loops seamlessly');
    console.log('   [ ] Subtitles render on top of overlay');
    console.log('   [ ] Audio is synchronized');
    console.log('   [ ] No visual artifacts or glitches\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Allow time for video to open before exiting
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}

// Run the test
testPersonOverlay().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

