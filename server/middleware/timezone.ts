/**
 * Enterprise-Grade Timezone Middleware
 * Adds user timezone context to all requests
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { user_profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getUserToday } from '@shared/timezoneUtils';

declare global {
  namespace Express {
    interface Request {
      userTimezone?: string;
      userToday?: string;
    }
  }
}

/**
 * Middleware to add user timezone context to authenticated requests
 */
export async function timezoneMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to authenticated requests
  if (!req.user_id) {
    return next();
  }

  try {
    // Get user's timezone from profile
    const userProfile = await db
      .select({ timezone: user_profiles.timezone })
      .from(user_profiles)
      .where(eq(user_profiles.user_id, req.user_id))
      .limit(1);

    if (userProfile.length > 0 && userProfile[0].timezone) {
      req.userTimezone = userProfile[0].timezone;
      req.userToday = getUserToday(userProfile[0].timezone);
    } else {
      // Default to UTC if no timezone set
      req.userTimezone = 'UTC';
      req.userToday = getUserToday('UTC');
    }

    next();
  } catch (error) {
    console.error('Timezone middleware error:', error);
    // Continue without timezone context on error
    req.userTimezone = 'UTC';
    req.userToday = getUserToday('UTC');
    next();
  }
}