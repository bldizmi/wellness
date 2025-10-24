import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { notification_preferences } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/notification-preferences
 * Get current user's notification preferences
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`📬 GET NOTIFICATION PREFERENCES: Fetching for user ${userId}`);

    // Fetch user's notification preferences
    const preferences = await db
      .select()
      .from(notification_preferences)
      .where(eq(notification_preferences.user_id, userId))
      .limit(1);

    if (preferences.length === 0) {
      // If no preferences exist, create default preferences
      console.log(`📬 NO PREFERENCES FOUND: Creating default preferences for user ${userId}`);

      const now = new Date().toISOString();
      const defaultPreferences = {
        user_id: userId,
        push_enabled: false,
        shared_item_completed: true,
        shared_item_verification_request: true,
        shared_item_assigned: true,
        daily_reminder_enabled: true,
        daily_reminder_time: "20:00",
        streak_risk_alert: true,
        streak_milestone_alert: true,
        community_invitation: true,
        community_member_joined: false,
        verification_approved: true,
        verification_rejected: true,
        manual_review_completed: true,
        created_at: now,
        updated_at: now,
      };

      await db.insert(notification_preferences).values(defaultPreferences);

      console.log(`✅ CREATED DEFAULT PREFERENCES: for user ${userId}`);
      return res.json(defaultPreferences);
    }

    console.log(`✅ FETCHED PREFERENCES: for user ${userId}`);
    res.json(preferences[0]);
  } catch (error) {
    console.error("❌ GET NOTIFICATION PREFERENCES ERROR:", error);
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

/**
 * PATCH /api/notification-preferences
 * Update current user's notification preferences
 */
router.patch("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updates = req.body;
    console.log(`📬 UPDATE NOTIFICATION PREFERENCES: Updating for user ${userId}`, updates);

    // Validate that we're not trying to update user_id, created_at, or updated_at
    const { user_id, created_at, ...validUpdates } = updates;

    // Add updated_at timestamp
    const updateData = {
      ...validUpdates,
      updated_at: new Date().toISOString(),
    };

    // Check if preferences exist
    const existing = await db
      .select()
      .from(notification_preferences)
      .where(eq(notification_preferences.user_id, userId))
      .limit(1);

    if (existing.length === 0) {
      // Create new preferences with updates
      const now = new Date().toISOString();
      const newPreferences = {
        user_id: userId,
        push_enabled: false,
        shared_item_completed: true,
        shared_item_verification_request: true,
        shared_item_assigned: true,
        daily_reminder_enabled: true,
        daily_reminder_time: "20:00",
        streak_risk_alert: true,
        streak_milestone_alert: true,
        community_invitation: true,
        community_member_joined: false,
        verification_approved: true,
        verification_rejected: true,
        manual_review_completed: true,
        created_at: now,
        updated_at: now,
        ...validUpdates,
      };

      await db.insert(notification_preferences).values(newPreferences);
      console.log(`✅ CREATED PREFERENCES: for user ${userId}`);
      return res.json(newPreferences);
    }

    // Update existing preferences
    await db
      .update(notification_preferences)
      .set(updateData)
      .where(eq(notification_preferences.user_id, userId));

    // Fetch updated preferences
    const updated = await db
      .select()
      .from(notification_preferences)
      .where(eq(notification_preferences.user_id, userId))
      .limit(1);

    console.log(`✅ UPDATED PREFERENCES: for user ${userId}`);
    res.json(updated[0]);
  } catch (error) {
    console.error("❌ UPDATE NOTIFICATION PREFERENCES ERROR:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

/**
 * POST /api/notification-preferences/request-permission
 * Request browser push notification permission
 */
router.post("/request-permission", authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { granted } = req.body;
    console.log(`📬 PUSH PERMISSION: User ${userId} permission ${granted ? 'granted' : 'denied'}`);

    // Update push_enabled based on permission
    await db
      .update(notification_preferences)
      .set({
        push_enabled: granted === true,
        updated_at: new Date().toISOString(),
      })
      .where(eq(notification_preferences.user_id, userId));

    console.log(`✅ PUSH PERMISSION UPDATED: for user ${userId}`);
    res.json({ success: true, push_enabled: granted });
  } catch (error) {
    console.error("❌ PUSH PERMISSION ERROR:", error);
    res.status(500).json({ error: "Failed to update push permission" });
  }
});

export default router;
