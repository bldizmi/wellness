/**
 * Debug Display ID Query Issue
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function debugDisplayIdQuery() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  console.log('Environment:', process.env.NODE_ENV);
  console.log('isDevelopment:', isDevelopment);

  const query = sql`
    SELECT 
      ri.id,
      ri.template_id,
      ri.occurrence_date,
      ri.display_id as instance_display_id,
      rt.display_id as template_display_id,
      COALESCE(ri.display_id, rt.display_id) as final_display_id,
      rt.title
    FROM ${isDevelopment ? sql.identifier('dev_recurring_instances') : sql.identifier('recurring_instances')} ri
    LEFT JOIN ${isDevelopment ? sql.identifier('dev_recurring_templates') : sql.identifier('recurring_templates')} rt 
      ON ri.template_id = rt.id
    WHERE ri.occurrence_date = '2025-07-06'
    ORDER BY ri.created_at DESC
    LIMIT 5
  `;

  const result = await db.execute(query);
  console.log('Query result:', JSON.stringify(result.rows, null, 2));
  console.log('Found', result.rows.length, 'items');
}

debugDisplayIdQuery().then(() => process.exit(0));