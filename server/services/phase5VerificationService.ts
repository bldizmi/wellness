import { db } from '../db';
import { recurring_instances, recurring_templates, item_verification_attempts } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Phase 5.3: Community Verification Service
 * Each occurrence can be independently verified
 * Community members see specific attempts, not entire series
 * Clear verification history per occurrence
 */

export interface VerificationAttempt {
  id: string;
  instance_id: string;
  template_id: string;
  occurrence_date: string;
  user_id: string;
  verification_image_url?: string;
  ai_verification_result?: 'complete' | 'not_complete' | 'unclear';
  ai_feedback?: string;
  created_at: string;
}

export interface InstanceVerificationSummary {
  instance_id: string;
  template_id: string;
  occurrence_date: string;
  total_attempts: number;
  latest_attempt: VerificationAttempt | null;
  verification_status: 'verified' | 'pending' | 'failed';
  verified_by?: string;
  verified_at?: string;
}

/**
 * Get verification attempts for a specific instance
 * Shows only attempts for this occurrence, not the entire series
 */
export async function getInstanceVerificationAttempts(instanceId: string, userId?: string): Promise<VerificationAttempt[]> {
  try {
    const tablePrefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
    
    // Get the instance to validate access
    const [instance] = await db
      .select()
      .from(recurring_instances)
      .where(eq(recurring_instances.id, instanceId));
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Check if user has access to view this instance
    if (userId) {
      const hasAccess = instance.assigned_to === userId || 
                       instance.completed_by === userId ||
                       (instance.shared_with && instance.shared_with.includes(userId));
      
      if (!hasAccess) {
        // Check template-level access
        const [template] = await db
          .select()
          .from(recurring_templates)
          .where(eq(recurring_templates.id, instance.template_id));
        
        const templateAccess = template?.created_by === userId ||
                              template?.assigned_to === userId ||
                              (template?.shared_with && template.shared_with.includes(userId));
        
        if (!templateAccess) {
          throw new Error('Access denied');
        }
      }
    }

    // Get verification attempts for this specific instance
    const attempts = await db.execute(sql`
      SELECT 
        va.id,
        va.user_id,
        va.verification_image_url,
        va.ai_verification_result,
        va.ai_feedback,
        va.created_at,
        ${instanceId} as instance_id,
        ${instance.template_id} as template_id,
        ${instance.occurrence_date} as occurrence_date
      FROM ${sql.identifier(tablePrefix + 'item_verification_attempts')} va
      WHERE va.item_id = ${instanceId}
      ORDER BY va.created_at DESC
    `);

    return attempts.rows.map((row: any) => ({
      id: row.id,
      instance_id: row.instance_id,
      template_id: row.template_id,
      occurrence_date: row.occurrence_date,
      user_id: row.user_id,
      verification_image_url: row.verification_image_url,
      ai_verification_result: row.ai_verification_result,
      ai_feedback: row.ai_feedback,
      created_at: row.created_at,
    }));

  } catch (error) {
    console.error('Error getting instance verification attempts:', error);
    throw error;
  }
}

/**
 * Create a verification attempt for a specific instance
 * Independent from template-level verification
 */
export async function createInstanceVerificationAttempt(
  instanceId: string,
  userId: string,
  verificationData: {
    verification_image_url?: string;
    ai_verification_result?: 'complete' | 'not_complete' | 'unclear';
    ai_feedback?: string;
  }
): Promise<VerificationAttempt> {
  try {
    const tablePrefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
    
    // Get the instance to validate access and get template info
    const [instance] = await db
      .select()
      .from(recurring_instances)
      .where(eq(recurring_instances.id, instanceId));
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Check if user has access to verify this instance
    const hasAccess = instance.assigned_to === userId || 
                     instance.completed_by === userId ||
                     (instance.shared_with && instance.shared_with.includes(userId));
    
    if (!hasAccess) {
      // Check template-level access
      const [template] = await db
        .select()
        .from(recurring_templates)
        .where(eq(recurring_templates.id, instance.template_id));
      
      const templateAccess = template?.created_by === userId ||
                            template?.assigned_to === userId ||
                            (template?.shared_with && template.shared_with.includes(userId));
      
      if (!templateAccess) {
        throw new Error('Access denied');
      }
    }

    // Create verification attempt
    const attemptId = nanoid();
    const now = new Date().toISOString();

    await db.execute(sql`
      INSERT INTO ${sql.identifier(tablePrefix + 'item_verification_attempts')} 
      (id, item_id, user_id, verification_image_url, ai_verification_result, ai_feedback, created_at)
      VALUES (
        ${attemptId},
        ${instanceId},
        ${userId},
        ${verificationData.verification_image_url || null},
        ${verificationData.ai_verification_result || null},
        ${verificationData.ai_feedback || null},
        ${now}
      )
    `);

    // If verification is successful, update the instance
    if (verificationData.ai_verification_result === 'complete') {
      await db
        .update(recurring_instances)
        .set({
          status: 'completed',
          verified: true,
          verified_by: userId,
          verified_at: now,
          completed_at: now,
          completed_by: userId,
          ai_verification_result: verificationData.ai_verification_result,
          ai_feedback: verificationData.ai_feedback,
          verification_image_url: verificationData.verification_image_url,
          updated_at: now
        })
        .where(eq(recurring_instances.id, instanceId));
    }

    return {
      id: attemptId,
      instance_id: instanceId,
      template_id: instance.template_id,
      occurrence_date: instance.occurrence_date,
      user_id: userId,
      verification_image_url: verificationData.verification_image_url,
      ai_verification_result: verificationData.ai_verification_result,
      ai_feedback: verificationData.ai_feedback,
      created_at: now,
    };

  } catch (error) {
    console.error('Error creating instance verification attempt:', error);
    throw error;
  }
}

/**
 * Get verification summary for multiple instances
 * Useful for showing verification status in lists
 */
export async function getInstanceVerificationSummaries(instanceIds: string[]): Promise<InstanceVerificationSummary[]> {
  try {
    const tablePrefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
    
    if (instanceIds.length === 0) {
      return [];
    }

    // Get instances with their verification status
    const summaries = await db.execute(sql`
      SELECT 
        ri.id as instance_id,
        ri.template_id,
        ri.occurrence_date,
        ri.verified,
        ri.verified_by,
        ri.verified_at,
        ri.status,
        COUNT(va.id) as total_attempts,
        MAX(va.created_at) as latest_attempt_date
      FROM ${sql.identifier(tablePrefix + 'recurring_instances')} ri
      LEFT JOIN ${sql.identifier(tablePrefix + 'item_verification_attempts')} va ON ri.id = va.item_id
      WHERE ri.id = ANY(${sql.array(instanceIds)})
      GROUP BY ri.id, ri.template_id, ri.occurrence_date, ri.verified, ri.verified_by, ri.verified_at, ri.status
    `);

    const results: InstanceVerificationSummary[] = [];

    for (const row of summaries.rows) {
      const summary: InstanceVerificationSummary = {
        instance_id: row.instance_id,
        template_id: row.template_id,
        occurrence_date: row.occurrence_date,
        total_attempts: parseInt(row.total_attempts) || 0,
        latest_attempt: null,
        verification_status: row.verified ? 'verified' : (row.total_attempts > 0 ? 'pending' : 'pending'),
        verified_by: row.verified_by,
        verified_at: row.verified_at,
      };

      // Get latest attempt details if there are any
      if (summary.total_attempts > 0) {
        const latestAttempts = await getInstanceVerificationAttempts(row.instance_id);
        if (latestAttempts.length > 0) {
          summary.latest_attempt = latestAttempts[0];
        }
      }

      results.push(summary);
    }

    return results;

  } catch (error) {
    console.error('Error getting instance verification summaries:', error);
    throw error;
  }
}

/**
 * Get shared instances that require verification from a user
 * Shows instances shared with the user that need verification
 */
export async function getSharedInstancesForVerification(userId: string): Promise<{
  instance_id: string;
  template_id: string;
  template_title: string;
  occurrence_date: string;
  assigned_to: string;
  status: string;
  verification_status: 'verified' | 'pending' | 'failed';
  total_attempts: number;
}[]> {
  try {
    const tablePrefix = process.env.NODE_ENV === 'production' ? '' : 'dev_';
    
    // Get instances shared with this user that may need verification
    const sharedInstances = await db.execute(sql`
      SELECT 
        ri.id as instance_id,
        ri.template_id,
        ri.occurrence_date,
        ri.assigned_to,
        ri.status,
        ri.verified,
        rt.title as template_title,
        COUNT(va.id) as total_attempts
      FROM ${sql.identifier(tablePrefix + 'recurring_instances')} ri
      JOIN ${sql.identifier(tablePrefix + 'recurring_templates')} rt ON ri.template_id = rt.id
      LEFT JOIN ${sql.identifier(tablePrefix + 'item_verification_attempts')} va ON ri.id = va.item_id
      WHERE (
        (ri.shared_with IS NOT NULL AND ri.shared_with ? ${userId})
        OR (rt.shared_with IS NOT NULL AND rt.shared_with ? ${userId})
      )
      AND ri.status IN ('completed', 'pending')
      GROUP BY ri.id, ri.template_id, ri.occurrence_date, ri.assigned_to, ri.status, ri.verified, rt.title
      ORDER BY ri.occurrence_date DESC
      LIMIT 50
    `);

    return sharedInstances.rows.map((row: any) => ({
      instance_id: row.instance_id,
      template_id: row.template_id,
      template_title: row.template_title,
      occurrence_date: row.occurrence_date,
      assigned_to: row.assigned_to,
      status: row.status,
      verification_status: row.verified ? 'verified' : (row.total_attempts > 0 ? 'pending' : 'pending'),
      total_attempts: parseInt(row.total_attempts) || 0,
    }));

  } catch (error) {
    console.error('Error getting shared instances for verification:', error);
    throw error;
  }
}