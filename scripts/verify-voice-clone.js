#!/usr/bin/env node

/**
 * Verify Voice Clone exists on genAi pro API
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;
const BASE_URL = 'https://genaipro.vn/api/v1';

async function verifyVoiceClone() {
  console.log('🔍 Verifying Voice Clone on genAi pro API...\n');

  if (!GENAIPRO_API_KEY) {
    console.error('❌ GENAIPRO_API_KEY not found in .env file');
    process.exit(1);
  }

  try {
    // Load local voice clones
    const voiceClonesPath = path.join(__dirname, '../storage/voice-clones.json');
    const localData = await fs.readJson(voiceClonesPath);
    const localClones = localData.voiceClones || [];
    
    console.log('📂 Local voice clones:');
    if (localClones.length === 0) {
      console.log('   (none)');
    } else {
      localClones.forEach(clone => {
        console.log(`   - ${clone.voice_name} (ID: ${clone.id}, Status: ${clone.voice_status})`);
      });
    }
    
    console.log('\n📡 Fetching voice clones from API...');
    
    // Fetch from API
    const response = await axios.get(
      `${BASE_URL}/max/voice-clones`,
      {
        headers: {
          'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const apiClones = response.data.voice_clones || [];
    
    console.log('\n✅ API voice clones:');
    if (apiClones.length === 0) {
      console.log('   (none)');
    } else {
      apiClones.forEach(clone => {
        const statusText = ['Pending', 'Processing', 'Ready', 'Failed'][clone.voice_status] || 'Unknown';
        console.log(`   - ${clone.voice_name} (ID: ${clone.id}, Status: ${statusText})`);
      });
    }
    
    // Compare
    console.log('\n🔍 Comparing local vs API...');
    
    const localIds = new Set(localClones.map(c => c.id));
    const apiIds = new Set(apiClones.map(c => c.id));
    
    const onlyLocal = localClones.filter(c => !apiIds.has(c.id));
    const onlyApi = apiClones.filter(c => !localIds.has(c.id));
    const bothHave = localClones.filter(c => apiIds.has(c.id));
    
    if (bothHave.length > 0) {
      console.log('\n✅ Voice clones in both local and API:');
      bothHave.forEach(clone => {
        console.log(`   - ${clone.voice_name} (ID: ${clone.id})`);
      });
    }
    
    if (onlyLocal.length > 0) {
      console.log('\n⚠️  Voice clones ONLY in local storage (not on API):');
      onlyLocal.forEach(clone => {
        console.log(`   - ${clone.voice_name} (ID: ${clone.id}) ❌ NOT ON API`);
      });
    }
    
    if (onlyApi.length > 0) {
      console.log('\n⚠️  Voice clones ONLY on API (not in local storage):');
      onlyApi.forEach(clone => {
        console.log(`   - ${clone.voice_name} (ID: ${clone.id})`);
      });
      console.log('\n💡 Tip: Click "Sync with API" in the frontend to update local storage');
    }
    
    // Load channel configurations
    console.log('\n📋 Checking channel configurations...');
    const channelsDir = path.join(__dirname, '../storage/channels');
    const channelFiles = await fs.readdir(channelsDir);
    
    for (const file of channelFiles) {
      if (!file.endsWith('.json')) continue;
      
      const channelPath = path.join(channelsDir, file);
      const channel = await fs.readJson(channelPath);
      
      if (channel.voiceSettings?.provider === 'genaipro' && channel.voiceSettings?.voiceCloneId) {
        const cloneId = channel.voiceSettings.voiceCloneId;
        const cloneExists = apiIds.has(cloneId);
        const status = cloneExists ? '✅' : '❌';
        
        console.log(`\n   Channel: ${channel.name}`);
        console.log(`   Voice Clone ID: ${cloneId}`);
        console.log(`   Exists on API: ${status}`);
        
        if (!cloneExists) {
          console.log(`   ⚠️  WARNING: This voice clone ID is NOT found on the API!`);
          console.log(`   This will cause "voice_id_not_found" errors.`);
        }
      }
    }
    
    console.log('\n✅ Verification complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

verifyVoiceClone();

