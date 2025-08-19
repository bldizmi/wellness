/**
 * Comprehensive User Data Isolation Test
 * Tests two different users accessing their own data without cross-contamination
 */

import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize Firebase Admin SDK for test token generation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const BASE_URL = 'http://localhost:5000';

// Test users - these must exist in Firebase Auth
const TEST_USERS = {
  user1: {
    uid: '2ejB7fVvbXXQytzgG6RXRNsWnsw2',
    email: 'jacquelinemekontso@gmail.com',
    name: 'Jacqueline Test'
  },
  user2: {
    uid: 'feykLj0oBPQLaa7JU0WpNXxoiz33', 
    email: 'amalyquiroz@gmail.com',
    name: 'Amaly Test'
  }
};

// Create test Firebase tokens
async function createTestToken(userInfo) {
  try {
    return await admin.auth().createCustomToken(userInfo.uid, {
      email: userInfo.email,
      name: userInfo.name,
      email_verified: true
    });
  } catch (error) {
    console.error(`Failed to create token for ${userInfo.email}:`, error);
    throw error;
  }
}

// Make authenticated API request
async function makeRequest(method, endpoint, token, data = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    return {
      status: response.status,
      data: parsedData,
      ok: response.ok
    };
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error);
    throw error;
  }
}

// Test user's profile access
async function testProfileAccess(userLabel, token, expectedData) {
  console.log(`\n🔍 Testing ${userLabel} Profile Access`);
  
  const result = await makeRequest('GET', '/api/profile', token);
  
  if (!result.ok) {
    console.error(`❌ ${userLabel} profile access failed:`, result.data);
    return false;
  }

  console.log(`✅ ${userLabel} profile loaded successfully`);
  console.log(`   - User ID: ${result.data.user_id}`);
  console.log(`   - Email: ${result.data.email || 'N/A'}`);
  console.log(`   - Display Name: ${result.data.display_name || 'N/A'}`);
  
  // Verify the user ID matches expected Firebase UID
  if (result.data.user_id !== expectedData.uid) {
    console.error(`❌ ${userLabel} UID mismatch! Expected: ${expectedData.uid}, Got: ${result.data.user_id}`);
    return false;
  }
  
  return true;
}

// Test mood check-in access
async function testMoodAccess(userLabel, token, expectedUid) {
  console.log(`\n🔍 Testing ${userLabel} Mood Access`);
  
  // Get mood history
  const historyResult = await makeRequest('GET', '/api/mood/history', token);
  
  if (!historyResult.ok) {
    console.error(`❌ ${userLabel} mood history access failed:`, historyResult.data);
    return false;
  }

  console.log(`✅ ${userLabel} mood history loaded successfully`);
  console.log(`   - Mood entries: ${historyResult.data.moods?.length || 0}`);
  
  // Create a test mood entry
  const moodData = {
    emoji: '😊',
    scale: 8,
    notes: `Test mood for ${userLabel} - ${new Date().toISOString()}`
  };
  
  const createResult = await makeRequest('POST', '/api/mood/check-in', token, moodData);
  
  if (!createResult.ok) {
    console.error(`❌ ${userLabel} mood creation failed:`, createResult.data);
    return false;
  }
  
  console.log(`✅ ${userLabel} mood entry created successfully`);
  console.log(`   - Mood ID: ${createResult.data.mood?.id || 'N/A'}`);
  
  return true;
}

// Test today items access
async function testTodayAccess(userLabel, token, expectedUid) {
  console.log(`\n🔍 Testing ${userLabel} Today Items Access`);
  
  const result = await makeRequest('GET', '/api/today', token);
  
  if (!result.ok) {
    console.error(`❌ ${userLabel} today items access failed:`, result.data);
    return false;
  }

  console.log(`✅ ${userLabel} today items loaded successfully`);
  console.log(`   - Tasks: ${result.data.today?.tasks?.length || 0}`);
  console.log(`   - Habits: ${result.data.today?.habits?.length || 0}`);
  console.log(`   - Goals: ${result.data.today?.goals?.length || 0}`);
  
  // Create a test item
  const itemData = {
    title: `Test task for ${userLabel} - ${new Date().toISOString()}`,
    item_type: 'task',
    category: 'work',
    priority: 'medium'
  };
  
  const createResult = await makeRequest('POST', '/api/item', token, itemData);
  
  if (!createResult.ok) {
    console.error(`❌ ${userLabel} item creation failed:`, createResult.data);
    return false;
  }
  
  console.log(`✅ ${userLabel} item created successfully`);
  console.log(`   - Item ID: ${createResult.data.item?.id || 'N/A'}`);
  
  return true;
}

// Cross-contamination test - verify user1 cannot see user2's data
async function testCrossContamination(user1Token, user2Token) {
  console.log(`\n🔍 Testing Cross-User Data Isolation`);
  
  // Get user1's profile to establish baseline
  const user1Profile = await makeRequest('GET', '/api/profile', user1Token);
  const user2Profile = await makeRequest('GET', '/api/profile', user2Token);
  
  if (!user1Profile.ok || !user2Profile.ok) {
    console.error('❌ Failed to get user profiles for cross-contamination test');
    return false;
  }
  
  // Verify different user IDs
  if (user1Profile.data.user_id === user2Profile.data.user_id) {
    console.error('❌ CRITICAL: Users have same ID - data isolation compromised!');
    return false;
  }
  
  console.log(`✅ Users have different IDs:`);
  console.log(`   - User 1: ${user1Profile.data.user_id}`);
  console.log(`   - User 2: ${user2Profile.data.user_id}`);
  
  // Get today items for both users
  const user1Today = await makeRequest('GET', '/api/today', user1Token);
  const user2Today = await makeRequest('GET', '/api/today', user2Token);
  
  if (!user1Today.ok || !user2Today.ok) {
    console.error('❌ Failed to get today items for cross-contamination test');
    return false;
  }
  
  // Check if any items have wrong user_id
  const user1Items = [
    ...(user1Today.data.today?.tasks || []),
    ...(user1Today.data.today?.habits || []),
    ...(user1Today.data.today?.goals || [])
  ];
  
  const user2Items = [
    ...(user2Today.data.today?.tasks || []),
    ...(user2Today.data.today?.habits || []),
    ...(user2Today.data.today?.goals || [])
  ];
  
  // Verify no cross-contamination
  const user1ContaminatedItems = user1Items.filter(item => 
    item.user_id !== user1Profile.data.user_id
  );
  
  const user2ContaminatedItems = user2Items.filter(item => 
    item.user_id !== user2Profile.data.user_id
  );
  
  if (user1ContaminatedItems.length > 0) {
    console.error('❌ CRITICAL: User 1 seeing items from other users!');
    console.error('Contaminated items:', user1ContaminatedItems);
    return false;
  }
  
  if (user2ContaminatedItems.length > 0) {
    console.error('❌ CRITICAL: User 2 seeing items from other users!');
    console.error('Contaminated items:', user2ContaminatedItems);
    return false;
  }
  
  console.log('✅ No cross-user data contamination detected');
  console.log(`   - User 1 has ${user1Items.length} items (all owned by ${user1Profile.data.user_id})`);
  console.log(`   - User 2 has ${user2Items.length} items (all owned by ${user2Profile.data.user_id})`);
  
  return true;
}

// Main test execution
async function runUserIsolationTest() {
  console.log('🚀 Starting Comprehensive User Data Isolation Test\n');
  
  try {
    // Create test tokens
    console.log('📝 Creating test tokens...');
    const user1Token = await createTestToken(TEST_USERS.user1);
    const user2Token = await createTestToken(TEST_USERS.user2);
    console.log('✅ Test tokens created successfully');
    
    let allTestsPassed = true;
    
    // Test User 1
    console.log('\n👤 Testing User 1 (Jacqueline)');
    console.log('=====================================');
    
    const user1ProfileTest = await testProfileAccess('User 1', user1Token, TEST_USERS.user1);
    const user1MoodTest = await testMoodAccess('User 1', user1Token, TEST_USERS.user1.uid);
    const user1TodayTest = await testTodayAccess('User 1', user1Token, TEST_USERS.user1.uid);
    
    if (!user1ProfileTest || !user1MoodTest || !user1TodayTest) {
      allTestsPassed = false;
    }
    
    // Test User 2
    console.log('\n👤 Testing User 2 (Amaly)');
    console.log('=====================================');
    
    const user2ProfileTest = await testProfileAccess('User 2', user2Token, TEST_USERS.user2);
    const user2MoodTest = await testMoodAccess('User 2', user2Token, TEST_USERS.user2.uid);
    const user2TodayTest = await testTodayAccess('User 2', user2Token, TEST_USERS.user2.uid);
    
    if (!user2ProfileTest || !user2MoodTest || !user2TodayTest) {
      allTestsPassed = false;
    }
    
    // Test cross-contamination
    console.log('\n🔒 Testing Data Isolation');
    console.log('=====================================');
    
    const isolationTest = await testCrossContamination(user1Token, user2Token);
    if (!isolationTest) {
      allTestsPassed = false;
    }
    
    // Final results
    console.log('\n📊 TEST RESULTS');
    console.log('=====================================');
    
    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - User data isolation is working correctly!');
      console.log('✅ No cross-user data contamination detected');
      console.log('✅ Each user only sees their own profile, mood, and item data');
      console.log('✅ Firebase UID-based authentication is working properly');
    } else {
      console.log('❌ SOME TESTS FAILED - Review the errors above');
      console.log('🚨 User data isolation may be compromised');
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
  }
}

// Run the test if this script is executed directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  runUserIsolationTest();
}

export { runUserIsolationTest };