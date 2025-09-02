import { Router } from "express";
import { z } from "zod";
import {
  completeItemForDate,
  isItemCompletedForDate,
  removeCompletionForDate,
  getItemCompletionHistory,
  calculateCompletionStreak,
} from "../services/itemCompletionService";
import { userHasItemAccess } from "../services/itemVisibilityService";
import { cacheService } from "../services/cacheService";
import { db } from "../db";
import { items, recurring_instances, item_completions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "../services/logger";
import { updateUserStreak } from "../services/streakService";
import { nanoid } from "nanoid";

/**
 * PHASE 1: Feature flag for targeted cache invalidation
 * Scoped to specific user account only for testing
 * RE-ENABLED after fixing import error
 */
const TARGETED_CACHE_INVALIDATION_USERS = new Set<string>([
  'feykLj0oBPQLaa7JU0WpNXxoiz33' // Your user ID - re-enabled after TypeScript fixes
]);

/**
 * PHASE 1: Helper to get cache keys for a specific item completion
 * Returns only the personal-progress key for the target date
 */
function getCacheKeysForItem(userId: string, effectiveDate: string, itemId: string) {
  const env = process.env.NODE_ENV || 'development';
  const personalProgressKey = `personal-progress-v2-${effectiveDate}`;
  const fullKey = `${env}:${userId}:${personalProgressKey}:`;
  
  return {
    personalProgressKey,
    fullKey,
    effectiveDate
  };
}

/**
 * PHASE 1: Targeted cache invalidation with timeout and logging
 */
async function invalidateCacheForCompletion(userId: string, effectiveDate: string, itemId: string, logger: any) {
  const startTime = Date.now();
  const timeoutMs = 200;
  let timeoutHit = false;
  
  try {
    const { personalProgressKey, fullKey } = getCacheKeysForItem(userId, effectiveDate, itemId);
    
    // B) Log the invalidation with full key
    logger.info('PH1_INVALIDATE', {
      keys: [fullKey],
      awaited: true
    });
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
    
    // Create invalidation promise  
    const invalidationPromise = Promise.resolve().then(async () => {
      // B) Show the line that calls cacheService.invalidate for personal-progress
      await Promise.all([
        cacheService.invalidate(userId, personalProgressKey)
      ]);
      return [fullKey];
    });
    
    // Race between invalidation and timeout
    const invalidatedKeys = await Promise.race([invalidationPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    
    logger.info('Targeted cache invalidation completed', {
      invalidation_keys: invalidatedKeys,
      invalidation_duration_ms: duration,
      timeout_hit: timeoutHit,
      effective_date: effectiveDate,
      item_id: itemId
    });
    
    return { success: true, timeoutHit, invalidatedKeys };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    timeoutHit = (error as Error).message === 'Timeout';
    
    if (timeoutHit) {
      // Background cleanup could be enqueued here if needed
      logger.info('Cache invalidation timeout - partial invalidation', {
        invalidation_duration_ms: duration,
        timeout_hit: true,
        partial_invalidation: true,
        effective_date: effectiveDate,
        item_id: itemId
      });
    } else {
      logger.error('Cache invalidation error', {
        error: (error as Error).message,
        invalidation_duration_ms: duration,
        effective_date: effectiveDate,
        item_id: itemId
      });
    }
    
    return { success: false, timeoutHit, error: (error as Error).message };
  }
}

const router = Router();

// Validation schemas
const completeItemSchema = z.object({
  completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  date_override: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  verification_data: z.any().optional(),
});

/**
 * FIXED: Week cache invalidation function that matches the week endpoint
 */
function invalidateWeekCache(user_id: string, targetDate: string) {
  try {
    console.log(
      `🧹 WEEK CACHE INVALIDATION: Starting for user ${user_id} and date ${targetDate}`,
    );

    // CRITICAL FIX: Calculate week start from the TARGET DATE, not today
    const targetDateObj = new Date(targetDate + "T00:00:00"); // Avoid timezone issues
    const dayOfWeek = targetDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const weekStart = new Date(targetDateObj);
    weekStart.setDate(targetDateObj.getDate() - dayOfWeek); // Go back to Sunday

    // Generate the exact same week dates array as the week endpoint
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDates.push(date.toISOString().split("T")[0]);
    }

    const weekCacheKey = `week-progress-${weekDates.join("-")}`;

    console.log(`📅 WEEK CACHE: Target date: ${targetDate}`);
    console.log(
      `📅 WEEK CACHE: Week start: ${weekStart.toISOString().split("T")[0]}`,
    );
    console.log(`📅 WEEK CACHE: Week dates: ${weekDates.join(", ")}`);
    console.log(`📅 WEEK CACHE: Cache key: ${weekCacheKey}`);

    // Invalidate the week cache
    cacheService.invalidate(user_id, weekCacheKey);

    // ADDITIONAL: Invalidate ALL week caches for this user (safety net)
    try {
      if ('invalidateUserPatterns' in cacheService && typeof cacheService.invalidateUserPatterns === 'function') {
        (cacheService as any).invalidateUserPatterns(user_id, ["week-progress-*"]);
        console.log(
          `🗑️ PATTERN INVALIDATION: Cleared all week-progress-* caches for user`,
        );
      }
    } catch (patternError) {
      console.log(
        `⚠️ PATTERN INVALIDATION: Not supported, continuing with specific key`,
      );
    }

    console.log(`✅ WEEK CACHE: Successfully invalidated ${weekCacheKey}`);
  } catch (error) {
    console.error(`❌ WEEK CACHE ERROR: ${(error as Error).message}`);
  }
}

/**
 * POST /api/item/:id/complete - Complete item for specific date
 */
router.post("/:id/complete", async (req, res) => {
  // A) Handler entry & flag proof - First line logging before any early returns
  const { id: itemId } = req.params;
  const { user_id } = req;
  const correlationId = `completion-${Date.now()}`;
  
  // Compute flags at runtime
  const phase1Flag = TARGETED_CACHE_INVALIDATION_USERS.has(user_id || '');
  const phase2Flag = false; // Phase 2 not implemented yet
  
  // A) PH1_ENTRY - First line of handler
  console.log(`PH1_ENTRY ${JSON.stringify({
    userId: user_id || 'undefined',
    itemId: itemId,
    route: "POST /api/item/:id/complete", 
    phase1Flag: phase1Flag,
    phase2Flag: phase2Flag,
    correlationId: correlationId
  })}`);
  
  // A) PH1_FLAG_INPUTS - Raw values for Phase-1 flag computation  
  console.log(`PH1_FLAG_INPUTS ${JSON.stringify({
    userId: user_id || 'undefined',
    targetSetContains: TARGETED_CACHE_INVALIDATION_USERS.has(user_id || ''),
    env: process.env.NODE_ENV || 'development',
    featureFlagName: 'TARGETED_CACHE_INVALIDATION_USERS'
  })}`);

  if (!user_id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // PHASE 1: Create logger for correlation with personal-progress endpoint
  const logger = createLogger({
    userId: user_id,
    requestPath: req.path,
    correlationId: correlationId
  });
  
  try {
    // Validate request body
    const validatedData = completeItemSchema.parse(req.body);
    const { completion_date, date_override, verification_data } = validatedData;

    // Use date_override if provided, otherwise completion_date, otherwise today
    const finalCompletionDate =
      date_override ||
      completion_date ||
      new Date().toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Check if completing early (for next occurrence only)
    let isEarlyCompletion = false;
    if (date_override && date_override !== today) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      if (date_override !== tomorrow) {
        return res.status(400).json({
          error: "Early completion only allowed for next occurrence (tomorrow)",
        });
      }
      isEarlyCompletion = true;
    }

    // PHASE 1: Add correlation debugging at entry point
    console.log(`🎯 PHASE 1 ENTRY: POST /api/item/${itemId}/complete for user ${user_id}`);
    console.log(`🎯 PHASE 1 DATE: finalCompletionDate = ${finalCompletionDate}`);

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, itemId);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // HYBRID COMPLETION CHECK: Check both new architecture and legacy systems
    let alreadyCompleted = false;

    // Use raw table names to match Phase 3 reading system
    const isDevelopment = process.env.NODE_ENV === "development";
    const instancesTable = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";

    // First check if this is a new architecture item and if it's already complete
    try {
      const instanceQuery = sql`
        SELECT status FROM ${sql.raw(instancesTable)} 
        WHERE id = ${itemId}
        LIMIT 1
      `;
      const instanceResult = await db.execute(instanceQuery);

      if (
        instanceResult.rows.length > 0 &&
        instanceResult.rows[0].status === "complete"
      ) {
        alreadyCompleted = true;
        console.log(
          `📝 NEW ARCHITECTURE: Instance ${itemId} already completed with status: ${instanceResult.rows[0].status}`,
        );
      } else if (instanceResult.rows.length > 0) {
        console.log(
          `📝 NEW ARCHITECTURE: Instance ${itemId} has status: ${instanceResult.rows[0].status} (not complete)`,
        );
      } else {
        console.log(`📝 NEW ARCHITECTURE: Instance ${itemId} not found in recurring_instances`);
      }
    } catch (error) {
      // If new architecture check fails, continue to legacy check
      console.log(
        `🔄 NEW ARCHITECTURE CHECK FAILED: Falling back to legacy completion check`,
      );
    }

    // If not completed in new architecture, check legacy system
    if (!alreadyCompleted) {
      alreadyCompleted = await isItemCompletedForDate(
        itemId,
        user_id,
        finalCompletionDate,
      );
    }

    if (alreadyCompleted) {
      // Even if already completed, invalidate cache to ensure UI shows correct status
      try {
        console.log(
          "🧹 ALREADY COMPLETED CACHE: Invalidating cache for already completed item",
        );

        // Invalidate specific date cache using exact pattern from cacheService
        const personalCacheKey = "personal-progress-v2-" + finalCompletionDate;
        const sharedCacheKey = "shared-items-v2-" + finalCompletionDate;

        cacheService.invalidate(user_id, personalCacheKey);
        cacheService.invalidate(user_id, sharedCacheKey);
        console.log(
          `🗑️ INVALIDATED: ${personalCacheKey} and ${sharedCacheKey}`,
        );

        // FIXED: Use the correct week cache invalidation
        invalidateWeekCache(user_id, finalCompletionDate);

        console.log(
          "🧹 ALREADY COMPLETED CACHE: Cache invalidated successfully",
        );
      } catch (cacheError) {
        console.log(`⚠️ ALREADY COMPLETED CACHE ERROR: ${cacheError}`);
      }

      return res.json({
        success: true,
        message: "Item already completed for this date",
        completion: null,
      });
    }

    // HYBRID COMPLETION: Support both legacy items and new recurring_instances architecture
    let completion;

    // First, check if this is a new architecture item using raw table names to match Phase 3 reading system
    try {
      const instanceQuery = sql`
        SELECT id, status, template_id, occurrence_date, assigned_to
        FROM ${sql.raw(instancesTable)} 
        WHERE id = ${itemId}
        LIMIT 1
      `;
      const instanceResult = await db.execute(instanceQuery);

      if (instanceResult.rows.length > 0) {
        const instanceItem = instanceResult.rows[0];
        console.log(
          `🔄 NEW ARCHITECTURE COMPLETION: Completing recurring instance ${itemId} for date ${finalCompletionDate}`,
        );
        console.log(
          `📊 INSTANCE DETAILS: id=${instanceItem.id}, occurrence_date=${instanceItem.occurrence_date}, current_status=${instanceItem.status}`,
        );

        // Update the instance status directly - simplified approach
        const updateQuery = sql`
          UPDATE ${sql.raw(instancesTable)}
          SET status = 'complete',
              completed_at = ${new Date().toISOString()},
              completed_by = ${user_id}
          WHERE id = ${itemId}
        `;
        await db.execute(updateQuery);
        
        console.log(`✅ UPDATED: Instance ${itemId} marked as complete`);
        
        // IMPORTANT: Also store in item_completions table with template_id for streak tracking
        try {
          const completionId = nanoid();
          await db.insert(item_completions).values({
            id: completionId,
            item_id: itemId,
            template_id: instanceItem.template_id || null, // Store template_id for streak tracking (nullable)
            user_id: user_id,
            completion_date: finalCompletionDate,
            completed_at: new Date().toISOString(),
            verification_data: verification_data || null,
            created_at: new Date().toISOString(),
          });
          
          console.log(`📊 STREAK: Stored completion with template_id ${instanceItem.template_id} for streak tracking`);
        } catch (completionError) {
          // Don't fail the entire completion if streak tracking fails
          console.error(`⚠️ STREAK WARNING: Failed to store completion for streak tracking:`, completionError);
          console.error(`Details: item_id=${itemId}, template_id=${instanceItem.template_id}, user_id=${user_id}`);
          // Continue with the completion process
        }
        
        console.log(
          `✅ UPDATED: Instance ${itemId} with occurrence_date=${instanceItem.occurrence_date} now has status='complete'`,
        );

        completion = {
          id: itemId,
          item_id: itemId,
          user_id: user_id,
          completion_date: finalCompletionDate,
          completed_at: new Date().toISOString(),
        };

        console.log(
          `✅ NEW ARCHITECTURE: Instance ${itemId} marked complete for date ${finalCompletionDate}`,
        );
      } else {
        // Fallback to legacy completion system for items in legacy table
        console.log(
          `📝 LEGACY COMPLETION: Using legacy completion system for item ${itemId}`,
        );
        completion = await completeItemForDate(
          itemId,
          user_id,
          finalCompletionDate,
          verification_data,
        );
      }
    } catch (architectureError) {
      console.error(`⚠️ HYBRID COMPLETION ERROR: ${(architectureError as Error).message}`);
      // Fallback to legacy system if new architecture fails
      console.log(
        `🔄 FALLBACK: Using legacy completion system for item ${itemId}`,
      );
      completion = await completeItemForDate(
        itemId,
        user_id,
        finalCompletionDate,
        verification_data,
      );
    }

    // PHASE 1: Check if user is enabled for targeted cache invalidation
    if (TARGETED_CACHE_INVALIDATION_USERS.has(user_id)) {
      console.log(`🎯 PHASE 1: Using targeted cache invalidation for user ${user_id}`);
      
      // Use the item's effective date (occurrence_date for new architecture, finalCompletionDate for legacy)
      let effectiveDate = finalCompletionDate;
      
      // For new architecture items, try to get the occurrence_date
      try {
        const instanceQuery = sql`
          SELECT occurrence_date FROM ${sql.raw(instancesTable)} 
          WHERE id = ${itemId}
          LIMIT 1
        `;
        const instanceResult = await db.execute(instanceQuery);
        
        if (instanceResult.rows.length > 0 && instanceResult.rows[0].occurrence_date) {
          effectiveDate = String(instanceResult.rows[0].occurrence_date);
        }
      } catch (error) {
        // Use finalCompletionDate as fallback
      }
      
      // B) Effective date & keys - before invalidate
      console.log(`PH1_EFFECTIVE_DATE_PT: ${effectiveDate}`);
      const cacheKeys = getCacheKeysForItem(user_id, effectiveDate, itemId);
      console.log(`PH1_CACHE_KEYS ${JSON.stringify({
        keys: [cacheKeys.fullKey]
      })}`);
      
      // C) Invalidate call site logging - right before call  
      console.log(`PH1_INVALIDATE_START ${JSON.stringify({
        keys: [cacheKeys.fullKey],
        awaiting: true,
        timeout_ms: 200
      })}`);
      
      const startTime = Date.now();
      // Targeted invalidation with timeout
      const result = await invalidateCacheForCompletion(user_id, effectiveDate, itemId, logger);
      const duration = Date.now() - startTime;
      
      // C) Invalidate call site logging - right after awaiting
      console.log(`PH1_INVALIDATE_END ${JSON.stringify({
        duration_ms: duration,
        timeout_hit: result?.timeoutHit || false,
        keys: [cacheKeys.fullKey]
      })}`);
      
    } else {
      // Legacy comprehensive cache invalidation for other users
      try {
        console.log(
          "🧹 COMPLETION CACHE: Starting comprehensive Today page cache invalidation",
        );
        console.log(
          `📅 COMPLETION CACHE: Invalidating for user ${user_id} and date ${finalCompletionDate}`,
        );

        // Get current date and completion date for targeted invalidation
        const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
        const dates = new Set([today, finalCompletionDate]);

        // Invalidate legacy cache keys
        cacheService.invalidate(user_id, "today_items");
        cacheService.invalidate(user_id, `today_items_${finalCompletionDate}`);

        // D) Guard against Phase 2 leakage - Only for non-Phase 1 users
        // NOTE: This legacy path should NOT execute for Phase 1 users
        dates.forEach((date) => {
          cacheService.invalidate(user_id, "personal-progress-v2-" + date);
          // Phase 2 behavior disabled: shared-items invalidation commented out
          // cacheService.invalidate(user_id, "shared-items-v2-" + date);
        });
        
        // PHASE 0: Mirror invalidation at INFO level for correlation
        logger.info('Completion cache invalidation completed', {
          completion_date: finalCompletionDate,
          invalidated_dates: Array.from(dates),
          personal_progress_keys: Array.from(dates).map(d => `personal-progress-v2-${d}`),
          shared_items_keys: Array.from(dates).map(d => `shared-items-v2-${d}`)
        });

        // FIXED: Use the correct week cache invalidation
        invalidateWeekCache(user_id, finalCompletionDate);

        // General items cache for backward compatibility
        cacheService.invalidate(user_id, "/api/items");

        console.log(
          "🧹 COMPLETION CACHE: Successfully invalidated all Today page caches",
        );
        console.log(
          `✅ COMPLETION CACHE: Cache invalidation completed for dates: ${Array.from(dates).join(", ")}`,
        );
      } catch (cacheError) {
        console.log(
          `⚠️ CACHE INVALIDATION ERROR: ${cacheError}, continuing without cache invalidation`,
        );
      }
    }

    // Update user's overall streak after successful completion
    try {
      console.log(`🔥 STREAK UPDATE: Updating streak for user ${user_id} on date ${finalCompletionDate}`);
      await updateUserStreak(user_id, finalCompletionDate);
      console.log(`🔥 STREAK SUCCESS: Streak updated successfully for user ${user_id}`);
    } catch (streakError) {
      // Don't fail the entire completion if streak update fails
      console.error(`⚠️ STREAK ERROR: Failed to update streak for user ${user_id}:`, streakError);
    }

    const message = isEarlyCompletion
      ? `Item completed for ${finalCompletionDate} (early completion)`
      : `Item completed for ${finalCompletionDate}`;

    console.log(
      `🎉 COMPLETION SUCCESS: Item ${itemId} completed successfully for date ${finalCompletionDate}`,
    );

    res.json({
      success: true,
      message,
      completion,
    });
  } catch (error) {
    console.error("Error completing item:", error);
    if ((error as any).name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request data",
        details: (error as any).errors,
      });
    }
    res.status(500).json({ error: "Failed to complete item" });
  }
});

/**
 * DELETE /api/item/:id/completions/:date - Remove completion for specific date
 */
router.delete("/:id/completions/:date", async (req, res) => {
  try {
    const { id: itemId, date: completionDate } = req.params;
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, itemId);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // HYBRID UNCOMPLETE: Support both legacy items and new recurring_instances architecture
    let success = false;

    // Use consistent environment-aware table selection to match Phase 3 reading system
    const isDevelopment = process.env.NODE_ENV === "development";
    const instancesTable = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";

    // First, try to uncomplete in new architecture using raw table names
    try {
      // Use a transaction to ensure immediate commit
      const result = await db.transaction(async (tx) => {
        const updateResult = await tx.execute(sql`
          UPDATE ${sql.raw(instancesTable)} 
          SET status = 'pending', 
              completed_at = NULL,
              completed_by = NULL
          WHERE id = ${itemId} AND status = 'complete'
        `);

        if (updateResult.rowCount && updateResult.rowCount > 0) {
          // Verify the update within the transaction
          const verifyQuery = sql`
            SELECT status FROM ${sql.raw(instancesTable)} 
            WHERE id = ${itemId}
            LIMIT 1
          `;
          const verifyResult = await tx.execute(verifyQuery);
          
          if (verifyResult.rows.length > 0) {
            console.log(
              `✅ VERIFIED IN TRANSACTION: Instance ${itemId} status is now: ${verifyResult.rows[0].status}`,
            );
          }
        }

        return updateResult;
      });

      if (result.rowCount && result.rowCount > 0) {
        console.log(
          `🔄 NEW ARCHITECTURE UNCOMPLETE: Reset recurring instance ${itemId} to pending`,
        );
        console.log(
          `✅ TRANSACTION COMMITTED: Instance ${itemId} is now pending`,
        );
        success = true;
      }
    } catch (architectureError) {
      console.error(
        `⚠️ NEW ARCHITECTURE UNCOMPLETE ERROR: ${(architectureError as Error).message}`,
      );
    }

    // If new architecture didn't handle it, try legacy system
    if (!success) {
      console.log(
        `📝 LEGACY UNCOMPLETE: Using legacy completion removal for item ${itemId}`,
      );
      await removeCompletionForDate(itemId, user_id, completionDate);
    }

    // FIXED: Invalidate comprehensive Today page caches
    try {
      console.log(
        "🧹 COMPLETION REMOVAL CACHE: Starting comprehensive Today page cache invalidation",
      );

      // Get current date and completion date for targeted invalidation
      const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
      const dates = new Set([today, completionDate]);

      // Invalidate legacy cache keys
      cacheService.invalidate(user_id, "today_items");
      cacheService.invalidate(user_id, `today_items_${completionDate}`);

      // Invalidate all Today page query cache keys using correct cache key format
      dates.forEach((date) => {
        cacheService.invalidate(user_id, "personal-progress-v2-" + date);
        cacheService.invalidate(user_id, "shared-items-v2-" + date);
      });

      // FIXED: Use the correct week cache invalidation
      invalidateWeekCache(user_id, completionDate);

      // General items cache for backward compatibility
      cacheService.invalidate(user_id, "/api/items");

      console.log(
        "🧹 COMPLETION REMOVAL CACHE: Successfully invalidated all Today page caches",
      );
    } catch (cacheError) {
      console.log(
        `⚠️ CACHE INVALIDATION ERROR: ${cacheError}, continuing without cache invalidation`,
      );
    }

    res.json({
      success: true,
      message: "Completion removed successfully",
      completion_date: completionDate,
    });
  } catch (error) {
    console.error("Error removing completion:", error);
    res.status(500).json({ error: "Failed to remove completion" });
  }
});

/**
 * GET /api/item/:id/completions - Get completion history
 */
router.get("/:id/completions", async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const { user_id } = req;
    const limit = parseInt(req.query.limit as string) || 30;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, itemId);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // Get completion history
    const completions = await getItemCompletionHistory(itemId, user_id, limit);

    res.json({
      success: true,
      completions,
      total: completions.length,
    });
  } catch (error) {
    console.error("Error fetching completion history:", error);
    res.status(500).json({ error: "Failed to fetch completion history" });
  }
});

/**
 * GET /api/item/:id/streak - Get completion streak information
 */
router.get("/:id/streak", async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, itemId);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // HYBRID ITEM LOOKUP: Check both legacy items table and new recurring_instances architecture
    let item = null;
    let recurrenceType = 'once';

    // First, try to find in legacy items table
    const [legacyItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (legacyItem) {
      item = legacyItem;
      recurrenceType = legacyItem.recurrence_type || 'once';
      console.log(`📝 STREAK API: Found legacy item ${itemId} with recurrence_type: ${recurrenceType}`);
    } else {
      // If not found in legacy table, check recurring_instances table
      try {
        const isDevelopment = process.env.NODE_ENV === "development";
        const instancesTable = isDevelopment ? "dev_recurring_instances" : "recurring_instances";
        const templatesTable = isDevelopment ? "dev_recurring_templates" : "recurring_templates";
        
        const instanceQuery = sql`
          SELECT ri.*, rt.recurrence_type, rt.title, rt.item_type
          FROM ${sql.raw(instancesTable)} ri
          JOIN ${sql.raw(templatesTable)} rt ON ri.template_id = rt.id
          WHERE ri.id = ${itemId}
          LIMIT 1
        `;
        const instanceResult = await db.execute(instanceQuery);
        
        if (instanceResult.rows.length > 0) {
          const instanceData = instanceResult.rows[0];
          // Convert instance to item-like structure
          item = {
            id: instanceData.id,
            title: instanceData.title,
            item_type: instanceData.item_type,
            recurrence_type: instanceData.recurrence_type,
          };
          recurrenceType = instanceData.recurrence_type || 'daily';
          console.log(`📝 STREAK API: Found recurring instance ${itemId} with recurrence_type: ${recurrenceType}`);
        }
      } catch (architectureError) {
        console.error(`⚠️ STREAK API ARCHITECTURE ERROR: ${(architectureError as Error).message}`);
      }
    }

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Calculate streak
    const streak = await calculateCompletionStreak(
      itemId,
      user_id,
      recurrenceType,
    );

    res.json({
      success: true,
      streak,
      item_id: itemId,
      recurrence_type: item.recurrence_type,
    });
  } catch (error) {
    console.error("Error calculating streak:", error);
    res.status(500).json({ error: "Failed to calculate streak" });
  }
});

// Route registration logging
console.log('ROUTE_REGISTERED {"method":"POST","path":"/api/item/:id/complete","file":"server/routes/itemCompletion.ts"}');

export default router;
