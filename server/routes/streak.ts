/**
 * Streak tracking API endpoints for individual recurring items and overall user streaks
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getUserStreak } from '../services/streakService';
import { createLogger } from '../services/logger';

const router = Router();
const logger = createLogger({ service: 'streakRoutes' });

/**
 * GET /api/streak/overall
 * Get current user's overall streak information (consecutive days with at least one completed item)
 */
router.get('/overall', authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.debug('Getting overall user streak', { userId });

    const streak = await getUserStreak(userId);

    res.json({
      success: true,
      streak,
    });
  } catch (error) {
    logger.error('Error getting overall user streak', { error });
    res.status(500).json({
      error: 'Failed to get streak information',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/streak/:id
 * GET /api/item/:id/streak
 * Returns per-item streak data including current streak, longest streak, and monthly completion rate
 */
router.get('/:id/streak', authMiddleware, async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.user_id;
    const TABLE_PREFIX = process.env.NODE_ENV === 'development' ? 'dev_' : '';

    // Verify item belongs to user using Drizzle ORM
    const isDevelopment = process.env.NODE_ENV === 'development';
    const itemsTable = isDevelopment ? sql.identifier('dev_items') : sql.identifier('items');
    const itemCheck = await db.execute(
      sql`SELECT id FROM ${itemsTable} WHERE id = ${itemId} AND user_id = ${userId}`
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get all completions for this item, ordered by date using Drizzle ORM
    const completionsTable = isDevelopment ? sql.identifier('dev_item_completions') : sql.identifier('item_completions');
    const completionsResult = await db.execute(
      sql`SELECT completion_date FROM ${completionsTable} WHERE item_id = ${itemId} AND user_id = ${userId} ORDER BY completion_date ASC`
    );

    const completions = completionsResult.rows.map((row: any) => row.completion_date);
    
    if (completions.length === 0) {
      return res.json({
        current_streak: 0,
        longest_streak: 0,
        monthly_completion_rate: 0
      });
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Find the most recent completion
    let checkDate = today;
    let foundRecent = false;
    
    // Check if completed today or yesterday to start streak calculation
    if (completions.includes(today)) {
      foundRecent = true;
      checkDate = today;
    } else if (completions.includes(yesterday)) {
      foundRecent = true;
      checkDate = yesterday;
    }
    
    if (foundRecent) {
      // Count consecutive days backwards from the most recent completion
      const checkDateTime = new Date(checkDate + 'T00:00:00');
      let streakDate = new Date(checkDateTime);
      
      while (true) {
        const dateStr = streakDate.toISOString().split('T')[0];
        if (completions.includes(dateStr)) {
          currentStreak++;
          streakDate.setDate(streakDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    for (const completionDate of completions) {
      const currentDate = new Date(completionDate + 'T00:00:00');
      
      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const diffTime = currentDate.getTime() - lastDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      
      lastDate = currentDate;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate monthly completion rate
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyCompletions = completions.filter(date => {
      const completionDate = new Date(date + 'T00:00:00');
      return completionDate.getMonth() === currentMonth && 
             completionDate.getFullYear() === currentYear;
    }).length;
    
    // Calculate days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthlyCompletionRate = Math.round((monthlyCompletions / daysInMonth) * 100);

    res.json({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      monthly_completion_rate: monthlyCompletionRate
    });

  } catch (error) {
    console.error('Error calculating streak:', error);
    res.status(500).json({ error: 'Failed to calculate streak data' });
  }
});

export default router;