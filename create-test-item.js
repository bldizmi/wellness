const { db } = require('./server/db');
const { sql } = require('drizzle-orm');

async function createTestItem() {
  const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
  const targetDate = '2025-08-08';
  
  console.log(`🧪 Creating test item for Phase 1 validation`);
  console.log(`👤 User: ${userId}`);
  console.log(`📅 Date: ${targetDate}`);
  
  try {
    // Create a test item in the new architecture (recurring_instances)
    const testItem = {
      id: `test-phase1-${Date.now()}`,
      template_id: `template-${Date.now()}`,
      occurrence_date: targetDate,
      due_time: null,
      status: 'pending',
      assigned_to: userId,
      completed_at: null,
      completed_by: null,
      verified: false,
      verified_by: null,
      verified_at: null,
      ai_verification_result: null,
      ai_feedback: null,
      verification_image_url: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      shared_with: null,
      display_id: `#TEST${Math.floor(Math.random() * 1000)}A`,
      title: 'Phase 1 Cache Test Item',
      description: null,
      item_type: 'task',
      why_it_matters: null,
      verify_required: false,
      time_frame: null,
      is_recurring: false,
      recurrence_type: null,
      completed: false,
      skipped: false
    };
    
    // Insert into dev_recurring_instances
    const insertQuery = sql`
      INSERT INTO dev_recurring_instances (
        id, template_id, occurrence_date, due_time, status, assigned_to,
        completed_at, completed_by, verified, verified_by, verified_at,
        ai_verification_result, ai_feedback, verification_image_url,
        notes, created_at, updated_at, shared_with, display_id,
        title, description, item_type, why_it_matters, verify_required,
        time_frame, is_recurring, recurrence_type, completed, skipped
      ) VALUES (
        ${testItem.id}, ${testItem.template_id}, ${testItem.occurrence_date},
        ${testItem.due_time}, ${testItem.status}, ${testItem.assigned_to},
        ${testItem.completed_at}, ${testItem.completed_by}, ${testItem.verified},
        ${testItem.verified_by}, ${testItem.verified_at}, ${testItem.ai_verification_result},
        ${testItem.ai_feedback}, ${testItem.verification_image_url}, ${testItem.notes},
        ${testItem.created_at}, ${testItem.updated_at}, ${testItem.shared_with},
        ${testItem.display_id}, ${testItem.title}, ${testItem.description},
        ${testItem.item_type}, ${testItem.why_it_matters}, ${testItem.verify_required},
        ${testItem.time_frame}, ${testItem.is_recurring}, ${testItem.recurrence_type},
        ${testItem.completed}, ${testItem.skipped}
      )
    `;
    
    await db.execute(insertQuery);
    
    console.log(`✅ Test item created successfully:`);
    console.log(`   ID: ${testItem.id}`);
    console.log(`   Display ID: ${testItem.display_id}`);
    console.log(`   Title: ${testItem.title}`);
    console.log(`   Status: ${testItem.status}`);
    console.log(`   Date: ${testItem.occurrence_date}`);
    
    console.log(`\n🎯 NEXT STEP: Refresh the page and click completion on "${testItem.display_id}"`);
    
  } catch (error) {
    console.error(`❌ Error creating test item:`, error);
  } finally {
    process.exit(0);
  }
}

createTestItem();
