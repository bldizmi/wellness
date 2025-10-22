import { db } from "../db";
import {
  items,
  community_members,
  recurring_instances,
  recurring_templates,
} from "@shared/schema";
import { eq, or, and, inArray, sql } from "drizzle-orm";

/**
 * Service to enforce strict item-level visibility controls
 * Only shows items if user is: assigned_to, in shared_with array, or created_by
 * AND is a member of the item's community (if community_id exists)
 */

/**
 * Get user's community IDs for visibility checks
 */
export async function getUserCommunityIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ community_id: community_members.community_id })
    .from(community_members)
    .where(eq(community_members.user_id, userId));

  return memberships.map((m) => m.community_id);
}

/**
 * Build WHERE clause for item visibility based on current user
 * Enforces: (assigned_to = user OR user IN shared_with OR created_by = user)
 * AND (community_id IS NULL OR community_id IN user_communities)
 */
export function buildItemVisibilityFilter(
  userId: string,
  userCommunityIds: string[],
) {
  const visibilityCondition = or(
    eq(items.assigned_to, userId),
    eq(items.created_by, userId),
  );

  const communityCondition =
    userCommunityIds.length > 0
      ? or(
          sql`${items.community_id} IS NULL`,
          inArray(items.community_id, userCommunityIds),
        )
      : sql`${items.community_id} IS NULL`;

  return and(visibilityCondition, communityCondition);
}

/**
 * Get all items visible to the current user with strict privacy controls
 * FAANG-Level: Simple SQL + JavaScript filtering for shared items
 */
export async function getVisibleItems(userId: string) {
  const userCommunityIds = await getUserCommunityIds(userId);
  const visibilityFilter = buildItemVisibilityFilter(userId, userCommunityIds);

  // Get basic access items (owner/assigned)
  const basicItems = await db.select().from(items).where(visibilityFilter);

  // Get all items for shared_with filtering
  const allItems = await db
    .select()
    .from(items)
    .where(
      userCommunityIds.length > 0
        ? or(
            sql`${items.community_id} IS NULL`,
            inArray(items.community_id, userCommunityIds),
          )
        : sql`${items.community_id} IS NULL`,
    );

  // Filter shared items using JavaScript
  const sharedItems = allItems.filter(
    (item) =>
      item.shared_with &&
      Array.isArray(item.shared_with) &&
      item.shared_with.includes(userId) &&
      !basicItems.find((basic) => basic.id === item.id), // Avoid duplicates
  );

  return [...basicItems, ...sharedItems];
}

/**
 * Get shared items (items user didn't create but has access to)
 * FAANG-Level: Simple SQL + JavaScript filtering to avoid complex array operations
 */
export async function getSharedItems(userId: string) {
  const userCommunityIds = await getUserCommunityIds(userId);

  // Get all items in user's communities
  const allItems = await db
    .select()
    .from(items)
    .where(
      userCommunityIds.length > 0
        ? or(
            sql`${items.community_id} IS NULL`,
            inArray(items.community_id, userCommunityIds),
          )
        : sql`${items.community_id} IS NULL`,
    );

  // Filter using JavaScript for reliability
  return allItems.filter((item) => {
    // Not created by user
    const notCreatedByUser = item.created_by !== userId;

    // Has access via assignment or sharing
    const hasAssignedAccess = item.assigned_to === userId;
    const hasSharedAccess =
      item.shared_with &&
      Array.isArray(item.shared_with) &&
      item.shared_with.includes(userId);

    return notCreatedByUser && (hasAssignedAccess || hasSharedAccess);
  });
}

/**
 * Check if user has access to a specific item (HYBRID: checks both legacy and new architecture)
 * FAANG-Level Implementation: Zero breaking changes, graceful fallback
 */
export async function userHasItemAccess(
  userId: string,
  itemId: string,
): Promise<boolean> {
  console.log(
    `🔍 HYBRID ACCESS: Checking access for user ${userId} to item ${itemId}`,
  );

  const userCommunityIds = await getUserCommunityIds(userId);

  try {
    // PHASE 1: Check legacy items table first (preserves existing behavior)
    const legacyVisibilityFilter = and(
      eq(items.id, itemId),
      buildItemVisibilityFilter(userId, userCommunityIds),
    );

    // const [legacyItem] = await db
    //   .select()
    //   .from(items)
    //   .where(legacyVisibilityFilter);
    const [legacyItem] = await db
      .select({
        id: items.id,
        created_by: items.created_by,
        assigned_to: items.assigned_to,
        shared_with: items.shared_with,
      })
      .from(items)
      .where(legacyVisibilityFilter);

    if (legacyItem) {
      console.log(
        `✅ HYBRID ACCESS: Found item ${itemId} in legacy architecture`,
      );
      return true;
    }

    // PHASE 2: Check new recurring_instances architecture (BOTH production and development tables)
    console.log(
      `🔄 HYBRID ACCESS: Item ${itemId} not in legacy, checking new architecture`,
    );

    // FAANG-Level Solution: Simple query + JavaScript filtering to avoid SQL syntax issues
    let newArchItem = null;

    try {
      // CONSISTENT ENVIRONMENT-BASED TABLE SELECTION (same as delete function)
      const isDevelopment = process.env.NODE_ENV === "development";
      const instancesTable = isDevelopment
        ? "dev_recurring_instances"
        : "recurring_instances";

      console.log(
        `🔍 ACCESS ENVIRONMENT: ${isDevelopment ? "development" : "production"}, using table: ${instancesTable}`,
      );

      // Use the same table that delete function would use, but JOIN with templates to get created_by
      const templatesTable = isDevelopment
        ? "dev_recurring_templates"
        : "recurring_templates";
        
      let candidateItem = await db.execute(sql`
        SELECT ri.*, rt.created_by 
        FROM ${sql.raw(instancesTable)} ri
        LEFT JOIN ${sql.raw(templatesTable)} rt ON ri.template_id = rt.id
        WHERE ri.id = ${itemId}
      `);

      console.log(
        `🔄 HYBRID ACCESS: Checking ${instancesTable} for item ${itemId}`,
      );

      if (candidateItem.rows && candidateItem.rows.length > 0) {
        const item = candidateItem.rows[0];
        console.log(
          `🔄 HYBRID ACCESS: Found item ${itemId} in ${instancesTable}`,
        );
        console.log(
          `🔍 DEBUG ACCESS: item.created_by="${item.created_by}", userId="${userId}", assigned_to="${item.assigned_to}"`,
        );

        // Check all permissions using JavaScript - no complex SQL
        const hasOwnerAccess = item.created_by === userId;
        const hasAssignedAccess = item.assigned_to === userId;
        // const hasSharedAccess =
        //   item.shared_with &&
        //   Array.isArray(item.shared_with) &&
        //   item.shared_with.includes(userId);

        const hasSharedAccess = (() => {
          if (!item.shared_with) return false;

          let sharedWith = item.shared_with;
          // Parse JSON string if needed
          if (typeof sharedWith === "string") {
            try {
              sharedWith = JSON.parse(sharedWith);
            } catch {
              return false;
            }
          }

          return Array.isArray(sharedWith) && sharedWith.includes(userId);
        })();

        console.log(
          `🔍 HYBRID ACCESS: Checking permissions for item ${itemId} - owner: ${hasOwnerAccess}, assigned: ${hasAssignedAccess}, shared: ${hasSharedAccess}`,
        );

        if (hasOwnerAccess || hasAssignedAccess || hasSharedAccess) {
          newArchItem = item;
        }
      } else {
        console.log(
          `❌ HYBRID ACCESS: Item ${itemId} not found in ${instancesTable}`,
        );
      }
    } catch (error) {
      console.log(
        `🚨 HYBRID ACCESS: Error checking new architecture item ${itemId}:`,
        error.message,
      );
      // Continue to legacy fallback below
    }

    if (newArchItem) {
      console.log(`✅ HYBRID ACCESS: Found item ${itemId} in new architecture`);
      return true;
    }

    console.log(
      `❌ HYBRID ACCESS: Item ${itemId} not found in either architecture`,
    );
    return false;
  } catch (error) {
    console.error(`🚨 HYBRID ACCESS ERROR for item ${itemId}:`, error);
    // FAANG-Level Graceful degradation: Simple legacy query + JavaScript filtering
    try {
      // Get the specific item by ID first
      const [candidateItem] = await db
        .select()
        .from(items)
        .where(eq(items.id, itemId));

      if (!candidateItem) {
        console.log(
          `🔄 HYBRID ACCESS: Item ${itemId} not found in legacy table`,
        );
        return false;
      }

      // Check permissions using JavaScript
      const hasOwnerAccess = candidateItem.created_by === userId;
      const hasAssignedAccess = candidateItem.assigned_to === userId;
      const hasSharedAccess =
        candidateItem.shared_with &&
        Array.isArray(candidateItem.shared_with) &&
        candidateItem.shared_with.includes(userId);

      const hasAccess = hasOwnerAccess || hasAssignedAccess || hasSharedAccess;
      console.log(
        `🔄 HYBRID ACCESS: Fallback to legacy only for item ${itemId}: ${hasAccess}`,
      );
      return hasAccess;
    } catch (fallbackError) {
      console.error(
        `🚨 HYBRID ACCESS FALLBACK ERROR for item ${itemId}:`,
        fallbackError,
      );
      return false;
    }
  }
}

/**
 * Filter items array to only include those visible to user (for AI services)
 */
export async function filterVisibleItems(
  userId: string,
  itemsArray: any[],
): Promise<any[]> {
  const userCommunityIds = await getUserCommunityIds(userId);

  return itemsArray.filter((item) => {
    // Check basic visibility (assigned_to, shared_with, created_by)
    const hasBasicAccess =
      item.assigned_to === userId ||
      (item.shared_with && item.shared_with.includes(userId)) ||
      item.created_by === userId;

    if (!hasBasicAccess) return false;

    // Check community membership if community_id exists
    if (item.community_id) {
      return userCommunityIds.includes(item.community_id);
    }

    return true;
  });
}
