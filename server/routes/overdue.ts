import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import { items } from '@shared/schema';
import { eq, and, lt, ne, sql } from 'drizzle-orm';

// Environment-specific table naming to match other endpoints
const getTableName = (baseName: string) => {
  const prefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
  return `${prefix}${baseName}`;
};

const router = Router();

// GET /api/overdue/count - Get count of overdue items for navigation badge
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user_id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get all items assigned to user (filter by assignee, not creator)
    const allItemsQuery = await db.execute(
      sql`SELECT * FROM ${sql.identifier(getTableName('items'))} 
          WHERE assigned_to = ${user_id}`
    );
    const allItems = allItemsQuery.rows as any[];

    // Helper function to check if item is completed (copied from Plans page)
    const isItemCompleted = (item: any) => {
      if (item.recurrence_type && item.recurrence_type !== 'once') {
        // For recurring items, check both recurring completion AND AI verification
        return item.is_completed_for_date || (item.verified && item.ai_verification_result === 'complete') || (item.verify_required && item.status === 'complete');
      }
      // For one-time items, check completed_at OR verified status
      return item.completed_at || (item.verify_required && item.status === 'complete') || (item.verified && item.ai_verification_result === 'complete');
    };

    // Helper function to check if item is overdue (copied from Plans page)
    const isItemOverdue = (item: any) => {
      // Only check overdue for Tasks, Goals, and Projects (not Habits)
      if (item.item_type === 'habit') return false;
      
      // Must have a due date and be incomplete
      if (!item.due_date || isItemCompleted(item)) return false;
      
      // Parse due date without timezone conversion (same as Plans page)
      const [year, month, day] = item.due_date.split('-');
      const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare dates only
      
      return dueDate < today;
    };

    // Filter items using the exact same logic as Plans page
    const overdueItems = allItems.filter(isItemOverdue);
    const totalOverdueCount = overdueItems.length;

    res.json({ count: totalOverdueCount });
  } catch (error) {
    console.error('Error fetching overdue count:', error);
    res.status(500).json({ error: 'Failed to fetch overdue count' });
  }
});

export default router;