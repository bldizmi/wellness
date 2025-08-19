/**
 * Test Phase 1 targeted cache invalidation for completion flow
 */

const itemId = 'F6An0iCK1KyvKG6IVtiuW'; // From logs
const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
const targetDate = '2025-08-08';

console.log(`🧪 PHASE 1 TEST: Testing completion flow for item ${itemId}`);
console.log(`📅 Target date: ${targetDate}`);
console.log(`👤 User ID: ${userId}`);

// Test completion with proper authentication
const testCompletion = async () => {
  try {
    // First, get a valid auth token from profile request
    const profileResponse = await fetch('http://localhost:5000/api/profile', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid_firebase_token_here'
      }
    });
    
    console.log(`📋 Profile response status: ${profileResponse.status}`);
    
    // Now test completion endpoint
    const completionResponse = await fetch(`http://localhost:5000/api/item/${itemId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_firebase_token_here'
      },
      body: JSON.stringify({
        completion_date: targetDate
      })
    });
    
    console.log(`✅ Completion response status: ${completionResponse.status}`);
    const result = await completionResponse.json();
    console.log(`📄 Completion result:`, result);
    
    // Test subsequent personal progress call
    const progressResponse = await fetch(`http://localhost:5000/api/today/personal-progress?date=${targetDate}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid_firebase_token_here'
      }
    });
    
    console.log(`📊 Progress response status: ${progressResponse.status}`);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// This test would require a valid Firebase token from the browser
console.log(`🔑 This test requires a valid Firebase token from browser session`);
console.log(`📝 Frontend completion requests should be traced in server logs`);
console.log(`🎯 Looking for: POST /api/item/${itemId}/complete with correlationId`);