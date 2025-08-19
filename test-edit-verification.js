/**
 * Test Edit Item with Verification Feature
 * Simulates the exact scenario where user creates item and then tries to edit verify_required to true
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:5000';

async function makeRequest(method, endpoint, data = null) {
  const options = {
    method,
    headers: {
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

async function testEditVerificationFlow() {
  console.log('🧪 Testing Edit Item with Verification Feature');
  console.log('   This tests if we can enable verification on existing new architecture items\n');

  // Test if item #1000A exists and what its current state is
  console.log('1️⃣ Test: Direct database check for item #1000A');
  
  // Check via SQL the item status
  const result = await fetch(`${SERVER_URL}/sql-debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        SELECT 
          ri.id, 
          ri.display_id, 
          rt.title,
          rt.verify_required as template_verify_required
        FROM recurring_instances ri
        LEFT JOIN recurring_templates rt ON ri.template_id = rt.id
        WHERE ri.display_id = '#1000A' 
        LIMIT 1;
      `
    })
  });

  if (result.status === 200) {
    const data = await result.json();
    console.log('✅ Found item #1000A in database:');
    console.log(`   Title: ${data.rows[0]?.title || 'N/A'}`);
    console.log(`   Template verify_required: ${data.rows[0]?.template_verify_required || false}`);
    console.log(`   Item ID: ${data.rows[0]?.id || 'N/A'}`);
    
    const itemId = data.rows[0]?.id;
    if (!itemId) {
      console.log('❌ No item found with display ID #1000A');
      return;
    }

    // Now test the hybrid verification endpoint directly
    console.log('\n2️⃣ Test: Check verification endpoint response (before enabling verification)');
    
    const verifyCheck1 = await makeRequest('POST', `/api/item/${itemId}/verify-photo`);
    console.log(`   Status: ${verifyCheck1.status}`);
    console.log(`   Message: ${verifyCheck1.data?.error || 'Success'}`);
    
    if (verifyCheck1.status === 400 && verifyCheck1.data?.error === 'Item does not require photo verification') {
      console.log('✅ Correct: Item currently does not require verification');
    }
    
    // Now enable verification via PUT update
    console.log('\n3️⃣ Test: Enable verification via PUT endpoint');
    
    const enableVerification = await makeRequest('PUT', `/api/item/${itemId}`, {
      title: "Fill pill organizer for the week",
      item_type: "task",
      verify_required: true,
      why_it_matters: "Health tracking",
      assigned_to: "feykLj0oBPQLaa7JU0WpNXxoiz33"
    });
    
    console.log(`   PUT Status: ${enableVerification.status}`);
    if (enableVerification.status === 200) {
      console.log('✅ Successfully enabled verification requirement');
    } else {
      console.log('❌ Failed to enable verification');
      console.log(`   Error: ${enableVerification.data?.error}`);
      return;
    }
    
    // Test verification endpoint again 
    console.log('\n4️⃣ Test: Check verification endpoint response (after enabling verification)');
    
    const verifyCheck2 = await makeRequest('POST', `/api/item/${itemId}/verify-photo`);
    console.log(`   Status: ${verifyCheck2.status}`);
    console.log(`   Message: ${verifyCheck2.data?.error || 'Success'}`);
    
    if (verifyCheck2.status === 400 && verifyCheck2.data?.error === 'No photo uploaded') {
      console.log('✅ SUCCESS: Verification endpoint now recognizes item requires verification!');
      console.log('   This confirms the hybrid logic is working correctly');
    } else if (verifyCheck2.status === 404) {
      console.log('❌ FAILURE: Verification endpoint still returns 404');
      console.log('   The hybrid logic is not working properly');
    }
    
  } else {
    console.log('❌ Could not access database for testing');
  }

  console.log('\n🏁 Test Complete');
}

testEditVerificationFlow().catch(console.error);