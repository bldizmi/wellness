/**
 * Display ID generation utilities
 * Generates human-readable IDs like #1000A, #1001B, etc.
 */

import { db } from '../db';
import { items } from '@shared/schema';
import { sql, desc } from 'drizzle-orm';

/**
 * Generate next unique display ID
 * Format: #[4-digit number][uppercase letter]
 * Starting from #1000A
 */
export async function generateNextDisplayId(): Promise<string> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    // FAANG-Level Fix: Check new architecture tables first, fallback to legacy
    const newTableName = isDevelopment ? 'dev_recurring_templates' : 'recurring_templates';
    const legacyTableName = isDevelopment ? 'dev_items' : 'items';
    
    // Get the highest display_id from both new and legacy systems
    // CRITICAL FIX: Parse and sort numerically, not alphabetically
    // Extract number from "#1234A" format and sort by that number
    const result = await db.execute(sql`
      SELECT display_id
      FROM (
        SELECT display_id FROM ${sql.identifier(newTableName)} WHERE display_id IS NOT NULL
        UNION ALL
        SELECT display_id FROM ${sql.identifier(legacyTableName)} WHERE display_id IS NOT NULL
      ) combined
      WHERE display_id ~ '^#[0-9]+[A-Z]$'
      ORDER BY
        CAST(SUBSTRING(display_id FROM 2 FOR LENGTH(display_id) - 2) AS INTEGER) DESC,
        RIGHT(display_id, 1) DESC
      LIMIT 1
    `);

    let nextNumber = 1000;
    let nextLetter = 'A';

    if (result.rows.length > 0) {
      const lastDisplayId = result.rows[0].display_id as string;
      
      if (lastDisplayId && lastDisplayId.startsWith('#')) {
        // Parse the last ID (e.g., "#1000A" -> number: 1000, letter: A)
        const match = lastDisplayId.match(/^#(\d+)([A-Z])$/);
        
        if (match) {
          const number = parseInt(match[1]);
          const letter = match[2];
          
          // Increment number first, then letter (1000A, 1001A, 1002A...)
          nextNumber = number + 1;
          nextLetter = 'A';
        }
      }
    }

    const displayId = `#${nextNumber}${nextLetter}`;
    
    console.log(`🆔 Generated new display ID: ${displayId}`);
    return displayId;
    
  } catch (error) {
    console.error('Error generating display ID:', error);
    // Fallback to a random ID if there's an error
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `#${randomNum}${randomLetter}`;
  }
}

/**
 * Assign display IDs to existing items that don't have them
 */
export async function backfillDisplayIds(): Promise<void> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const tableName = isDevelopment ? 'dev_items' : 'items';
  
  try {
    // Get all items without display_id
    const result = await db.execute(sql`
      SELECT id 
      FROM ${sql.identifier(tableName)} 
      WHERE display_id IS NULL 
      ORDER BY created_at ASC
    `);

    console.log(`🔄 Backfilling display IDs for ${result.rows.length} items`);

    for (const row of result.rows) {
      const displayId = await generateNextDisplayId();
      
      await db.execute(sql`
        UPDATE ${sql.identifier(tableName)} 
        SET display_id = ${displayId} 
        WHERE id = ${row.id}
      `);
      
      console.log(`✅ Assigned ${displayId} to item ${row.id}`);
    }
    
    console.log(`🎉 Completed backfill of display IDs`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
  }
}