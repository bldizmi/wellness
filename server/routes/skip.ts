/**
 * Smart scheduling API endpoints for skipping recurring item occurrences
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/item/:id/skip
 * Skip a single occurrence of a recurring item
 * Body: { skipped_date?: string, reason?: string }
 */
router.post('/:id/skip', authMiddleware, async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.user_id;
    const { skipped_date, reason } = req.body;
    const TABLE_PREFIX = process.env.NODE_ENV === 'development' ? 'dev_' : '';

    // Default to today if no date provided
    const skipDate = skipped_date || new Date().toISOString().split('T')[0];

    // Verify item belongs to user and is recurring using Drizzle ORM
    const isDevelopment = process.env.NODE_ENV === 'development';
    const itemsTable = isDevelopment ? sql.identifier('dev_items') : sql.identifier('items');
    const itemResult = await db.execute(
      sql`SELECT id, recurrence_type FROM ${itemsTable} WHERE id = ${itemId} AND user_id = ${userId}`
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0] as any;
    if (!item.recurrence_type || item.recurrence_type === 'once') {
      return res.status(400).json({ error: 'Cannot skip non-recurring items' });
    }

    // Check if already skipped for this date using Drizzle ORM
    const skipsTable = isDevelopment ? sql.identifier('dev_item_skips') : sql.identifier('item_skips');
    const existingSkip = await db.execute(
      sql`SELECT id FROM ${skipsTable} WHERE item_id = ${itemId} AND user_id = ${userId} AND skipped_date = ${skipDate}`
    );

    if (existingSkip.rows.length > 0) {
      return res.status(400).json({ error: 'Item already skipped for this date' });
    }

    // Check if already completed for this date using Drizzle ORM
    const completionsTable = isDevelopment ? sql.identifier('dev_item_completions') : sql.identifier('item_completions');
    const existingCompletion = await db.execute(
      sql`SELECT id FROM ${completionsTable} WHERE item_id = ${itemId} AND user_id = ${userId} AND completion_date = ${skipDate}`
    );

    if (existingCompletion.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot skip - item already completed for this date' });
    }

    // Create the skip record
    const skipId = nanoid();
    const createdAt = new Date().toISOString();
    
    // Insert skip record using Drizzle ORM
    await db.execute(
      sql`INSERT INTO ${skipsTable} (id, item_id, user_id, skipped_date, reason, created_at) VALUES (${skipId}, ${itemId}, ${userId}, ${skipDate}, ${reason || null}, ${createdAt})`
    );

    res.json({
      success: true,
      message: `Item skipped for ${skipDate}`,
      skip: {
        id: skipId,
        item_id: itemId,
        user_id: userId,
        skipped_date: skipDate,
        reason: reason || null,
        created_at: createdAt
      }
    });

  } catch (error) {
    console.error('Error skipping item:', error);
    res.status(500).json({ error: 'Failed to skip item occurrence' });
  }
});

/**
 * DELETE /api/item/:id/skip/:date
 * Remove a skip for a specific date
 */
router.delete('/:id/skip/:date', authMiddleware, async (req, res) => {
  try {
    const { id: itemId, date } = req.params;
    const userId = req.user_id;
    const TABLE_PREFIX = process.env.NODE_ENV === 'development' ? 'dev_' : '';

    const result = await db.execute(`
      DELETE FROM ${TABLE_PREFIX}item_skips 
      WHERE item_id = $1 AND user_id = $2 AND skipped_date = $3
    `, [itemId, userId, date]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Skip not found' });
    }

    res.json({
      success: true,
      message: `Skip removed for ${date}`
    });

  } catch (error) {
    console.error('Error removing skip:', error);
    res.status(500).json({ error: 'Failed to remove skip' });
  }
});

/**
 * GET /api/item/:id/skips
 * Get all skips for an item
 */
router.get('/:id/skips', authMiddleware, async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.user_id;
    const TABLE_PREFIX = process.env.NODE_ENV === 'development' ? 'dev_' : '';

    const result = await db.execute(`
      SELECT id, skipped_date, reason, created_at
      FROM ${TABLE_PREFIX}item_skips 
      WHERE item_id = $1 AND user_id = $2
      ORDER BY skipped_date DESC
    `, [itemId, userId]);

    res.json({
      success: true,
      skips: result.rows
    });

  } catch (error) {
    console.error('Error fetching skips:', error);
    res.status(500).json({ error: 'Failed to fetch skips' });
  }
});

export default router;