#!/usr/bin/env node

/**
 * Genaipro.vn API Debugging Script
 * Tests different endpoint combinations to find the correct one
 */

require('dotenv').config();
const axios = require('axios');

const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;

const testEndpoints = [
  'https://genaipro.vn/api/v1/audio/speech',
  'https://genaipro.vn/api/audio/speech',
  'https://api.genaipro.vn/v1/audio/speech',
  'https://api.genaipro.vn/audio/speech',
  'https://genaipro.vn/v1/audio/speech',
];

const testPayload = {
  model: 'tts-1-hd',
  input: 'Hello, this is a test.',
  voice: 'alloy',
  speed: 1.0,
  response_format: 'mp3',
};

async function testEndpoint(url) {
  console.log(`\n🔍 Testing: ${url}`);
  
  try {
    const response = await axios.post(url, testPayload, {
      headers: {
        'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log(`   ✅ SUCCESS! This endpoint works.`);
      console.log(`   Response size: ${response.data.length} bytes`);
      return { url, success: true, status: response.status };
    } else if (response.status === 401 || response.status === 403) {
      console.log(`   🔐 Authentication issue (API key might be invalid or expired)`);
      return { url, success: false, status: response.status, note: 'Auth error' };
    } else if (response.status === 404) {
      console.log(`   ❌ Not Found (wrong endpoint)`);
      return { url, success: false, status: response.status, note: 'Not found' };
    } else if (response.status === 405) {
      console.log(`   ❌ Method Not Allowed (endpoint exists but wrong method or format)`);
      return { url, success: false, status: response.status, note: 'Method not allowed' };
    } else {
      const body = Buffer.from(response.data).toString('utf-8').substring(0, 200);
      console.log(`   Response body: ${body}`);
      return { url, success: false, status: response.status, note: body };
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.log(`   ❌ DNS Error: Domain not found`);
      return { url, success: false, error: 'DNS_ERROR' };
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.log(`   ⏱️  Timeout`);
      return { url, success: false, error: 'TIMEOUT' };
    } else {
      console.log(`   ❌ Error: ${error.message}`);
      return { url, success: false, error: error.message };
    }
  }
}

async function runDebugTests() {
  console.log('='.repeat(70));
  console.log('🧪 GENAIPRO.VN API ENDPOINT DEBUG TEST');
  console.log('='.repeat(70));
  
  if (!GENAIPRO_API_KEY) {
    console.error('\n❌ ERROR: GENAIPRO_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  console.log(`\n🔑 API Key (first 20 chars): ${GENAIPRO_API_KEY.substring(0, 20)}...`);
  console.log(`\n📦 Test Payload:`);
  console.log(JSON.stringify(testPayload, null, 2));
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // If we found a working endpoint, stop
    if (result.success) {
      console.log('\n' + '='.repeat(70));
      console.log('🎉 FOUND WORKING ENDPOINT!');
      console.log('='.repeat(70));
      console.log(`\n✅ Use this endpoint: ${endpoint}`);
      console.log('\nUpdate your config to:');
      const urlParts = new URL(endpoint);
      const baseURL = `${urlParts.protocol}//${urlParts.host}`;
      const path = urlParts.pathname;
      console.log(`  baseURL: '${baseURL}'`);
      console.log(`  endpoint: '${path}'`);
      break;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const workingEndpoints = results.filter(r => r.success);
  
  if (workingEndpoints.length > 0) {
    console.log('\n✅ Working endpoints:');
    workingEndpoints.forEach(r => console.log(`   - ${r.url}`));
  } else {
    console.log('\n❌ No working endpoints found.');
    console.log('\n🔍 Possible issues:');
    console.log('   1. API key might be invalid or expired');
    console.log('   2. The service might use a different API structure');
    console.log('   3. Check the Genaipro.vn dashboard for correct API documentation');
    console.log('\n💡 Recommendations:');
    console.log('   - Visit https://genaipro.vn/dashboard');
    console.log('   - Look for API documentation or examples');
    console.log('   - Verify your API key is valid and has voice generation permissions');
    console.log('   - Check if there\'s a different endpoint path or request format');
  }
  
  console.log('\n');
}

runDebugTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

