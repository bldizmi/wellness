import { db } from "../db";
import { items, item_completions } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { isItemCompletedForDate } from "./itemCompletionService";

/**
 * Enhancement 4: Edge Case Validation Functions
 */

/**
 * Validates that a recurrence configuration is complete
 */
function validateRecurrenceConfig(item: any): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (item.recurrence_type === "weekly") {
    if (
      !item.by_day ||
      !Array.isArray(item.by_day) ||
      item.by_day.length === 0
    ) {
      issues.push("Weekly item missing by_day configuration");
    }
  }

  if (item.recurrence_type === "monthly") {
    if (!item.by_monthday && !(item.by_week && item.by_day)) {
      issues.push(
        "Monthly item missing both by_monthday and by_week/by_day configuration",
      );
    }
  }

  if (item.recurrence_type === "yearly") {
    if (!item.by_month || !item.by_monthday) {
      issues.push("Yearly item missing by_month or by_monthday configuration");
    }
  }

  return { isValid: issues.length === 0, issues };
}

/**
 * Handles edge cases for dates that don't exist (like Feb 30th)
 */
function getLastValidDayOfMonth(
  year: number,
  month: number,
  targetDay: number,
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(targetDay, daysInMonth);
}

/**
 * Enhancement 2: Improved Week-of-Month Calculation
 * Calculates which week of the month a date falls in, accounting for what day the month starts on
 */
function getWeekOfMonth(date: Date): number {
  // Get the first day of the month
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);

  // Get what day of week the month starts on (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = firstDay.getDay();

  // Calculate the date of the first occurrence of the target weekday
  const targetDayOfWeek = date.getDay();

  // Find the first occurrence of this weekday in the month
  let firstOccurrence = 1 + ((targetDayOfWeek - firstDayOfWeek + 7) % 7);

  // Calculate which occurrence this date represents
  const weekNumber = Math.floor((date.getDate() - firstOccurrence) / 7) + 1;

  // Ensure we don't return week 5 for months that only have 4 weeks of this day
  const lastDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const maxWeeksInMonth =
    Math.floor((lastDayOfMonth - firstOccurrence) / 7) + 1;

  return Math.min(weekNumber, maxWeeksInMonth);
}

export interface RecurringItemInstance {
  id: string;
  display_id?: string;
  title: string;
  item_type: string;
  recurrence_type: string;
  verify_required: boolean;
  verified?: boolean;
  ai_verification_result?: string;
  ai_feedback?: string;
  why_it_matters?: string;
  created_at: string;
  completed_at?: string;
  status?: string;
  is_completed_for_date: boolean;
  is_skipped_for_date?: boolean;
  completion_date: string;
  created_by: string;
  assigned_to?: string;
  shared_with?: string[];
  community_id?: string;
  time_frame?: number;
  due_date?: string;
  by_day?: string[];
  by_monthday?: number;
  by_week?: number;
  by_month?: string;
}

/**
 * Check if an item should appear on a specific date based on recurrence rules
 */
export function shouldItemAppearOnDate(item: any, targetDate: string): boolean {
  const date = new Date(targetDate + "T23:59:59");
  const itemCreatedDate = new Date(item.created_at);

  // Only show items created before or on the target date
  if (itemCreatedDate > date) {
    return false;
  }

  // Only process items with recurrence patterns (excluding one-time items)
  if (!item.recurrence_type || item.recurrence_type === "once") {
    return false;
  }

  // Enhancement 4: Validate recurrence configuration and log issues
  const validation = validateRecurrenceConfig(item);
  if (!validation.isValid) {
    console.log(
      `⚠️ Item ${item.id} has configuration issues:`,
      validation.issues,
    );
  }

  // Daily recurrence - simplified logic
  if (item.recurrence_type === "daily") {
    return date >= itemCreatedDate;
  }

  // Weekly items
  if (item.recurrence_type === "weekly") {
    if (item.by_day && Array.isArray(item.by_day) && item.by_day.length > 0) {
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const currentDayName = dayNames[date.getDay()];

      // FIX: Only show on target days AND only on/after creation date
      // This ensures items created "starting today" appear on the correct schedule
      return item.by_day.includes(currentDayName) && date >= itemCreatedDate;
    } else {
      // Enhanced fallback: use creation day with logging, but only on/after creation date
      console.log(
        `⚠️ Weekly item ${item.id} has no by_day configuration, using creation day fallback`,
      );
      return (
        date.getDay() === itemCreatedDate.getDay() && date >= itemCreatedDate
      );
    }
  }

  // Monthly items
  if (item.recurrence_type === "monthly") {
    if (item.by_monthday) {
      return date.getDate() === item.by_monthday;
    }
    if (item.by_week && item.by_day && Array.isArray(item.by_day)) {
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const currentDayName = dayNames[date.getDay()];
      if (item.by_day.includes(currentDayName)) {
        // Enhancement 2: Use improved week-of-month calculation
        const weekOfMonth = getWeekOfMonth(date);
        const matches = weekOfMonth === item.by_week;

        // Add logging for debugging week calculations
        if (process.env.NODE_ENV === "development") {
          console.log(
            `📅 Monthly item ${item.id}: ${currentDayName} week ${weekOfMonth} (target: week ${item.by_week}) = ${matches ? "MATCH" : "NO MATCH"}`,
          );
        }

        return matches;
      }
    }
    // Enhanced fallback: use creation date with logging
    console.log(
      `⚠️ Monthly item ${item.id} has incomplete configuration, using creation date fallback`,
    );
    return date.getDate() === itemCreatedDate.getDate();
  }

  // Yearly items
  if (item.recurrence_type === "yearly") {
    if (item.by_month && item.by_monthday) {
      const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      const currentMonthName = months[date.getMonth()];

      // Enhancement 4: Handle edge cases for invalid dates (like Feb 30th)
      if (currentMonthName === item.by_month) {
        const validDay = getLastValidDayOfMonth(
          date.getFullYear(),
          date.getMonth(),
          item.by_monthday,
        );
        if (validDay !== item.by_monthday) {
          console.log(
            `⚠️ Yearly item ${item.id} adjusted from day ${item.by_monthday} to ${validDay} for ${currentMonthName}`,
          );
        }
        return date.getDate() === validDay;
      }
      return false;
    }
    // Enhanced fallback: same month and day as creation with logging
    console.log(
      `⚠️ Yearly item ${item.id} has incomplete configuration, using creation date fallback`,
    );
    return (
      date.getMonth() === itemCreatedDate.getMonth() &&
      date.getDate() === itemCreatedDate.getDate()
    );
  }

  // Semi-annual items (every 6 months)
  if (item.recurrence_type === "semi-annual") {
    const monthsSinceCreation =
      (date.getFullYear() - itemCreatedDate.getFullYear()) * 12 +
      (date.getMonth() - itemCreatedDate.getMonth());
    return (
      monthsSinceCreation % 6 === 0 &&
      date.getDate() === itemCreatedDate.getDate()
    );
  }

  return false;
}

/**
 * Get all recurring items that should appear on a specific date with completion status
 */
export async function getRecurringItemsForDate(
  userId: string,
  targetDate: string,
): Promise<RecurringItemInstance[]> {
  const isDevelopment = process.env.NODE_ENV === "development";
  console.log(
    `🔍 Querying recurring items for user ${userId} on ${targetDate} using ${isDevelopment ? "development" : "production"} tables`,
  );

  // Get all items for the user using Drizzle ORM with dynamic table selection
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const completionsTable = isDevelopment
    ? sql.identifier("dev_item_completions")
    : sql.identifier("item_completions");
  const skipsTable = isDevelopment
    ? sql.identifier("dev_item_skips")
    : sql.identifier("item_skips");

  // Get user items using Drizzle ORM - include items created by, assigned to, or shared with user
  const userItemsQuery = sql`
    SELECT * FROM ${itemsTable} 
    WHERE (
      created_by = ${userId}
      OR assigned_to = ${userId}
      OR (shared_with IS NOT NULL AND shared_with ? ${userId})
    )
    AND recurrence_type IS NOT NULL 
    AND recurrence_type != 'once'
  `;
  const itemsResult = await db.execute(userItemsQuery);
  const userItems = itemsResult.rows;

  console.log(`📊 Found ${userItems.length} total items for user ${userId}`);
  console.log(
    "Items:",
    userItems.map((item) => ({
      id: item.id,
      title: item.title,
      recurrence_type: item.recurrence_type,
    })),
  );

  // Get completions and skips for filtering using Drizzle ORM - include completions for items assigned to user
  const completionsQuery = sql`
    SELECT item_id, completion_date FROM ${completionsTable} 
    WHERE user_id = ${userId}
    OR item_id IN (
      SELECT id FROM ${itemsTable} 
      WHERE assigned_to = ${userId} AND recurrence_type IS NOT NULL
    )
  `;
  const completionsResult = await db.execute(completionsQuery);

  const skipsQuery = sql`
    SELECT item_id, skipped_date FROM ${skipsTable} 
    WHERE user_id = ${userId}
    OR item_id IN (
      SELECT id FROM ${itemsTable} 
      WHERE assigned_to = ${userId} AND recurrence_type IS NOT NULL
    )
  `;
  const skipsResult = await db.execute(skipsQuery);

  const completions = new Set(
    completionsResult.rows.map(
      (row: any) => `${row.item_id}:${row.completion_date}`,
    ),
  );

  const skips = new Set(
    skipsResult.rows.map((row: any) => `${row.item_id}:${row.skipped_date}`),
  );

  const recurringInstances: RecurringItemInstance[] = [];

  for (const item of userItems) {
    if (shouldItemAppearOnDate(item as any, targetDate)) {
      // Check if completed or skipped for today
      const completionKey = `${item.id}:${targetDate}`;
      const skipKey = `${item.id}:${targetDate}`;
      const isCompleted = completions.has(completionKey);
      const isSkipped = skips.has(skipKey);

      // Note: We no longer hide skipped items completely
      // Instead, they appear with a visual indicator

      recurringInstances.push({
        id: (item as any).id,
        display_id: (item as any).display_id || undefined,
        title: (item as any).title,
        item_type: (item as any).item_type,
        recurrence_type: (item as any).recurrence_type || "once",
        verify_required: (item as any).verify_required || false,
        verified: (item as any).verified || undefined,
        ai_verification_result:
          (item as any).ai_verification_result || undefined,
        ai_feedback: (item as any).ai_feedback || undefined,
        why_it_matters: (item as any).why_it_matters || undefined,
        created_at: (item as any).created_at,
        completed_at: (item as any).completed_at || undefined, // Added completed_at field
        status: (item as any).status || undefined, // Added status field
        is_completed_for_date: isCompleted,
        is_skipped_for_date: isSkipped,
        completion_date: targetDate,
        created_by: (item as any).created_by,
        assigned_to: (item as any).assigned_to || undefined,
        shared_with: ((item as any).shared_with as string[]) || undefined,
        community_id: (item as any).community_id || undefined,
        time_frame: (item as any).time_frame || undefined,
        due_date: (item as any).due_date || undefined,
        by_day: ((item as any).by_day as string[]) || undefined,
        by_monthday: (item as any).by_monthday || undefined,
        by_week: (item as any).by_week || undefined,
        by_month: (item as any).by_month || undefined,
      });
    }
  }

  console.log(
    `✅ Returning ${recurringInstances.length} recurring items for ${targetDate}`,
  );
  return recurringInstances;
}

/**
 * Get items for today with enhanced recurring logic
 */
export async function getTodayItemsWithCompletion(
  userId: string,
  targetDate?: string,
): Promise<{
  tasks: RecurringItemInstance[];
  habits: RecurringItemInstance[];
  goals: RecurringItemInstance[];
  projects: RecurringItemInstance[];
}> {
  const today = targetDate || new Date().toISOString().split("T")[0];
  const recurringItems = await getRecurringItemsForDate(userId, today);

  // Group by type
  const grouped = {
    tasks: recurringItems.filter((item) => item.item_type === "task"),
    habits: recurringItems.filter((item) => item.item_type === "habit"),
    goals: recurringItems.filter((item) => item.item_type === "goal"),
    projects: recurringItems.filter((item) => item.item_type === "project"),
  };

  return grouped;
}
