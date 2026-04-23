#!/usr/bin/env node

/**
 * Genaipro.vn Voice Testing
 * Get available voices and test with a real voice_id
 */

require('dotenv').config();
const axios = require('axios');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;
const BASE_URL = 'https://genaipro.vn/api/v1';

async function listTasks() {
  console.log('\n📋 Fetching recent tasks...\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/labs/task`, {
      params: { page: 1, limit: 5 },
      headers: { 'Authorization': `Bearer ${GENAIPRO_API_KEY}` },
    });

    console.log(`Total tasks: ${response.data.total}`);
    console.log(`\nRecent tasks:`);
    
    response.data.tasks.forEach((task, i) => {
      console.log(`\n${i + 1}. Task ID: ${task.id}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Voice ID: ${task.voice_id}`);
      console.log(`   Model: ${task.model_id}`);
      console.log(`   Input: ${task.input.substring(0, 50)}...`);
      console.log(`   Created: ${task.created_at}`);
      if (task.result) {
        console.log(`   Result: ${task.result}`);
      }
      if (task.error) {
        console.log(`   ❌ Error: ${task.error}`);
      }
    });

    // Find a successful task to get a working voice_id
    const successfulTask = response.data.tasks.find(t => t.status === 'completed');
    if (successfulTask) {
      console.log(`\n✅ Found working voice_id: ${successfulTask.voice_id}`);
      console.log(`   Model: ${successfulTask.model_id}`);
      return { voice_id: successfulTask.voice_id, model_id: successfulTask.model_id };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching tasks:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function testVoiceGeneration(voiceId, modelId) {
  console.log(`\n🎙️  Testing voice generation with:`);
  console.log(`   Voice ID: ${voiceId}`);
  console.log(`   Model ID: ${modelId}\n`);

  try {
    // Create task
    const taskResponse = await axios.post(`${BASE_URL}/labs/task`, {
      input: "This is a quick test of the voice generation system.",
      voice_id: voiceId,
      model_id: modelId || 'eleven_turbo_v2_5',
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
    console.log(`   Polling every 3 seconds (max 60 seconds)...`);

    // Poll for completion
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < 60000) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await axios.get(`${BASE_URL}/labs/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${GENAIPRO_API_KEY}` },
      });

      const task = statusResponse.data;
      console.log(`   [${attempts}] Status: ${task.status}`);

      if (task.status === 'completed') {
        console.log(`\n✅ SUCCESS! Voice generated in ${Date.now() - startTime}ms`);
        console.log(`   Audio URL: ${task.result}`);
        console.log(`   Subtitle URL: ${task.subtitle || 'N/A'}`);
        return task;
      } else if (task.status === 'failed' || task.status === 'error') {
        console.log(`\n❌ FAILED: ${task.error || 'Unknown error'}`);
        return null;
      }
    }

    console.log(`\n⏱️  Task still processing after 60 seconds`);
    return null;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 GENAIPRO.VN VOICE TESTING');
  console.log('='.repeat(70));

  if (!GENAIPRO_API_KEY) {
    console.error('\n❌ GENAIPRO_API_KEY not found');
    process.exit(1);
  }

  // Step 1: List recent tasks to find working voice_ids
  const workingConfig = await listTasks();

  // Step 2: Test voice generation
  if (workingConfig) {
    await testVoiceGeneration(workingConfig.voice_id, workingConfig.model_id);
  } else {
    console.log('\n⚠️  No completed tasks found. Trying default voice_id...');
    await testVoiceGeneration('uju3wxzG5OhpWcoi3SMy', 'eleven_turbo_v2_5');
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 Recommendations:');
  console.log('   - Check Genaipro dashboard for available voices');
  console.log('   - Verify your API key has voice generation permissions');
  console.log('   - Some models may take longer to process');
  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

