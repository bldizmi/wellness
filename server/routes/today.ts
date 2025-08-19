import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { cacheService } from "../services/cacheService";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { createLogger, measurePerformanceAsync } from "../services/logger";
import {
  getPersonalProgressItemsNew,
  getSharedItemsNew,
  getWeekProgressNew,
} from "../services/phase3ReadingService.js";
import { shouldItemAppearOnDate } from "../services/recurringItemService";

const router = Router();

/**
 * Legacy function for compatibility - gets today items with completion status
 * This function was missing and causing 500 errors
 */
async function getTodayItemsWithCompletion(userId: string, targetDate: string) {
  console.log(
    `🔄 LEGACY: Getting today items with completion for user ${userId} on ${targetDate}`,
  );

  try {
    const result = await getPersonalProgressItemsForDate(userId, targetDate);
    console.log(
      `✅ LEGACY: Successfully fetched ${Object.values(result).flat().length} items`,
    );
    return result;
  } catch (error) {
    console.error(`❌ LEGACY: Error in getTodayItemsWithCompletion:`, error);
    throw error;
  }
}

/**
 * Get personal progress items for a specific date
 * Only includes items assigned to the user for their personal progress
 * Excludes items they created but assigned to others
 */
async function getPersonalProgressItemsForDate(
  userId: string,
  targetDate: string,
) {
  const logger = createLogger({
    userId,
    requestPath: "/today/personal-progress",
  });
  const isDevelopment = process.env.NODE_ENV === "development";

  logger.debug("Querying personal progress items", {
    user_id: userId,
    target_date: targetDate,
    environment: isDevelopment ? "development" : "production",
    table_prefix: isDevelopment ? "dev_" : "",
  });

  // OPTIMIZATION: Single query for both recurring and due date items
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const completionsTable = isDevelopment
    ? sql.identifier("dev_item_completions")
    : sql.identifier("item_completions");
  const skipsTable = isDevelopment
    ? sql.identifier("dev_item_skips")
    : sql.identifier("item_skips");

  // Get day name for recurring logic
  const date = new Date(targetDate);
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDayName = dayNames[date.getDay()];

  const optimizedPersonalProgressQuery = sql`
    WITH user_items AS (
      SELECT 
        i.*,
        CASE 
          WHEN c.completion_date IS NOT NULL THEN true 
          ELSE false 
        END as is_completed_for_date,
        CASE 
          WHEN s.skipped_date IS NOT NULL THEN true 
          ELSE false 
        END as is_skipped_for_date,
        CASE
          WHEN i.recurrence_type IS NULL OR i.recurrence_type = 'once' THEN 'due_date_item'
          ELSE 'recurring_item'
        END as item_category
      FROM ${itemsTable} i
      LEFT JOIN ${completionsTable} c 
        ON i.id = c.item_id AND c.completion_date = ${targetDate} AND c.user_id = ${userId}
      LEFT JOIN ${skipsTable} s 
        ON i.id = s.item_id AND s.skipped_date = ${targetDate} AND s.user_id = ${userId}
      WHERE i.assigned_to = ${userId}
      AND i.created_at::date <= ${targetDate}::date
    )
    SELECT *
    FROM user_items
    WHERE 
      -- Due date items for today
      (item_category = 'due_date_item' AND due_date::text = ${targetDate})
      OR
      -- Recurring items that should appear today
      (item_category = 'recurring_item' AND (
        (recurrence_type = 'daily')
        OR
        (recurrence_type = 'weekly' AND (
          (by_day IS NOT NULL AND by_day::jsonb @> ${JSON.stringify([targetDayName])}::jsonb)
          OR (by_day IS NULL AND EXTRACT(DOW FROM ${targetDate}::date) = EXTRACT(DOW FROM created_at::date))
        ))
      ))
    ORDER BY item_type, created_at DESC
  `;

  console.log(
    `🔍 PERSONAL PROGRESS: Optimized single query for user items on '${targetDate}'`,
  );

  const result = await db.execute(optimizedPersonalProgressQuery);
  const personalProgressItems = result.rows.map((item: any) => ({
    id: item.id,
    display_id: item.display_id,
    title: item.title,
    item_type: item.item_type,
    recurrence_type: item.recurrence_type || "once",
    verify_required: item.verify_required || false,
    verified: item.verified || false,
    ai_verification_result: item.ai_verification_result,
    ai_feedback: item.ai_feedback,
    why_it_matters: item.why_it_matters,
    created_at: item.created_at,
    completed_at: item.completed_at,
    status: item.status,
    is_completed_for_date: item.is_completed_for_date,
    is_skipped_for_date: item.is_skipped_for_date,
    completion_date: targetDate,
    created_by: item.created_by,
    assigned_to: item.assigned_to,
    shared_with: item.shared_with,
    community_id: item.community_id,
    time_frame: item.time_frame,
    due_date: item.due_date,
    by_day: item.by_day,
    by_monthday: item.by_monthday,
    by_week: item.by_week,
    by_month: item.by_month,
  }));

  // All items are already filtered correctly by the optimized query
  logger.debug("Personal progress items aggregated", {
    total_items: personalProgressItems.length,
    recurring_items: personalProgressItems.filter(
      (item: any) => item.recurrence_type !== "once",
    ).length,
    due_date_items: personalProgressItems.filter(
      (item: any) => item.recurrence_type === "once",
    ).length,
    target_date: targetDate,
  });

  return personalProgressItems;
}

/**
 * Get shared items for a specific date
 * Returns items where assigned_to != current_user AND shared_with contains current_user
 * OR items where created_by = current_user AND assigned_to != current_user
 */
async function getSharedItemsForDate(userId: string, targetDate: string) {
  const logger = createLogger({ userId, requestPath: "/today/shared" });
  const isDevelopment = process.env.NODE_ENV === "development";

  logger.debug("Querying shared items", {
    user_id: userId,
    target_date: targetDate,
    environment: isDevelopment ? "development" : "production",
  });

  // OPTIMIZATION: Single query for both recurring and due date shared items
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const completionsTable = isDevelopment
    ? sql.identifier("dev_item_completions")
    : sql.identifier("item_completions");
  const skipsTable = isDevelopment
    ? sql.identifier("dev_item_skips")
    : sql.identifier("item_skips");

  // Get day name for recurring logic
  const date = new Date(targetDate);
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDayName = dayNames[date.getDay()];

  const optimizedSharedItemsQuery = sql`
    WITH shared_items AS (
      SELECT 
        i.*,
        CASE 
          WHEN c.completion_date IS NOT NULL THEN true 
          ELSE false 
        END as is_completed_for_date,
        CASE 
          WHEN s.skipped_date IS NOT NULL THEN true 
          ELSE false 
        END as is_skipped_for_date,
        CASE
          WHEN i.recurrence_type IS NULL OR i.recurrence_type = 'once' THEN 'due_date_item'
          ELSE 'recurring_item'
        END as item_category
      FROM ${itemsTable} i
      LEFT JOIN ${completionsTable} c 
        ON i.id = c.item_id AND c.completion_date = ${targetDate} AND c.user_id = ${userId}
      LEFT JOIN ${skipsTable} s 
        ON i.id = s.item_id AND s.skipped_date = ${targetDate} AND s.user_id = ${userId}
      WHERE i.item_type != 'habit'
      AND (
        (i.created_by = ${userId} AND i.assigned_to != ${userId})
        OR (i.shared_with::jsonb @> ${JSON.stringify([userId])}::jsonb AND i.assigned_to != ${userId})
      )
      AND i.created_at::date <= ${targetDate}::date
    )
    SELECT *
    FROM shared_items
    WHERE 
      -- Due date items for today
      (item_category = 'due_date_item' AND due_date::text = ${targetDate})
      OR
      -- Recurring items that should appear today
      (item_category = 'recurring_item' AND (
        (recurrence_type = 'daily')
        OR
        (recurrence_type = 'weekly' AND (
          (by_day IS NOT NULL AND by_day::jsonb @> ${JSON.stringify([targetDayName])}::jsonb)
          OR (by_day IS NULL AND EXTRACT(DOW FROM ${targetDate}::date) = EXTRACT(DOW FROM created_at::date))
        ))
      ))
    ORDER BY item_type, created_at DESC
  `;

  console.log(
    `🔍 SHARED ITEMS: Optimized single query for shared items on '${targetDate}'`,
  );

  const result = await db.execute(optimizedSharedItemsQuery);
  const sharedItems = result.rows.map((item: any) => ({
    id: item.id,
    display_id: item.display_id,
    title: item.title,
    item_type: item.item_type,
    recurrence_type: item.recurrence_type || "once",
    verify_required: item.verify_required || false,
    verified: item.verified || false,
    ai_verification_result: item.ai_verification_result,
    ai_feedback: item.ai_feedback,
    why_it_matters: item.why_it_matters,
    created_at: item.created_at,
    completed_at: item.completed_at,
    due_date: item.due_date,
    created_by: item.created_by,
    assigned_to: item.assigned_to,
    shared_with: item.shared_with,
    community_id: item.community_id,
    time_frame: item.time_frame,
    status: item.status,
    is_completed_for_date: item.is_completed_for_date,
    is_skipped_for_date: item.is_skipped_for_date,
    completion_date: targetDate,
    by_day: item.by_day,
    by_monthday: item.by_monthday,
    by_week: item.by_week,
    by_month: item.by_month,
  }));

  // All items are already filtered correctly by the optimized query
  console.log(
    `🔍 SHARED ITEMS: Found ${sharedItems.length} shared items for ${targetDate}`,
  );

  return sharedItems;
}

/**
 * Get shared recurring items for a specific date
 * Returns items where created_by = user AND assigned_to != user
 * OR items where shared_with contains user AND assigned_to != user
 */
async function getSharedRecurringItemsForDate(
  userId: string,
  targetDate: string,
) {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Get shared items using Drizzle ORM - items created by user but assigned to others, or shared with user but not assigned to them
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const completionsTable = isDevelopment
    ? sql.identifier("dev_item_completions")
    : sql.identifier("item_completions");
  const skipsTable = isDevelopment
    ? sql.identifier("dev_item_skips")
    : sql.identifier("item_skips");

  const sharedItemsQuery = sql`
    SELECT * FROM ${itemsTable} 
    WHERE (
      (created_by = ${userId} AND assigned_to != ${userId})
      OR (${itemsTable}.shared_with::jsonb @> ${JSON.stringify([userId])}::jsonb AND assigned_to != ${userId})
    )
    AND recurrence_type IS NOT NULL 
    AND recurrence_type != 'once'
  `;
  const itemsResult = await db.execute(sharedItemsQuery);
  const sharedItems = itemsResult.rows;

  // Get completions and skips for shared items (note: completions are tied to assigned_to user, not current user)
  if (sharedItems.length === 0) {
    // No shared items, return empty result
    return [];
  }

  const itemIds = sharedItems.map((item: any) => item.id);

  // Use IN clause instead of ANY for better compatibility
  const completionsQuery = sql`
    SELECT item_id, completion_date FROM ${completionsTable} 
    WHERE item_id IN (${sql.join(
      itemIds.map((id: string) => sql`${id}`),
      sql`, `,
    )})
  `;
  const skipsQuery = sql`
    SELECT item_id, skip_date FROM ${skipsTable} 
    WHERE item_id IN (${sql.join(
      itemIds.map((id: string) => sql`${id}`),
      sql`, `,
    )})
  `;

  const [completionsResult, skipsResult] = await Promise.all([
    db.execute(completionsQuery),
    db.execute(skipsQuery),
  ]);

  const completions = new Map();
  completionsResult.rows.forEach((row: any) => {
    if (!completions.has(row.item_id)) {
      completions.set(row.item_id, new Set());
    }
    completions.get(row.item_id).add(row.completion_date);
  });

  const skips = new Map();
  skipsResult.rows.forEach((row: any) => {
    if (!skips.has(row.item_id)) {
      skips.set(row.item_id, new Set());
    }
    skips.get(row.item_id).add(row.skip_date);
  });

  // Filter shared items that should appear on target date
  const sharedRecurringInstances = [];

  for (const item of sharedItems) {
    try {
      if (shouldItemAppearOnDate(item, targetDate)) {
        // Check if completed on this specific date
        const itemCompletions = completions.get(item.id) || new Set();
        const itemSkips = skips.get(item.id) || new Set();
        const isCompletedForDate = itemCompletions.has(targetDate);
        const isSkippedForDate = itemSkips.has(targetDate);

        // Add recurring instance for this date
        sharedRecurringInstances.push({
          id: item.id,
          display_id: item.display_id,
          title: item.title,
          item_type: item.item_type,
          recurrence_type: item.recurrence_type,
          verify_required: item.verify_required || false,
          verified: item.verified || false,
          ai_verification_result: item.ai_verification_result,
          ai_feedback: item.ai_feedback,
          why_it_matters: item.why_it_matters,
          created_at: item.created_at,
          completed_at: item.completed_at,
          due_date: item.due_date,
          created_by: item.created_by,
          assigned_to: item.assigned_to,
          shared_with: item.shared_with,
          community_id: item.community_id,
          time_frame: item.time_frame,
          status: item.status,
          is_completed_for_date: isCompletedForDate,
          is_skipped_for_date: isSkippedForDate,
          completion_date: targetDate,
        });
      }
    } catch (error) {
      console.error(
        `Error processing shared recurring item ${item.id}:`,
        error,
      );
      // Continue processing other items
    }
  }

  return sharedRecurringInstances;
}

/**
 * Get recurring items that belong to user's personal progress
 * Only includes items assigned to the user
 */
async function getPersonalRecurringItemsForDate(
  userId: string,
  targetDate: string,
) {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Get user items using Drizzle ORM - only items created by or assigned to user
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const completionsTable = isDevelopment
    ? sql.identifier("dev_item_completions")
    : sql.identifier("item_completions");
  const skipsTable = isDevelopment
    ? sql.identifier("dev_item_skips")
    : sql.identifier("item_skips");

  const userItemsQuery = sql`
    SELECT * FROM ${itemsTable} 
    WHERE assigned_to = ${userId}
    AND recurrence_type IS NOT NULL 
    AND recurrence_type != 'once'
  `;
  const itemsResult = await db.execute(userItemsQuery);
  const userItems = itemsResult.rows;

  // Get completions and skips for the user
  const completionsQuery = sql`
    SELECT item_id, completion_date FROM ${completionsTable} 
    WHERE user_id = ${userId}
  `;
  const completionsResult = await db.execute(completionsQuery);

  const skipsQuery = sql`
    SELECT item_id, skipped_date FROM ${skipsTable} 
    WHERE user_id = ${userId}
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

  const recurringInstances = [];

  for (const item of userItems) {
    // Use existing logic to check if item should appear on date
    if (shouldItemAppearOnDate(item as any, targetDate)) {
      const completionKey = `${item.id}:${targetDate}`;
      const skipKey = `${item.id}:${targetDate}`;
      const isCompleted = completions.has(completionKey);
      const isSkipped = skips.has(skipKey);

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
        completed_at: (item as any).completed_at || undefined,
        status: (item as any).status || undefined,
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
        by_month: ((item as any).by_month as string[]) || undefined,
      });
    }
  }

  return recurringInstances;
}

/**
 * Get items with specific due_date matching the target date
 */
async function getItemsWithSpecificDueDate(userId: string, targetDate: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  console.log(
    `🔍 Querying items with specific due_date = ${targetDate} using ${isDevelopment ? "development" : "production"} tables`,
  );

  // Query items with due_date matching target date exactly
  // Include items where user is creator, assigned to, or in shared_with array (for Shared section)
  // Show all items on their due date regardless of completion status (UI handles completion display)
  const itemsTable = isDevelopment
    ? sql.identifier("dev_items")
    : sql.identifier("items");
  const query = sql`
    SELECT * FROM ${itemsTable} 
    WHERE (
      created_by = ${userId} 
      OR assigned_to = ${userId}
      OR ${itemsTable}.shared_with::jsonb @> ${JSON.stringify([userId])}::jsonb
    )
    AND due_date::text = ${targetDate}
  `;

  console.log(
    `🔍 EXACT QUERY: Looking for items with due_date exactly matching '${targetDate}'`,
  );
  console.log(
    `🔍 SQL EXECUTION: SELECT * FROM ${isDevelopment ? "dev_items" : "items"} WHERE (...) AND due_date = '${targetDate}'`,
  );

  const result = await db.execute(query);
  console.log(
    `📊 Raw database results for due_date='${targetDate}': ${result.rows.length} items found`,
  );

  if (result.rows.length > 0) {
    console.log(
      "🔍 Sample items with due dates:",
      result.rows.map((item: any) => ({
        id: item.id,
        display_id: item.display_id,
        title: item.title,
        due_date: item.due_date,
        due_date_type: typeof item.due_date,
      })),
    );
  }

  return result.rows.map((item: any) => ({
    id: item.id,
    display_id: item.display_id,
    title: item.title,
    item_type: item.item_type,
    recurrence_type: item.recurrence_type || "once",
    verify_required: item.verify_required || false,
    verified: item.verified || false,
    ai_verification_result: item.ai_verification_result,
    ai_feedback: item.ai_feedback,
    why_it_matters: item.why_it_matters,
    created_at: item.created_at,
    completed_at: item.completed_at, // Added missing completed_at field
    due_date: item.due_date,
    created_by: item.created_by,
    assigned_to: item.assigned_to,
    shared_with: item.shared_with,
    community_id: item.community_id,
    time_frame: item.time_frame,
    status: item.status, // Added status field for completion checks
  }));
}

/**
 * Merge recurring items with items that have specific due dates, avoiding duplicates
 */
function mergeRecurringAndDueDateItems(
  recurringItems: any,
  dueDateItems: any[],
) {
  // Create a set of recurring item IDs to avoid duplicates
  const recurringItemIds = new Set();
  Object.values(recurringItems)
    .flat()
    .forEach((item: any) => {
      recurringItemIds.add(item.id);
    });

  // Filter out due date items that are already in recurring items
  const uniqueDueDateItems = dueDateItems.filter(
    (item) => !recurringItemIds.has(item.id),
  );

  console.log(
    `🔧 Filtered ${dueDateItems.length - uniqueDueDateItems.length} duplicate items`,
  );

  // Group due date items by type
  const dueDateGrouped = {
    tasks: uniqueDueDateItems.filter((item) => item.item_type === "task"),
    habits: uniqueDueDateItems.filter((item) => item.item_type === "habit"),
    goals: uniqueDueDateItems.filter((item) => item.item_type === "goal"),
    projects: uniqueDueDateItems.filter((item) => item.item_type === "project"),
  };

  // Merge with recurring items
  return {
    tasks: [...(recurringItems.tasks || []), ...dueDateGrouped.tasks],
    habits: [...(recurringItems.habits || []), ...dueDateGrouped.habits],
    goals: [...(recurringItems.goals || []), ...dueDateGrouped.goals],
    projects: [...(recurringItems.projects || []), ...dueDateGrouped.projects],
  };
}

/**
 * GET /api/today
 * Hybrid approach with intelligent caching: Get recurring items + items with specific due dates
 */
router.get("/", authMiddleware, async (req, res) => {
  console.log(
    `🔥 ROOT ROUTE: /api/today/ called - this should NOT handle personal-progress requests!`,
  );
  console.log(`🔥 ROOT ROUTE: Full path was:`, req.originalUrl);
  console.log(`🔥 ROOT ROUTE: Path was:`, req.path);

  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`🔍 BACKEND RECEIVED: Raw query params:`, req.query);

    // Use client_date parameter if provided, otherwise use current date in local timezone
    const clientDate = req.query.client_date as string;
    const currentLocalDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
    const targetDate = clientDate || currentLocalDate;

    console.log(`🔍 BACKEND PROCESSING: targetDate='${targetDate}'`);

    // Check cache first with graceful fallback
    const cacheKey = "today_items";
    const cacheParams = { date: targetDate };
    let cachedResult;

    try {
      cachedResult = cacheService.get(userId, cacheKey, cacheParams);
      if (cachedResult) {
        console.log(
          `⚡ CACHE HIT: Returning cached today items for ${targetDate}`,
        );
        return res.json(cachedResult);
      }
    } catch (cacheError) {
      console.log(`⚠️ CACHE ERROR: ${cacheError}, falling back to live query`);
    }

    console.log(`🔄 CACHE MISS: Fetching fresh today items for ${targetDate}`);

    // Using stable legacy system only
    console.log(`🔄 LEGACY: Using proven legacy system for user ${userId}`);

    // Get recurring items for the target date (items without specific due dates)
    const recurringItems = await getTodayItemsWithCompletion(
      userId,
      targetDate,
    );
    console.log(
      `🔄 Found ${Object.values(recurringItems).flat().length} recurring items for ${targetDate}`,
    );

    // Get items with specific due_date matching the target date
    const dueDateItems = await getItemsWithSpecificDueDate(userId, targetDate);
    console.log(
      `📅 Found ${dueDateItems.length} items with specific due_date on ${targetDate}`,
    );

    // Merge both types, avoiding duplicates
    const mergedItems = mergeRecurringAndDueDateItems(
      recurringItems,
      dueDateItems,
    );
    console.log(
      `✅ Final merged items: ${Object.values(mergedItems).flat().length} total`,
    );

    // Cache the result with 10-minute TTL (graceful fallback on cache errors)
    try {
      // FIXED: Reduce cache TTL for immediate completion state consistency
      const cacheTTL = 2 * 60 * 1000; // 2 minutes
      cacheService.set(userId, cacheKey, mergedItems, cacheParams, cacheTTL);
      console.log(
        `💾 CACHED: Today items for ${targetDate} cached for 2 minutes`,
      );
    } catch (cacheError) {
      console.log(
        `⚠️ CACHE STORE ERROR: ${cacheError}, continuing without cache`,
      );
    }

    res.json(mergedItems);
  } catch (error) {
    console.error("Error fetching today items:", error);
    res.status(500).json({ error: "Failed to fetch today items" });
  }
});

/**
 * GET /api/today/personal-progress - Get personal progress items for a specific date
 * Only includes items assigned to the user for their personal progress
 * Query params: date - ISO date string for the target date
 */
router.get("/personal-progress", authMiddleware, async (req, res) => {
  const logger = createLogger({
    userId: req.user_id,
    requestPath: "/api/today/personal-progress",
  });
  const startTime = Date.now();

  try {
    const { date } = req.query;
    const userId = req.user_id as string;

    if (!date || typeof date !== "string") {
      return res
        .status(400)
        .json({ error: "date query parameter is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // OPTIMIZATION 1: Enhanced cache with longer TTL and smart keys
    const cacheKey = `personal-progress-v2-${date}`;
    const cached = cacheService.get(userId, cacheKey);
    if (cached) {
      logger.info("Cache READ HIT for personal-progress", {
        target_date: date,
        cache_key: cacheKey,
        full_key: `development:${userId}:${cacheKey}:`,
        cache_hit_time_ms: Date.now() - startTime,
      });
      return res.json(cached);
    }

    logger.info("Cache READ MISS for personal-progress", {
      target_date: date,
      cache_key: cacheKey,
      full_key: `development:${userId}:${cacheKey}:`,
    });

    // PHASE 5: New Architecture Only - No Fallback Needed
    console.log(
      `🚀 PHASE 5: Using new recurring_instances architecture for user ${userId}`,
    );

    const groupedPersonalItems = await measurePerformanceAsync(
      "new_architecture_personal_progress",
      () => getPersonalProgressItemsNew(userId, date),
      logger,
    );

    // FIXED: Synchronize cache TTL to approved value for completion state consistency
    const cacheTTL = 120000; // 120,000ms = 2 minutes
    cacheService.set(userId, cacheKey, groupedPersonalItems, null, cacheTTL);

    logger.info("Cache SET for personal-progress", {
      target_date: date,
      cache_key: cacheKey,
      full_key: `development:${userId}:${cacheKey}:`,
      ttl_ms: cacheTTL,
      data_size: JSON.stringify(groupedPersonalItems).length,
    });

    const totalTime = Date.now() - startTime;

    const totalItems =
      groupedPersonalItems.tasks.length +
      groupedPersonalItems.habits.length +
      groupedPersonalItems.goals.length +
      groupedPersonalItems.projects.length;

    logger.performance("Personal progress endpoint optimization", totalTime, {
      target_date: date,
      cache_miss: true,
      total_items: totalItems,
      tasks: groupedPersonalItems.tasks.length,
      habits: groupedPersonalItems.habits.length,
      goals: groupedPersonalItems.goals.length,
      projects: groupedPersonalItems.projects.length,
      optimization_target: "<200ms",
      performance_status:
        totalTime < 200 ? "TARGET_ACHIEVED" : "NEEDS_FURTHER_OPTIMIZATION",
      baseline_improvement:
        totalTime < 1600
          ? `${Math.round(((1600 - totalTime) / 1600) * 100)}% faster`
          : "slower",
    });

    console.log(
      `🔍 PERSONAL PROGRESS: Found ${totalItems} personal progress items for ${date}`,
    );
    res.json(groupedPersonalItems);
  } catch (error) {
    logger.error("Error in optimized personal progress endpoint", { error });
    res.status(500).json({ error: "Failed to fetch personal progress items" });
  }
});

/**
 * GET /api/today/personal-progress/week - Get personal progress items for calendar (7 days)
 * Only includes items that count toward user's personal progress (created_by OR assigned_to user)
 * Excludes shared items that don't belong to the user's personal progress tracking
 * Query params: start_date - ISO date string for the start of the week
 */
router.get("/personal-progress/week", authMiddleware, async (req, res) => {
  try {
    const { start_date } = req.query;
    const userId = req.user_id as string;

    if (!start_date || typeof start_date !== "string") {
      return res
        .status(400)
        .json({ error: "start_date query parameter is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // Generate array of 7 dates starting from start_date
    const weekDates: string[] = [];
    const startDate = new Date(start_date);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDates.push(date.toISOString().split("T")[0]);
    }

    console.log(
      `📅 PERSONAL PROGRESS WEEK: Fetching personal progress data for week starting ${start_date}, dates: ${weekDates.join(", ")}`,
    );

    const logger = createLogger({
      userId,
      requestPath: "/api/today/personal-progress/week",
    });
    const optimizationStartTime = Date.now();

    // DISABLED CACHE - Always fetch fresh data to avoid sync issues
    // const weekCacheKey = `week-progress-${weekDates.join("-")}`;
    // const cachedWeek = cacheService.get(userId, weekCacheKey);
    // if (cachedWeek) {
    //   logger.debug("Cache hit for week progress", {
    //     week_dates: weekDates,
    //     cache_hit_time_ms: Date.now() - optimizationStartTime,
    //   });
    //   return res.json(cachedWeek);
    // }

    // PHASE 5: New Architecture Only for Week Data
    console.log(
      `🚀 PHASE 5: Using new architecture week queries for user ${userId}`,
    );

    const weekData = await measurePerformanceAsync(
      "new_architecture_week_progress",
      () => getWeekProgressNew(userId, weekDates),
      logger,
    );

    // DISABLED CACHE - Don't cache to ensure fresh data
    // const cacheTTL = 2 * 60 * 1000; // 2 minutes
    // cacheService.set(userId, weekCacheKey, weekData, null, cacheTTL);

    const totalOptimizationTime = Date.now() - optimizationStartTime;

    logger.performance(
      "Week progress optimization metrics",
      totalOptimizationTime,
      {
        week_dates: weekDates,
        optimization_target: "<500ms",
        performance_status:
          totalOptimizationTime < 500
            ? "TARGET_ACHIEVED"
            : "NEEDS_FURTHER_OPTIMIZATION",
        baseline_improvement:
          totalOptimizationTime < 2000
            ? `${Math.round(((2000 - totalOptimizationTime) / 2000) * 100)}% faster`
            : "slower",
        caching_enabled: true,
      },
    );

    console.log(
      `✅ PERSONAL PROGRESS WEEK: Successfully fetched personal progress data for 7 days`,
    );
    res.json(weekData);
  } catch (error) {
    console.error("Error fetching personal progress week data:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch personal progress week data" });
  }
});

/**
 * GET /api/today/week - Get items for an entire week (7 days)
 * Used by calendar component to load all week data simultaneously
 * Query params: start_date - ISO date string for the start of the week
 */
router.get("/week", authMiddleware, async (req, res) => {
  try {
    const { start_date } = req.query;
    const userId = req.user_id as string;

    if (!start_date || typeof start_date !== "string") {
      return res
        .status(400)
        .json({ error: "start_date query parameter is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // Generate array of 7 dates starting from start_date
    const weekDates = [];
    const startDate = new Date(start_date);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDates.push(date.toISOString().split("T")[0]);
    }

    console.log(
      `📅 WEEK BATCH: Fetching data for week starting ${start_date}, dates: ${weekDates.join(", ")}`,
    );

    // Fetch data for all 7 days in parallel
    const weekDataPromises = weekDates.map(async (date: string) => {
      // Try cache first
      const cacheKey = `today_items_${date}`;
      const cacheParams = { targetDate: date };

      try {
        const cachedData = cacheService.get(userId, cacheKey, cacheParams);
        if (cachedData) {
          console.log(
            `⚡ CACHE HIT: Today items for ${date} served from cache`,
          );
          return { date, data: cachedData };
        }
      } catch (cacheError) {
        console.log(
          `⚠️ CACHE READ ERROR for ${date}: ${cacheError}, fetching from database`,
        );
      }

      // Fetch from database
      const recurringItems = await getTodayItemsWithCompletion(userId, date);
      const specificItems = await getItemsWithSpecificDueDate(userId, date);

      // Merge and deduplicate using the same logic as individual /api/today endpoint
      const mergedItems = mergeRecurringAndDueDateItems(
        recurringItems,
        specificItems,
      );

      // Cache the result
      try {
        // FIXED: Reduce cache TTL for immediate completion state consistency
        const cacheTTL = 2 * 60 * 1000; // 2 minutes
        cacheService.set(userId, cacheKey, mergedItems, cacheParams, cacheTTL);
        console.log(`💾 CACHED: Today items for ${date} cached for 2 minutes`);
      } catch (cacheError) {
        console.log(
          `⚠️ CACHE STORE ERROR for ${date}: ${cacheError}, continuing without cache`,
        );
      }

      return { date, data: mergedItems };
    });

    // Wait for all days to complete
    const weekData = await Promise.all(weekDataPromises);

    // Transform to object format for easy frontend consumption
    const weekDataObject = weekData.reduce(
      (acc, { date, data }) => {
        acc[date] = data;
        return acc;
      },
      {} as Record<string, any>,
    );

    console.log(
      `✅ WEEK BATCH: Successfully fetched data for ${weekDates.length} days`,
    );
    res.json(weekDataObject);
  } catch (error) {
    console.error("Error fetching week data:", error);
    res.status(500).json({ error: "Failed to fetch week data" });
  }
});

/**
 * GET /api/today/shared - Get shared items for a specific date
 * Returns items that are not assigned to the user but are shared with them
 * Scenario 1: User creates item, assigns to someone else → appears here
 * Scenario 2: Community member creates item, shares with user → appears here
 */
router.get("/shared", authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user_id as string;

    if (!date || typeof date !== "string") {
      return res
        .status(400)
        .json({ error: "date query parameter is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // Check cache first
    const cacheKey = `shared-items-v2-${date}`;
    const cached = cacheService.get(userId, cacheKey);
    if (cached) {
      console.log(`⚡ CACHE HIT: Shared items for ${date} served from cache`);
      return res.json(cached);
    }

    // PHASE 5: New Architecture Only for Shared Items
    console.log(
      `🚀 PHASE 5: Using new architecture for shared items - user: ${userId}, date: ${date}`,
    );

    const groupedSharedItems = await getSharedItemsNew(userId, date);

    // FIXED: Synchronize cache TTL to 2 minutes for consistency with other Today page caches
    const cacheTTL = 2 * 60 * 1000; // 2 minutes
    cacheService.set(userId, cacheKey, groupedSharedItems, null, cacheTTL);

    // Calculate total count for logging
    const totalCount =
      groupedSharedItems.tasks.length +
      groupedSharedItems.goals.length +
      groupedSharedItems.projects.length;
    console.log(
      `🔍 SHARED ITEMS: Found ${totalCount} shared items for ${date}`,
    );
    res.json(groupedSharedItems);
  } catch (error) {
    console.error("Error fetching shared items:", error);
    res.status(500).json({ error: "Failed to fetch shared items" });
  }
});

export default router;
