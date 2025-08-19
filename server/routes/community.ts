/**
 * Community API Routes
 *
 * Handles all community-related operations including:
 * - Community creation and management
 * - Member invitations and management
 * - Role assignments and permissions
 * - Community sharing and collaboration
 */

import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, pool } from "../db";
import {
  communities,
  community_members,
  community_invitations,
  community_role_changes,
  users,
  items,
} from "@shared/schema";
import { eq, and, count, isNull, desc, sql } from "drizzle-orm";
import { getSharedItems } from "../services/itemVisibilityService";
import { checkCommunityRole } from "../middleware/communityRole";

const router = Router();

/**
 * GET /api/community/collaborators
 * Get all potential collaborators for the authenticated user
 *
 * This endpoint replaces the N+1 query anti-pattern in the sharing dropdown
 * with a single optimized query that fetches all users the current user
 * can collaborate with across all their communities.
 *
 * @returns {object} Array of collaborators with user details and community context
 */
router.get("/collaborators", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Use environment-specific table names
    const tablePrefix = process.env.NODE_ENV === "development" ? "dev_" : "";

    // Single optimized query to get all collaborators
    // This replaces the N+1 anti-pattern with a single database call
    const result = await pool.query(
      `
      WITH user_communities AS (
        SELECT community_id, role
        FROM ${tablePrefix}community_members 
        WHERE user_id = $1 AND removed_at IS NULL
      ),
      all_collaborators AS (
        SELECT DISTINCT 
          u.firebase_uid as user_id,
          u.display_name,
          u.email,
          u.username,
          c.name as community_name,
          c.id as community_id,
          cm.role as member_role
        FROM ${tablePrefix}users u
        JOIN ${tablePrefix}community_members cm ON u.firebase_uid = cm.user_id
        JOIN ${tablePrefix}communities c ON cm.community_id = c.id
        WHERE cm.community_id IN (SELECT community_id FROM user_communities)
          AND cm.removed_at IS NULL
          AND u.firebase_uid != $1  -- Exclude self at database level
        ORDER BY u.display_name
      )
      SELECT * FROM all_collaborators;
    `,
      [user_id],
    );

    const collaborators = result.rows;

    // Add caching headers for 15-minute cache
    res.set("Cache-Control", "private, max-age=900"); // 15 minutes

    console.log(
      `🚀 COLLABORATORS: Found ${collaborators.length} collaborators for user ${user_id}`,
    );

    res.json({ collaborators });
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    res.status(500).json({ error: "Failed to fetch collaborators" });
  }
});

/**
 * POST /api/community
 * Create a new community
 *
 * @body {string} name - Community name (1-100 chars)
 * @body {string} type - Community type (family, friends, work, etc.)
 * @returns {object} Created community data
 */
router.post("/", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100),
      type: z.enum([
        "family",
        "friends",
        "work",
        "study",
        "hobby",
        "roommates",
        "team",
        "custom",
      ]),
    });

    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.format(),
      });
    }

    const { name, type } = validationResult.data;
    const communityId = nanoid();
    const memberId = nanoid();
    const now = new Date().toISOString();

    // Create community
    const [newCommunity] = await db
      .insert(communities)
      .values({
        id: communityId,
        name,
        created_by: user_id,
        type,
        created_at: now,
      })
      .returning();

    // Add creator as owner
    await db.insert(community_members).values({
      id: memberId,
      community_id: communityId,
      user_id: user_id,
      role: "owner",
      joined_at: now,
    });

    res.status(201).json({ community: newCommunity });
  } catch (error) {
    console.error("Error creating community:", error);
    res.status(500).json({ error: "Failed to create community" });
  }
});

/**
 * GET /api/community
 * Get all communities for the authenticated user
 *
 * @returns {object} Array of user's communities with member counts
 */
router.get("/", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userCommunities = await db
      .select({
        id: communities.id,
        name: communities.name,
        type: communities.type,
        created_at: communities.created_at,
        created_by: communities.created_by,
        deleted_at: communities.deleted_at,
        user_role: community_members.role,
        user_joined_at: community_members.joined_at,
        member_count: sql<number>`(
          SELECT COUNT(*)::int 
          FROM ${sql.raw(process.env.NODE_ENV === "development" ? "dev_community_members" : "community_members")} cm 
          WHERE cm.community_id = ${communities.id} 
            AND cm.removed_at IS NULL
        )`,
      })
      .from(communities)
      .innerJoin(
        community_members,
        eq(communities.id, community_members.community_id),
      )
      .where(
        and(
          eq(community_members.user_id, user_id),
          isNull(community_members.removed_at),
          isNull(communities.deleted_at),
        ),
      )
      .orderBy(desc(community_members.joined_at));

    // Fetch member data for each community
    const communitiesWithMembers = await Promise.all(
      userCommunities.map(async (community) => {
        const tablePrefix =
          process.env.NODE_ENV === "development" ? "dev_" : "";

        const memberQuery = `
          SELECT 
            cm.id,
            cm.user_id,
            cm.role,
            cm.joined_at,
            u.display_name,
            u.username,
            u.email
          FROM ${tablePrefix}community_members cm
          INNER JOIN ${tablePrefix}users u ON cm.user_id = u.firebase_uid
          WHERE cm.community_id = $1 
            AND cm.removed_at IS NULL
          ORDER BY cm.joined_at DESC
        `;

        const memberResult = await pool.query(memberQuery, [community.id]);

        return {
          ...community,
          members: memberResult.rows,
        };
      }),
    );

    res.json({ communities: communitiesWithMembers });
  } catch (error) {
    console.error("Error fetching user communities:", error);
    res.status(500).json({ error: "Failed to fetch communities" });
  }
});

/**
 * GET /api/community/shared
 * Get all shared items in user's communities
 *
 * @returns {object} Array of shared items across all communities
 */
router.get("/shared", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sharedItems = await getSharedItems(user_id);
    res.json({ items: sharedItems });
  } catch (error) {
    console.error("Error fetching shared items:", error);
    res.status(500).json({ error: "Failed to fetch shared items" });
  }
});

/**
 * GET /api/community/:id/members
 * Get all members of a specific community
 *
 * @param {string} id - Community ID
 * @query {string} excludeSelf - If 'true', exclude current user from results
 * @returns {object} Array of community members with user details
 */
router.get("/:id/members", async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { user_id } = req;
    const { excludeSelf } = req.query;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is a member of this community (use environment-specific table)
    const tablePrefix = process.env.NODE_ENV === "development" ? "dev_" : "";
    const membershipCheck = await pool.query(
      `
      SELECT id FROM ${tablePrefix}community_members 
      WHERE community_id = $1 AND user_id = $2 AND removed_at IS NULL
    `,
      [communityId, user_id],
    );

    if (membershipCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Access denied: Not a member of this community" });
    }

    // Fetch all community members with user details (use environment-specific tables)
    const result = await pool.query(
      `
      SELECT 
        cm.id,
        cm.user_id,
        cm.role,
        cm.joined_at,
        u.display_name,
        u.username,
        u.email
      FROM ${tablePrefix}community_members cm
      LEFT JOIN ${tablePrefix}users u ON cm.user_id = u.firebase_uid
      WHERE cm.community_id = $1
        AND cm.removed_at IS NULL
      ORDER BY cm.joined_at
    `,
      [communityId],
    );

    let members = result.rows;

    // Filter out current user if excludeSelf=true
    if (excludeSelf === "true") {
      members = members.filter((member) => member.user_id !== user_id);
    }

    res.json({ members });
  } catch (error) {
    console.error("Error fetching community members:", error);
    res.status(500).json({ error: "Failed to fetch community members" });
  }
});

/**
 * POST /api/community/:id/invite
 * Send an invitation to join a community (Owner/Admin only)
 *
 * @param {string} id - Community ID
 * @body {string} email - Email address of user to invite
 * @returns {object} Created invitation data
 */
router.post(
  "/:id/invite",
  checkCommunityRole(["owner", "admin"]),
  async (req, res) => {
    try {
      const communityId = req.params.id;
      const { email } = req.body;
      const inviter_id = req.user_id;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if invitee is already a member
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (existingUser.length > 0) {
        // Step 1: Simple query to get community members
        const allMembers = await db
          .select()
          .from(community_members)
          .where(eq(community_members.community_id, communityId));

        // Step 2: JavaScript filtering for complex conditions
        const existingMember = allMembers.find(
          (member) =>
            member.user_id === existingUser[0].firebase_uid &&
            member.removed_at === null,
        );

        if (existingMember) {
          return res
            .status(400)
            .json({ error: "User is already a member of this community" });
        }
      }

      // Check for existing pending invitation
      const [existingInvitation] = await db
        .select()
        .from(community_invitations)
        .where(
          and(
            eq(community_invitations.community_id, communityId),
            eq(community_invitations.invitee_email, email),
            eq(community_invitations.status, "pending"),
          ),
        );

      if (existingInvitation) {
        // Check if invitation has expired, if so delete it and allow new invitation
        const now = new Date();
        const expiresAt = new Date(existingInvitation.expires_at);

        if (now > expiresAt) {
          // Delete expired invitation
          await db
            .delete(community_invitations)
            .where(eq(community_invitations.id, existingInvitation.id));
        } else {
          return res
            .status(400)
            .json({ error: "Invitation already sent to this email" });
        }
      }

      if (!inviter_id) {
        throw new Error("Inviter ID is required");
      }

      // Create invitation
      const invitationId = nanoid();
      const [invitation] = await db
        .insert(community_invitations)
        .values({
          id: invitationId,
          community_id: communityId,
          invitee_email: email,
          inviter_id: inviter_id,
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        })
        .returning();

      res.status(201).json({ invitation });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  },
);

/**
 * GET /api/community/invitations/pending
 * Get all pending invitations for the authenticated user
 *
 * @returns {object} Array of pending invitations
 */
router.get("/invitations/pending", async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user's email using direct SQL to avoid Drizzle ORM issues
    const tablePrefix = process.env.NODE_ENV === "development" ? "dev_" : "";
    const userResult = await pool.query(
      `
      SELECT email FROM ${tablePrefix}users WHERE firebase_uid = $1
    `,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userEmail = userResult.rows[0].email;

    // Get pending invitations using direct SQL
    const invitationsResult = await pool.query(
      `
      SELECT 
        ci.id,
        ci.community_id,
        ci.inviter_id as invited_by,
        ci.created_at,
        ci.expires_at,
        c.name as community_name,
        c.type as community_type
      FROM ${tablePrefix}community_invitations ci
      JOIN ${tablePrefix}communities c ON ci.community_id = c.id
      WHERE ci.invitee_email = $1 
        AND ci.status = 'pending'
        AND c.deleted_at IS NULL
      ORDER BY ci.created_at DESC
    `,
      [userEmail],
    );

    res.json({ invitations: invitationsResult.rows });
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

/**
 * POST /api/community/invitations/:invitationId/:action
 * Accept or decline a community invitation
 *
 * @param {string} invitationId - Invitation ID
 * @param {string} action - 'accept' or 'decline'
 * @returns {object} Success message and community data (if accepted)
 */
router.post("/invitations/:invitationId/:action", async (req, res) => {
  try {
    const { invitationId, action } = req.params;
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!["accept", "decline"].includes(action)) {
      return res
        .status(400)
        .json({ error: 'Invalid action. Must be "accept" or "decline"' });
    }

    // Get invitation details
    const [invitation] = await db
      .select()
      .from(community_invitations)
      .where(eq(community_invitations.id, invitationId));

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ error: "Invitation is no longer pending" });
    }

    // Verify user owns this invitation
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.firebase_uid, user_id));

    if (!user || user.email !== invitation.invitee_email) {
      return res
        .status(403)
        .json({ error: "Not authorized to respond to this invitation" });
    }

    if (action === "accept") {
      // Check if user is already a member to prevent duplicates
      const tablePrefix = process.env.NODE_ENV === "development" ? "dev_" : "";
      const existingMember = await pool.query(
        `
        SELECT id FROM ${tablePrefix}community_members 
        WHERE community_id = $1 AND user_id = $2 AND removed_at IS NULL
      `,
        [invitation.community_id, user_id],
      );

      if (existingMember.rows.length === 0) {
        // Add user to community using direct SQL to avoid timestamp issues
        const memberId = nanoid();
        await pool.query(
          `
          INSERT INTO ${tablePrefix}community_members (id, community_id, user_id, role, joined_at)
          VALUES ($1, $2, $3, 'member', NOW())
        `,
          [memberId, invitation.community_id, user_id],
        );
      }
    }

    // Update invitation status using direct SQL to avoid timestamp issues
    const tablePrefixForUpdate =
      process.env.NODE_ENV === "development" ? "dev_" : "";
    await pool.query(
      `
      UPDATE ${tablePrefixForUpdate}community_invitations 
      SET status = $1, responded_at = NOW()
      WHERE id = $2
    `,
      [action === "accept" ? "accepted" : "declined", invitationId],
    );

    res.json({
      message: `Invitation ${action}ed successfully`,
      action,
      community_id: invitation.community_id,
    });
  } catch (error) {
    console.error("Error responding to invitation:", error);
    res.status(500).json({ error: "Failed to respond to invitation" });
  }
});

/**
 * GET /api/community/:id/invitations
 * Get pending invitations for a specific community (Owner/Admin only)
 *
 * @param {string} id - Community ID
 * @returns {object} Array of pending invitations for the community
 */
router.get(
  "/:id/invitations",
  checkCommunityRole(["owner", "admin"]),
  async (req, res) => {
    try {
      const communityId = req.params.id;

      // Use direct SQL query to handle table prefixes properly
      const tablePrefix = process.env.NODE_ENV === "development" ? "dev_" : "";

      const result = await pool.query(
        `
      SELECT 
        ci.id,
        ci.invitee_email,
        ci.status,
        ci.expires_at,
        ci.created_at,
        u.display_name as inviter_name,
        u.email as inviter_email
      FROM ${tablePrefix}community_invitations ci
      LEFT JOIN ${tablePrefix}users u ON ci.inviter_id = u.firebase_uid
      WHERE ci.community_id = $1 AND ci.status = 'pending'
      ORDER BY ci.created_at DESC
    `,
        [communityId],
      );

      res.json({ invitations: result.rows });
    } catch (error) {
      console.error("Error fetching community invitations:", error);
      res.status(500).json({ error: "Failed to fetch community invitations" });
    }
  },
);

/**
 * DELETE /api/community/invitations/:invitationId
 * Revoke a pending invitation (Owner/Admin only)
 *
 * @param {string} invitationId - Invitation ID to revoke
 * @returns {object} Success message
 */
router.delete("/invitations/:invitationId", async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get invitation and verify permissions
    const [invitation] = await db
      .select()
      .from(community_invitations)
      .where(eq(community_invitations.id, invitationId));

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    // Check if user has permission to revoke this invitation
    const [membership] = await db
      .select()
      .from(community_members)
      .where(
        and(
          eq(community_members.community_id, invitation.community_id),
          eq(community_members.user_id, user_id),
          isNull(community_members.removed_at),
        ),
      );

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return res.status(403).json({
        error: "Not authorized to revoke invitations for this community",
      });
    }

    // Delete the invitation
    await db
      .delete(community_invitations)
      .where(eq(community_invitations.id, invitationId));

    res.json({ message: "Invitation revoked successfully" });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    res.status(500).json({ error: "Failed to revoke invitation" });
  }
});

/**
 * POST /api/community/:id/leave
 * Leave a community or delete it (with confirmation)
 *
 * @param {string} id - Community ID
 * @body {boolean} confirm_leave - Confirmation for leaving
 * @body {boolean} confirm_delete - Confirmation for deletion (owner only)
 * @returns {object} Success message
 */
router.post("/:id/leave", async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { user_id } = req;
    const { confirm_leave, confirm_delete } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user's membership and role
    const [membership] = await db
      .select()
      .from(community_members)
      .where(
        and(
          eq(community_members.community_id, communityId),
          eq(community_members.user_id, user_id),
          isNull(community_members.removed_at),
        ),
      );

    if (!membership) {
      return res
        .status(404)
        .json({ error: "You are not a member of this community" });
    }

    const isOwner = membership.role === "owner";

    // Handle deletion (owner only)
    if (confirm_delete === true) {
      if (!isOwner) {
        return res
          .status(403)
          .json({ error: "Only the owner can delete a community" });
      }

      // Soft delete the community
      await db
        .update(communities)
        .set({ deleted_at: new Date().toISOString() })
        .where(eq(communities.id, communityId));

      res.json({
        message: "Community deleted successfully",
        action: "deleted",
      });
      return;
    }

    // Handle leaving
    if (confirm_leave === true) {
      // Check if owner is trying to leave (requires deletion)
      if (isOwner) {
        return res.status(400).json({
          error:
            "As the owner, you must delete the community or transfer ownership before leaving",
        });
      }

      // Check if this is the last admin
      if (membership.role === "admin") {
        const adminCount = await db
          .select({ count: count() })
          .from(community_members)
          .where(
            and(
              eq(community_members.community_id, communityId),
              eq(community_members.role, "admin"),
              isNull(community_members.removed_at),
            ),
          );

        const ownerCount = await db
          .select({ count: count() })
          .from(community_members)
          .where(
            and(
              eq(community_members.community_id, communityId),
              eq(community_members.role, "owner"),
              isNull(community_members.removed_at),
            ),
          );

        if (adminCount[0].count <= 1 && ownerCount[0].count === 0) {
          return res.status(400).json({
            error:
              "Cannot leave: You are the last admin. Transfer ownership or promote another member first.",
          });
        }
      }

      // Remove user from community (soft delete)
      await db
        .update(community_members)
        .set({ removed_at: new Date().toISOString() })
        .where(eq(community_members.id, membership.id));

      res.json({
        message: "Left community successfully",
        action: "left",
      });
      return;
    }

    // No valid confirmation provided
    res.status(400).json({
      error: "Missing required confirmation",
      required: isOwner
        ? "confirm_delete or transfer ownership"
        : "confirm_leave",
    });
  } catch (error) {
    console.error("Error in community leave/delete:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * DELETE /api/community/:communityId/members/:memberId
 * Remove a member from the community (Owner/Admin only)
 *
 * @param {string} communityId - Community ID
 * @param {string} memberId - Member ID to remove
 * @returns {object} Success message
 */
router.delete(
  "/:communityId/members/:memberId",
  checkCommunityRole(["owner", "admin"]),
  async (req, res) => {
    try {
      const { communityId, memberId } = req.params;
      const { user_id: actorId } = req;

      // Get the member to be removed
      const [memberToRemove] = await db
        .select()
        .from(community_members)
        .where(
          and(
            eq(community_members.id, memberId),
            eq(community_members.community_id, communityId),
            isNull(community_members.removed_at),
          ),
        );

      if (!memberToRemove) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Prevent self-removal (use leave endpoint instead)
      if (memberToRemove.user_id === actorId) {
        return res
          .status(400)
          .json({ error: "Use the leave endpoint to remove yourself" });
      }

      // Prevent removing owners
      if (memberToRemove.role === "owner") {
        return res.status(403).json({ error: "Cannot remove community owner" });
      }

      // Soft delete the membership
      await db
        .update(community_members)
        .set({ removed_at: new Date().toISOString() })
        .where(eq(community_members.id, memberId));

      // Log role change
      await db.insert(community_role_changes).values({
        community_id: communityId,
        user_id: memberToRemove.user_id,
        old_role: memberToRemove.role,
        new_role: "removed",
        changed_by: actorId,
        created_at: new Date().toISOString(),
      });

      res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  },
);

/**
 * POST /api/community/:communityId/transfer
 * Transfer ownership to another member (Owner only)
 *
 * @param {string} communityId - Community ID
 * @body {string} new_owner_id - User ID of new owner
 * @returns {object} Success message
 */
router.post(
  "/:communityId/transfer",
  checkCommunityRole(["owner"]),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const { new_owner_id } = req.body;
      const { user_id: currentOwnerId } = req;

      if (!new_owner_id) {
        return res.status(400).json({ error: "new_owner_id is required" });
      }

      if (new_owner_id === currentOwnerId) {
        return res
          .status(400)
          .json({ error: "Cannot transfer ownership to yourself" });
      }

      // Verify new owner is a member
      const [newOwnerMembership] = await db
        .select()
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, communityId),
            eq(community_members.user_id, new_owner_id),
            isNull(community_members.removed_at),
          ),
        );

      if (!newOwnerMembership) {
        return res
          .status(400)
          .json({ error: "New owner must be a member of the community" });
      }

      const now = new Date().toISOString();

      // Update current owner to admin
      await db
        .update(community_members)
        .set({ role: "admin" })
        .where(eq(community_members.community_id, communityId));

      // Update new owner
      await db
        .update(community_members)
        .set({ role: "owner" })
        .where(eq(community_members.id, newOwnerMembership.id));

      // Log role changes
      await db.insert(community_role_changes).values([
        {
          id: nanoid(),
          community_id: communityId,
          user_id: currentOwnerId,
          old_role: "owner",
          new_role: "admin",
          changed_by: currentOwnerId,
          created_at: now,
        },
        {
          id: nanoid(),
          community_id: communityId,
          user_id: new_owner_id,
          old_role: newOwnerMembership.role,
          new_role: "owner",
          changed_by: currentOwnerId,
          created_at: now,
        },
      ]);

      res.json({ message: "Ownership transferred successfully" });
    } catch (error) {
      console.error("Error transferring ownership:", error);
      res.status(500).json({ error: "Failed to transfer ownership" });
    }
  },
);

/**
 * GET /api/community/:id/role-history
 * Get role change history for a community (Owner/Admin only)
 *
 * @param {string} id - Community ID
 * @returns {object} Array of role changes with user details
 */
router.get(
  "/:id/role-history",
  checkCommunityRole(["owner", "admin"]),
  async (req, res) => {
    try {
      const { id: communityId } = req.params;

      // Use direct SQL to avoid Drizzle ORM type issues
      // Step 1: Get role changes
      const roleChanges = await db
        .select()
        .from(community_role_changes)
        .where(eq(community_role_changes.community_id, communityId));

      // Step 2: Get user details
      const allUsers = await db.select().from(users);

      // Step 3: JavaScript join for user details
      const result = {
        rows: roleChanges
          .map((rc) => {
            const user = allUsers.find((u) => u.firebase_uid === rc.user_id);
            const changedByUser = allUsers.find(
              (u) => u.firebase_uid === rc.changed_by,
            );

            return {
              id: rc.id,
              user_id: rc.user_id,
              old_role: rc.old_role,
              new_role: rc.new_role,
              changed_by: rc.changed_by,
              created_at: rc.created_at,
              user_display_name: user?.display_name || null,
              user_email: user?.email || null,
              changed_by_display_name: changedByUser?.display_name || null,
              changed_by_email: changedByUser?.email || null,
            };
          })
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          ),
      };

      res.json({ role_changes: result.rows });
    } catch (error) {
      console.error("Error fetching role history:", error);
      res.status(500).json({ error: "Failed to fetch role history" });
    }
  },
);

export default router;
