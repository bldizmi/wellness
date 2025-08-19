/**
 * Fix missing display IDs in recurring_instances and recurring_templates
 * Assigns proper display IDs to items that don't have them
 */

import { db } from './server/db.ts';
import { generateNextDisplayId } from './server/utils/displayId.js';
import { sql } from 'drizzle-orm';

const isDevelopment = process.env.NODE_ENV === 'development';

async function fixDisplayIds() {
  try {
    console.log('🔧 Starting display ID fix for new architecture items...');
    
    // Step 1: Fix templates without display_id
    const templatesResult = await db.execute(sql`
      SELECT id, title 
      FROM ${isDevelopment ? sql.identifier('dev_recurring_templates') : sql.identifier('recurring_templates')} 
      WHERE display_id IS NULL
      ORDER BY created_at ASC
    `);
    
    console.log(`📋 Found ${templatesResult.rows.length} templates without display_id`);
    
    for (const template of templatesResult.rows) {
      const displayId = await generateNextDisplayId();
      
      await db.execute(sql`
        UPDATE ${isDevelopment ? sql.identifier('dev_recurring_templates') : sql.identifier('recurring_templates')}
        SET display_id = ${displayId}
        WHERE id = ${template.id}
      `);
      
      console.log(`✅ Assigned ${displayId} to template "${template.title}"`);
    }
    
    // Step 2: Fix instances without display_id by copying from their templates
    const instancesResult = await db.execute(sql`
      SELECT ri.id, ri.template_id, rt.display_id as template_display_id, rt.title
      FROM ${isDevelopment ? sql.identifier('dev_recurring_instances') : sql.identifier('recurring_instances')} ri
      LEFT JOIN ${isDevelopment ? sql.identifier('dev_recurring_templates') : sql.identifier('recurring_templates')} rt 
        ON ri.template_id = rt.id
      WHERE ri.display_id IS NULL
      ORDER BY ri.created_at ASC
    `);
    
    console.log(`📋 Found ${instancesResult.rows.length} instances without display_id`);
    
    for (const instance of instancesResult.rows) {
      // For instances, use the template's display_id (they share the same ID for consistency)
      const displayId = instance.template_display_id;
      
      if (displayId) {
        await db.execute(sql`
          UPDATE ${isDevelopment ? sql.identifier('dev_recurring_instances') : sql.identifier('recurring_instances')}
          SET display_id = ${displayId}
          WHERE id = ${instance.id}
        `);
        
        console.log(`✅ Assigned ${displayId} to instance of "${instance.title}"`);
      } else {
        console.log(`⚠️ Warning: Instance ${instance.id} has no template display_id available`);
      }
    }
    
    console.log('🎉 Display ID fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing display IDs:', error);
    process.exit(1);
  }
}

// Run the fix
fixDisplayIds();