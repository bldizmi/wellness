/**
 * Test script to enable Phase 3A Feature Flag for testing
 * Enables the new recurring system for a specific user
 */

import { featureFlagService } from './server/services/featureFlagService.ts';

async function enableFeatureFlag() {
  const testUserId = 'feykLj0oBPQLaa7JU0WpNXxoiz33'; // Your Firebase UID from logs
  
  console.log('🎌 FEATURE FLAG TEST: Current status before changes:');
  console.log(featureFlagService.getStatus());
  
  // Enable new recurring system for your user specifically
  featureFlagService.addUserToNewSystem(testUserId);
  
  console.log('\n🎌 FEATURE FLAG TEST: Status after enabling for test user:');
  console.log(featureFlagService.getStatus());
  
  console.log('\n✅ FEATURE FLAG TEST: New recurring system enabled for user:', testUserId);
  console.log('🔍 Test by visiting the Today page and checking server logs for "🆕 HYBRID" or "🆕 NEW SYSTEM" messages');
}

enableFeatureFlag().catch(console.error);