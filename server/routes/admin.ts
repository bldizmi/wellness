import { Router } from "express";
import { db } from "../db";
import {
  users,
  updateUserSchema,
  createUserAdminSchema,
  type User,
  type UpdateUser,
  type CreateUserAdmin,
} from "../../shared/schema";
import { eq, or, ilike, and, count, desc } from "drizzle-orm";
import { Request, Response } from "express";
import { nanoid } from "nanoid";
import admin from "firebase-admin";
import promptsRouter from "./admin/prompts";

const router = Router();

// Middleware to check admin role
const requireAdmin = (req: Request, res: Response, next: any) => {
  const { user_id } = req;

  if (!user_id) {
    console.error("❌ SECURITY: Admin access denied - No user_id in request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check user role from database
  db.select({ role: users.role })
    .from(users)
    .where(eq(users.firebase_uid, user_id))
    .then(([user]) => {
      if (!user || user.role !== "admin") {
        console.error(
          `❌ SECURITY: Admin access denied - User ${user_id} role: ${user?.role || "not found"}`,
        );
        return res.status(403).json({ error: "Admin access required" });
      }

      console.log(`✅ AUDIT: Admin access granted - User ${user_id}`);
      next();
    })
    .catch((error) => {
      console.error("❌ Admin role check error:", error);
      return res.status(500).json({ error: "Role verification failed" });
    });
};

/**
 * Get all users with filtering and search
 * GET /api/admin/users?role=admin&status=active&search=john
 */
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role, status, search } = req.query;

    // Build where conditions
    const conditions = [];

    if (role && typeof role === "string") {
      conditions.push(eq(users.role, role));
    }

    if (status && typeof status === "string") {
      conditions.push(eq(users.status, status));
    }

    if (search && typeof search === "string") {
      conditions.push(
        or(
          ilike(users.display_name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.username, `%${search}%`),
        ),
      );
    }

    const whereClause =
      conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : and(...conditions)
        : undefined;

    const [userResults, totalCount, activeCount, invitedCount] =
      await Promise.all([
        whereClause
          ? db
              .select()
              .from(users)
              .where(whereClause)
              .orderBy(desc(users.created_at))
          : db.select().from(users).orderBy(desc(users.created_at)),
        db.select({ count: count() }).from(users),
        db
          .select({ count: count() })
          .from(users)
          .where(eq(users.status, "active")),
        db
          .select({ count: count() })
          .from(users)
          .where(eq(users.status, "invited")),
      ]);

    // Remove sensitive data
    const safeUsers = userResults.map((user) => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      users: safeUsers,
      counts: {
        total: totalCount[0].count,
        active: activeCount[0].count,
        invited: invitedCount[0].count,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * Create new user (admin only)
 * POST /api/admin/users
 */
router.post("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const validatedData = createUserAdminSchema.parse(req.body);

    // Check if username already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, validatedData.username))
      .limit(1);

    if (existingUser.length > 0) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    // Check if email already exists (optional but recommended)
    if (validatedData.email) {
      const existingEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, validatedData.email))
        .limit(1);

      if (existingEmail.length > 0) {
        return res
          .status(400)
          .json({ error: "Username or email already exists" });
      }
    }

    let firebaseUid = null;

    // Create Firebase user if status is active and email/password provided
    if (
      validatedData.status === "active" &&
      validatedData.email &&
      validatedData.password
    ) {
      try {
        // Use Firebase Admin SDK to create user
        const userRecord = await admin.auth().createUser({
          email: validatedData.email,
          password: validatedData.password,
          displayName: validatedData.display_name,
          disabled: false, // User is active
        });

        firebaseUid = userRecord.uid;

        // Optionally set custom claims for role-based access
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: validatedData.role,
          status: validatedData.status,
        });
      } catch (firebaseError: any) {
        console.error("Firebase user creation failed:", firebaseError);

        // Handle specific Firebase errors
        if (firebaseError.code === "auth/email-already-exists") {
          return res.status(400).json({
            error: "Email already exists in authentication system",
          });
        } else if (firebaseError.code === "auth/weak-password") {
          return res.status(400).json({
            error: "Password is too weak. Must be at least 6 characters.",
          });
        } else if (firebaseError.code === "auth/invalid-email") {
          return res.status(400).json({
            error: "Invalid email format",
          });
        }

        return res.status(400).json({
          error: "Failed to create user authentication account",
        });
      }
    }

    // Create user in database
    const [newUser] = await db
      .insert(users)
      .values({
        ...validatedData,
        firebase_uid: firebaseUid || "",
        created_at: new Date(),
        verified: validatedData.status === "active" ? true : false, // Auto-verify active users
      })
      .returning();

    // Remove password from response
    const { password, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      user: safeUser,
      message: firebaseUid
        ? "User created successfully with authentication account"
        : "User created successfully (invite-only, no authentication account yet)",
    });
  } catch (error) {
    console.error("Error creating user:", error);

    // Check if we have the request body and email
    if (error && req.body?.email) {
      try {
        // Try to parse the body again just for cleanup purposes
        const cleanupData = createUserAdminSchema.safeParse(req.body);
        if (cleanupData.success && cleanupData.data.email) {
          const existingFirebaseUser = await admin
            .auth()
            .getUserByEmail(cleanupData.data.email);
          if (existingFirebaseUser) {
            await admin.auth().deleteUser(existingFirebaseUser.uid);
            console.log("Cleaned up Firebase user after database error");
          }
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup Firebase user:", cleanupError);
      }
    }

    res.status(400).json({ error: "Failed to create user" });
  }
});

/**
 * Update user (admin only)
 * PUT /api/admin/users/:id
 */
router.put("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const validatedData = updateUserSchema.parse(req.body);

    // If terminating user, add terminated_at timestamp
    if (validatedData.status === "terminated") {
      validatedData.terminated_at = new Date();
    }

    const [updatedUser] = await db
      .update(users)
      .set(validatedData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password, ...safeUser } = updatedUser;

    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Error updating user:", error);
    // Return the actual error message to the frontend
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(400).json({ error: "Failed to update user" });
  }
});

/**
 * Get user by ID
 * GET /api/admin/users/:id
 */
router.get("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password, ...safeUser } = user;

    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Add prompts management routes
router.use("/prompts", promptsRouter);

export default router;
