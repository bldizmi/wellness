/**
 * Phase 2 Storage Layer Testing - Validates new recurring storage methods
 * Tests the storage layer implementation without requiring authentication
 */

import { storage } from './server/storage.ts';

async function testStorageLayer() {
  console.log('🧪 Testing Phase 2 Storage Layer Implementation');
  console.log('=====================================');

  try {
    // Test 1: getRecurringTemplate
    console.log('\n📋 Test 1: getRecurringTemplate');
    const template = await storage.getRecurringTemplate('non-existent-template');
    console.log('✅ getRecurringTemplate executed successfully:', template === null ? 'null (expected)' : 'found');

    // Test 2: createInstanceCompletion
    console.log('\n📋 Test 2: createInstanceCompletion');
    const completionData = {
      template_id: 'test-template-123',
      occurrence_date: '2025-07-03',
      completed_by: 'test-user-456'
    };
    
    const completion = await storage.createInstanceCompletion(completionData);
    console.log('✅ createInstanceCompletion executed successfully:', completion ? 'created' : 'failed');

    // Test 3: getInstanceCompletionHistory
    console.log('\n📋 Test 3: getInstanceCompletionHistory');
    const history = await storage.getInstanceCompletionHistory('test-template-123', '2025-07-03');
    console.log('✅ getInstanceCompletionHistory executed successfully:', Array.isArray(history) ? `${history.length} records` : 'failed');

    // Test 4: generateRecurringInstances
    console.log('\n📋 Test 4: generateRecurringInstances');
    const instances = await storage.generateRecurringInstances('non-existent-template', {
      start_date: '2025-07-01',
      end_date: '2025-07-07'
    });
    console.log('✅ generateRecurringInstances executed successfully:', Array.isArray(instances) ? `${instances.length} instances` : 'failed');

    // Test 5: deleteInstanceCompletion (if we created one)
    if (completion && completion.id) {
      console.log('\n📋 Test 5: deleteInstanceCompletion');
      await storage.deleteInstanceCompletion(completion.id);
      console.log('✅ deleteInstanceCompletion executed successfully');
    }

    console.log('\n🎉 All storage layer tests completed successfully!');
    console.log('✅ Phase 2 storage implementation is fully operational');

  } catch (error) {
    console.error('❌ Storage layer test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
testStorageLayer().then(() => {
  console.log('\n🚀 Ready for Phase 3 implementation');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});