import { Router } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { metricsService } from '../services/metricsCalculationService';

const router = Router();

// Helper function to get table names based on environment
const getTableName = (baseName: string) => {
  const prefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
  return `${prefix}${baseName}`;
};

// Legacy helper function removed - now using Phase 4 MetricsCalculationService

// GET /api/insights/personal - Personal insights for the logged-in user
router.get('/personal', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Calculate real user-specific metrics using Phase 4 system
    const [trustScore30Days, trustScoreAllTime, streakData] = await Promise.all([
      metricsService.calculateTrustScore30Days(user_id),
      metricsService.calculateTrustScoreAllTime(user_id),
      metricsService.calculateStreaks(user_id)
    ]);
    
    // Get verification attempts with accurate success/failure and time filtering
    const verificationQuery = await db.execute(
      sql`SELECT 
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE ai_verification_result = 'complete') as successful_verifications,
            COUNT(*) FILTER (WHERE created_at::timestamp >= CURRENT_DATE - INTERVAL '7 days') as this_week_attempts,
            COUNT(*) FILTER (WHERE created_at::timestamp >= CURRENT_DATE - INTERVAL '7 days' AND ai_verification_result = 'complete') as this_week_successful
          FROM ${sql.identifier(getTableName('item_verification_attempts'))} 
          WHERE user_id = ${user_id}`
    );
    const verificationRow = (verificationQuery.rows[0] as any);
    const totalVerificationAttempts = verificationRow?.total_attempts || 0;
    const successfulVerifications = verificationRow?.successful_verifications || 0;
    const thisWeekSuccessful = verificationRow?.this_week_successful || 0;
    
    const timeSavedTotal = Math.max(0, totalVerificationAttempts * 3.5); // Phase 4 calculation
    const timeSavedThisWeek = Math.max(0, (verificationRow?.this_week_attempts || 0) * 3.5);
    
    // 2. Get user's items for category analysis (still needed for "What's Working" section)
    const itemsQuery = await db.execute(
      sql`SELECT id, item_type, verify_required, status, completed_at, created_at 
          FROM ${sql.identifier(getTableName('items'))} 
          WHERE user_id = ${user_id} OR created_by = ${user_id}`
    );
    const userItems = itemsQuery.rows as any[];
    
    // 3. Extract streak data from Phase 4 calculations
    const currentStreak = streakData.current;
    
    // For backward compatibility, still calculate week-over-week rates for display
    const thisWeekRate = trustScore30Days;
    const lastWeekRate = Math.max(0, trustScore30Days - 10); // Simplified assumption for now

    // 5. Analyze items by type for top performing categories (Last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get completion data for recurring items from item_completions table
    const recentCompletionsQuery = await db.execute(
      sql`SELECT item_id, completion_date, item_type 
          FROM ${sql.identifier(getTableName('item_completions'))} ic
          JOIN ${sql.identifier(getTableName('items'))} i ON ic.item_id = i.id
          WHERE ic.user_id = ${user_id} AND ic.completion_date >= ${thirtyDaysAgo.toISOString().split('T')[0]}`
    );
    const recentCompletions = recentCompletionsQuery.rows as any[];

    // Analyze items by type with proper recurring/one-time logic
    const itemsByType = userItems.reduce((acc: any, item) => {
      const type = item.item_type === 'task' ? 'Tasks' : 
                   item.item_type === 'habit' ? 'Habits' :
                   item.item_type === 'goal' ? 'Goals' : 'Projects';
      
      if (!acc[type]) acc[type] = { totalItems: 0, completedItems: 0, totalCompletions: 0 };
      
      acc[type].totalItems++;
      
      // For recurring items (habits), count completions from item_completions table
      if (item.item_type === 'habit') {
        const itemCompletions = recentCompletions.filter(comp => comp.item_id === item.id);
        acc[type].totalCompletions += itemCompletions.length;
        if (itemCompletions.length > 0) {
          acc[type].completedItems++;
        }
      } else {
        // For one-time items (tasks, goals, projects), use existing completion logic
        if (item.completed_at || (item.verify_required && item.status === 'complete')) {
          acc[type].completedItems++;
          acc[type].totalCompletions++;
        }
      }
      
      return acc;
    }, {});

    const topPerformingItems = Object.entries(itemsByType).map(([type, data]: [string, any]) => ({
      type,
      completionRate: data.totalItems > 0 ? Math.round((data.completedItems / data.totalItems) * 100) : 0,
      count: data.totalCompletions
    })).sort((a, b) => b.completionRate - a.completionRate);

    // 6. Trust score already calculated above using Phase 4 system

    // 7. Generate AI insights based on real data
    const aiInsights = [];
    if (topPerformingItems.length > 0) {
      const topCategory = topPerformingItems[0];
      aiInsights.push(`Your ${topCategory.type.toLowerCase()} have a ${topCategory.completionRate}% completion rate - ${topCategory.completionRate >= 80 ? 'excellent consistency!' : 'keep building that momentum!'}`);
    }
    if (timeSavedThisWeek > 0) {
      aiInsights.push(`You've saved ${timeSavedThisWeek} minutes this week with DoubleCheck verification.`);
    }
    if (totalVerificationAttempts > 0) {
      aiInsights.push("Your verification photos are helping build trust and accountability!");
    }
    if (aiInsights.length === 0) {
      aiInsights.push("Start creating tasks and habits to see your personalized insights!");
    }

    // 8. Identify areas for growth
    const areasForGrowth = topPerformingItems
      .filter(item => item.completionRate < 70 && item.count > 0)
      .map(item => ({
        type: item.type,
        completionRate: item.completionRate,
        suggestion: `Try breaking down ${item.type.toLowerCase()} into smaller, more manageable steps.`
      }));

    const personalInsights = {
      timeSavedThisWeek,
      timeSavedTotal,
      currentStreaks: [
        {
          itemType: 'daily',
          count: currentStreak,
          title: 'Daily Streak'
        }
      ],
      completionRate: {
        thisWeek: trustScore30Days, // Trust Score for last 30 days (used by frontend)
        lastWeek: trustScore30Days // Simplified - same as 30-day score
      },
      trustScore30Days: trustScore30Days, // Explicit 30-day Trust Score
      topPerformingItems: topPerformingItems.slice(0, 3), // Top 3 categories
      trustScore: trustScoreAllTime,
      doubleCheckStats: {
        itemsVerified: successfulVerifications, // Use actual successful verifications, not attempts
        itemsVerifiedThisWeek: thisWeekSuccessful, // Use real this week data, not approximation
        averagePhotos: totalVerificationAttempts > 0 ? 2.3 : 0,
        timePerVerification: totalVerificationAttempts > 0 ? 3.2 : 0
      },
      aiInsights,
      areasForGrowth
    };

    res.json(personalInsights);
  } catch (error) {
    console.error('Error fetching personal insights:', error);
    res.status(500).json({ error: 'Failed to fetch personal insights' });
  }
});

// GET /api/insights/community/members/:communityId - Get community members for dropdown
router.get('/community/members/:communityId', async (req, res) => {
  try {
    const { user_id } = req;
    const { communityId } = req.params;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use the same logic as the working community members endpoint
    const tablePrefix = getTableName('').replace('_', '') === '' ? '' : 'dev_';
    
    // Fetch all community members with user details (use environment-specific tables)
    const result = await pool.query(`
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
    `, [communityId]);

    // Filter out current user from dropdown since their data is on Personal tab
    const members = result.rows.filter(member => member.user_id !== user_id);

    res.json({ members });
  } catch (error) {
    console.error('Error fetching community members:', error);
    res.status(500).json({ error: 'Failed to fetch community members' });
  }
});

// GET /api/insights/community - Community insights for user's communities
router.get('/community', async (req, res) => {
  try {
    const { user_id } = req;
    const communityId = req.query.communityId as string;
    const memberId = req.query.memberId as string;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For MVP, check if user has communities via simple query
    const communityCheck = await db.execute(
      sql`SELECT COUNT(*) as count FROM ${sql.identifier(getTableName('community_members'))} WHERE user_id = ${user_id}`
    );

    const hasCommunitites = (communityCheck.rows[0] as any)?.count > 0;

    if (!hasCommunitites) {
      return res.json(null); // No community data
    }

    // For MVP, provide different data based on selection
    let communityInsights;

    if (memberId && memberId !== 'all') {
      // Individual member insights - calculate real data for specific member
      
      // Get member details
      const tablePrefix = getTableName('').replace('_', '') === '' ? '' : 'dev_';
      const memberResult = await pool.query(`
        SELECT u.display_name, u.firebase_uid 
        FROM ${tablePrefix}users u 
        WHERE u.firebase_uid = $1
      `, [memberId]);
      
      if (memberResult.rows.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      const memberData = memberResult.rows[0];
      const memberFirebaseUid = memberData.firebase_uid;
      
      // Calculate member's verification attempts using hybrid method (successful verifications only)
      const memberVerificationQuery = await db.execute(
        sql`SELECT 
              COUNT(*) as total_attempts,
              COUNT(*) FILTER (WHERE ai_verification_result = 'complete') as successful_verifications
            FROM ${sql.identifier(getTableName('item_verification_attempts'))} 
            WHERE user_id = ${memberFirebaseUid}`
      );
      const memberVerificationRow = (memberVerificationQuery.rows[0] as any);
      const memberVerificationAttempts = memberVerificationRow?.successful_verifications || 0; // Use successful only
      // Calculate member time saved using Phase 4 approach
      const memberTimeSaved = Math.max(0, memberVerificationAttempts * 3.5); // Phase 4 simplified calculation
      
      // Get member's items for stats
      const memberItemsQuery = await db.execute(
        sql`SELECT * FROM ${sql.identifier(getTableName('items'))} 
            WHERE user_id = ${memberFirebaseUid} OR created_by = ${memberFirebaseUid}`
      );
      const memberItems = memberItemsQuery.rows as any[];
      
      // Calculate Trust Score for consistent metric display
      const memberTrustScore = await metricsService.calculateTrustScoreAllTime(memberFirebaseUid);
      
      // Analyze items by type
      const memberItemsByType = memberItems.reduce((acc: any, item) => {
        const type = item.item_type === 'task' ? 'Tasks' : 
                     item.item_type === 'habit' ? 'Habits' :
                     item.item_type === 'goal' ? 'Goals' : 'Projects';
        if (!acc[type]) acc[type] = { total: 0, completed: 0 };
        acc[type].total++;
        if (item.completed_at || (item.verify_required && item.status === 'complete')) {
          acc[type].completed++;
        }
        return acc;
      }, {});

      const topMemberItem = Object.entries(memberItemsByType)
        .map(([type, data]: [string, any]) => ({
          type,
          count: data.total,
          avgPhotos: memberVerificationAttempts > 0 ? 2.3 : 0
        }))
        .sort((a, b) => b.count - a.count)[0] || { type: 'Tasks', count: 0, avgPhotos: 0 };
      
      communityInsights = {
        selectedMember: memberData.display_name,
        totalTimeSaved: memberTimeSaved,
        memberCount: 1,
        topVerifiers: [
          {
            name: memberData.display_name,
            verificationsCount: memberVerificationAttempts,
            trustScore: memberTrustScore
          }
        ],
        popularItems: [topMemberItem],
        communityStats: {
          totalItems: memberItems.length,
          totalVerifications: memberVerificationAttempts,
          avgCompletionRate: memberTrustScore
        }
      };
    } else {
      // All members view - calculate real community-wide data
      const tablePrefix = getTableName('').replace('_', '') === '' ? '' : 'dev_';
      
      // Get all community members if specific community selected, otherwise all user's communities
      let communityMembersResult;
      
      if (communityId && communityId !== 'all') {
        // Query for specific community
        communityMembersResult = await pool.query(`
          SELECT DISTINCT u.firebase_uid, u.display_name
          FROM ${tablePrefix}community_members cm
          JOIN ${tablePrefix}users u ON cm.user_id = u.firebase_uid
          WHERE cm.removed_at IS NULL
          AND cm.community_id = $1
        `, [communityId]);
      } else {
        // Query for all user's communities
        communityMembersResult = await pool.query(`
          SELECT DISTINCT u.firebase_uid, u.display_name
          FROM ${tablePrefix}community_members cm
          JOIN ${tablePrefix}users u ON cm.user_id = u.firebase_uid
          WHERE cm.removed_at IS NULL
          AND cm.community_id IN (
            SELECT community_id 
            FROM ${tablePrefix}community_members 
            WHERE user_id = $1 AND removed_at IS NULL
          )
        `, [user_id]);
      }
      
      const communityMembers = communityMembersResult.rows;
      const memberFirebaseUids = communityMembers.map(m => m.firebase_uid);
      
      if (memberFirebaseUids.length === 0) {
        return res.json({
          totalTimeSaved: 0,
          memberCount: 0,
          topVerifiers: [],
          popularItems: [],
          communityStats: { totalItems: 0, totalVerifications: 0, avgCompletionRate: 0 }
        });
      }
      
      // Get verification attempts and items data in optimized queries with hybrid method
      const [verificationResult, itemsResult] = await Promise.all([
        pool.query(`
          SELECT 
            user_id, 
            COUNT(*) as attempts,
            COUNT(*) FILTER (WHERE ai_verification_result = 'complete') as successful_verifications
          FROM ${tablePrefix}item_verification_attempts 
          WHERE user_id = ANY($1)
          GROUP BY user_id
        `, [memberFirebaseUids]),
        
        pool.query(`
          SELECT user_id, created_by, item_type, completed_at, status, verify_required
          FROM ${tablePrefix}items 
          WHERE user_id = ANY($1) OR created_by = ANY($1)
        `, [memberFirebaseUids])
      ]);
      
      const verificationsByUser = verificationResult.rows;
      const communityItems = itemsResult.rows;
      
      const totalCommunityVerifications = verificationsByUser.reduce((sum, row) => sum + (parseInt(row.successful_verifications) || 0), 0);
      const totalCommunityTimeSaved = Math.max(0, totalCommunityVerifications * 3.5); // Phase 4 simplified calculation
      
      // Calculate community Trust Score average for consistent metric display
      const communityTrustScores = await Promise.all(
        memberFirebaseUids.map(uid => metricsService.calculateTrustScoreAllTime(uid))
      );
      const communityTrustScore = communityTrustScores.length > 0 ? 
        Math.round(communityTrustScores.reduce((sum, score) => sum + score, 0) / communityTrustScores.length) : 0;
      
      // Build top verifiers list using new Trust Score architecture
      const topVerifiers = await Promise.all(
        verificationsByUser
          .map(async row => {
            const member = communityMembers.find(m => m.firebase_uid === row.user_id);
            const trustScore = await metricsService.calculateTrustScoreAllTime(row.user_id);
            
            return {
              name: member?.display_name || 'Unknown User',
              verificationsCount: parseInt(row.successful_verifications) || 0, // Use successful verifications
              trustScore: trustScore
            };
          })
      );
      
      const sortedTopVerifiers = topVerifiers
        .sort((a, b) => b.verificationsCount - a.verificationsCount)
        .slice(0, 3);
      
      // Calculate popular item types using SQL aggregation
      const itemTypesResult = await pool.query(`
        SELECT 
          CASE 
            WHEN item_type = 'task' THEN 'Tasks'
            WHEN item_type = 'habit' THEN 'Habits'
            WHEN item_type = 'goal' THEN 'Goals'
            ELSE 'Projects'
          END as type,
          COUNT(*) as total
        FROM ${tablePrefix}items 
        WHERE user_id = ANY($1) OR created_by = ANY($1)
        GROUP BY item_type
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `, [memberFirebaseUids]);
      
      const popularItems = itemTypesResult.rows.map(row => ({
        type: row.type,
        count: parseInt(row.total),
        avgPhotos: totalCommunityVerifications > 0 ? 2.3 : 0
      }));
      
      communityInsights = {
        totalTimeSaved: totalCommunityTimeSaved,
        memberCount: communityMembers.length,
        topVerifiers: sortedTopVerifiers,
        popularItems,
        communityStats: {
          totalItems: communityItems.length,
          totalVerifications: totalCommunityVerifications,
          avgCompletionRate: communityTrustScore
        }
      };
    }

    res.json(communityInsights);
  } catch (error) {
    console.error('Error fetching community insights:', error);
    res.status(500).json({ error: 'Failed to fetch community insights' });
  }
});

export default router;