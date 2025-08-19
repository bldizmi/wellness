import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { community_members } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Extend Express Request type to include community role info
declare global {
  namespace Express {
    interface Request {
      communityMembership?: {
        role: string;
        community_id: string;
        user_id: string;
      };
    }
  }
}

/**
 * Middleware to check if user has required role(s) in a community
 * @param allowedRoles - Array of roles that are allowed (e.g., ['owner', 'admin'])
 * @returns Express middleware function
 */
export const checkCommunityRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user_id;
      const communityId = req.params.id || req.params.communityId;

      if (!user_id) {
        console.log('[RBAC] No user_id found in request - auth middleware may not have run');
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!communityId) {
        console.log('[RBAC] No community ID found in request params:', req.params);
        return res.status(400).json({ error: 'Invalid request data', details: 'Community ID required' });
      }

      // Look up user's membership in the community
      const [membership] = await db
        .select()
        .from(community_members)
        .where(and(
          eq(community_members.community_id, communityId),
          eq(community_members.user_id, user_id)
        ));

      if (!membership) {
        console.log(`[RBAC] ${user_id} denied access to ${communityId} - not a member`);
        return res.status(403).json({ 
          error: 'You do not have permission to perform this action in this community.' 
        });
      }

      if (!allowedRoles.includes(membership.role)) {
        console.log(`[RBAC] ${user_id} denied access to ${communityId} - role: ${membership.role}, required: ${allowedRoles.join(' or ')}`);
        return res.status(403).json({ 
          error: 'You do not have permission to perform this action in this community.' 
        });
      }

      // Store membership info in request for use in route handlers
      req.communityMembership = {
        role: membership.role,
        community_id: communityId,
        user_id: user_id
      };

      console.log(`[RBAC] ${user_id} granted access to ${communityId} - role: ${membership.role}`);
      next();
    } catch (error) {
      console.error('[RBAC] Error checking community role:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};