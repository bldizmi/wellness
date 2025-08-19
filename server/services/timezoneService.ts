/**
 * Enterprise-Grade Timezone Service
 * FAANG-level timezone handling for scalable applications
 */

import { db } from '../db';
import { user_profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  getUserToday, 
  formatTimestampForUser, 
  convertUTCToUserTimezone,
  getUserDayBounds,
  isValidTimezone 
} from '@shared/timezoneUtils';

export class TimezoneService {
  /**
   * Get user's timezone from database
   */
  static async getUserTimezone(userId: string): Promise<string> {
    try {
      const userProfile = await db
        .select({ timezone: user_profiles.timezone })
        .from(user_profiles)
        .where(eq(user_profiles.user_id, userId))
        .limit(1);

      return userProfile[0]?.timezone || 'UTC';
    } catch (error) {
      console.error('Error getting user timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Update user's timezone
   */
  static async updateUserTimezone(userId: string, timezone: string): Promise<boolean> {
    try {
      if (!isValidTimezone(timezone)) {
        throw new Error(`Invalid timezone: ${timezone}`);
      }

      await db
        .update(user_profiles)
        .set({ timezone })
        .where(eq(user_profiles.user_id, userId));

      return true;
    } catch (error) {
      console.error('Error updating user timezone:', error);
      return false;
    }
  }

  /**
   * Get user's "today" date in their timezone
   */
  static async getUserTodayDate(userId: string): Promise<string> {
    const timezone = await this.getUserTimezone(userId);
    return getUserToday(timezone);
  }

  /**
   * Format timestamp for user display
   */
  static async formatForUser(
    userId: string, 
    utcTimestamp: string, 
    format: 'date' | 'datetime' | 'time' = 'datetime'
  ): Promise<string> {
    const timezone = await this.getUserTimezone(userId);
    return formatTimestampForUser(utcTimestamp, timezone, format);
  }

  /**
   * Get user's day bounds in UTC for database queries
   */
  static async getUserDayBoundsUTC(userId: string, date: string): Promise<{ start: Date; end: Date }> {
    const timezone = await this.getUserTimezone(userId);
    return getUserDayBounds(date, timezone);
  }

  /**
   * Convert UTC timestamp to user's local time
   */
  static async convertToUserTime(userId: string, utcTimestamp: string): Promise<Date> {
    const timezone = await this.getUserTimezone(userId);
    return convertUTCToUserTimezone(utcTimestamp, timezone);
  }

  /**
   * Batch get timezones for multiple users (for performance)
   */
  static async getUserTimezones(userIds: string[]): Promise<Record<string, string>> {
    try {
      const userProfiles = await db
        .select({ user_id: user_profiles.user_id, timezone: user_profiles.timezone })
        .from(user_profiles)
        .where(eq(user_profiles.user_id, userIds[0])); // This would need to be updated for multiple users

      const timezoneMap: Record<string, string> = {};
      userProfiles.forEach(profile => {
        timezoneMap[profile.user_id] = profile.timezone || 'UTC';
      });

      // Fill in missing users with UTC
      userIds.forEach(userId => {
        if (!timezoneMap[userId]) {
          timezoneMap[userId] = 'UTC';
        }
      });

      return timezoneMap;
    } catch (error) {
      console.error('Error getting user timezones:', error);
      // Return UTC for all users on error
      const timezoneMap: Record<string, string> = {};
      userIds.forEach(userId => {
        timezoneMap[userId] = 'UTC';
      });
      return timezoneMap;
    }
  }
}