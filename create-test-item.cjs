const { sql } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

async function createTestItem() {
  const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
  const targetDate = '2025-08-08';
  
  console.log(`🧪 Creating test item for Phase 1 validation`);
  console.log(`👤 User: ${userId}`);
  console.log(`📅 Date: ${targetDate}`);
  
  // Initialize database connection
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);
  
  try {
    const itemId = `test-phase1-${Date.now()}`;
    const templateId = `template-${Date.now()}`;
    const displayId = `#TEST${Math.floor(Math.random() * 1000)}A`;
    
    // Insert directly using SQL
    const result = await client`
      INSERT INTO dev_recurring_instances (
        id, template_id, occurrence_date, due_time, status, assigned_to,
        completed_at, completed_by, verified, verified_by, verified_at,
        ai_verification_result, ai_feedback, verification_image_url,
        notes, created_at, updated_at, shared_with, display_id,
        title, description, item_type, why_it_matters, verify_required,
        time_frame, is_recurring, recurrence_type, completed, skipped
      ) VALUES (
        ${itemId}, ${templateId}, ${targetDate},
        null, 'pending', ${userId},
        null, null, false,
        null, null, null,
        null, null, null,
        ${new Date().toISOString()}, ${new Date().toISOString()}, null,
        ${displayId}, 'Phase 1 Cache Test Item', null,
        'task', null, false,
        null, false, null, false, false
      ) RETURNING id, display_id, title, status
    `;
    
    console.log(`✅ Test item created successfully:`);
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Display ID: ${result[0].display_id}`);
    console.log(`   Title: ${result[0].title}`);
    console.log(`   Status: ${result[0].status}`);
    console.log(`   Date: ${targetDate}`);
    
    console.log(`\n🎯 NEXT STEP: Refresh the page and click completion on "${result[0].display_id}"`);
    
  } catch (error) {
    console.error(`❌ Error creating test item:`, error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

createTestItem();
