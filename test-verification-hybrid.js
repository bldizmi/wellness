/**
 * Test Verification Hybrid Architecture Fix
 * Tests that the photo verification endpoint works with items in new architecture
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:5000';

async function makeRequest(method, endpoint, token, data = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${SERVER_URL}${endpoint}`, options);
  return {
    status: response.status,
    data: response.status !== 204 ? await response.json() : null
  };
}

async function testVerificationHybrid() {
  console.log('🧪 Testing Verification Hybrid Architecture Fix\n');

  // Use Firebase token from environment variable
  const FIREBASE_TOKEN = process.env.TEST_FIREBASE_TOKEN;
  
  if (!FIREBASE_TOKEN) {
    console.error('❌ ERROR: TEST_FIREBASE_TOKEN environment variable is not set');
    console.error('Please add your Firebase authentication token as a secret in Replit');
    return;
  }

  console.log('1️⃣ Test: First update item #1000A to verify_required=true');
  
  // Find the item ID from display_id
  const itemsResponse = await makeRequest('GET', '/api/items', FIREBASE_TOKEN);
  console.log(`Items API Status: ${itemsResponse.status}`);
  
  if (itemsResponse.status !== 200) {
    console.log('❌ Failed to get items list');
    return;
  }

  // Find item with display_id #1000A
  const item1000A = itemsResponse.data.items?.find(item => item.display_id === '#1000A');
  
  if (!item1000A) {
    console.log('❌ Item #1000A not found in items list');
    return;
  }

  console.log(`✅ Found item #1000A with ID: ${item1000A.id}`);
  console.log(`   Current verify_required: ${item1000A.verify_required}`);

  // Try to update verify_required to true
  console.log('\n2️⃣ Test: Update verify_required to true using PUT endpoint');
  
  const updateResponse = await makeRequest('PUT', `/api/item/${item1000A.id}`, FIREBASE_TOKEN, {
    title: item1000A.title,
    item_type: item1000A.item_type,
    verify_required: true,
    why_it_matters: item1000A.why_it_matters,
    due_date: item1000A.due_date,
    assigned_to: item1000A.assigned_to,
    shared_with: item1000A.shared_with
  });

  console.log(`PUT Update Status: ${updateResponse.status}`);
  
  if (updateResponse.status === 200) {
    console.log('✅ Successfully updated item to verify_required=true');
  } else {
    console.log('❌ Failed to update item:');
    console.log(JSON.stringify(updateResponse.data, null, 2));
    return;
  }

  // Now test the verification endpoint
  console.log('\n3️⃣ Test: Check verification endpoint now recognizes verify_required=true');
  
  // Try a test verification request (without photo) to see if it recognizes the item
  const verifyResponse = await makeRequest('POST', `/api/item/${item1000A.id}/verify-photo`, FIREBASE_TOKEN);
  
  console.log(`Verification Endpoint Status: ${verifyResponse.status}`);
  
  if (verifyResponse.status === 400 && verifyResponse.data?.error === 'No photo uploaded') {
    console.log('✅ SUCCESS: Verification endpoint found the item and is asking for photo');
    console.log('   This means the hybrid logic is working - item found with verify_required=true');
  } else if (verifyResponse.status === 404) {
    console.log('❌ FAILED: Verification endpoint still returning 404');
    console.log('   This means the hybrid logic is not working properly');
    console.log(JSON.stringify(verifyResponse.data, null, 2));
  } else {
    console.log(`ℹ️  Unexpected response: ${verifyResponse.status}`);
    console.log(JSON.stringify(verifyResponse.data, null, 2));
  }

  console.log('\n🏁 Test Complete');
}

testVerificationHybrid().catch(console.error);