#!/usr/bin/env node

/**
 * API Integration Test Script
 * Tests all external API integrations independently
 */

require('dotenv').config();
const path = require('path');

// Import services
const ClaudeService = require('../services/claudeService');
const VoiceService = require('../services/voiceService');
const ImageService = require('../services/imageService');

// Color output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  log(colors.bright, '🧪 API INTEGRATION TESTS');
  console.log('='.repeat(60) + '\n');

  const results = {
    claude: { tested: false, success: false, error: null, time: 0, data: null },
    genaipro: { tested: false, success: false, error: null, time: 0, data: null },
    falImages: { tested: false, success: false, error: null, time: 0, data: null },
  };

  // Test 1: Claude API
  log(colors.cyan, '\n📝 TEST 1: Claude API (Script Generation)');
  log(colors.cyan, '-'.repeat(60));
  try {
    const claudeService = new ClaudeService();
    const startTime = Date.now();
    
    const script = await claudeService.generateScript({
      title: "The Fall of Rome",
      context: "Focus on the economic factors that led to the collapse",
      tone: "educational",
      length: "short",
    });

    results.claude = {
      tested: true,
      success: true,
      error: null,
      time: Date.now() - startTime,
      data: {
        scriptLength: script.script.length,
        sentences: script.sentences.length,
        estimatedDuration: script.estimatedDuration,
        model: script.metadata.model,
        tokens: script.metadata.totalTokens,
      },
    };

    log(colors.green, '✅ Claude API PASSED');
    console.log(`   Model: ${script.metadata.model}`);
    console.log(`   Script: ${script.script.substring(0, 100)}...`);
    console.log(`   Sentences: ${script.sentences.length}`);
    console.log(`   Duration: ~${script.estimatedDuration}s`);
    console.log(`   Tokens: ${script.metadata.totalTokens}`);
    console.log(`   Time: ${results.claude.time}ms`);
  } catch (error) {
    results.claude = {
      tested: true,
      success: false,
      error: error.message,
      time: 0,
      data: null,
    };
    log(colors.red, '❌ Claude API FAILED');
    console.log(`   Error: ${error.message}`);
  }

  // Test 2: Genaipro.vn Voice
  log(colors.cyan, '\n🎙️  TEST 2: Genaipro.vn (Voice Generation)');
  log(colors.cyan, '-'.repeat(60));
  try {
    const voiceService = new VoiceService();
    const startTime = Date.now();
    
    const voice = await voiceService.generateVoice(
      "Hello world, this is a test of the Genaipro voice generation system.",
      { provider: 'genaipro', voice: 'alloy', speed: 1.0 }
    );

    results.genaipro = {
      tested: true,
      success: true,
      error: null,
      time: Date.now() - startTime,
      data: {
        audioPath: voice.audioPath,
        fileSize: voice.metadata.fileSize,
        duration: voice.duration,
        provider: voice.provider,
      },
    };

    log(colors.green, '✅ Genaipro.vn PASSED');
    console.log(`   Provider: ${voice.provider}`);
    console.log(`   Audio file: ${voice.audioPath}`);
    console.log(`   File size: ${(voice.metadata.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   Duration: ~${voice.duration}s`);
    console.log(`   Time: ${results.genaipro.time}ms`);
  } catch (error) {
    results.genaipro = {
      tested: true,
      success: false,
      error: error.message,
      time: 0,
      data: null,
    };
    log(colors.red, '❌ Genaipro.vn FAILED');
    console.log(`   Error: ${error.message}`);
  }

  // Test 3: Fal.AI Images
  log(colors.cyan, '\n🎨 TEST 3: Fal.AI (Image Generation)');
  log(colors.cyan, '-'.repeat(60));
  try {
    const imageService = new ImageService();
    const startTime = Date.now();
    
    const images = await imageService.generateImages([
      "A medieval blacksmith working in a forge, high quality, detailed",
      "Ancient Roman soldiers marching through city streets, cinematic"
    ], {
      aspectRatio: '16:9',
      quality: 'standard',
      model: 'flux-dev',
    });

    const successfulImages = images.filter(img => img.success);

    results.falImages = {
      tested: true,
      success: successfulImages.length > 0,
      error: successfulImages.length === 0 ? 'All images failed' : null,
      time: Date.now() - startTime,
      data: {
        totalImages: images.length,
        successCount: successfulImages.length,
        images: successfulImages.map(img => ({
          path: img.imagePath,
          size: img.metadata.fileSize,
        })),
      },
    };

    if (successfulImages.length > 0) {
      log(colors.green, `✅ Fal.AI Images PASSED (${successfulImages.length}/${images.length})`);
      successfulImages.forEach((img, i) => {
        console.log(`   Image ${i + 1}: ${img.imagePath}`);
        console.log(`   Size: ${(img.metadata.fileSize / 1024).toFixed(2)} KB`);
        console.log(`   Prompt: ${img.prompt.substring(0, 50)}...`);
      });
      console.log(`   Total time: ${results.falImages.time}ms`);
    } else {
      log(colors.red, '❌ Fal.AI Images FAILED');
      images.forEach((img, i) => {
        console.log(`   Image ${i + 1}: ${img.error}`);
      });
    }
  } catch (error) {
    results.falImages = {
      tested: true,
      success: false,
      error: error.message,
      time: 0,
      data: null,
    };
    log(colors.red, '❌ Fal.AI Images FAILED');
    console.log(`   Error: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  log(colors.bright, '📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  console.log(`\nTotal Tests: ${totalTests}`);
  log(colors.green, `Passed: ${passedTests}`);
  log(colors.red, `Failed: ${failedTests}`);

  console.log('\nDetailed Results:');
  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL';
    console.log(`  ${name}: ${status}${colors.reset}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
    if (result.time > 0) {
      console.log(`    Time: ${result.time}ms`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (passedTests === totalTests) {
    log(colors.green, '✅ ALL TESTS PASSED! API integrations are working correctly.');
  } else {
    log(colors.yellow, `⚠️  ${failedTests} test(s) failed. Check configuration and API keys.`);
  }

  console.log('='.repeat(60) + '\n');

  // Save results to file
  const resultsPath = path.join(__dirname, '../../test-output/api-test-results.json');
  const fs = require('fs-extra');
  await fs.ensureDir(path.dirname(resultsPath));
  await fs.writeJson(resultsPath, {
    timestamp: new Date().toISOString(),
    summary: { total: totalTests, passed: passedTests, failed: failedTests },
    results,
  }, { spaces: 2 });

  console.log(`📝 Results saved to: ${resultsPath}\n`);

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

