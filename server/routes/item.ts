import { Router } from "express";
import { storage } from "../storage";
import { insertItemSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "../db";
import {
  items,
  users,
  communities,
  community_members,
  item_completions,
  item_verification_attempts,
  manual_review_actions,
  user_profiles,
  recurring_instances,
  recurring_templates,
} from "@shared/schema";
import { eq, inArray, and, desc, sql, getTableName } from "drizzle-orm";
import { userHasItemAccess } from "../services/itemVisibilityService";
import { authMiddleware } from "../middleware/auth";
import { cacheService } from "../services/cacheService";
import multer from "multer";
import { verifyTaskWithPhoto } from "../services/aiVisionService";
import { nanoid } from "nanoid";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { generateNextDisplayId } from "../utils/displayId";
import { PhotoRetentionService } from "../services/photoRetentionService";
import {
  createRecurringTemplate,
  legacyItemToTemplate,
} from "../services/newRecurringItemService";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure upload directory
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const PUBLIC_URL = "/uploads";

try {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.error("Failed to create upload directory:", err);
}

// DEBUG ENDPOINT: Check database-level item creation audit
router.get("/debug/creation-audit", authMiddleware, async (req, res) => {
  try {
    const auditLogs = await db.execute(sql`
      SELECT * FROM item_creation_audit 
      ORDER BY insertion_timestamp DESC 
      LIMIT 20
    `);

    res.json({
      audit_logs: auditLogs.rows,
      total_count: auditLogs.rows.length,
    });
  } catch (error) {
    console.error("Error fetching creation audit:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// DEBUG ENDPOINT: Test enterprise dual-write system
router.post("/debug/test-dual-write", authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    console.log(`🧪 TESTING: Enterprise dual-write system for user ${userId}`);

    // Create a test recurring item through storage layer
    const testItem = {
      title: "DUAL-WRITE TEST ITEM",
      item_type: "habit" as const,
      recurrence_type: "daily" as const,
      verify_required: false,
    };

    const storage = req.app.get("storage");
    const createdItem = await storage.saveItem(userId, testItem);

    console.log(`✅ TESTING: Test item created with ID ${createdItem.id}`);

    res.json({
      success: true,
      test_item: createdItem,
      message: "Check logs for dual-write system operation",
    });
  } catch (error) {
    console.error("❌ TESTING ERROR:", error);
    res.status(500).json({ error: "Test failed", details: String(error) });
  }
});

/**
 * Helper function to invalidate relevant caches when items change
 */
function invalidateItemCaches(userId: string, itemData?: any) {
  try {
    console.log(
      "🧹 CACHE INVALIDATION: Starting comprehensive Today page cache invalidation",
    );

    // Get current date and item due date for targeted invalidation
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const dates = new Set([today]);

    // Add item due date if provided
    if (itemData?.due_date) {
      const dueDate = new Date(itemData.due_date).toLocaleDateString("en-CA");
      dates.add(dueDate);
    }

    // Add occurrence date if provided (for recurring items)
    if (itemData?.occurrence_date) {
      dates.add(itemData.occurrence_date);
    }

    // Function to invalidate all Today page cache keys for a user
    const invalidateUserTodayCaches = (targetUserId: string) => {
      console.log(
        `🧹 CACHE: Invalidating Today page caches for user ${targetUserId}`,
      );

      // Invalidate legacy cache keys
      cacheService.invalidate(targetUserId, "today_items");

      // Invalidate all Today page query cache keys (matching the actual cache key format)
      dates.forEach((date) => {
        cacheService.invalidate(targetUserId, `personal-progress-v2-${date}`);
        cacheService.invalidate(targetUserId, `shared-items-v2-${date}`);
      });

      // FIXED: Invalidate weekly calendar cache for each relevant date
      dates.forEach((targetDate) => {
        try {
          console.log(`📅 WEEK CACHE: Processing date ${targetDate}`);

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
          cacheService.invalidate(targetUserId, weekCacheKey);

          console.log(
            `📅 WEEK CACHE: Invalidated ${weekCacheKey} for date ${targetDate}`,
          );
          console.log(`📅 WEEK CACHE: Week dates: ${weekDates.join(", ")}`);
        } catch (weekError) {
          console.log(
            `⚠️ WEEK CACHE ERROR for ${targetDate}: ${weekError.message}`,
          );
        }
      });

      // Also invalidate general items cache for backward compatibility
      cacheService.invalidate(targetUserId, "/api/items");
    };

    // Invalidate cache for the item creator
    invalidateUserTodayCaches(userId);

    // If item affects other users (shared_with, assigned_to), invalidate their caches too
    if (itemData) {
      const affectedUsers = new Set<string>();

      if (itemData.assigned_to && itemData.assigned_to !== userId) {
        affectedUsers.add(itemData.assigned_to);
      }

      if (itemData.shared_with && Array.isArray(itemData.shared_with)) {
        itemData.shared_with.forEach((sharedUserId: string) => {
          if (sharedUserId !== userId) {
            affectedUsers.add(sharedUserId);
          }
        });
      }

      // Invalidate caches for all affected users
      affectedUsers.forEach((affectedUserId) => {
        invalidateUserTodayCaches(affectedUserId);
      });

      console.log(
        `🧹 CACHE: Invalidated caches for ${affectedUsers.size + 1} users total`,
      );
    }
  } catch (error) {
    console.log(
      `⚠️ CACHE INVALIDATION ERROR: ${error}, continuing without cache invalidation`,
    );
  }
}

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// POST /api/item - Create a new item
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user_id;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      "📝 PHASE 1 ROUTE TRACE: POST /api/item called by user",
      user_id,
    );
    console.log("Creating item with data:", req.body);
    console.log("Environment:", process.env.NODE_ENV);
    console.log("shared_with field received:", req.body.shared_with);

    // CLIENT DATE CONTEXT: Log received client date and timezone
    if (req.body.client_date) {
      console.log(
        `🌍 CLIENT DATE CONTEXT: Received client_date="${req.body.client_date}", timezone="${req.body.client_timezone}"`,
      );
    }

    // Prepare data with proper handling for production + CLIENT DATE CONTEXT
    const requestData = {
      title: req.body.title,
      item_type: req.body.item_type,
      recurrence_type: req.body.recurrence_type || "once",
      custom_recurrence: req.body.custom_recurrence || undefined,
      by_day: req.body.by_day || undefined,
      by_monthday: req.body.by_monthday || undefined,
      time_of_day: req.body.time_of_day || "anytime",
      by_week: req.body.by_week || undefined,
      by_month: req.body.by_month || undefined,
      due_date: req.body.due_date || null,
      time_frame: req.body.time_frame ? parseInt(req.body.time_frame) : null,
      verify_required:
        req.body.verify_required === true ||
        req.body.verify_required === "true",
      why_it_matters: req.body.why_it_matters || undefined,
      assigned_to: req.body.assigned_to || null,
      // CLIENT DATE CONTEXT: Include client date and timezone
      client_date: req.body.client_date || null,
      client_timezone: req.body.client_timezone || null,
      shared_with:
        Array.isArray(req.body.shared_with) && req.body.shared_with.length > 0
          ? req.body.shared_with
          : null,
    };

    console.log("Prepared request data:", requestData);

    // Validate the request body
    const validatedData = insertItemSchema.parse(requestData);
    console.log("validated shared_with:", validatedData.shared_with);

    // Generate globally unique display ID
    const displayId = await generateNextDisplayId();

    // Create the item - user is always the owner unless explicitly assigned to someone else
    const newItem = {
      id: nanoid(),
      display_id: displayId,
      user_id: user_id,
      created_by: user_id,
      assigned_to: validatedData.assigned_to || user_id, // Default to creator as owner
      shared_with:
        validatedData.shared_with && validatedData.shared_with.length > 0
          ? validatedData.shared_with
          : null,
      title: validatedData.title,
      item_type: validatedData.item_type,
      recurrence_type: validatedData.recurrence_type,
      custom_recurrence: validatedData.custom_recurrence,
      by_day: validatedData.by_day,
      time_of_day: validatedData.time_of_day || "anytime",
      by_monthday: validatedData.by_monthday,
      by_week: validatedData.by_week,
      by_month: validatedData.by_month,
      due_date: validatedData.due_date,
      time_frame: validatedData.time_frame,
      verify_required: validatedData.verify_required || false,
      why_it_matters: validatedData.why_it_matters,
      created_at: new Date().toISOString(),
    };

    // PHASE 4: New Architecture Only (No More Legacy Writes)
    // Create items exclusively in the new recurring_instances architecture
    try {
      const {
        createRecurringTemplate,
        generateInitialInstances,
        createSingleInstance,
      } = await import("../services/newRecurringItemService");

      if (newItem.recurrence_type && newItem.recurrence_type !== "once") {
        // Recurring item: Create template + instances
        console.log(
          `🔄 PHASE 4: Creating recurring template for item ${newItem.id}`,
        );

        const templateId = await createRecurringTemplate(newItem);
        const instancesCreated = await generateInitialInstances(
          templateId,
          newItem,
        );

        console.log(
          `✅ PHASE 4: Created template ${templateId} with ${instancesCreated} instances`,
        );
      } else {
        // One-time item: Create single instance
        console.log(
          `📝 PHASE 4: Creating single instance for one-time item ${newItem.id}`,
        );

        const instanceId = await createSingleInstance(newItem);

        console.log(`✅ PHASE 4: Created single instance ${instanceId}`);
      }

      console.log(
        `🚀 PHASE 4 COMPLETE: Item ${newItem.id} created in new architecture`,
      );
    } catch (newArchError) {
      console.error(
        `⚠️ PHASE 4 ERROR: Failed to create item in new architecture: ${newArchError.message}`,
      );
      throw newArchError; // Fail the request if new system fails
    }

    // Invalidate caches for affected users
    invalidateItemCaches(user_id, newItem);

    res.status(201).json({
      success: true,
      item: newItem,
    });
  } catch (error) {
    console.error("Error creating item:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "ZodError") {
      console.error(
        "Validation errors:",
        JSON.stringify(error.errors, null, 2),
      );
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        })),
      });
    }

    res.status(500).json({
      error: "Failed to create item",
      message: error.message,
    });
  }
});

// GET /api/item - Get all user items
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user_id;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch all items
    const items = await storage.getUserItems(user_id);

    res.status(200).json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// PUT /api/item/:id - Update an existing item (Hybrid System - Phase 5)
router.put("/:id", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🔄 HYBRID UPDATE: Updating item with data:", req.body);
    console.log("shared_with field received:", req.body.shared_with);

    // Validate the request body
    const validatedData = insertItemSchema.parse(req.body);
    console.log("validated shared_with:", validatedData.shared_with);

    // First check if the user has access to this item
    console.log(
      `🔍 EDIT ACCESS CHECK: User ${user_id} attempting to edit item ${id}`,
    );
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      console.log(
        `❌ EDIT ACCESS DENIED: User ${user_id} doesn't have access to item ${id}`,
      );
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }
    console.log(
      `✅ EDIT ACCESS GRANTED: User ${user_id} has access to item ${id}`,
    );

    // PHASE 5: Check if this is a recurring_instances item first (with environment-aware table selection)
    const isDevelopment = process.env.NODE_ENV === "development";
    const instancesTable = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";
    const templatesTable = isDevelopment
      ? "dev_recurring_templates"
      : "recurring_templates";

    console.log(
      `🔍 HYBRID UPDATE: Checking if ${id} exists in new architecture (${instancesTable})`,
    );

    // Use sql.identifier to ensure we're using the correct table name
    const instanceQuery = await db.execute(sql`
      SELECT * FROM ${sql.identifier(instancesTable)} WHERE id = ${id} LIMIT 1
    `);
    const instanceItem = instanceQuery.rows[0] || null;

    console.log(
      `🔍 HYBRID UPDATE: Instance found in new architecture: ${!!instanceItem}`,
    );

    if (instanceItem) {
      console.log(
        "🚀 PHASE 5: Updating item in new recurring_instances architecture",
      );

      // Update the recurring instance using environment-aware table
      const updateResult = await db.execute(sql`
        UPDATE ${sql.identifier(instancesTable)}
        SET 
          due_time = ${
            validatedData.due_date
              ? new Date(validatedData.due_date)
                  .toISOString()
                  .split("T")[1]
                  .slice(0, 8)
              : null
          },
          notes = ${validatedData.why_it_matters || null},
          updated_at = ${new Date().toISOString()},
          shared_with = ${
            validatedData.shared_with && validatedData.shared_with.length > 0
              ? `{${validatedData.shared_with.join(",")}}`
              : null
          }
        WHERE id = ${id}
        RETURNING *
      `);

      const updatedInstance = updateResult.rows[0] || null;

      if (!updatedInstance) {
        console.log(
          `❌ HYBRID UPDATE: Failed to update instance ${id} in new architecture`,
        );
        return res.status(404).json({ error: "Instance not found" });
      }

      console.log(
        `✅ HYBRID UPDATE: Successfully updated instance ${id} in new architecture`,
      );

      // Also update the template if it exists AND user has permission
      if (updatedInstance.template_id) {
        // Check if user has permission to modify the template using environment-aware table
        const templateQuery = await db.execute(sql`
          SELECT id, created_by, assigned_to, shared_with 
          FROM ${sql.identifier(templatesTable)} 
          WHERE id = ${updatedInstance.template_id}
          LIMIT 1
        `);
        const templateInfo = templateQuery.rows[0] || null;

        if (templateInfo) {
          // Parse shared_with if it's a JSON string
          let sharedWithArray = [];
          if (templateInfo.shared_with) {
            try {
              sharedWithArray =
                typeof templateInfo.shared_with === "string"
                  ? JSON.parse(templateInfo.shared_with)
                  : templateInfo.shared_with;
            } catch (e) {
              console.log(
                "⚠️ Failed to parse shared_with field:",
                templateInfo.shared_with,
              );
              sharedWithArray = [];
            }
          }

          const canModifyTemplate =
            templateInfo.created_by === user_id ||
            templateInfo.assigned_to === user_id ||
            (Array.isArray(sharedWithArray) &&
              sharedWithArray.includes(user_id));

          console.log(
            `🔍 TEMPLATE PERMISSIONS: User ${user_id} can modify template ${updatedInstance.template_id}: ${canModifyTemplate}`,
          );
          console.log(
            `🔍 TEMPLATE PERMISSIONS: created_by=${templateInfo.created_by}, assigned_to=${templateInfo.assigned_to}, shared_with=${JSON.stringify(templateInfo.shared_with)}`,
          );

          if (canModifyTemplate) {
            console.log(
              "🔄 PHASE 5: Updating template - user has modification rights",
            );
            await db.execute(sql`
              UPDATE ${sql.identifier(templatesTable)}
              SET 
                title = ${validatedData.title},
                item_type = ${validatedData.item_type},
                verify_required = ${validatedData.verify_required || false},
                time_frame = ${validatedData.time_frame || null},
                why_it_matters = ${validatedData.why_it_matters || null},
                assigned_to = ${validatedData.assigned_to || null},
                shared_with = ${
                  validatedData.shared_with &&
                  validatedData.shared_with.length > 0
                    ? `{${validatedData.shared_with.join(",")}}`
                    : null
                },
                updated_at = ${new Date().toISOString()}
              WHERE id = ${updatedInstance.template_id}
            `);
            console.log("✅ PHASE 5: Template updated successfully");
          } else {
            console.log(
              "⚠️ PHASE 5: User doesn't have template modification rights - skipping template update",
            );
            console.log(
              "ℹ️ PHASE 5: This is normal for shared items - instance was updated successfully",
            );
          }
        } else {
          console.log(
            "⚠️ PHASE 5: Template not found for instance, skipping template update",
          );
        }
      }

      // Invalidate cache for affected users after successful update
      invalidateItemCaches(user_id, updatedInstance);

      console.log("✅ PHASE 5: Successfully updated item in new architecture");
      res.status(200).json({
        success: true,
        item: updatedInstance,
      });
      return;
    }

    // FALLBACK: Update in legacy items table
    console.log("🔄 LEGACY: Updating item in legacy items table");
    const [updatedItem] = await db
      .update(items)
      .set({
        title: validatedData.title,
        item_type: validatedData.item_type,
        recurrence_type: validatedData.recurrence_type,
        custom_recurrence: validatedData.custom_recurrence,
        due_date: validatedData.due_date,
        time_frame: validatedData.time_frame,
        verify_required: validatedData.verify_required || false,
        why_it_matters: validatedData.why_it_matters,
        completed_at: req.body.completed_at || null,
        assigned_to: validatedData.assigned_to,
        shared_with:
          validatedData.shared_with && validatedData.shared_with.length > 0
            ? validatedData.shared_with
            : null,
      })
      .where(eq(items.id, id))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Invalidate cache for affected users after successful update
    invalidateItemCaches(user_id, updatedItem);

    console.log("✅ LEGACY: Successfully updated item in legacy table");
    res.status(200).json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error updating item:", error);
    if (error.name === "ZodError") {
      console.error("Validation errors:", error.errors);
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }
    res.status(500).json({ error: "Failed to update item" });
  }
});

// PUT /api/item/:id/complete - Mark an item as complete
router.put("/:id/complete", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Mark the item as complete
    const completedItem = await storage.markItemComplete(user_id, id);

    if (!completedItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    // CACHE INVALIDATION: Clear all Today page caches after completion
    try {
      console.log(
        "🧹 PUT COMPLETE CACHE: Invalidating cache after item completion",
      );

      // Get completion date from request body or use today
      const { completion_date } = req.body || {};
      const targetDate =
        completion_date || new Date().toISOString().split("T")[0];

      // Invalidate personal progress cache for target date
      cacheService.invalidate(
        user_id,
        "personal-progress-v2-" + targetDate,
        {},
      );
      cacheService.invalidate(user_id, "shared-items-v2-" + targetDate, {});

      // FIXED: Invalidate week cache using correct calculation
      try {
        console.log(
          `📅 PUT COMPLETE WEEK CACHE: Processing date ${targetDate}`,
        );

        // Calculate week start from the TARGET DATE, not today
        const targetDateObj = new Date(targetDate + "T00:00:00");
        const dayOfWeek = targetDateObj.getDay();
        const weekStart = new Date(targetDateObj);
        weekStart.setDate(targetDateObj.getDate() - dayOfWeek);

        // Generate week dates array matching the week endpoint
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          weekDates.push(date.toISOString().split("T")[0]);
        }

        const weekCacheKey = `week-progress-${weekDates.join("-")}`;
        cacheService.invalidate(user_id, weekCacheKey, {});

        console.log(`🗑️ PUT COMPLETE: Invalidated week cache ${weekCacheKey}`);
      } catch (weekError) {
        console.log(`⚠️ PUT COMPLETE WEEK CACHE ERROR: ${weekError}`);
      }

      console.log(`🗑️ PUT COMPLETE: Invalidated caches for ${targetDate}`);
    } catch (cacheError) {
      console.log(`⚠️ PUT COMPLETE CACHE ERROR: ${cacheError}`);
    }

    res.status(200).json({
      success: true,
      item: completedItem,
    });
  } catch (error) {
    console.error("Error completing item:", error);
    res.status(500).json({ error: "Failed to complete item" });
  }
});

// POST /api/item/:id/verify-photo - Upload photo and verify task completion with AI
router.post(
  "/:id/verify-photo",
  authMiddleware,
  upload.array("photos", 5),
  async (req, res) => {
    try {
      const { user_id } = req;
      const { id } = req.params;

      if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No photos uploaded",
        });
      }

      // Validate file count
      if (req.files.length > 5) {
        return res.status(400).json({
          success: false,
          error: "Maximum 5 photos allowed",
        });
      }

      // Check if user has access to this item using the visibility service
      const hasAccess = await userHasItemAccess(user_id, id);
      if (!hasAccess) {
        return res
          .status(404)
          .json({ error: "Item not found or unauthorized" });
      }

      // HYBRID: Get the item to verify - check both new and legacy architecture
      console.log(
        `🔍 VERIFICATION HYBRID: Getting item ${id} for verification in ${process.env.NODE_ENV} environment`,
      );

      // First check if this is a recurring_instances item
      const [instanceItem] = await db
        .select()
        .from(recurring_instances)
        .where(eq(recurring_instances.id, id))
        .limit(1);

      let item = null;
      let verify_required = false;
      let isNewArchitecture = false;

      if (instanceItem) {
        console.log(
          "🚀 VERIFICATION PHASE 5: Found item in new recurring_instances architecture",
        );
        isNewArchitecture = true;

        // Get the template to check verify_required
        if (instanceItem.template_id) {
          const [template] = await db
            .select()
            .from(recurring_templates)
            .where(eq(recurring_templates.id, instanceItem.template_id))
            .limit(1);

          if (template) {
            item = {
              ...instanceItem,
              title: template.title,
              verify_required: template.verify_required,
              item_type: template.item_type,
              recurrence_type: template.recurrence_type,
            };
            verify_required = template.verify_required;
            console.log(
              `📋 VERIFICATION PHASE 5: Template verify_required: ${verify_required}`,
            );
          }
        } else {
          // Single instance item (no template)
          item = instanceItem;
          verify_required = instanceItem.verify_required; // Check instance-level verify_required
          console.log(
            `📄 VERIFICATION PHASE 5: Single instance item (no template), verify_required: ${verify_required}`,
          );
        }
      } else {
        console.log("🔄 VERIFICATION LEGACY: Checking legacy items table");
        // Fall back to legacy items table
        const [legacyItem] = await db
          .select()
          .from(items)
          .where(eq(items.id, id))
          .limit(1);

        if (legacyItem) {
          item = legacyItem;
          verify_required = legacyItem.verify_required;
          console.log(
            `📋 VERIFICATION LEGACY: Found item, verify_required: ${verify_required}`,
          );
        }
      }

      if (!item) {
        console.log("❌ VERIFICATION: Item not found in either architecture");
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      if (!verify_required) {
        return res.status(400).json({
          success: false,
          error: "This item does not require verification",
        });
      }

      // Convert uploaded files to base64 array
      const savedFiles = await Promise.all(
        req.files.map(async (file) => {
          // Validate file type
          if (!file.mimetype.startsWith("image/")) {
            throw new Error("Only image files are allowed");
          }

          const fileExt = path.extname(file.originalname) || ".jpg";
          const fileName = `${nanoid()}${fileExt}`;
          const filePath = path.join(UPLOAD_DIR, fileName);

          await fs.writeFile(filePath, file.buffer);

          return {
            fileName,
            filePath,
            publicUrl: `${PUBLIC_URL}/${fileName}`,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size,
          };
        }),
      );

      console.log(`📸 Processing ${savedFiles.length} photos for verification`);

      // Get previous verification attempts for progressive feedback
      const previousAttempts = await db
        .select({
          ai_feedback: item_verification_attempts.ai_feedback,
          ai_verification_result:
            item_verification_attempts.ai_verification_result,
          created_at: item_verification_attempts.created_at,
        })
        .from(item_verification_attempts)
        .where(eq(item_verification_attempts.item_id, id))
        .orderBy(desc(item_verification_attempts.created_at))
        .limit(3);

      // Get user's timezone from request header or body (headers are case-insensitive)
      const userTimezone =
        req.headers["x-user-timezone"] ||
        req.headers["X-User-Timezone"] ||
        req.body.timezone ||
        "UTC";
      console.log(`Using timezone: ${userTimezone} for AI verification`);

      // Use AI to verify the task completion with multiple photos
      console.log(
        `Starting AI verification for item: ${item.title} with ${savedFiles.length} photos`,
      );

      // Convert saved files to base64 for AI processing
      const imagesForAI = await Promise.all(
        savedFiles.map(async (file) => {
          try {
            const fileData = await fs.readFile(file.filePath);
            return {
              data: fileData.toString("base64"),
              mimetype: file.mimetype,
            };
          } catch (err) {
            console.error("Error reading file for AI processing:", err);
            throw new Error("Failed to process images for verification");
          }
        }),
      );

      const verificationResult = await verifyTaskWithPhoto(
        item.title,
        imagesForAI,
        previousAttempts,
        userTimezone,
      );
      console.log("AI verification result:", verificationResult);

      // Store the image URLs (in a real app, you'd upload to cloud storage)
      const imageUrls = savedFiles.map((file) => file.publicUrl);
      const primaryImageUrl = imageUrls[0]; // Use first image as primary for backward compatibility

      // Calculate automatic deletion date (14 days from now)
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

      const imagesUrl = savedFiles.map((file) => file.publicUrl);

      // Save verification attempt to history with multiple photos
      const verificationAttemptId = nanoid();
      await db.insert(item_verification_attempts).values({
        id: verificationAttemptId,
        item_id: id,
        user_id: user_id,
        //image_url: primaryImageUrl, // Primary image for backward compatibility
        image_urls: JSON.stringify(imagesUrl), // Store all images as JSON string
        photo_count: savedFiles.length,
        ai_verification_result: verificationResult.ai_verification_result,
        ai_feedback: verificationResult.ai_feedback,
        photo_uploaded_at: now.toISOString(),
        auto_delete_at: autoDeleteAt.toISOString(),
        photo_deleted: false,
        created_at: now.toISOString(),
      });

      // Automatically complete item if AI marks it as complete
      const updateData = {
        //image_url: primaryImageUrl, // Primary image for backward compatibility
        image_urls: imagesUrl, // Store all images
        photo_count: savedFiles.length,
        ai_verification_result: verificationResult.ai_verification_result,
        ai_feedback: verificationResult.ai_feedback,
      };

      // If AI verification is complete, handle differently for recurring vs one-time items
      if (verificationResult.ai_verification_result === "complete") {
        console.log(`🤖 AI VERIFICATION: Item ${id} marked as complete by AI`);

        // For recurring items in new architecture, mark the specific instance as complete
        if (item.recurrence_type && item.recurrence_type !== "once") {
          console.log(
            `📝 RECURRING ITEM: Marking specific instance as complete for ${item.occurrence_date || "today"}`,
          );

          // For new architecture recurring items, update the instance status directly
          updateData.verified = true;
          updateData.verified_by = "ai";
          updateData.verified_by_user_id = user_id;
          updateData.verified_at = new Date().toISOString();
          updateData.status = "complete";
          updateData.completed_at = new Date().toISOString();
          updateData.completed_by = user_id;

          console.log(
            `✅ RECURRING COMPLETION: Instance will be marked complete with status='complete'`,
          );

          // Legacy fallback: Also create item_completions record if this is legacy architecture
          if (!isNewArchitecture) {
            const today = new Date().toISOString().split("T")[0];
            const completionId = nanoid();

            await db.insert(item_completions).values({
              id: completionId,
              item_id: id,
              user_id: user_id,
              completion_date: today,
              completed_at: new Date().toISOString(),
              verification_data: {
                type: "ai_verification",
                status: "complete",
                photo_count: base64Images.length,
              },
              created_at: new Date().toISOString(),
            });
          }
        } else {
          // For one-time items, mark the entire item as complete
          console.log(
            `📝 ONE-TIME ITEM: Setting item status to 'complete' for item ${id}`,
          );
          updateData.verified = true;
          updateData.verified_by = "ai";
          updateData.verified_by_user_id = user_id;
          updateData.verified_at = new Date().toISOString();
          updateData.status = "complete";
          updateData.completed_at = new Date().toISOString();
        }
      }

      // HYBRID UPDATE: Update the correct table based on architecture
      console.log(
        `📊 DATABASE UPDATE HYBRID: Updating item ${id} in ${isNewArchitecture ? "NEW" : "LEGACY"} architecture with data:`,
        updateData,
      );

      let updatedItem = null;

      if (isNewArchitecture) {
        // Update new architecture (recurring_instances)
        const [newUpdated] = await db
          .update(recurring_instances)
          .set({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .where(eq(recurring_instances.id, id))
          .returning();
        updatedItem = newUpdated;
        console.log(
          `✅ DATABASE SUCCESS (NEW): Item ${id} updated in recurring_instances table`,
        );
      } else {
        // Update legacy architecture (items)
        const [legacyUpdated] = await db
          .update(items)
          .set(updateData)
          .where(eq(items.id, id))
          .returning();
        updatedItem = legacyUpdated;
        console.log(
          `✅ DATABASE SUCCESS (LEGACY): Item ${id} updated in items table`,
        );
      }

      if (!updatedItem) {
        console.error(`❌ DATABASE ERROR: Failed to update item ${id}`);
        return res.status(500).json({
          success: false,
          error: "Failed to update item",
        });
      }

      console.log(
        `✅ DATABASE SUCCESS: Item ${id} updated successfully. New status: ${updatedItem.status}`,
      );

      // Invalidate caches for affected users
      invalidateItemCaches(user_id, updatedItem);

      res.json({
        success: true,
        item: updatedItem,
        verification: verificationResult,
        photo_count: savedFiles.length,
      });
    } catch (error) {
      console.error("Photo verification error:", error);
      console.error("Error details:", {
        name: (error as any)?.name,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        item_id: id,
        environment: process.env.NODE_ENV,
        file_count: req.files?.length || 0,
      });

      // Specific error handling for common issues
      if ((error as any)?.message?.includes("OpenAI")) {
        return res.status(500).json({
          success: false,
          error: "AI verification service unavailable. Please try again later.",
        });
      }

      if (
        (error as any)?.message?.includes("database") ||
        (error as any)?.code === "ECONNREFUSED"
      ) {
        return res.status(500).json({
          success: false,
          error: "Database connection error. Please try again.",
        });
      }

      // File size/format specific errors
      if ((error as any)?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File size too large. Please select smaller images.",
        });
      }

      if ((error as any)?.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "Too many files. Maximum 5 photos allowed.",
        });
      }

      // Ensure we always return JSON, never HTML
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process photo verification",
      });
    }
  },
);

// POST /api/item/:id/verify - Enhanced Community-Based Verification with Logging
router.post("/:id/verify", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const schema = z.object({
      verified_by: z.enum(["ai", "pilot"]),
    });

    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.format(),
      });
    }

    const { verified_by } = validationResult.data;

    // Check if user has access to this item using the visibility service
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // Update the item with enhanced verification logging
    const [updatedItem] = await db
      .update(items)
      .set({
        verified: true,
        verified_by: verified_by,
        verified_by_user_id: user_id,
        verified_at: new Date().toISOString(),
      })
      .where(eq(items.id, id))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({
      id: updatedItem.id,
      verified: updatedItem.verified,
      verified_by: updatedItem.verified_by,
      verified_by_user_id: updatedItem.verified_by_user_id,
      verified_at: updatedItem.verified_at,
    });
  } catch (error) {
    console.error("Error verifying item:", error);
    res.status(500).json({ error: "Failed to verify item" });
  }
});

// POST /api/item/:id/share - Smart Context-Aware Sharing (Frontend Interface)
router.post("/:id/share", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req;
    const { community_id, visibility } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!community_id) {
      return res.status(400).json({ error: "Community ID is required" });
    }

    // Get the item to check permissions and determine sharing strategy
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if user can share this item (created_by or assigned_to)
    const canShare =
      item.created_by === user_id || item.assigned_to === user_id;
    if (!canShare) {
      return res.status(403).json({
        error: "Only the creator or assigned user can share this item",
      });
    }

    // Get community members for sharing
    const communityMembers = await db
      .select({ user_id: community_members.user_id })
      .from(community_members)
      .where(eq(community_members.community_id, community_id));

    if (communityMembers.length === 0) {
      return res
        .status(400)
        .json({ error: "No members found in this community" });
    }

    const memberIds = communityMembers
      .map((m) => m.user_id)
      .filter((memberId) => memberId !== user_id);

    // Smart Context-Aware Sharing Logic
    if (item.recurrence_type && item.recurrence_type !== "once") {
      // For recurring items: Use Phase 5 template sharing (smarter backend, same frontend)
      console.log(
        `🔄 SMART SHARING: Using Phase 5 template sharing for recurring item ${id}`,
      );

      // Update item with legacy sharing for backward compatibility
      await db
        .update(items)
        .set({
          shared_with: memberIds.length > 0 ? memberIds : null,
          community_id: community_id,
        })
        .where(eq(items.id, id));

      // TODO: When Phase 5 frontend is ready, also create recurring template sharing
      console.log(
        `📋 Phase 5 Template Sharing: Item ${id} would use template sharing for future instances`,
      );
    } else {
      // For one-time items: Continue using existing sharing logic
      console.log(
        `📝 SMART SHARING: Using legacy sharing for one-time item ${id}`,
      );

      // Update item with standard sharing
      await db
        .update(items)
        .set({
          shared_with: memberIds.length > 0 ? memberIds : null,
          community_id: community_id,
        })
        .where(eq(items.id, id));
    }

    // Get updated item for response
    const [updatedItem] = await db.select().from(items).where(eq(items.id, id));

    // Invalidate caches for all affected users
    invalidateItemCaches(user_id, updatedItem);

    res.json({
      success: true,
      id: updatedItem.id,
      shared_with: updatedItem.shared_with || [],
      community_id: updatedItem.community_id,
      sharing_strategy:
        item.recurrence_type && item.recurrence_type !== "once"
          ? "phase5_template"
          : "legacy",
    });
  } catch (error) {
    console.error("Error in smart sharing:", error);
    res.status(500).json({ error: "Failed to share item" });
  }
});

// PATCH /api/item/:id/share - Manual Item Sharing
router.patch("/:id/share", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req;
    const { shared_with } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate shared_with is an array of strings
    if (
      !Array.isArray(shared_with) ||
      !shared_with.every((id) => typeof id === "string")
    ) {
      return res
        .status(400)
        .json({ error: "shared_with must be an array of user IDs" });
    }

    // Get the item to check permissions
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if user can share this item (created_by or assigned_to)
    const canShare =
      item.created_by === user_id || item.assigned_to === user_id;
    if (!canShare) {
      return res.status(403).json({
        error: "Only the creator or assigned user can share this item",
      });
    }

    // If item has community_id, validate all shared_with users are in that community
    if (item.community_id && shared_with.length > 0) {
      const validUsers = await db
        .select({ user_id: community_members.user_id })
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, item.community_id),
            inArray(community_members.user_id, shared_with),
          ),
        );

      const validUserIds = validUsers.map((u) => u.user_id);
      const invalidUsers = shared_with.filter(
        (uid) => !validUserIds.includes(uid),
      );

      if (invalidUsers.length > 0) {
        return res.status(400).json({
          error: "Some users are not members of this community",
          invalid_users: invalidUsers,
        });
      }
    } else if (shared_with.length > 0) {
      // If no community_id, verify users exist
      const existingUsers = await db
        .select({ username: users.username })
        .from(users)
        .where(inArray(users.username, shared_with));

      const existingUserIds = existingUsers.map((u) => u.username);
      const invalidUsers = shared_with.filter(
        (uid) => !existingUserIds.includes(uid),
      );

      if (invalidUsers.length > 0) {
        return res.status(400).json({
          error: "Some user IDs do not exist",
          invalid_users: invalidUsers,
        });
      }
    }

    // Update the item's shared_with field
    const [updatedItem] = await db
      .update(items)
      .set({ shared_with: shared_with.length > 0 ? shared_with : null })
      .where(eq(items.id, id))
      .returning();

    // Invalidate caches for all affected users (creator and newly shared users)
    invalidateItemCaches(user_id, updatedItem);

    res.json({
      id: updatedItem.id,
      shared_with: updatedItem.shared_with || [],
    });
  } catch (error) {
    console.error("Error sharing item:", error);
    res.status(500).json({ error: "Failed to share item" });
  }
});

// GET /api/item/:id - Get item details with photos for completed items
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // HYBRID: Check both new and legacy architecture
    // First check recurring_instances (new architecture)
    const [instanceItem] = await db
      .select()
      .from(recurring_instances)
      .where(eq(recurring_instances.id, id))
      .limit(1);

    if (instanceItem) {
      return res.json({
        success: true,
        item: instanceItem,
        architecture: "new",
      });
    }

    // Fall back to legacy items table
    const [legacyItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (legacyItem) {
      return res.json({
        success: true,
        item: legacyItem,
        architecture: "legacy",
      });
    }

    return res.status(404).json({ error: "Item not found" });
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// GET /api/item/:id/verification-history - Get verification attempt history - PHASE 2 HYBRID ARCHITECTURE
router.get("/:id/verification-history", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `🔍 VERIFICATION HISTORY PHASE 2: Getting history for item ${id} in ${process.env.NODE_ENV} environment`,
    );

    // PHASE 1 HYBRID ACCESS CONTROL: Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      console.log(
        `❌ VERIFICATION HISTORY PHASE 2: Access denied for user ${user_id} to item ${id}`,
      );
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // PHASE 2: DETECT ITEM ARCHITECTURE for proper logging and context
    let itemArchitecture = "unknown";
    let itemDetails = null;

    // Check if item exists in new recurring_instances architecture
    try {
      const [instanceItem] = await db
        .select({
          id: recurring_instances.id,
          title: recurring_instances.title,
          template_id: recurring_instances.template_id,
          occurrence_date: recurring_instances.occurrence_date,
        })
        .from(recurring_instances)
        .where(eq(recurring_instances.id, id))
        .limit(1);

      if (instanceItem) {
        itemArchitecture = "new";
        itemDetails = instanceItem;
        console.log(
          `📋 VERIFICATION HISTORY PHASE 2: Found item in NEW architecture - "${instanceItem.title}" (${instanceItem.occurrence_date})`,
        );
      }
    } catch (error) {
      console.log(
        `⚠️ VERIFICATION HISTORY PHASE 2: Error checking new architecture:`,
        error.message,
      );
    }

    // If not found in new architecture, check legacy items table
    if (itemArchitecture === "unknown") {
      try {
        const [legacyItem] = await db
          .select({
            id: items.id,
            title: items.title,
            item_type: items.item_type,
            due_date: items.due_date,
          })
          .from(items)
          .where(eq(items.id, id))
          .limit(1);

        if (legacyItem) {
          itemArchitecture = "legacy";
          itemDetails = legacyItem;
          console.log(
            `📋 VERIFICATION HISTORY PHASE 2: Found item in LEGACY architecture - "${legacyItem.title}"`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ VERIFICATION HISTORY PHASE 2: Error checking legacy architecture:`,
          error.message,
        );
      }
    }

    // Get all verification attempts for this item (works for both architectures)
    const attempts = await db
      .select()
      .from(item_verification_attempts)
      .where(eq(item_verification_attempts.item_id, id))
      .orderBy(desc(item_verification_attempts.created_at))
      .limit(20); // Limit to last 20 attempts

    console.log(
      `📸 VERIFICATION HISTORY PHASE 2: Found ${attempts.length} verification attempts for ${itemArchitecture} architecture item`,
    );

    // Get manual review actions for this item with reviewer display names
    let reviewActions = [];
    try {
      reviewActions = await db
        .select({
          id: manual_review_actions.id,
          item_id: manual_review_actions.item_id,
          reviewer_user_id: manual_review_actions.reviewer_user_id,
          action: manual_review_actions.action,
          message: manual_review_actions.message,
          created_at: manual_review_actions.created_at,
          reviewer_display_name: user_profiles.display_name,
        })
        .from(manual_review_actions)
        .leftJoin(
          user_profiles,
          eq(manual_review_actions.reviewer_user_id, user_profiles.user_id),
        )
        .where(eq(manual_review_actions.item_id, id))
        .orderBy(desc(manual_review_actions.created_at));

      console.log(
        `👥 VERIFICATION HISTORY PHASE 2: Found ${reviewActions.length} manual review actions for ${itemArchitecture} architecture item`,
      );
    } catch (error) {
      // Manual review table doesn't exist in this environment - return empty array
      console.log(
        "⚠️ VERIFICATION HISTORY PHASE 2: Manual review actions table not available, returning empty array",
      );
      reviewActions = [];
    }

    console.log(
      `✅ VERIFICATION HISTORY PHASE 2: Successfully retrieved history for ${itemArchitecture} architecture item "${itemDetails?.title || "Unknown"}"`,
    );

    res.json({
      success: true,
      attempts: attempts,
      reviewActions: reviewActions,
      // Phase 2 enhancement: Include architecture context for debugging
      _debug: {
        architecture: itemArchitecture,
        item_title: itemDetails?.title,
        total_attempts: attempts.length,
        total_reviews: reviewActions.length,
      },
    });
  } catch (error) {
    console.error("❌ VERIFICATION HISTORY PHASE 2 ERROR:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ error: "Failed to fetch verification history" });
  }
});

// POST /api/item/:id/request-manual-review - Request manual review for an item - HYBRID ARCHITECTURE
router.post("/:id/request-manual-review", authMiddleware, async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    const { reason } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    console.log(
      `🔍 REQUEST MANUAL REVIEW HYBRID: Checking item ${id} in both architectures`,
    );

    // STEP 1: Try to find and update item in new architecture (recurring_instances)
    let updatedItem = null;
    let isNewArchitecture = false;

    try {
      const newArchitectureResult = await db
        .select({
          id: recurring_instances.id,
          //title: recurring_instances.title,
          status: recurring_instances.status,
        })
        .from(recurring_instances)
        .where(eq(recurring_instances.id, id));

      if (newArchitectureResult.length > 0) {
        // Update in new architecture
        const [updated] = await db
          .update(recurring_instances)
          .set({
            status: "pending_review", // matches the enum in recurring_instances
            notes: reason || "User requested verification without AI",
            updated_at: new Date().toISOString(),
          })
          .where(eq(recurring_instances.id, id))
          .returning();

        if (updated) {
          updatedItem = updated;
          isNewArchitecture = true;
          console.log(
            `✅ REQUEST MANUAL REVIEW HYBRID: Updated item in NEW architecture (recurring_instances)`,
          );
        }
      }
    } catch (error) {
      console.log(
        `⚠️ REQUEST MANUAL REVIEW HYBRID: Error checking new architecture:`,
        error.message,
      );
    }

    // STEP 2: If not found in new architecture, try legacy items table
    if (!updatedItem) {
      try {
        const [updated] = await db
          .update(items)
          .set({
            status: "pending",
            manual_review_requested_by: user_id,
            manual_review_requested_at: new Date().toISOString(),
            manual_review_reason:
              reason || "User requested verification without AI",
          })
          .where(eq(items.id, id))
          .returning();

        if (updated) {
          updatedItem = updated;
          isNewArchitecture = false;
          console.log(
            `✅ REQUEST MANUAL REVIEW HYBRID: Updated item in LEGACY architecture (items table)`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ REQUEST MANUAL REVIEW HYBRID: Error checking legacy architecture:`,
          error.message,
        );
      }
    }

    if (!updatedItem) {
      console.log(
        `❌ REQUEST MANUAL REVIEW HYBRID: Item ${id} not found in either architecture`,
      );
      return res.status(404).json({ error: "Item not found" });
    }

    console.log(
      `📋 REQUEST MANUAL REVIEW HYBRID: Manual review requested for "${updatedItem.title}" using ${isNewArchitecture ? "NEW" : "LEGACY"} architecture`,
    );

    res.status(200).json({
      success: true,
      message: "Manual review requested successfully",
      item: updatedItem,
      architecture: isNewArchitecture ? "new" : "legacy",
    });
  } catch (error) {
    console.error("❌ REQUEST MANUAL REVIEW HYBRID ERROR:", error);
    res.status(500).json({ error: "Failed to request manual review" });
  }
});

// POST /api/item/:id/manual-review - Process manual review (approve/reject) - HYBRID ARCHITECTURE
router.post("/:id/manual-review", authMiddleware, async (req, res) => {
  try {
    const { id: item_id } = req.params;
    const { action, reason } = req.body;
    const reviewer_id = req.user_id;

    if (!action || !["approve", "reject"].includes(action)) {
      console.log(
        `❌ MANUAL REVIEW: Invalid action "${action}" from user ${reviewer_id}`,
      );
      return res
        .status(400)
        .json({ error: "Valid action (approve/reject) is required" });
    }

    console.log(
      `🔍 MANUAL REVIEW HYBRID: Checking item ${item_id} in both architectures`,
    );

    // STEP 1: Try to find item in new architecture (recurring_instances)
    let itemData = null;
    let isNewArchitecture = false;
    let templateData = null;

    try {
      const newArchitectureResult = await db
        .select({
          id: recurring_instances.id,
          title: recurring_instances.title,
          occurrence_date: recurring_instances.occurrence_date,
          status: recurring_instances.status,
          template_id: recurring_instances.template_id,
          assigned_to: recurring_instances.assigned_to,
          created_by: recurring_instances.created_by,
          verify_required: recurring_instances.verify_required,
          image_urls: recurring_instances.image_urls,
          ai_verification_result: recurring_instances.ai_verification_result,
        })
        .from(recurring_instances)
        .where(eq(recurring_instances.id, item_id));

      if (newArchitectureResult.length > 0) {
        itemData = newArchitectureResult[0];
        isNewArchitecture = true;

        // Get template data if this is a template-based item
        if (itemData.template_id) {
          const templateResult = await db
            .select({
              title: recurring_templates.title,
              verify_required: recurring_templates.verify_required,
              created_by: recurring_templates.created_by,
              is_recurring: recurring_templates.is_recurring,
            })
            .from(recurring_templates)
            .where(eq(recurring_templates.id, itemData.template_id));

          if (templateResult.length > 0) {
            templateData = templateResult[0];
            // Merge template data with instance data
            itemData = {
              ...itemData,
              title: itemData.title || templateData.title,
              verify_required:
                itemData.verify_required ?? templateData.verify_required,
              created_by: itemData.created_by || templateData.created_by,
            };
          }
        }

        console.log(
          `✅ MANUAL REVIEW HYBRID: Found item in NEW architecture (recurring_instances)`,
        );
      }
    } catch (error) {
      console.log(
        `⚠️ MANUAL REVIEW HYBRID: Error checking new architecture:`,
        error.message,
      );
    }

    // STEP 2: If not found in new architecture, check legacy items table
    if (!itemData) {
      try {
        const legacyResult = await db
          .select()
          .from(items)
          .where(eq(items.id, item_id));

        if (legacyResult.length > 0) {
          itemData = legacyResult[0];
          isNewArchitecture = false;
          console.log(
            `✅ MANUAL REVIEW HYBRID: Found item in LEGACY architecture (items table)`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ MANUAL REVIEW HYBRID: Error checking legacy architecture:`,
          error.message,
        );
      }
    }

    if (!itemData) {
      console.log(
        `❌ MANUAL REVIEW HYBRID: Item ${item_id} not found in either architecture`,
      );
      return res.status(404).json({ error: "Item not found" });
    }

    // Only allow community members (not the creator) to review
    if (itemData.created_by === reviewer_id) {
      return res.status(403).json({ error: "Cannot review your own item" });
    }

    // Check if item is actually pending manual review
    if (itemData.status !== "pending_manual_review") {
      console.log(
        `❌ MANUAL REVIEW: Item ${item_id} status is "${itemData.status}", not pending_manual_review`,
      );
      return res
        .status(400)
        .json({ error: "Item is not pending manual review" });
    }

    // Store the review action in manual_review_actions table using raw SQL
    const reviewMessage = reason || `Community member ${action}d the verification`;
    await db.execute(sql`
      INSERT INTO ${sql.identifier(process.env.NODE_ENV === "production" ? "manual_review_actions" : "dev_manual_review_actions")}
      (id, item_id, reviewer_user_id, action, message, created_at)
      VALUES (${nanoid()}, ${item_id}, ${reviewer_id}, ${action}, ${reviewMessage}, ${new Date().toISOString()})
    `);

    // STEP 3: Process approval/rejection based on architecture
    const newStatus = action === "approve" ? "complete" : "not_completed";

    if (isNewArchitecture) {
      console.log(
        `🔄 MANUAL REVIEW HYBRID: Processing NEW architecture review for item ${item_id}`,
      );

      // For new architecture, create completion record for specific date when approved
      if (action === "approve") {
        const completionDate =
          itemData.occurrence_date || new Date().toISOString().split("T")[0];
        const completionId = nanoid();

        await db.insert(item_completions).values({
          id: completionId,
          item_id: item_id,
          user_id: itemData.created_by,
          completion_date: completionDate,
          completed_at: new Date().toISOString(),
          verification_data: {
            type: "manual_review",
            status: "complete",
            reviewer_id: reviewer_id,
            reason: reason || "Community member approved the verification",
          },
          created_at: new Date().toISOString(),
        });
      }

      // Update the recurring_instances record
      const [updatedItem] = await db
        .update(recurring_instances)
        .set({
          status: newStatus,
          ai_verification_result:
            action === "approve" ? "complete" : "not_complete",
          updated_at: new Date().toISOString(),
        })
        .where(eq(recurring_instances.id, item_id))
        .returning();

      console.log(
        `✅ MANUAL REVIEW HYBRID: NEW architecture item ${action}d successfully`,
      );

      res.status(200).json({
        success: true,
        message: `Item ${action}d successfully`,
        item: updatedItem,
        architecture: "new",
      });
    } else {
      console.log(
        `🔄 MANUAL REVIEW HYBRID: Processing LEGACY architecture review for item ${item_id}`,
      );

      // For legacy architecture, use existing logic
      // For approved recurring items, create completion record instead of setting completed_at
      if (
        action === "approve" &&
        itemData.recurrence_type &&
        itemData.recurrence_type !== "once"
      ) {
        const today = new Date().toISOString().split("T")[0];
        const completionId = nanoid();

        await db.insert(item_completions).values({
          id: completionId,
          item_id: item_id,
          user_id: itemData.created_by,
          completion_date: today,
          completed_at: new Date().toISOString(),
          verification_data: {
            type: "manual_review",
            status: "complete",
            reviewer_id: reviewer_id,
            reason: reason || "Community member approved the verification",
          },
          created_at: new Date().toISOString(),
        });
      }

      const [updatedItem] = await db
        .update(items)
        .set({
          status: newStatus,
          completed_at:
            action === "approve" &&
            (!itemData.recurrence_type || itemData.recurrence_type === "once")
              ? new Date().toISOString()
              : null,
          ai_verification_result:
            action === "approve" ? "complete" : "not_complete",
        })
        .where(eq(items.id, item_id))
        .returning();

      console.log(
        `✅ MANUAL REVIEW HYBRID: LEGACY architecture item ${action}d successfully`,
      );

      res.status(200).json({
        success: true,
        message: `Item ${action}d successfully`,
        item: updatedItem,
        architecture: "legacy",
      });
    }

    // Log the review action
    console.log(
      `📋 MANUAL REVIEW HYBRID: Item "${itemData.title}" ${action}d by user ${reviewer_id} using ${isNewArchitecture ? "NEW" : "LEGACY"} architecture`,
    );
  } catch (error) {
    console.error("❌ MANUAL REVIEW HYBRID ERROR:", error);
    res.status(500).json({ error: "Failed to process manual review" });
  }
});

// DELETE /api/item/:id - Delete an item with strategy options
router.delete("/:id", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    const { strategy } = req.body || {}; // "all" or "future" (default: "future")

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `🗑️ DELETE REQUEST: Attempting to delete item ${id} by user ${user_id} with strategy: ${strategy || "future"}`,
    );
    console.log(
      `🔍 DELETE DEBUG: Item ID: "${id}", Type: ${typeof id}, Length: ${id.length}`,
    );

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, id);
    console.log(
      `🔐 ACCESS CHECK: User ${user_id} access to item ${id}: ${hasAccess}`,
    );

    if (!hasAccess) {
      console.log(
        `❌ DELETE DENIED: User ${user_id} does not have access to item ${id}`,
      );
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    // HYBRID DELETE: Support both legacy items and new recurring_instances architecture
    let deletedItem = null;
    let itemTitle = "";
    let itemDisplayId = "";

    // HYBRID DELETE: Get table names from schema (handles environment prefixes automatically)
    const instancesTable = getTableName(recurring_instances);
    const templatesTable = getTableName(recurring_templates);

    console.log(
      `🔍 DELETE ENVIRONMENT: ${process.env.NODE_ENV || "production"}, using table: ${instancesTable}`,
    );

    try {
      // Use the SAME table that the access check uses
      let existingItem = await db.execute(sql`
        SELECT ri.*, rt.title 
        FROM ${sql.identifier(instancesTable)} ri
        LEFT JOIN ${sql.identifier(templatesTable)} rt ON ri.template_id = rt.id
        WHERE ri.id = ${id}
        LIMIT 1
      `);

      let tableName = instancesTable;

      if (existingItem.rows.length > 0) {
        const item = existingItem.rows[0];
        itemTitle = item.title || "Untitled";
        itemDisplayId = item.display_id || id;

        console.log(
          `🔍 HYBRID DELETE: Found item ${id} (${itemDisplayId}) in ${tableName} table`,
        );

        // First, get template info to determine if this is truly a recurring item
        let isRecurring = false;
        let templateData = null;

        if (item.template_id) {
          const templateQuery = sql`
            SELECT is_recurring, max_occurrences FROM ${sql.identifier(templatesTable)} 
            WHERE id = ${item.template_id}
            LIMIT 1
          `;
          const templateResult = await db.execute(templateQuery);
          if (templateResult.rows.length > 0) {
            templateData = templateResult.rows[0];
            isRecurring = templateData.is_recurring === true;
          }
        }

        console.log(
          `🔍 DELETION STRATEGY: Item ${id} is recurring: ${isRecurring}, strategy: ${strategy || "all"}`,
        );

        if (isRecurring && strategy === "future") {
          // STRATEGY: Future Only - Keep ALL existing data, only prevent future occurrences
          console.log(`🔄 FUTURE ONLY: Marking template as inactive to stop future instances, preserving ALL existing data including current instance`);
          


          const templateId = item.template_id;
          if (templateId) {
            // Mark template as inactive instead of deleting to preserve historical data in insights
            const templateUpdateResult = await db.execute(sql`
              UPDATE ${sql.identifier(templatesTable)} 
              SET is_active = false, updated_at = ${new Date().toISOString()}
              WHERE id = ${templateId}
            `);
            
            if (templateUpdateResult.rowCount && templateUpdateResult.rowCount > 0) {
              console.log(`✅ FUTURE ONLY: Marked template ${templateId} as inactive, all instances and completion data preserved for insights`);
              deletedItem = { id, title: itemTitle, display_id: itemDisplayId };
              console.log(`✅ FUTURE ONLY: Template deactivation successful - no instances were removed`);
            } else {
              console.log(`❌ FUTURE ONLY: Failed to deactivate template ${templateId}`);

            }
          } else {
            console.log(
              `⚠️ FUTURE ONLY: No template_id found, cannot stop future occurrences`,
            );
          }
        } else {
          // STRATEGY: All (default for one-time items or "all" strategy for recurring items)
          console.log(
            `🗑️ DELETE ALL: Removing all records including completion data and instances`,
          );

          const templateId = item.template_id;

          // Delete related records for this specific item
          await db
            .delete(item_verification_attempts)
            .where(eq(item_verification_attempts.item_id, id));
          await db
            .delete(item_completions)
            .where(eq(item_completions.item_id, id));

          // Delete the current instance
          const result = await db.execute(sql`
            DELETE FROM ${sql.identifier(tableName)} 
            WHERE id = ${id}
          `);

          if (result.rowCount && result.rowCount > 0) {
            deletedItem = { id, title: itemTitle, display_id: itemDisplayId };
            console.log(
              `🗑️ DELETE ALL: Deleted current instance ${id} (${itemDisplayId})`,
            );

            // For recurring items with "all" strategy, also delete template and other instances
            if (isRecurring && templateId) {
              console.log(
                `🗑️ DELETE ALL RECURRING: Removing template and all other instances`,
              );

              // Delete all other instances of this template first (to clean up their completion data)
              const allInstancesQuery = sql`
                SELECT id FROM ${sql.identifier(instancesTable)} 
                WHERE template_id = ${templateId} AND id != ${id}
              `;
              const allInstancesResult = await db.execute(allInstancesQuery);

              for (const instance of allInstancesResult.rows) {
                // Clean up completion data for each instance
                await db
                  .delete(item_verification_attempts)
                  .where(eq(item_verification_attempts.item_id, instance.id));
                await db
                  .delete(item_completions)
                  .where(eq(item_completions.item_id, instance.id));
              }

              // Delete all other instances
              const instancesDeleteResult = await db.execute(sql`
                DELETE FROM ${sql.identifier(instancesTable)} 
                WHERE template_id = ${templateId} AND id != ${id}
              `);

              if (
                instancesDeleteResult.rowCount &&
                instancesDeleteResult.rowCount > 0
              ) {
                console.log(
                  `✅ DELETE ALL: Deleted ${instancesDeleteResult.rowCount} other instances`,
                );
              }

              // Finally delete the template
              const templateDeleteResult = await db.execute(sql`
                DELETE FROM ${sql.identifier(templatesTable)} 
                WHERE id = ${templateId}
              `);

              if (
                templateDeleteResult.rowCount &&
                templateDeleteResult.rowCount > 0
              ) {
                console.log(`✅ DELETE ALL: Deleted template ${templateId}`);
              }
            } else if (templateId) {
              // For one-time items, just delete the template
              console.log(
                `🗑️ DELETE ALL ONE-TIME: Removing template for one-time item`,
              );
              await db.execute(sql`
                DELETE FROM ${sql.identifier(templatesTable)} 
                WHERE id = ${templateId}
              `);
            }

            console.log(`✅ DELETE ALL: Complete cleanup finished`);
          } else {
            console.log(`❌ DELETE ALL: Failed to delete instance ${id}`);
          }
        }
      }
    } catch (architectureError) {
      console.error(
        `⚠️ NEW ARCHITECTURE DELETE ERROR: ${architectureError.message}`,
      );
    }

    // If new architecture didn't handle it, try legacy system
    if (!deletedItem) {
      console.log(`📝 LEGACY DELETE: Using legacy deletion for item ${id}`);

      // Handle strategy for legacy items (always delete all for legacy items since they're one-time)
      console.log(
        `🗑️ LEGACY STRATEGY: Legacy items are always deleted with 'all' strategy`,
      );
      await db
        .delete(item_verification_attempts)
        .where(eq(item_verification_attempts.item_id, id));
      await db.delete(item_completions).where(eq(item_completions.item_id, id));

      // Try to delete from legacy items table
      const [legacyDeleted] = await db
        .delete(items)
        .where(eq(items.id, id))
        .returning();
      if (legacyDeleted) {
        deletedItem = legacyDeleted;
        itemTitle = legacyDeleted.title || "Untitled";
        itemDisplayId = legacyDeleted.display_id || id;
        console.log(
          `🔄 LEGACY DELETE: Successfully deleted item ${id} from legacy items table`,
        );
      } else {
        console.log(
          `❌ LEGACY DELETE FAILED: No item found in legacy items table for ID ${id}`,
        );
      }
    }

    if (!deletedItem) {
      console.log(`❌ DELETE FAILED: No item found with ID ${id} in any table`);
      return res.status(404).json({ error: "Item not found" });
    }

    // ADDITIONAL CLEANUP: If this was a recurring item, ensure we clean up related data
    if (deletedItem && (itemDisplayId || deletedItem.display_id)) {
      const finalDisplayId = itemDisplayId || deletedItem.display_id;
      console.log(
        `🧹 CLEANUP: Checking for related items with display_id ${finalDisplayId}`,
      );

      try {
        // Clean up any orphaned instances or templates with the same display_id
        // Use the same tables already defined above

        // Check if there are other instances with the same display_id but different IDs
        const otherInstancesQuery = sql`
          SELECT id, template_id FROM ${sql.identifier(instancesTable)} 
          WHERE display_id = ${finalDisplayId} AND id != ${id}
        `;
        const otherInstances = await db.execute(otherInstancesQuery);

        if (otherInstances.rows.length > 0) {
          console.log(
            `⚠️ CLEANUP WARNING: Found ${otherInstances.rows.length} other instances with same display_id ${finalDisplayId}`,
          );
          otherInstances.rows.forEach((row, index) => {
            console.log(
              `  ${index + 1}. Instance ID: ${row.id}, Template ID: ${row.template_id}`,
            );
          });
        }
      } catch (cleanupError) {
        console.error(`⚠️ CLEANUP ERROR: ${cleanupError.message}`);
        // Don't fail the request if cleanup fails
      }
    }

    console.log(
      `✅ ITEM DELETED: Item "${itemTitle}" (${itemDisplayId}) deleted by user ${user_id}`,
    );

    // Comprehensive cache invalidation after successful deletion
    try {
      console.log(
        `🧹 ITEM DELETE CACHE: Starting cache invalidation for deleted item ${itemDisplayId}`,
      );

      // Use the comprehensive invalidateItemCaches function
      invalidateItemCaches(user_id, {
        due_date: new Date().toISOString().split("T")[0], // Today's date
        assigned_to: deletedItem?.assigned_to,
        shared_with: deletedItem?.shared_with,
      });

      // Additional pattern-based cache invalidation for safety
      // Use invalidateUser instead of non-existent invalidateUserPatterns
      cacheService.invalidateUser(user_id);

      console.log(
        "✅ ITEM DELETE CACHE: All Today page caches invalidated successfully",
      );
    } catch (cacheError) {
      console.error(
        "⚠️ ITEM DELETE CACHE: Failed to invalidate cache:",
        cacheError,
      );
      // Don't fail the request if cache invalidation fails
    }

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
      item: deletedItem,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// DELETE /api/item/photo/:attemptId - Manual photo deletion (hybrid retention)
router.delete("/photo/:attemptId", async (req, res) => {
  try {
    const { user_id } = req;
    const { attemptId } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const deleted = await PhotoRetentionService.deletePhotoManually(
      attemptId,
      user_id,
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Photo not found or unauthorized",
      });
    }

    res.json({
      success: true,
      message: "Photo deleted successfully",
    });
  } catch (error) {
    console.error("Manual photo deletion error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete photo",
    });
  }
});

// GET /api/item/:id/photo-retention - Get photo retention information
router.get("/:id/photo-retention", async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has access to this item
    const hasAccess = await userHasItemAccess(user_id, id);
    if (!hasAccess) {
      return res.status(404).json({ error: "Item not found or unauthorized" });
    }

    const retentionInfo = await PhotoRetentionService.getPhotoRetentionInfo(id);

    res.json({
      success: true,
      retention_info: retentionInfo,
    });
  } catch (error) {
    console.error("Photo retention info error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get photo retention information",
    });
  }
});

export default router;
