import { Router } from "express";
import { db } from "../db";
import { user_profiles, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { updateUserProfileSchema } from "@shared/schema";
import { z } from "zod";
import { TimezoneService } from "../services/timezoneService";
import { isValidTimezone } from "@shared/timezoneUtils";

const router = Router();

// GET /api/profile - Get current user's profile
router.get("/", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user info including role by Firebase UID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, user_id));

    if (!user) {
      console.error(
        `❌ SECURITY: Profile access denied - Firebase UID ${user_id} not found in database`,
      );
      return res.status(404).json({ error: "User not found" });
    }

    // Get existing profile or create default if none exists
    let [profile] = await db
      .select()
      .from(user_profiles)
      .where(eq(user_profiles.user_id, user_id));

    // Create default profile if none exists
    if (!profile) {
      const defaultProfile = {
        user_id,
        display_name: user.display_name || "User",
        avatar_url: null,
        phone_number: null,
        life_stage: null,
        values: null,
        overall_goals: null,
        ai_nudge_level: "light" as const,
        tone_preference: "friendly" as const,
        focus_window: "variable" as const,
        energy_curve: null,
        work_context: null,
        habit_style: null,
        task_style: null,
        wake_time: null,
        sleep_time: null,
        notification_opt_in: true,
        timezone: "America/Los_Angeles", // Default to Pacific Time
        created_at: new Date().toISOString(),
      };

      [profile] = await db
        .insert(user_profiles)
        .values(defaultProfile)
        .returning();
    }

    // Combine profile data with user role information
    const responseData = {
      ...profile,
      role: user.role,
      email: user.email,
      username: user.username,
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/profile - Update user's profile (partial updates)
router.patch("/", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Debug: Log the incoming request body
    console.log(
      "Profile update request body:",
      JSON.stringify(req.body, null, 2),
    );

    // Validate request body using Zod with proper life_stage handling
    const validationResult = updateUserProfileSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.error(
        "Profile validation failed:",
        validationResult.error.format(),
      );
      return res.status(400).json({
        error: "Invalid profile data",
        details: validationResult.error.format(),
      });
    }

    const updateData = validationResult.data;

    // Check if profile exists, create if not
    let [existingProfile] = await db
      .select()
      .from(user_profiles)
      .where(eq(user_profiles.user_id, user_id));

    if (!existingProfile) {
      // Create new profile with provided data + defaults
      const newProfile = {
        user_id,
        display_name: updateData.display_name || "User",
        avatar_url: updateData.avatar_url || null,
        phone_number: updateData.phone_number || null,
        life_stage: updateData.life_stage || null,
        values: updateData.values || null,
        overall_goals: updateData.overall_goals || null,
        ai_nudge_level: updateData.ai_nudge_level || "light",
        tone_preference: updateData.tone_preference || "friendly",
        focus_window: updateData.focus_window || "variable",
        energy_curve: updateData.energy_curve || null,
        work_context: updateData.work_context || null,
        habit_style: updateData.habit_style || null,
        task_style: updateData.task_style || null,
        wake_time: updateData.wake_time || null,
        sleep_time: updateData.sleep_time || null,
        notification_opt_in: updateData.notification_opt_in ?? true,
        created_at: new Date().toISOString(),
      };

      const [createdProfile] = await db
        .insert(user_profiles)
        .values(newProfile)
        .returning();

      return res.json(createdProfile);
    }

    // Update existing profile with only provided fields
    const [updatedProfile] = await db
      .update(user_profiles)
      .set(updateData)
      .where(eq(user_profiles.user_id, user_id))
      .returning();

    // SYNC FIX: If display_name was updated, also update the users table for consistency
    if (updateData.display_name !== undefined) {
      try {
        await db
          .update(users)
          .set({ display_name: updateData.display_name })
          .where(eq(users.firebase_uid, user_id));

        console.log(
          `✅ SYNC: Updated users.display_name to "${updateData.display_name}" for user ${user_id}`,
        );
      } catch (syncError) {
        console.error(
          "⚠️ SYNC WARNING: Failed to update users table display_name:",
          syncError,
        );
        // Don't fail the request - profile update succeeded, sync failed
      }
    }

    res.json(updatedProfile);
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT /api/profile/timezone - Update user's timezone
router.put("/timezone", async (req, res) => {
  try {
    const { user_id } = req;
    const { timezone } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!timezone || typeof timezone !== "string") {
      return res.status(400).json({ error: "Timezone is required" });
    }

    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ error: "Invalid timezone" });
    }

    const success = await TimezoneService.updateUserTimezone(user_id, timezone);

    if (!success) {
      return res.status(500).json({ error: "Failed to update timezone" });
    }

    console.log(`✅ TIMEZONE: Updated user ${user_id} timezone to ${timezone}`);
    res.json({ success: true, timezone });
  } catch (error) {
    console.error("Error updating timezone:", error);
    res.status(500).json({ error: "Failed to update timezone" });
  }
});

// GET /api/profile/timezone - Get user's current timezone
router.get("/timezone", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const timezone = await TimezoneService.getUserTimezone(user_id);
    const userToday = await TimezoneService.getUserTodayDate(user_id);

    res.json({
      timezone,
      userToday,
      serverUTC: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting timezone:", error);
    res.status(500).json({ error: "Failed to get timezone" });
  }
});

// GET /api/profile/status - Get current user's account status
router.get("/status", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user status by Firebase UID
    const [user] = await db
      .select({
        status: users.status,
        username: users.username,
        email: users.email,
        terminated_at: users.terminated_at,
      })
      .from(users)
      .where(eq(users.firebase_uid, user_id));

    if (!user) {
      console.error(
        `❌ SECURITY: Status check denied - Firebase UID ${user_id} not found in database`,
      );
      return res.status(404).json({ error: "User not found" });
    }

    console.log(
      `✅ STATUS CHECK: User ${user.username || user.email} status: ${user.status}`,
    );

    res.json({
      status: user.status,
      terminated_at: user.terminated_at,
    });
  } catch (error) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ error: "Failed to fetch user status" });
  }
});

export default router;
