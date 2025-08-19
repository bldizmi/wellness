/**
 * Quick Data Audit - Identify Missing Items Root Cause
 * Focus on immediate issues preventing items from appearing
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function quickAudit() {
  console.log('🔍 QUICK AUDIT: Analyzing missing items issue...');
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const tablePrefix = isDevelopment ? 'dev_' : '';
  const testUserId = 'QnsYlHpwGIdw5I4xmKeQsxywo843'; // Current user from logs
  const testDate = '2025-07-04';
  
  console.log(`Environment: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`Table prefix: ${tablePrefix}`);
  console.log(`Test user: ${testUserId}`);
  console.log(`Test date: ${testDate}`);
  
  try {
    // 1. Check total items for user
    console.log('\n📊 TOTAL ITEMS ANALYSIS:');
    const totalItems = await db.execute(sql`
      SELECT 
        item_type,
        recurrence_type,
        COUNT(*) as count,
        COUNT(CASE WHEN assigned_to = ${testUserId} THEN 1 END) as assigned_to_user,
        COUNT(CASE WHEN created_by = ${testUserId} THEN 1 END) as created_by_user
      FROM ${sql.identifier(`${tablePrefix}items`)}
      WHERE created_by = ${testUserId} OR assigned_to = ${testUserId}
      GROUP BY item_type, recurrence_type
      ORDER BY count DESC
    `);
    
    console.log('Items by type and recurrence:');
    totalItems.forEach(item => {
      console.log(`  ${item.item_type} (${item.recurrence_type || 'once'}): ${item.count} total, ${item.assigned_to_user} assigned, ${item.created_by_user} created`);
    });
    
    // 2. Check specific date items
    console.log('\n📅 SPECIFIC DATE ANALYSIS:');
    const dateItems = await db.execute(sql`
      SELECT 
        id, title, item_type, recurrence_type, due_date, created_by, assigned_to,
        CASE 
          WHEN created_by = ${testUserId} THEN 'created'
          WHEN assigned_to = ${testUserId} THEN 'assigned'
          ELSE 'other'
        END as relationship
      FROM ${sql.identifier(`${tablePrefix}items`)}
      WHERE (created_by = ${testUserId} OR assigned_to = ${testUserId})
        AND (due_date = ${testDate} OR recurrence_type IS NOT NULL)
      LIMIT 20
    `);
    
    console.log(`Items for ${testDate}:`);
    dateItems.forEach(item => {
      console.log(`  ${item.title} (${item.item_type}, ${item.recurrence_type || 'once'}) - ${item.relationship}`);
    });
    
    // 3. Check recurring items logic
    console.log('\n🔄 RECURRING ITEMS ANALYSIS:');
    const recurringItems = await db.execute(sql`
      SELECT 
        id, title, item_type, recurrence_type, created_at, due_date,
        by_day, by_week, by_month, by_monthday
      FROM ${sql.identifier(`${tablePrefix}items`)}
      WHERE (created_by = ${testUserId} OR assigned_to = ${testUserId})
        AND recurrence_type IS NOT NULL
        AND recurrence_type != 'once'
      LIMIT 10
    `);
    
    console.log('Recurring items configuration:');
    recurringItems.forEach(item => {
      console.log(`  ${item.title} (${item.recurrence_type})`);
      console.log(`    by_day: ${item.by_day}`);
      console.log(`    by_week: ${item.by_week}`);
      console.log(`    due_date: ${item.due_date}`);
    });
    
    // 4. Check completions
    console.log('\n✅ COMPLETIONS ANALYSIS:');
    const completions = await db.execute(sql`
      SELECT 
        ic.item_id, ic.completion_date, i.title, i.item_type
      FROM ${sql.identifier(`${tablePrefix}item_completions`)} ic
      JOIN ${sql.identifier(`${tablePrefix}items`)} i ON ic.item_id = i.id
      WHERE ic.user_id = ${testUserId}
        AND ic.completion_date BETWEEN '2025-07-01' AND '2025-07-07'
      ORDER BY ic.completion_date DESC
    `);
    
    console.log('Recent completions:');
    completions.forEach(comp => {
      console.log(`  ${comp.title} completed on ${comp.completion_date}`);
    });
    
    // 5. Test the current query logic
    console.log('\n🔍 QUERY LOGIC TEST:');
    
    // Test personal progress query
    const personalQuery = await db.execute(sql`
      SELECT 
        i.id, i.title, i.item_type, i.recurrence_type, i.due_date,
        i.created_by, i.assigned_to,
        ic.completion_date,
        CASE WHEN ic.completion_date IS NOT NULL THEN true ELSE false END as is_completed
      FROM ${sql.identifier(`${tablePrefix}items`)} i
      LEFT JOIN ${sql.identifier(`${tablePrefix}item_completions`)} ic 
        ON i.id = ic.item_id AND ic.completion_date = ${testDate}
      WHERE i.assigned_to = ${testUserId}
        AND (i.due_date = ${testDate} OR i.recurrence_type IS NOT NULL)
      LIMIT 20
    `);
    
    console.log(`Personal progress query results for ${testDate}:`);
    personalQuery.forEach(item => {
      console.log(`  ${item.title} (${item.item_type}) - completed: ${item.is_completed}`);
    });
    
    // 6. Identify schema issues
    console.log('\n📋 SCHEMA VALIDATION:');
    const schemaCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = ${tablePrefix + 'items'}
        AND column_name IN ('item_type', 'recurrence_type', 'created_by', 'assigned_to', 'due_date')
      ORDER BY column_name
    `);
    
    console.log('Critical columns:');
    schemaCheck.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ AUDIT ERROR:', error);
  }
}

quickAudit();