// Simple script to test MindDouble API endpoints
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = 'test-user-123'; // This matches our development test user

// Test endpoints one by one
async function runTests() {
  try {
    // 1. Test health check endpoint
    console.log('\n🔍 Testing health check endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('Health check response:', healthData);

    // 2. Test mood check-in
    console.log('\n🔍 Testing mood check-in...');
    const moodResponse = await fetch(`${BASE_URL}/api/mood/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood_emoji: '😊',
        timestamp: new Date().toISOString()
      })
    });
    const moodData = await moodResponse.json();
    console.log('Mood check-in response:', moodData);

    // 3. Test create item
    console.log('\n🔍 Testing item creation...');
    const itemResponse = await fetch(`${BASE_URL}/api/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Complete MindDouble setup',
        item_type: 'task',
        recurrence_type: 'once',
        due_date: new Date().toISOString(),
        time_frame: 30,
        is_chore: false,
        why_it_matters: 'To have a functional wellness app'
      })
    });
    const itemData = await itemResponse.json();
    console.log('Item creation response:', itemData);

    // 4. Test today's items
    console.log('\n🔍 Testing today\'s items endpoint...');
    const todayResponse = await fetch(`${BASE_URL}/api/today`);
    const todayData = await todayResponse.json();
    console.log('Today\'s items response:', todayData);

    // 5. Test time estimation
    console.log('\n🔍 Testing time estimation...');
    const estimateResponse = await fetch(`${BASE_URL}/api/ai/estimate-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Do the dishes'
      })
    });
    const estimateData = await estimateResponse.json();
    console.log('Time estimate response:', estimateData);

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Run the tests
runTests();