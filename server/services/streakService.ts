import { db } from "../db";
import { user_streaks } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "./logger";
import { nanoid } from "nanoid";

const logger = createLogger({ service: "streakService" });

/**
 * Calculate and update user streak after item completion
 * This increments streak for EVERY item completion (consecutive item-based tracking)
 */
export async function updateUserStreak(userId: string, completionDate: string) {
  try {
    logger.debug("Updating user streak for item completion", { userId, completionDate });

    const completionDateObj = new Date(completionDate);
    const completionDateStr = completionDateObj.toISOString().split("T")[0];

    // Try to get or create user streak record, handle table not existing
    let streakRecord;
    try {
      streakRecord = await db
        .select()
        .from(user_streaks)
        .where(eq(user_streaks.user_id, userId))
        .limit(1);
    } catch (dbError: any) {
      logger.error("Database table might not exist", { dbError: dbError.message });
      // If table doesn't exist, log and return default
      return {
        id: "",
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_completion_date: completionDateStr,
        streak_start_date: completionDateStr,
        total_completion_days: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();

    if (streakRecord.length === 0) {
      // Create new streak record for first-time user
      const newStreak = {
        id: nanoid(),
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_completion_date: completionDateStr,
        streak_start_date: completionDateStr,
        total_completion_days: 1,
        created_at: now,
        updated_at: now,
      };

      await db.insert(user_streaks).values(newStreak);
      logger.info("Created new streak record for first item completion", newStreak);
      return newStreak;
    }

    const currentStreak = streakRecord[0];
    
    // ITEM-BASED STREAK: Always increment for each item completion
    // No date-based restrictions - every item completion increases streak
    const newCurrentStreak = currentStreak.current_streak + 1;
    
    // Update longest streak if current streak is new record
    const newLongestStreak = Math.max(
      currentStreak.longest_streak,
      newCurrentStreak
    );

    const updatedStreak = {
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_completion_date: completionDateStr,
      streak_start_date: currentStreak.streak_start_date || completionDateStr,
      total_completion_days: currentStreak.total_completion_days + 1,
      updated_at: now,
    };

    await db
      .update(user_streaks)
      .set(updatedStreak)
      .where(eq(user_streaks.user_id, userId));

    logger.info("Updated item-based streak", {
      userId,
      oldStreak: currentStreak.current_streak,
      newStreak: newCurrentStreak,
      message: "Streak increased for item completion"
    });

    return { ...currentStreak, ...updatedStreak };
  } catch (error) {
    logger.error("Error updating user streak", { userId, completionDate, error });
    throw error;
  }
}

/**
 * Get current streak information for a user
 */
export async function getUserStreak(userId: string) {
  try {
    let streakRecord;
    try {
      streakRecord = await db
        .select()
        .from(user_streaks)
        .where(eq(user_streaks.user_id, userId))
        .limit(1);
    } catch (dbError: any) {
      logger.error("Database table might not exist", { dbError: dbError.message });
      // Return default streak if table doesn't exist
      return {
        id: "",
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_completion_date: null,
        streak_start_date: null,
        total_completion_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (streakRecord.length === 0) {
      // Return default streak for new users
      return {
        id: "",
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_completion_date: null,
        streak_start_date: null,
        total_completion_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const streak = streakRecord[0];

    // ITEM-BASED STREAK: No automatic resets based on days
    // Streak persists until manually reset or user chooses to reset
    // The streak represents consecutive item completions, not consecutive days
    
    return streak;
  } catch (error) {
    logger.error("Error getting user streak", { userId, error });
    throw error;
  }
}

/**
 * Check if user has completed any items today (for daily streak calculation)
 * This is used by the streak calculation logic but could also be useful for other features
 */
export async function hasCompletedItemsToday(userId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const isDevelopment = process.env.NODE_ENV === "development";
    const itemsTable = isDevelopment
      ? sql.identifier("dev_items")
      : sql.identifier("items");
    const completionsTable = isDevelopment
      ? sql.identifier("dev_item_completions")
      : sql.identifier("item_completions");

    // Check for any completed items today
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM ${completionsTable} c
        INNER JOIN ${itemsTable} i ON c.item_id = i.id
        WHERE c.user_id = ${userId}
          AND c.completion_date = ${today}
          AND i.assigned_to = ${userId}
      ) as has_completions
    `);

    return result.rows[0]?.has_completions === true;
  } catch (error) {
    logger.error("Error checking daily completions", { userId, error });
    return false;
  }
}