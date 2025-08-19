/**
 * Test Production Cache Invalidation
 * Tests that items appear immediately after creation in production
 */

async function makeRequest(method, endpoint, token, data = null) {
  const url = `https://minddouble-production.amalyquiroz.repl.co${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error.message }
    };
  }
}

async function testProductionCacheInvalidation() {
  console.log('🧪 PRODUCTION CACHE TEST: Testing immediate item appearance after creation');
  
  // You'll need to provide Amy Q's production Firebase token
  const AMY_TOKEN = "PRODUCTION_FIREBASE_TOKEN_HERE"; // Replace with actual token
  
  if (AMY_TOKEN === "PRODUCTION_FIREBASE_TOKEN_HERE") {
    console.log('❌ Please update AMY_TOKEN with Amy Q\'s production Firebase token');
    return;
  }
  
  const testDate = '2025-07-06';
  const testItemTitle = `Cache Test Item ${Date.now()}`;
  
  console.log(`📅 Testing cache invalidation for date: ${testDate}`);
  console.log(`📝 Test item title: ${testItemTitle}`);
  
  try {
    // Step 1: Get baseline Today page items
    console.log('\n📊 Step 1: Getting baseline Today page items...');
    const beforeResult = await makeRequest('GET', `/api/today/personal-progress?date=${testDate}`, AMY_TOKEN);
    
    if (!beforeResult.ok) {
      console.error('❌ Failed to get baseline items:', beforeResult.data);
      return;
    }
    
    const beforeCount = beforeResult.data.tasks?.length || 0;
    console.log(`✅ Baseline: Found ${beforeCount} tasks for ${testDate}`);
    
    // Step 2: Create a new item
    console.log('\n📝 Step 2: Creating new test item...');
    const itemData = {
      title: testItemTitle,
      item_type: 'task',
      recurrence_type: 'once',
      due_date: testDate,
      verify_required: false
    };
    
    const createResult = await makeRequest('POST', '/api/item', AMY_TOKEN, itemData);
    
    if (!createResult.ok) {
      console.error('❌ Failed to create item:', createResult.data);
      return;
    }
    
    const createdItem = createResult.data.item;
    console.log(`✅ Item created successfully with ID: ${createdItem.id}`);
    
    // Step 3: Immediately check if item appears (should be instant)
    console.log('\n⚡ Step 3: Checking immediate appearance (cache invalidation test)...');
    const afterResult = await makeRequest('GET', `/api/today/personal-progress?date=${testDate}`, AMY_TOKEN);
    
    if (!afterResult.ok) {
      console.error('❌ Failed to get updated items:', afterResult.data);
      return;
    }
    
    const afterCount = afterResult.data.tasks?.length || 0;
    const foundItem = afterResult.data.tasks?.find(item => item.title === testItemTitle);
    
    if (foundItem) {
      console.log(`✅ SUCCESS: Item appears immediately! Cache invalidation working correctly.`);
      console.log(`   - Before: ${beforeCount} tasks`);
      console.log(`   - After: ${afterCount} tasks`);
      console.log(`   - Found item: ${foundItem.display_id} - ${foundItem.title}`);
    } else {
      console.log(`❌ FAILURE: Item not found immediately. Cache invalidation not working.`);
      console.log(`   - Before: ${beforeCount} tasks`);
      console.log(`   - After: ${afterCount} tasks`);
      console.log(`   - Expected item: ${testItemTitle}`);
      console.log(`   - Available items:`, afterResult.data.tasks?.map(t => t.title) || []);
    }
    
    // Step 4: Wait 30 seconds and check again (should still be there)
    console.log('\n⏰ Step 4: Waiting 30 seconds and checking persistence...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const persistResult = await makeRequest('GET', `/api/today/personal-progress?date=${testDate}`, AMY_TOKEN);
    const persistItem = persistResult.data.tasks?.find(item => item.title === testItemTitle);
    
    if (persistItem) {
      console.log(`✅ PERSISTENCE: Item still appears after 30 seconds.`);
    } else {
      console.log(`❌ PERSISTENCE ISSUE: Item disappeared after 30 seconds.`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testProductionCacheInvalidation().catch(console.error);