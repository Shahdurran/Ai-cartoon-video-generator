#!/usr/bin/env node

/**
 * Fetch and display available Genaipro voices
 */

require('dotenv').config();
const axios = require('axios');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;
const BASE_URL = 'https://genaipro.vn/api/v1';

async function getVoices(filters = {}) {
  try {
    console.log(`Calling: ${BASE_URL}/labs/voices`);
    console.log(`Params:`, filters);
    
    const response = await axios.get(`${BASE_URL}/labs/voices`, {
      params: {
        page: filters.page !== undefined ? filters.page : 0,
        page_size: filters.page_size || 30,
      },
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
      },
      validateStatus: () => true, // Don't throw on any status
    });

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, response.headers);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching voices:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🎙️  GENAIPRO AVAILABLE VOICES');
  console.log('='.repeat(70));

  if (!GENAIPRO_API_KEY) {
    console.error('\n❌ GENAIPRO_API_KEY not found');
    process.exit(1);
  }

  console.log('\n📋 Fetching available voices...\n');

  const data = await getVoices({ language: 'en' });

  console.log('Response:', JSON.stringify(data, null, 2));

  if (!data || !data.voices) {
    console.error('\n❌ No voices data returned. Response structure might be different.');
    console.error('Check Genaipro API documentation or contact support.');
    process.exit(1);
  }

  console.log(`Total voices: ${data.total}`);
  console.log(`Showing: ${data.voices.length} voices\n`);

  console.log('Available Voices:\n');

  data.voices.forEach((voice, i) => {
    console.log(`${i + 1}. ${voice.name}`);
    console.log(`   Voice ID: ${voice.voice_id}`);
    console.log(`   Category: ${voice.category}`);
    if (voice.labels) {
      console.log(`   Gender: ${voice.labels.gender || 'N/A'}`);
      console.log(`   Age: ${voice.labels.age || 'N/A'}`);
      console.log(`   Accent: ${voice.labels.accent || 'N/A'}`);
      console.log(`   Description: ${voice.labels.description || 'N/A'}`);
    }
    console.log('');
  });

  // Recommend some voices
  console.log('='.repeat(70));
  console.log('💡 RECOMMENDED VOICES FOR VIDEO NARRATION:');
  console.log('='.repeat(70) + '\n');

  const recommendedCategories = ['premade', 'professional'];
  const recommended = data.voices.filter(v => 
    recommendedCategories.includes(v.category) && 
    v.labels && 
    (v.labels.description?.includes('professional') || 
     v.labels.description?.includes('clear') ||
     v.labels.description?.includes('narrator'))
  ).slice(0, 5);

  if (recommended.length > 0) {
    console.log('Top recommendations:');
    recommended.forEach((voice, i) => {
      console.log(`${i + 1}. ${voice.name} (${voice.voice_id})`);
      console.log(`   - ${voice.labels.description || 'Professional voice'}`);
    });
  } else {
    console.log('Using first available voice:');
    if (data.voices.length > 0) {
      const first = data.voices[0];
      console.log(`1. ${first.name} (${first.voice_id})`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📝 UPDATE YOUR CONFIG:');
  console.log('='.repeat(70) + '\n');
  
  if (data.voices.length > 0) {
    const defaultVoice = data.voices[0];
    console.log('Add this to your .env or api.config.js:');
    console.log(`GENAIPRO_DEFAULT_VOICE_ID="${defaultVoice.voice_id}"`);
    console.log('');
    console.log('Or update src/config/api.config.js:');
    console.log(`defaultVoiceId: '${defaultVoice.voice_id}', // ${defaultVoice.name}`);
  }

  console.log('\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

