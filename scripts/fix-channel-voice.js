#!/usr/bin/env node

/**
 * Fix channel to use default voice instead of missing clone
 */

const fs = require('fs-extra');
const path = require('path');

const CHANNEL_ID = '547d3818-5a5e-47c5-bfd9-121f16cb2ec5'; // Video bg testing
const channelPath = path.join(__dirname, '../storage/channels', `${CHANNEL_ID}.json`);

async function fixChannel() {
  console.log('🔧 Fixing channel voice settings...\n');
  
  try {
    const channel = await fs.readJson(channelPath);
    
    console.log('Current settings:');
    console.log(`  Provider: ${channel.voiceSettings.provider}`);
    console.log(`  Voice: ${channel.voiceSettings.voice}`);
    console.log(`  VoiceCloneId: ${channel.voiceSettings.voiceCloneId}`);
    
    // Use default genAi pro voice
    channel.voiceSettings = {
      provider: 'genaipro',
      voice: 'uju3wxzG5OhpWcoi3SMy', // Default voice from config
      voiceCloneId: null,
      speed: 1.0,
      language: 'Vietnamese',
    };
    
    await fs.writeJson(channelPath, channel, { spaces: 2 });
    
    console.log('\n✅ Updated settings:');
    console.log(`  Provider: ${channel.voiceSettings.provider}`);
    console.log(`  Voice: ${channel.voiceSettings.voice} (default)`);
    console.log(`  VoiceCloneId: ${channel.voiceSettings.voiceCloneId}`);
    
    console.log('\n✅ Channel fixed! You can now generate videos with the default voice.');
    console.log('💡 Create a new voice clone in the frontend when ready.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixChannel();

