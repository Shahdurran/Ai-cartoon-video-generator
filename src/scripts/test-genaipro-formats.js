#!/usr/bin/env node

/**
 * Genaipro.vn API Format Testing
 * Tests different request formats and authentication methods
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;
const BASE_URL = 'https://genaipro.vn/api/v1/audio/speech';

async function testFormat(name, config) {
  console.log(`\n🔍 Testing Format: ${name}`);
  console.log(`   Config: ${JSON.stringify(config.headers, null, 2)}`);
  
  try {
    const response = await axios({
      ...config,
      url: BASE_URL,
      timeout: 10000,
      validateStatus: () => true,
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log(`   ✅ SUCCESS! This format works.`);
      console.log(`   Response size: ${response.data?.length || 'unknown'} bytes`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      return { name, success: true, status: response.status };
    } else if (response.status === 401 || response.status === 403) {
      console.log(`   🔐 Auth Error`);
      const body = typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200);
      console.log(`   Response: ${body}`);
      return { name, success: false, status: response.status };
    } else {
      const body = typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200);
      console.log(`   Response: ${body}`);
      return { name, success: false, status: response.status };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { name, success: false, error: error.message };
  }
}

async function runFormatTests() {
  console.log('='.repeat(70));
  console.log('🧪 GENAIPRO.VN API FORMAT TESTS');
  console.log('='.repeat(70));
  
  if (!GENAIPRO_API_KEY) {
    console.error('\n❌ ERROR: GENAIPRO_API_KEY not found');
    process.exit(1);
  }

  const testText = "Hello, this is a test.";
  
  const formats = [
    {
      name: 'JSON with Bearer Token',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'tts-1-hd',
        input: testText,
        voice: 'alloy',
        speed: 1.0,
        response_format: 'mp3',
      },
      responseType: 'arraybuffer',
    },
    {
      name: 'JSON without model',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        input: testText,
        voice: 'alloy',
        speed: 1.0,
      },
      responseType: 'arraybuffer',
    },
    {
      name: 'JSON with text instead of input',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        text: testText,
        voice: 'alloy',
        speed: 1.0,
      },
      responseType: 'arraybuffer',
    },
    {
      name: 'API Key in header (x-api-key)',
      method: 'POST',
      headers: {
        'x-api-key': GENAIPRO_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'tts-1-hd',
        input: testText,
        voice: 'alloy',
      },
      responseType: 'arraybuffer',
    },
    {
      name: 'Simple JSON (minimal)',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        input: testText,
      },
      responseType: 'arraybuffer',
    },
    {
      name: 'GET with query params',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
      },
      params: {
        text: testText,
        voice: 'alloy',
      },
      responseType: 'arraybuffer',
    },
  ];
  
  console.log(`\n🔑 API Key (first 30 chars): ${GENAIPRO_API_KEY.substring(0, 30)}...`);
  console.log(`🎯 Testing ${formats.length} different formats\n`);
  
  const results = [];
  
  for (const format of formats) {
    const result = await testFormat(format.name, format);
    results.push(result);
    
    if (result.success) {
      console.log('\n' + '='.repeat(70));
      console.log('🎉 FOUND WORKING FORMAT!');
      console.log('='.repeat(70));
      console.log(`\n✅ Use this configuration:`);
      console.log(JSON.stringify(format, null, 2));
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const workingFormats = results.filter(r => r.success);
  
  if (workingFormats.length > 0) {
    console.log('\n✅ Working format found!');
  } else {
    console.log('\n❌ No working format found.');
    console.log('\n💡 This suggests:');
    console.log('   1. The Genaipro API key might not have TTS permissions');
    console.log('   2. The API structure might be completely different');
    console.log('   3. TTS might not be available at this endpoint');
    console.log('\n🔍 Next steps:');
    console.log('   - Check Genaipro dashboard for API documentation');
    console.log('   - Look for TTS/Voice generation examples in their docs');
    console.log('   - Contact Genaipro support for correct API usage');
    console.log('   - Consider using Fal.AI as primary instead (after adding credits)');
  }
  
  console.log('\n');
}

runFormatTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

