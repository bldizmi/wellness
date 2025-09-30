import { Router } from 'express';
import { db } from '../db';
import { rewards, users, community_members, reward_progress_history } from '@shared/schema';
import { insertRewardSchema, updateRewardSchema, insertRewardProgressHistorySchema } from '@shared/schema';
import { eq, and, or, inArray, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GET /api/rewards - Get user's rewards (created by user)
router.get('/', async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRewards = await db
      .select()
      .from(rewards)
      .where(eq(rewards.created_by, user_id))
      .orderBy(sql`${rewards.created_at} DESC`);

    // Check for expired rewards and update their status
    const now = new Date();
    for (const reward of userRewards) {
      // Check rewards that are pending, active, or approved
      if (reward.status === 'pending' || reward.status === 'approved' || reward.status === 'active') {
        if (reward.end_date && new Date(reward.end_date) < now) {
          // Mark as expired
          await db
            .update(rewards)
            .set({
              status: 'expired',
              updated_at: now.toISOString()
            })
            .where(eq(rewards.id, reward.id));

          // Update the object being returned
          reward.status = 'expired';

          console.log(`✅ Reward "${reward.title}" (${reward.id}) marked as expired from status: ${reward.status}`);
        }
      }
    }

    res.json({ rewards: userRewards });
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// GET /api/rewards/shared - Get rewards shared with current user for approval
router.get('/shared', async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find rewards where user is in shared_with array and not the creator
    const sharedRewards = await db
      .select({
        id: rewards.id,
        created_by: rewards.created_by,
        creator_name: users.display_name,
        title: rewards.title,
        description: rewards.description,
        target_metric: rewards.target_metric,
        target_value: rewards.target_value,
        duration_type: rewards.duration_type,
        duration_value: rewards.duration_value,
        start_date: rewards.start_date,
        end_date: rewards.end_date,
        status: rewards.status,
        approved_by: rewards.approved_by,
        approved_at: rewards.approved_at,
        completed_at: rewards.completed_at,
        delivered_by: rewards.delivered_by,
        delivered_at: rewards.delivered_at,
        rejection_reason: rewards.rejection_reason,
        community_id: rewards.community_id,
        shared_with: rewards.shared_with,
        created_at: rewards.created_at,
        updated_at: rewards.updated_at,
      })
      .from(rewards)
      .leftJoin(users, eq(users.firebase_uid, rewards.created_by))
      .where(
        and(
          sql`${rewards.shared_with} IS NOT NULL AND ${rewards.shared_with} ? ${user_id}`,
          sql`${rewards.created_by} != ${user_id}`
        )
      )
      .orderBy(sql`${rewards.created_at} DESC`);

    // Check for expired rewards and update their status
    const now = new Date();
    for (const reward of sharedRewards) {
      // Check rewards that are pending, active, or approved
      if (reward.status === 'pending' || reward.status === 'approved' || reward.status === 'active') {
        if (reward.end_date && new Date(reward.end_date) < now) {
          // Mark as expired
          await db
            .update(rewards)
            .set({
              status: 'expired',
              updated_at: now.toISOString()
            })
            .where(eq(rewards.id, reward.id));

          // Update the object being returned
          reward.status = 'expired';

          console.log(`✅ Shared reward "${reward.title}" (${reward.id}) marked as expired from status: ${reward.status}`);
        }
      }
    }

    res.json({ rewards: sharedRewards });
  } catch (error) {
    console.error('Error fetching shared rewards:', error);
    res.status(500).json({ error: 'Failed to fetch shared rewards' });
  }
});

// POST /api/rewards - Create a new reward
router.post('/', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertRewardSchema.parse(req.body);
    
    // Validate shared_with users are in the same community (if community_id provided)
    if (validatedData.community_id && validatedData.shared_with && Array.isArray(validatedData.shared_with) && validatedData.shared_with.length > 0) {
      const validUsers = await db
        .select({ user_id: community_members.user_id })
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, validatedData.community_id),
            inArray(community_members.user_id, validatedData.shared_with)
          )
        );

      const validUserIds = validUsers.map(u => u.user_id);
      const invalidUsers = (validatedData.shared_with as string[]).filter((uid: string) => !validUserIds.includes(uid));

      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          error: 'Some users are not members of this community',
          invalid_users: invalidUsers
        });
      }
    }

    const now = new Date().toISOString();
    const rewardId = nanoid();

    // Auto-approve rewards that are not shared with others (solo rewards)
    const isSharedReward = validatedData.shared_with && Array.isArray(validatedData.shared_with) && validatedData.shared_with.length > 0;
    const rewardStatus = isSharedReward ? 'pending' : 'approved';

    const [newReward] = await db
      .insert(rewards)
      .values({
        id: rewardId,
        created_by: user_id,
        ...validatedData,
        status: rewardStatus,
        approved_by: isSharedReward ? undefined : user_id, // Self-approve solo rewards
        approved_at: isSharedReward ? undefined : now, // Set approval timestamp for solo rewards
        created_at: now,
        updated_at: now,
      })
      .returning();

    res.status(201).json(newReward);
  } catch (error: any) {
    console.error('Error creating reward:', error);
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid reward data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create reward' });
  }
});

// PUT /api/rewards/:id - Update a reward
router.put('/:id', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;

    // Check if reward exists and user owns it
    const [existingReward] = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, id));

    if (!existingReward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    if (existingReward.created_by !== user_id) {
      return res.status(403).json({ error: 'You can only update your own rewards' });
    }

    // Only allow updating rewards that haven't been completed/expired/rejected
    if (!['pending', 'approved', 'active'].includes(existingReward.status)) {
      return res.status(400).json({ error: 'Cannot update completed, expired, or rejected rewards' });
    }

    const validatedData = insertRewardSchema.parse(req.body);

    // Validate community membership for shared_with users if community_id provided
    if (validatedData.community_id && validatedData.shared_with?.length) {
      const validUsers = await db
        .select({ user_id: community_members.user_id })
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, validatedData.community_id),
            inArray(community_members.user_id, validatedData.shared_with)
          )
        );

      const validUserIds = validUsers.map(u => u.user_id);
      const invalidUsers = (validatedData.shared_with as string[]).filter((uid: string) => !validUserIds.includes(uid));

      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          error: 'Some users are not members of this community',
          invalid_users: invalidUsers
        });
      }
    }

    const now = new Date().toISOString();

    const [updatedReward] = await db
      .update(rewards)
      .set({
        ...validatedData,
        updated_at: now,
      })
      .where(eq(rewards.id, id))
      .returning();

    res.json(updatedReward);
  } catch (error: any) {
    console.error('Error updating reward:', error);
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid reward data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update reward' });
  }
});

// PATCH /api/rewards/:id/approve - Approve a reward
router.patch('/:id/approve', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    const { message } = req.body;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check if user can approve this reward (must be in shared_with and not the creator)
    const sharedWithArray = Array.isArray(reward.shared_with) ? reward.shared_with : [];
    const canApprove = sharedWithArray.includes(user_id) && reward.created_by !== user_id;
    if (!canApprove) {
      return res.status(403).json({ error: 'You cannot approve this reward' });
    }

    // Check if reward is in pending status
    if (reward.status !== 'pending') {
      return res.status(400).json({ error: 'Reward is not pending approval' });
    }

    const now = new Date().toISOString();

    const [updatedReward] = await db
      .update(rewards)
      .set({
        status: 'approved',
        approved_by: user_id,
        approved_at: now,
        updated_at: now,
      })
      .where(eq(rewards.id, id))
      .returning();

    res.json(updatedReward);
  } catch (error) {
    console.error('Error approving reward:', error);
    res.status(500).json({ error: 'Failed to approve reward' });
  }
});

// PATCH /api/rewards/:id/reject - Reject a reward
router.patch('/:id/reject', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check if user can reject this reward (must be in shared_with and not the creator)
    const sharedWithArrayReject = Array.isArray(reward.shared_with) ? reward.shared_with : [];
    const canReject = sharedWithArrayReject.includes(user_id) && reward.created_by !== user_id;
    if (!canReject) {
      return res.status(403).json({ error: 'You cannot reject this reward' });
    }

    // Check if reward is in pending status
    if (reward.status !== 'pending') {
      return res.status(400).json({ error: 'Reward is not pending approval' });
    }

    const now = new Date().toISOString();

    const [updatedReward] = await db
      .update(rewards)
      .set({
        status: 'rejected',
        rejection_reason: reason.trim(),
        updated_at: now,
      })
      .where(eq(rewards.id, id))
      .returning();

    res.json(updatedReward);
  } catch (error) {
    console.error('Error rejecting reward:', error);
    res.status(500).json({ error: 'Failed to reject reward' });
  }
});

// PATCH /api/rewards/:id/complete - Mark reward as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Only the creator can mark their reward as completed
    if (reward.created_by !== user_id) {
      return res.status(403).json({ error: 'Only the reward creator can mark it as completed' });
    }

    // Check if reward is approved
    if (reward.status !== 'approved') {
      return res.status(400).json({ error: 'Reward must be approved before it can be completed' });
    }

    const now = new Date().toISOString();

    const [updatedReward] = await db
      .update(rewards)
      .set({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .where(eq(rewards.id, id))
      .returning();

    res.json(updatedReward);
  } catch (error) {
    console.error('Error completing reward:', error);
    res.status(500).json({ error: 'Failed to complete reward' });
  }
});

// PATCH /api/rewards/:id/deliver - Mark reward as delivered
router.patch('/:id/deliver', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Only someone in shared_with (approver) can mark as delivered
    const sharedWithArrayDeliver = Array.isArray(reward.shared_with) ? reward.shared_with : [];
    const canDeliver = sharedWithArrayDeliver.includes(user_id) && reward.created_by !== user_id;
    if (!canDeliver) {
      return res.status(403).json({ error: 'Only the approver can mark this reward as delivered' });
    }

    // Check if reward is completed
    if (reward.status !== 'completed') {
      return res.status(400).json({ error: 'Reward must be completed before it can be delivered' });
    }

    const now = new Date().toISOString();

    const [updatedReward] = await db
      .update(rewards)
      .set({
        delivered_by: user_id,
        delivered_at: now,
        updated_at: now,
      })
      .where(eq(rewards.id, id))
      .returning();

    res.json(updatedReward);
  } catch (error) {
    console.error('Error delivering reward:', error);
    res.status(500).json({ error: 'Failed to deliver reward' });
  }
});

// GET /api/rewards/motivational-message - Generate AI motivational message
router.get('/motivational-message', async (req, res) => {
  try {
    const { progress, daysLeft, rewardType } = req.query;
    
    if (!openai) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a positive, encouraging coach for teenagers. Generate short, uplifting messages that feel authentic and motivating. Keep it casual and teen-friendly. Focus on consistency, growth, and celebrating progress."
        },
        {
          role: "user",
          content: `Generate a short motivational message (6-8 words max) for a teen who is ${progress}% complete with their ${rewardType} goal and has ${daysLeft} days left. Make it encouraging and authentic.`
        }
      ],
      max_tokens: 30
    });

    const message = response.choices[0].message.content?.trim() || "Keep going, you've got this!";
    
    res.json({ message });
  } catch (error) {
    console.error('Error generating motivational message:', error);
    // Fallback to positive messages if AI fails
    const fallbackMessages = [
      "Every day you show up, you grow stronger!",
      "Progress, not perfection - you're killing it!",
      "Small steps, big wins - keep going!",
      "You're building something amazing!",
      "Trust the process, you've got this!",
      "One day at a time, you're unstoppable!"
    ];
    const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    res.json({ message: randomMessage });
  }
});

// DELETE /api/rewards/:id - Delete a reward
router.delete('/:id', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Only the creator can delete their reward
    if (reward.created_by !== user_id) {
      return res.status(403).json({ error: 'You can only delete your own rewards' });
    }

    // Delete the reward
    await db.delete(rewards).where(eq(rewards.id, id));

    res.json({ message: 'Reward deleted successfully' });
  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({ error: 'Failed to delete reward' });
  }
});

// GET /api/rewards/:id - Get specific reward details
router.get('/:id', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [reward] = await db
      .select({
        id: rewards.id,
        created_by: rewards.created_by,
        creator_name: users.display_name,
        shared_with: rewards.shared_with,
        title: rewards.title,
        description: rewards.description,
        target_metric: rewards.target_metric,
        target_value: rewards.target_value,
        duration_type: rewards.duration_type,
        duration_value: rewards.duration_value,
        start_date: rewards.start_date,
        end_date: rewards.end_date,
        status: rewards.status,
        approved_by: rewards.approved_by,
        approved_at: rewards.approved_at,
        completed_at: rewards.completed_at,
        delivered_by: rewards.delivered_by,
        delivered_at: rewards.delivered_at,
        rejection_reason: rewards.rejection_reason,
        community_id: rewards.community_id,
        created_at: rewards.created_at,
        updated_at: rewards.updated_at,
      })
      .from(rewards)
      .leftJoin(users, eq(users.firebase_uid, rewards.created_by))
      .where(eq(rewards.id, id));

    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check if user has access to this reward
    const sharedWithArrayAccess = Array.isArray(reward.shared_with) ? (reward.shared_with as string[]) : [];
    const hasAccess = reward.created_by === user_id || sharedWithArrayAccess.includes(user_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(reward);
  } catch (error) {
    console.error('Error fetching reward:', error);
    res.status(500).json({ error: 'Failed to fetch reward' });
  }
});

// GET /api/rewards/:id/progress-history - Get progress history for a reward
router.get('/:id/progress-history', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check if user has access to this reward
    const sharedWithArray = Array.isArray(reward.shared_with) ? reward.shared_with : [];
    const hasAccess = reward.created_by === user_id || sharedWithArray.includes(user_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get progress history for this reward
    const progressHistory = await db
      .select()
      .from(reward_progress_history)
      .where(eq(reward_progress_history.reward_id, id))
      .orderBy(desc(reward_progress_history.recorded_at));

    res.json({ progressHistory });
  } catch (error) {
    console.error('Error fetching progress history:', error);
    res.status(500).json({ error: 'Failed to fetch progress history' });
  }
});

// GET /api/rewards/analytics/community - Get community insights for rewards
router.get('/analytics/community', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's communities
    const userCommunities = await db
      .select({ community_id: community_members.community_id })
      .from(community_members)
      .where(eq(community_members.user_id, user_id));

    const communityIds = userCommunities.map(c => c.community_id);

    if (communityIds.length === 0) {
      return res.json({
        totalRewards: 0,
        approvalPatterns: [],
        popularRewardTypes: [],
        completionRates: {}
      });
    }

    // Get approval patterns
    const approvalPatterns = await db
      .select({
        status: rewards.status,
        count: sql`COUNT(*)::int`,
        avg_approval_time: sql`AVG(
          CASE 
            WHEN ${rewards.approved_at} IS NOT NULL AND ${rewards.created_at} IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (${rewards.approved_at}::timestamp - ${rewards.created_at}::timestamp)) / 3600
            ELSE NULL 
          END
        )::float`
      })
      .from(rewards)
      .where(inArray(rewards.community_id, communityIds))
      .groupBy(rewards.status);

    // Get popular reward types
    const popularRewardTypes = await db
      .select({
        target_metric: rewards.target_metric,
        count: sql`COUNT(*)::int`
      })
      .from(rewards)
      .where(inArray(rewards.community_id, communityIds))
      .groupBy(rewards.target_metric)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    // Get completion rates by month
    const completionRates = await db
      .select({
        month: sql`DATE_TRUNC('month', ${rewards.created_at}::timestamp)`,
        total_rewards: sql`COUNT(*)::int`,
        completed_rewards: sql`COUNT(CASE WHEN ${rewards.status} = 'completed' THEN 1 END)::int`
      })
      .from(rewards)
      .where(inArray(rewards.community_id, communityIds))
      .groupBy(sql`DATE_TRUNC('month', ${rewards.created_at}::timestamp)`)
      .orderBy(sql`DATE_TRUNC('month', ${rewards.created_at}::timestamp) DESC`)
      .limit(6);

    res.json({
      totalRewards: approvalPatterns.reduce((sum, p) => sum + p.count, 0),
      approvalPatterns,
      popularRewardTypes,
      completionRates
    });
  } catch (error) {
    console.error('Error fetching community analytics:', error);
    res.status(500).json({ error: 'Failed to fetch community analytics' });
  }
});

// POST /api/rewards/:id/record-progress - Record progress for a reward
router.post('/:id/record-progress', async (req, res) => {
  try {
    const { user_id } = req;
    const { id } = req.params;
    const { progress_percentage, milestone_reached } = req.body;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the reward and check permissions
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Only the creator can record progress
    if (reward.created_by !== user_id) {
      return res.status(403).json({ error: 'Only the reward creator can record progress' });
    }

    // Validate progress percentage
    if (typeof progress_percentage !== 'number' || progress_percentage < 0 || progress_percentage > 100) {
      return res.status(400).json({ error: 'Progress percentage must be between 0 and 100' });
    }

    const now = new Date().toISOString();
    const progressId = nanoid();

    // Insert progress record
    const [progressRecord] = await db
      .insert(reward_progress_history)
      .values({
        id: progressId,
        reward_id: id,
        user_id,
        progress_percentage,
        milestone_reached: milestone_reached || null,
        recorded_at: now,
        created_at: now,
      })
      .returning();

    res.json(progressRecord);
  } catch (error) {
    console.error('Error recording progress:', error);
    res.status(500).json({ error: 'Failed to record progress' });
  }
});

export default router;