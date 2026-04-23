#!/usr/bin/env node

/**
 * Final Genaipro Voice Test with Valid Voice ID
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;
const BASE_URL = 'https://genaipro.vn/api/v1';

// Use a valid voice_id from the API
const VOICE_ID = 'WkVhWA2EqSfUAWAZG7La'; // James - British Male Narrator
const MODEL_ID = 'eleven_turbo_v2_5';

async function testVoiceGeneration() {
  console.log('='.repeat(70));
  console.log('🎙️  GENAIPRO VOICE GENERATION - FINAL TEST');
  console.log('='.repeat(70));
  
  console.log(`\n🎯 Using Voice: James (British Male Narrator)`);
  console.log(`   Voice ID: ${VOICE_ID}`);
  console.log(`   Model: ${MODEL_ID}\n`);

  try {
    // Step 1: Create task
    console.log('📝 Creating TTS task...');
    const taskResponse = await axios.post(`${BASE_URL}/labs/task`, {
      input: "Hello! This is a test of the Genaipro voice generation service. It's working beautifully now with the correct voice ID.",
      voice_id: VOICE_ID,
      model_id: MODEL_ID,
      speed: 1.0,
      style: 0.0,
      use_speaker_boost: true,
      similarity: 0.75,
      stability: 0.5,
    }, {
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const taskId = taskResponse.data.task_id;
    console.log(`✅ Task created: ${taskId}`);
    console.log(`⏳ Polling every 3 seconds...\n`);

    // Step 2: Poll for completion
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < 120000) { // 2 minutes max
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await axios.get(`${BASE_URL}/labs/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${GENAIPRO_API_KEY}` },
      });

      const task = statusResponse.data;
      console.log(`   [${attempts}] Status: ${task.status}`);

      if (task.status === 'completed') {
        console.log(`\n🎉 SUCCESS! Voice generated in ${Date.now() - startTime}ms`);
        console.log(`   Audio URL: ${task.result}`);
        
        // Step 3: Download the audio
        console.log(`\n📥 Downloading audio...`);
        const audioResponse = await axios.get(task.result, { responseType: 'arraybuffer' });
        const outputPath = path.join(__dirname, '../../temp', `genaipro_test_${Date.now()}.mp3`);
        await fs.writeFile(outputPath, audioResponse.data);
        
        console.log(`✅ Audio saved to: ${outputPath}`);
        console.log(`   File size: ${(audioResponse.data.length / 1024).toFixed(2)} KB`);
        console.log(`\n🎧 Play this file with VLC or Windows Media Player to verify!`);
        
        return { success: true, audioPath: outputPath };
      } else if (task.status === 'failed' || task.status === 'error') {
        console.log(`\n❌ FAILED: ${task.error || 'Unknown error'}`);
        return { success: false, error: task.error };
      }
    }

    console.log(`\n⏱️  Task timed out after 2 minutes`);
    return { success: false, error: 'Timeout' };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

testVoiceGeneration().then(result => {
  console.log('\n' + '='.repeat(70));
  if (result.success) {
    console.log('✅ GENAIPRO VOICE GENERATION IS WORKING!');
    console.log('='.repeat(70));
    console.log('\n💡 Now you can update your voice service to use:');
    console.log(`   defaultVoiceId: '${VOICE_ID}'`);
    console.log(`   defaultModelId: '${MODEL_ID}'`);
  } else {
    console.log('❌ Voice generation failed. Check your account credits/permissions.');
  }
  console.log('='.repeat(70) + '\n');
  process.exit(result.success ? 0 : 1);
});

