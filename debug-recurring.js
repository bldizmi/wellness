/**
 * Debug Recurring Items Logic
 * Test the specific Basketball practice item that should appear on Friday
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

// Import the function to test
async function debugRecurringLogic() {
  console.log('🔍 DEBUG: Testing recurring items logic...');
  
  const testUserId = 'QnsYlHpwGIdw5I4xmKeQsxywo843';
  const testDate = '2025-07-04'; // Friday
  const basketballItemId = 'vmnzqpMPSJKmGlUGRbt-Z';
  
  // 1. Get the Basketball practice item directly
  const itemQuery = await db.execute(sql`
    SELECT * FROM dev_items 
    WHERE id = ${basketballItemId}
  `);
  
  const item = itemQuery.rows[0];
  console.log('\n📊 Raw item from database:');
  console.log('ID:', item.id);
  console.log('Title:', item.title);
  console.log('Recurrence type:', item.recurrence_type);
  console.log('by_day raw:', item.by_day);
  console.log('by_day type:', typeof item.by_day);
  console.log('by_day is array:', Array.isArray(item.by_day));
  
  // 2. Test JavaScript date logic
  const date = new Date(testDate + 'T23:59:59');
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[date.getDay()];
  
  console.log('\n📅 Date logic:');
  console.log('Test date:', testDate);
  console.log('JS Date object:', date);
  console.log('Day of week (0=Sunday):', date.getDay());
  console.log('Day name:', currentDayName);
  
  // 3. Test the by_day matching logic
  console.log('\n🔍 Matching logic test:');
  
  if (item.by_day) {
    console.log('by_day exists');
    
    // Check if it's already an array
    if (Array.isArray(item.by_day)) {
      console.log('✅ by_day is already an array:', item.by_day);
      console.log('Includes friday:', item.by_day.includes('friday'));
      console.log('Should appear:', item.by_day.includes(currentDayName));
    } else {
      console.log('⚠️ by_day is not an array, attempting to parse...');
      
      // Try parsing as JSON
      try {
        const parsed = JSON.parse(item.by_day);
        console.log('📊 Parsed as JSON:', parsed);
        console.log('Parsed type:', typeof parsed);
        console.log('Parsed is array:', Array.isArray(parsed));
        
        if (Array.isArray(parsed)) {
          console.log('Includes friday:', parsed.includes('friday'));
          console.log('Should appear:', parsed.includes(currentDayName));
        }
      } catch (e) {
        console.log('❌ Failed to parse as JSON:', e.message);
      }
    }
  } else {
    console.log('❌ by_day is null/undefined');
  }
  
  // 4. Test the full shouldItemAppearOnDate logic manually
  console.log('\n🧪 Manual shouldItemAppearOnDate test:');
  
  const itemCreatedDate = new Date(item.created_at);
  console.log('Item created:', itemCreatedDate);
  console.log('Target date:', date);
  console.log('Created before target:', itemCreatedDate <= date);
  
  if (item.recurrence_type === 'weekly') {
    console.log('✅ Item is weekly');
    
    let by_day_array = item.by_day;
    
    // Handle both array and string cases
    if (typeof by_day_array === 'string') {
      try {
        by_day_array = JSON.parse(by_day_array);
      } catch (e) {
        console.log('❌ Failed to parse by_day string');
      }
    }
    
    if (Array.isArray(by_day_array) && by_day_array.length > 0) {
      console.log('by_day array:', by_day_array);
      console.log('Looking for day:', currentDayName);
      console.log('Array includes day:', by_day_array.includes(currentDayName));
      console.log('FINAL RESULT: Should appear =', by_day_array.includes(currentDayName));
    } else {
      console.log('❌ by_day is not a valid array');
    }
  }
}

debugRecurringLogic();