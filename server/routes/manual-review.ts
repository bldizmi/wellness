import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import {
  items,
  manual_review_actions,
  users,
  communities,
  community_members,
  recurring_instances,
  recurring_templates,
} from "@shared/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cacheService } from "../services/cacheService";

const router = Router();

/**
 * GET /api/manual-review/pending
 * Get items pending manual review that the user can review - HYBRID ARCHITECTURE
 */
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `🔍 FETCH PENDING REVIEWS HYBRID: Checking both architectures for user ${userId}`,
    );

    // Get user's role to determine if they can review items
    const user = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, userId))
      .limit(1);
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = user[0].role;
    const isAdmin = userRole === "admin";

    let reviewableItems = [];

    // First, collect all unique user IDs we'll need to look up
    const userIdsToLookup = new Set();

    if (isAdmin) {
      console.log(
        `👑 FETCH PENDING REVIEWS HYBRID: Admin access - fetching all pending items`,
      );

      // STEP 1: Fetch from NEW architecture (recurring_instances)
      try {
        const isDevelopment = process.env.NODE_ENV === "development";
        const verificationsTable = isDevelopment
          ? "dev_item_verification_attempts"
          : "item_verification_attempts";

        const newArchitecturePendingItemsRaw = await db.execute(sql`
          SELECT
            ri.id,
            rt.title,
            rt.item_type,
            rt.created_by,
            ri.assigned_to,
            rt.community_id,
            iva.image_urls,
            ri.ai_feedback,
            ri.updated_at as manual_review_requested_at,
            ri.notes as manual_review_reason,
            'new' as architecture
          FROM ${isDevelopment ? sql.raw('dev_recurring_instances') : sql.raw('recurring_instances')} ri
          LEFT JOIN ${isDevelopment ? sql.raw('dev_recurring_templates') : sql.raw('recurring_templates')} rt
            ON ri.template_id = rt.id
          LEFT JOIN LATERAL (
            SELECT image_urls
            FROM ${sql.raw(verificationsTable)}
            WHERE item_id = ri.id
            ORDER BY created_at DESC
            LIMIT 1
          ) iva ON true
          WHERE ri.status = 'pending_review'
        `);

        const newArchitecturePendingItems = newArchitecturePendingItemsRaw.rows;

        reviewableItems.push(...newArchitecturePendingItems);

        // Add user IDs to lookup set
        newArchitecturePendingItems.forEach((item) => {
          if (item.created_by) userIdsToLookup.add(item.created_by);
          if (item.assigned_to) userIdsToLookup.add(item.assigned_to);
        });

        console.log(
          `✅ FETCH PENDING REVIEWS HYBRID: Found ${newArchitecturePendingItems.length} items in NEW architecture`,
        );
      } catch (error) {
        console.log(
          `⚠️ FETCH PENDING REVIEWS HYBRID: Error fetching from new architecture:`,
          error.message,
        );
      }

      // STEP 2: Fetch from LEGACY architecture (items table)
      try {
        const legacyPendingItems = await db
          .select({
            id: items.id,
            title: items.title,
            item_type: items.item_type,
            created_by: items.created_by,
            assigned_to: items.assigned_to,
            community_id: items.community_id,
            image_urls: items.image_urls,
            ai_feedback: items.ai_feedback,
            manual_review_requested_at: items.manual_review_requested_at,
            manual_review_reason: items.manual_review_reason,
            architecture: sql`'legacy'`.as("architecture"),
          })
          .from(items)
          .where(eq(items.status, "pending"));

        reviewableItems.push(...legacyPendingItems);

        // Add user IDs to lookup set
        legacyPendingItems.forEach((item) => {
          if (item.created_by) userIdsToLookup.add(item.created_by);
          if (item.assigned_to) userIdsToLookup.add(item.assigned_to);
        });

        console.log(
          `✅ FETCH PENDING REVIEWS HYBRID: Found ${legacyPendingItems.length} items in LEGACY architecture`,
        );
      } catch (error) {
        console.log(
          `⚠️ FETCH PENDING REVIEWS HYBRID: Error fetching from legacy architecture:`,
          error.message,
        );
      }
    } else {
      console.log(
        `👤 FETCH PENDING REVIEWS HYBRID: Regular user access - fetching community items only`,
      );

      // Get user's communities
      const userCommunities = await db
        .select({ community_id: community_members.community_id })
        .from(community_members)
        .where(eq(community_members.user_id, userId));

      const communityIds = userCommunities.map((c) => c.community_id);

      if (communityIds.length > 0) {
        // STEP 1: Fetch from NEW architecture (recurring_instances) - community items only
        try {
          const isDevelopment = process.env.NODE_ENV === "development";
          const verificationsTable = isDevelopment
            ? "dev_item_verification_attempts"
            : "item_verification_attempts";

          const newArchitectureSharedItemsRaw = await db.execute(sql`
            SELECT
              ri.id,
              rt.title,
              rt.item_type,
              rt.created_by,
              ri.assigned_to,
              rt.community_id,
              iva.image_urls,
              ri.ai_feedback,
              ri.updated_at as manual_review_requested_at,
              ri.notes as manual_review_reason,
              'new' as architecture
            FROM ${isDevelopment ? sql.raw('dev_recurring_instances') : sql.raw('recurring_instances')} ri
            LEFT JOIN ${isDevelopment ? sql.raw('dev_recurring_templates') : sql.raw('recurring_templates')} rt
              ON ri.template_id = rt.id
            LEFT JOIN LATERAL (
              SELECT image_urls
              FROM ${sql.raw(verificationsTable)}
              WHERE item_id = ri.id
              ORDER BY created_at DESC
              LIMIT 1
            ) iva ON true
            WHERE ri.status = 'pending_review'
              AND rt.community_id = ANY(${communityIds})
          `);

          const newArchitectureSharedItems = newArchitectureSharedItemsRaw.rows;

          reviewableItems.push(...newArchitectureSharedItems);

          // Add user IDs to lookup set
          newArchitectureSharedItems.forEach((item) => {
            if (item.created_by) userIdsToLookup.add(item.created_by);
            if (item.assigned_to) userIdsToLookup.add(item.assigned_to);
          });

          console.log(
            `✅ FETCH PENDING REVIEWS HYBRID: Found ${newArchitectureSharedItems.length} community items in NEW architecture`,
          );
        } catch (error) {
          console.log(
            `⚠️ FETCH PENDING REVIEWS HYBRID: Error fetching community items from new architecture:`,
            error.message,
          );
        }

        // STEP 2: Fetch from LEGACY architecture (items table) - community items only
        try {
          const legacySharedItems = await db
            .select({
              id: items.id,
              title: items.title,
              item_type: items.item_type,
              created_by: items.created_by,
              assigned_to: items.assigned_to,
              community_id: items.community_id,
              image_urls: items.image_urls,
              ai_feedback: items.ai_feedback,
              manual_review_requested_at: items.manual_review_requested_at,
              manual_review_reason: items.manual_review_reason,
              architecture: sql`'legacy'`.as("architecture"),
            })
            .from(items)
            .where(
              and(
                eq(items.status, "pending"),
                inArray(items.community_id, communityIds),
              ),
            );

          reviewableItems.push(...legacySharedItems);

          // Add user IDs to lookup set
          legacySharedItems.forEach((item) => {
            if (item.created_by) userIdsToLookup.add(item.created_by);
            if (item.assigned_to) userIdsToLookup.add(item.assigned_to);
          });

          console.log(
            `✅ FETCH PENDING REVIEWS HYBRID: Found ${legacySharedItems.length} community items in LEGACY architecture`,
          );
        } catch (error) {
          console.log(
            `⚠️ FETCH PENDING REVIEWS HYBRID: Error fetching community items from legacy architecture:`,
            error.message,
          );
        }
      }
    }

    // Now fetch all usernames we need in a single query
    const userIdsArray = Array.from(userIdsToLookup);
    let usernameMap = new Map();

    if (userIdsArray.length > 0) {
      const userRecords = await db
        .select({
          firebase_uid: users.firebase_uid,
          username: users.username,
        })
        .from(users)
        .where(inArray(users.firebase_uid, userIdsArray));

      userRecords.forEach((user) => {
        usernameMap.set(user.firebase_uid, user.username);
      });
    }

    // Replace UIDs with usernames in the response
    const itemsWithUsernames = reviewableItems.map((item) => ({
      ...item,
      created_by: item.created_by
        ? {
            uid: item.created_by,
            username: usernameMap.get(item.created_by) || "Unknown",
          }
        : null,
      assigned_to: item.assigned_to
        ? {
            uid: item.assigned_to,
            username: usernameMap.get(item.assigned_to) || "Unknown",
          }
        : null,
    }));

    console.log(
      `📋 FETCH PENDING REVIEWS HYBRID: Total reviewable items found: ${itemsWithUsernames.length}`,
    );

    res.json({
      items: itemsWithUsernames,
      total: itemsWithUsernames.length,
      architectures: {
        new: itemsWithUsernames.filter((item) => item.architecture === "new")
          .length,
        legacy: itemsWithUsernames.filter(
          (item) => item.architecture === "legacy",
        ).length,
      },
    });
  } catch (error) {
    console.error("❌ FETCH PENDING REVIEWS HYBRID ERROR:", error);
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

/**
 * POST /api/manual-review/:itemId/approve
 * Approve an item for completion - HYBRID ARCHITECTURE
 */
router.post("/:itemId/approve", authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { message } = req.body;
    const userId = req.user_id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `✅ APPROVE HYBRID: Processing approval for item ${itemId} by user ${userId}`,
    );

    // STEP 1: Try to find item in new architecture (recurring_instances)
    let item = null;
    let isNewArchitecture = false;
    let communityId = null;
    let createdBy = null;

    try {
      const newArchitectureResult = await db
        .select({
          id: recurring_instances.id,
          status: recurring_instances.status,
          assigned_to: recurring_instances.assigned_to,
          shared_with: recurring_instances.shared_with,
          community_id: recurring_templates.community_id,
          created_by: recurring_templates.created_by,
          template_id: recurring_instances.template_id,
        })
        .from(recurring_instances)
        .leftJoin(
          recurring_templates,
          eq(recurring_instances.template_id, recurring_templates.id),
        )
        .where(eq(recurring_instances.id, itemId))
        .limit(1);

      if (newArchitectureResult.length > 0) {
        item = newArchitectureResult[0];
        communityId = item.community_id;
        createdBy = item.created_by;
        isNewArchitecture = true;
        console.log(
          `🔍 APPROVE HYBRID: Found item in NEW architecture (recurring_instances)`,
        );
      }
    } catch (error) {
      console.log(
        `⚠️ APPROVE HYBRID: Error checking new architecture:`,
        error.message,
      );
    }

    // STEP 2: If not found in new architecture, try legacy items table
    if (!item) {
      try {
        const legacyResult = await db
          .select()
          .from(items)
          .where(eq(items.id, itemId))
          .limit(1);

        if (legacyResult.length > 0) {
          item = legacyResult[0];
          communityId = item.community_id;
          createdBy = item.created_by;
          isNewArchitecture = false;
          console.log(
            `🔍 APPROVE HYBRID: Found item in LEGACY architecture (items table)`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ APPROVE HYBRID: Error checking legacy architecture:`,
          error.message,
        );
      }
    }

    if (!item) {
      console.log(
        `❌ APPROVE HYBRID: Item ${itemId} not found in either architecture`,
      );
      return res.status(404).json({ error: "Item not found" });
    }

    // Check user permissions
    const user = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, userId))
      .limit(1);
    const isAdmin = user.length > 0 && user[0].role === "admin";

    let canReview = isAdmin;

    // Allow the creator to review their own shared items
    if (!canReview && createdBy === userId) {
      canReview = true;
      console.log(
        `✅ APPROVE HYBRID: User ${userId} is the creator of item ${itemId}, allowing approval`,
      );
    }

    // If not admin or creator, check if user is in shared_with array or community
    if (!canReview) {
      // Check if user is in shared_with array
      if (item.shared_with && Array.isArray(item.shared_with)) {
        canReview = item.shared_with.includes(userId);
        if (canReview) {
          console.log(
            `✅ APPROVE HYBRID: User ${userId} is in shared_with array for item ${itemId}, allowing approval`,
          );
        }
      }

      // If still can't review, check community membership
      if (!canReview && communityId) {
        const membership = await db
          .select()
          .from(community_members)
          .where(
            and(
              eq(community_members.community_id, communityId),
              eq(community_members.user_id, userId),
            ),
          )
          .limit(1);

        canReview = membership.length > 0;
        if (canReview) {
          console.log(
            `✅ APPROVE HYBRID: User ${userId} is a community member, allowing approval`,
          );
        }
      }
    }

    if (!canReview) {
      return res
        .status(403)
        .json({ error: "Not authorized to review this item. Only admins, item creators, shared users, or community members can approve." });
    }

    // Record the review action
    await db.insert(manual_review_actions).values({
      id: nanoid(),
      item_id: itemId,
      reviewer_user_id: userId,
      action: "approve",
      message: message || undefined,
      created_at: new Date().toISOString(),
    });

    // Update item status based on architecture
    if (isNewArchitecture) {
      // Update in recurring_instances table
      await db
        .update(recurring_instances)
        .set({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: userId,
          verified: true,
          verified_by: userId,
          verified_at: new Date().toISOString(),
          notes: message ? `Manual approval: ${message}` : "Manually approved",
          updated_at: new Date().toISOString(),
        })
        .where(eq(recurring_instances.id, itemId));

      console.log(`✅ APPROVE HYBRID: Updated item in NEW architecture`);

      // Get occurrence_date for cache invalidation
      const instanceForCache = await db
        .select({
          occurrence_date: recurring_instances.occurrence_date,
          assigned_to: recurring_instances.assigned_to,
        })
        .from(recurring_instances)
        .where(eq(recurring_instances.id, itemId))
        .limit(1);

      if (instanceForCache.length > 0) {
        const occurrenceDate = instanceForCache[0].occurrence_date;
        const assignedTo = instanceForCache[0].assigned_to;

        console.log(
          `🗑️ APPROVE CACHE: Invalidating cache for occurrence_date ${occurrenceDate}`,
        );

        // Invalidate cache for assigned user (the one who completed it)
        if (assignedTo) {
          const personalCacheKey = "personal-progress-v2-" + occurrenceDate;
          const sharedCacheKey = "shared-items-v2-" + occurrenceDate;

          cacheService.invalidate(assignedTo, personalCacheKey);
          cacheService.invalidate(assignedTo, sharedCacheKey);

          console.log(
            `🗑️ APPROVE CACHE: Invalidated cache for assigned user ${assignedTo}`,
          );
        }

        // Invalidate cache for creator (if different from assigned user)
        if (createdBy && createdBy !== assignedTo) {
          const personalCacheKey = "personal-progress-v2-" + occurrenceDate;
          const sharedCacheKey = "shared-items-v2-" + occurrenceDate;

          cacheService.invalidate(createdBy, personalCacheKey);
          cacheService.invalidate(createdBy, sharedCacheKey);

          console.log(
            `🗑️ APPROVE CACHE: Invalidated cache for creator ${createdBy}`,
          );
        }
      }
    } else {
      // Update in legacy items table
      await db
        .update(items)
        .set({
          status: "complete",
          completed_at: new Date().toISOString(),
          verified: true,
          verified_by: "manual",
          verified_by_user_id: userId,
          verified_at: new Date().toISOString(),
        })
        .where(eq(items.id, itemId));

      console.log(`✅ APPROVE HYBRID: Updated item in LEGACY architecture`);
    }

    console.log(
      `🎉 APPROVE HYBRID: Item ${itemId} approved successfully using ${isNewArchitecture ? "NEW" : "LEGACY"} architecture`,
    );

    res.json({
      success: true,
      message: "Item approved and marked complete",
      architecture: isNewArchitecture ? "new" : "legacy",
    });
  } catch (error) {
    console.error("❌ APPROVE HYBRID ERROR:", error);
    res.status(500).json({ error: "Failed to approve item" });
  }
});

/**
 * POST /api/manual-review/:itemId/reject
 * Reject an item and provide feedback - HYBRID ARCHITECTURE
 */
router.post("/:itemId/reject", authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { message } = req.body;
    const userId = req.user_id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!message) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    console.log(
      `❌ REJECT HYBRID: Processing rejection for item ${itemId} by user ${userId}`,
    );

    // STEP 1: Try to find item in new architecture (recurring_instances)
    let item = null;
    let isNewArchitecture = false;
    let communityId = null;
    let createdBy = null;

    try {
      const newArchitectureResult = await db
        .select({
          id: recurring_instances.id,
          status: recurring_instances.status,
          assigned_to: recurring_instances.assigned_to,
          shared_with: recurring_instances.shared_with,
          community_id: recurring_templates.community_id,
          created_by: recurring_templates.created_by,
          template_id: recurring_instances.template_id,
        })
        .from(recurring_instances)
        .leftJoin(
          recurring_templates,
          eq(recurring_instances.template_id, recurring_templates.id),
        )
        .where(eq(recurring_instances.id, itemId))
        .limit(1);

      if (newArchitectureResult.length > 0) {
        item = newArchitectureResult[0];
        communityId = item.community_id;
        createdBy = item.created_by;
        isNewArchitecture = true;
        console.log(
          `🔍 REJECT HYBRID: Found item in NEW architecture (recurring_instances)`,
        );
      }
    } catch (error) {
      console.log(
        `⚠️ REJECT HYBRID: Error checking new architecture:`,
        error.message,
      );
    }

    // STEP 2: If not found in new architecture, try legacy items table
    if (!item) {
      try {
        const legacyResult = await db
          .select()
          .from(items)
          .where(eq(items.id, itemId))
          .limit(1);

        if (legacyResult.length > 0) {
          item = legacyResult[0];
          communityId = item.community_id;
          createdBy = item.created_by;
          isNewArchitecture = false;
          console.log(
            `🔍 REJECT HYBRID: Found item in LEGACY architecture (items table)`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ REJECT HYBRID: Error checking legacy architecture:`,
          error.message,
        );
      }
    }

    if (!item) {
      console.log(
        `❌ REJECT HYBRID: Item ${itemId} not found in either architecture`,
      );
      return res.status(404).json({ error: "Item not found" });
    }

    // Check user permissions
    const user = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, userId))
      .limit(1);
    const isAdmin = user.length > 0 && user[0].role === "admin";

    let canReview = isAdmin;

    // Allow the creator to review their own shared items
    if (!canReview && createdBy === userId) {
      canReview = true;
      console.log(
        `✅ REJECT HYBRID: User ${userId} is the creator of item ${itemId}, allowing rejection`,
      );
    }

    // If not admin or creator, check if user is in shared_with array or community
    if (!canReview) {
      // Check if user is in shared_with array
      if (item.shared_with && Array.isArray(item.shared_with)) {
        canReview = item.shared_with.includes(userId);
        if (canReview) {
          console.log(
            `✅ REJECT HYBRID: User ${userId} is in shared_with array for item ${itemId}, allowing rejection`,
          );
        }
      }

      // If still can't review, check community membership
      if (!canReview && communityId) {
        const membership = await db
          .select()
          .from(community_members)
          .where(
            and(
              eq(community_members.community_id, communityId),
              eq(community_members.user_id, userId),
            ),
          )
          .limit(1);

        canReview = membership.length > 0;
        if (canReview) {
          console.log(
            `✅ REJECT HYBRID: User ${userId} is a community member, allowing rejection`,
          );
        }
      }
    }

    if (!canReview) {
      return res
        .status(403)
        .json({ error: "Not authorized to review this item. Only admins, item creators, shared users, or community members can reject." });
    }

    // Record the review action
    await db.insert(manual_review_actions).values({
      id: nanoid(),
      item_id: itemId,
      reviewer_user_id: userId,
      action: "reject",
      message: message,
      created_at: new Date().toISOString(),
    });

    // Update item status based on architecture
    if (isNewArchitecture) {
      // Update in recurring_instances table
      await db
        .update(recurring_instances)
        .set({
          status: "pending", // Reset to pending status
          notes: `Manual Review Feedback: ${message}`,
          ai_feedback: `Manual Review Feedback: ${message}`,
          completed_at: null,
          completed_by: null,
          verified: false,
          verified_by: null,
          verified_at: null,
          updated_at: new Date().toISOString(),
        })
        .where(eq(recurring_instances.id, itemId));

      console.log(`✅ REJECT HYBRID: Updated item in NEW architecture`);

      // Get occurrence_date for cache invalidation
      const instanceForCache = await db
        .select({
          occurrence_date: recurring_instances.occurrence_date,
          assigned_to: recurring_instances.assigned_to,
        })
        .from(recurring_instances)
        .where(eq(recurring_instances.id, itemId))
        .limit(1);

      if (instanceForCache.length > 0) {
        const occurrenceDate = instanceForCache[0].occurrence_date;
        const assignedTo = instanceForCache[0].assigned_to;

        console.log(
          `🗑️ REJECT CACHE: Invalidating cache for occurrence_date ${occurrenceDate}`,
        );

        // Invalidate cache for assigned user
        if (assignedTo) {
          const personalCacheKey = "personal-progress-v2-" + occurrenceDate;
          const sharedCacheKey = "shared-items-v2-" + occurrenceDate;

          cacheService.invalidate(assignedTo, personalCacheKey);
          cacheService.invalidate(assignedTo, sharedCacheKey);

          console.log(
            `🗑️ REJECT CACHE: Invalidated cache for assigned user ${assignedTo}`,
          );
        }

        // Invalidate cache for creator (if different from assigned user)
        if (createdBy && createdBy !== assignedTo) {
          const personalCacheKey = "personal-progress-v2-" + occurrenceDate;
          const sharedCacheKey = "shared-items-v2-" + occurrenceDate;

          cacheService.invalidate(createdBy, personalCacheKey);
          cacheService.invalidate(createdBy, sharedCacheKey);

          console.log(
            `🗑️ REJECT CACHE: Invalidated cache for creator ${createdBy}`,
          );
        }
      }
    } else {
      // Update in legacy items table
      await db
        .update(items)
        .set({
          status: "open",
          ai_feedback: `Manual Review Feedback: ${message}`,
          manual_review_requested_by: null,
          manual_review_requested_at: null,
          manual_review_reason: null,
        })
        .where(eq(items.id, itemId));

      console.log(`✅ REJECT HYBRID: Updated item in LEGACY architecture`);
    }

    console.log(
      `🔄 REJECT HYBRID: Item ${itemId} rejected successfully using ${isNewArchitecture ? "NEW" : "LEGACY"} architecture`,
    );

    res.json({
      success: true,
      message: "Item rejected with feedback",
      architecture: isNewArchitecture ? "new" : "legacy",
    });
  } catch (error) {
    console.error("❌ REJECT HYBRID ERROR:", error);
    res.status(500).json({ error: "Failed to reject item" });
  }
});

export default router;
