/**
 * Test Display ID Creation Flow
 * Tests the specific path where display_id is generated and saved
 */

import { createSingleInstance } from './server/services/newRecurringItemService.ts';
import { generateNextDisplayId } from './server/utils/displayId.ts';

async function testDisplayIdCreation() {
  console.log('🧪 Testing Display ID Creation Flow');
  
  // Test 1: Can we generate a display ID?
  console.log('\n1. Testing display ID generation:');
  const displayId = await generateNextDisplayId();
  console.log(`Generated display ID: ${displayId}`);
  
  // Test 2: Create a test item with explicit display_id
  console.log('\n2. Creating test item with explicit display_id:');
  const testItem = {
    id: 'test-' + Date.now(),
    display_id: displayId,
    title: 'Test Display ID Creation',
    item_type: 'task',
    user_id: 'test-user',
    created_by: 'test-user',
    assigned_to: 'test-user',
    due_date: '2025-07-06',
    created_at: new Date().toISOString(),
    verify_required: false
  };
  
  try {
    const instanceId = await createSingleInstance(testItem);
    console.log(`✅ Created instance: ${instanceId}`);
    
    // Test 3: Query the created item to verify display_id was saved
    console.log('\n3. Verifying item was saved with display_id:');
    const { db } = await import('./server/db.ts');
    const { sql } = await import('drizzle-orm');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const query = sql`
      SELECT 
        ri.id,
        ri.display_id as instance_display_id,
        rt.display_id as template_display_id,
        rt.title
      FROM ${isDevelopment ? sql.identifier('dev_recurring_instances') : sql.identifier('recurring_instances')} ri
      LEFT JOIN ${isDevelopment ? sql.identifier('dev_recurring_templates') : sql.identifier('recurring_templates')} rt 
        ON ri.template_id = rt.id
      WHERE ri.id = ${instanceId}
    `;
    
    const result = await db.execute(query);
    console.log('Query result:', JSON.stringify(result.rows, null, 2));
    
  } catch (error) {
    console.error('❌ Error creating test item:', error);
  }
}

testDisplayIdCreation().then(() => process.exit(0));