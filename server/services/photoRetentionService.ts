import { db } from '../db';
import { item_verification_attempts } from '@shared/schema';
import { and, lt, eq } from 'drizzle-orm';

/**
 * Photo Retention Service - Hybrid Approach Implementation
 * Automatically deletes photos after 14 days while allowing manual deletion
 */

export class PhotoRetentionService {
  
  /**
   * Automatically delete photos that have exceeded their 14-day retention period
   */
  static async cleanupExpiredPhotos(): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      // Find verification attempts where auto_delete_at has passed and photo is not already deleted
      const expiredAttempts = await db
        .select({ id: item_verification_attempts.id })
        .from(item_verification_attempts)
        .where(
          and(
            lt(item_verification_attempts.auto_delete_at, now),
            eq(item_verification_attempts.photo_deleted, false)
          )
        );

      if (expiredAttempts.length === 0) {
        console.log('📸 PHOTO CLEANUP: No expired photos found');
        return 0;
      }

      // Update expired attempts to mark photos as deleted
      const deletedCount = await db
        .update(item_verification_attempts)
        .set({
          image_url: '[DELETED_AFTER_14_DAYS]', // Replace with deletion marker
          photo_deleted: true
        })
        .where(
          and(
            lt(item_verification_attempts.auto_delete_at, now),
            eq(item_verification_attempts.photo_deleted, false)
          )
        );

      console.log(`📸 PHOTO CLEANUP: Automatically deleted ${expiredAttempts.length} expired photos`);
      return expiredAttempts.length;
    } catch (error) {
      console.error('❌ PHOTO CLEANUP ERROR:', error);
      return 0;
    }
  }

  /**
   * Manually delete a specific photo (user-initiated)
   */
  static async deletePhotoManually(attemptId: string, userId: string): Promise<boolean> {
    try {
      // Verify user has permission to delete this photo
      const [attempt] = await db
        .select()
        .from(item_verification_attempts)
        .where(eq(item_verification_attempts.id, attemptId))
        .limit(1);

      if (!attempt) {
        console.log(`❌ MANUAL DELETE: Verification attempt ${attemptId} not found`);
        return false;
      }

      if (attempt.user_id !== userId) {
        console.log(`❌ MANUAL DELETE: User ${userId} does not own verification attempt ${attemptId}`);
        return false;
      }

      if (attempt.photo_deleted) {
        console.log(`⚠️ MANUAL DELETE: Photo ${attemptId} already deleted`);
        return true; // Already deleted, return success
      }

      // Delete the photo
      await db
        .update(item_verification_attempts)
        .set({
          image_url: '[DELETED_BY_USER]',
          photo_deleted: true
        })
        .where(eq(item_verification_attempts.id, attemptId));

      console.log(`📸 MANUAL DELETE: User ${userId} deleted photo ${attemptId}`);
      return true;
    } catch (error) {
      console.error(`❌ MANUAL DELETE ERROR for attempt ${attemptId}:`, error);
      return false;
    }
  }

  /**
   * Get photo retention info for verification attempts
   */
  static async getPhotoRetentionInfo(itemId: string): Promise<Array<{
    id: string;
    photo_uploaded_at: string;
    auto_delete_at: string;
    photo_deleted: boolean;
    days_remaining: number;
  }>> {
    try {
      const attempts = await db
        .select({
          id: item_verification_attempts.id,
          photo_uploaded_at: item_verification_attempts.photo_uploaded_at,
          auto_delete_at: item_verification_attempts.auto_delete_at,
          photo_deleted: item_verification_attempts.photo_deleted
        })
        .from(item_verification_attempts)
        .where(eq(item_verification_attempts.item_id, itemId));

      const now = new Date();
      
      return attempts.map(attempt => {
        const deleteDate = new Date(attempt.auto_delete_at);
        const daysRemaining = Math.max(0, Math.ceil((deleteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        
        return {
          ...attempt,
          days_remaining: daysRemaining
        };
      });
    } catch (error) {
      console.error(`❌ RETENTION INFO ERROR for item ${itemId}:`, error);
      return [];
    }
  }

  /**
   * Start the automatic cleanup process (runs every 6 hours)
   */
  static startAutomaticCleanup(): void {
    // Run cleanup immediately on startup
    this.cleanupExpiredPhotos();
    
    // Schedule cleanup every 6 hours
    setInterval(() => {
      this.cleanupExpiredPhotos();
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

    console.log('📸 PHOTO RETENTION: Automatic cleanup service started (runs every 6 hours)');
  }
}