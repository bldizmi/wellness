import { Router } from 'express';
import { db } from '../db';
import { recurring_templates, recurring_instances, community_members } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  getInstanceVerificationAttempts, 
  createInstanceVerificationAttempt,
  getInstanceVerificationSummaries,
  getSharedInstancesForVerification 
} from '../services/phase5VerificationService';

const router = Router();

/**
 * Phase 5.1: Share Template - "Share this daily habit with community"
 * Shares the entire recurring template for future instances
 */
router.post('/template/:templateId/share', async (req, res) => {
  try {
    const { user_id } = req;
    const { templateId } = req.params;
    const { shared_with, community_id } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate shared_with is an array of strings
    if (!Array.isArray(shared_with) || !shared_with.every(id => typeof id === 'string')) {
      return res.status(400).json({ error: 'shared_with must be an array of user IDs' });
    }

    // Get the template to check permissions
    const [template] = await db.select().from(recurring_templates).where(eq(recurring_templates.id, templateId));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user can share this template (created_by or assigned_to)
    const canShare = template.created_by === user_id || template.assigned_to === user_id;
    if (!canShare) {
      return res.status(403).json({ error: 'Only the creator or assigned user can share this template' });
    }

    // If template has community_id, validate all shared_with users are in that community
    if (community_id && shared_with.length > 0) {
      const validUsers = await db
        .select({ user_id: community_members.user_id })
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, community_id),
            inArray(community_members.user_id, shared_with)
          )
        );

      const validUserIds = validUsers.map(u => u.user_id);
      const invalidUsers = shared_with.filter(userId => !validUserIds.includes(userId));

      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          error: 'Some users are not members of the specified community',
          invalid_users: invalidUsers 
        });
      }
    }

    // Update template with new sharing
    await db
      .update(recurring_templates)
      .set({ 
        shared_with: shared_with,
        community_id: community_id || template.community_id,
        updated_at: new Date().toISOString()
      })
      .where(eq(recurring_templates.id, templateId));

    res.json({ 
      success: true, 
      message: 'Template shared successfully',
      type: 'template_share',
      template_id: templateId,
      shared_with: shared_with 
    });

  } catch (error) {
    console.error('Error sharing template:', error);
    res.status(500).json({ error: 'Failed to share template' });
  }
});

/**
 * Phase 5.2: Share Instance - "Share today's completion with community"  
 * Shares a specific occurrence without affecting the template
 */
router.post('/instance/:instanceId/share', async (req, res) => {
  try {
    const { user_id } = req;
    const { instanceId } = req.params;
    const { shared_with, community_id } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate shared_with is an array of strings
    if (!Array.isArray(shared_with) || !shared_with.every(id => typeof id === 'string')) {
      return res.status(400).json({ error: 'shared_with must be an array of user IDs' });
    }

    // Get the instance to check permissions
    const [instance] = await db.select().from(recurring_instances).where(eq(recurring_instances.id, instanceId));
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Check if user can share this instance (assigned_to or completed_by)
    const canShare = instance.assigned_to === user_id || instance.completed_by === user_id;
    if (!canShare) {
      return res.status(403).json({ error: 'Only the assigned user or completer can share this instance' });
    }

    // If community_id provided, validate all shared_with users are in that community
    if (community_id && shared_with.length > 0) {
      const validUsers = await db
        .select({ user_id: community_members.user_id })
        .from(community_members)
        .where(
          and(
            eq(community_members.community_id, community_id),
            inArray(community_members.user_id, shared_with)
          )
        );

      const validUserIds = validUsers.map(u => u.user_id);
      const invalidUsers = shared_with.filter(userId => !validUserIds.includes(userId));

      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          error: 'Some users are not members of the specified community',
          invalid_users: invalidUsers 
        });
      }
    }

    // Update instance with sharing information
    await db
      .update(recurring_instances)
      .set({ 
        shared_with: shared_with,
        updated_at: new Date().toISOString()
      })
      .where(eq(recurring_instances.id, instanceId));

    res.json({ 
      success: true, 
      message: 'Instance shared successfully',
      type: 'instance_share',
      instance_id: instanceId,
      template_id: instance.template_id,
      occurrence_date: instance.occurrence_date,
      shared_with: shared_with 
    });

  } catch (error) {
    console.error('Error sharing instance:', error);
    res.status(500).json({ error: 'Failed to share instance' });
  }
});

/**
 * Phase 5.3: Assign Template - Clear assignment for future instances
 * Assigns the template to a user for all future occurrences
 */
router.post('/template/:templateId/assign', async (req, res) => {
  try {
    const { user_id } = req;
    const { templateId } = req.params;
    const { assigned_to } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!assigned_to || typeof assigned_to !== 'string') {
      return res.status(400).json({ error: 'assigned_to must be a valid user ID' });
    }

    // Get the template to check permissions
    const [template] = await db.select().from(recurring_templates).where(eq(recurring_templates.id, templateId));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user can assign this template (created_by only)
    if (template.created_by !== user_id) {
      return res.status(403).json({ error: 'Only the creator can assign this template' });
    }

    // Update template assignment
    await db
      .update(recurring_templates)
      .set({ 
        assigned_to: assigned_to,
        updated_at: new Date().toISOString()
      })
      .where(eq(recurring_templates.id, templateId));

    res.json({ 
      success: true, 
      message: 'Template assigned successfully',
      type: 'template_assignment',
      template_id: templateId,
      assigned_to: assigned_to 
    });

  } catch (error) {
    console.error('Error assigning template:', error);
    res.status(500).json({ error: 'Failed to assign template' });
  }
});

/**
 * Phase 5.4: Assign Instance - Clear occurrence assignment  
 * Assigns a specific occurrence to a user
 */
router.post('/instance/:instanceId/assign', async (req, res) => {
  try {
    const { user_id } = req;
    const { instanceId } = req.params;
    const { assigned_to } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!assigned_to || typeof assigned_to !== 'string') {
      return res.status(400).json({ error: 'assigned_to must be a valid user ID' });
    }

    // Get the instance and template to check permissions
    const [instance] = await db
      .select({
        instance: recurring_instances,
        template: recurring_templates
      })
      .from(recurring_instances)
      .leftJoin(recurring_templates, eq(recurring_instances.template_id, recurring_templates.id))
      .where(eq(recurring_instances.id, instanceId));

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Check if user can assign this instance (template creator or current assignee)
    const canAssign = instance.template.created_by === user_id || instance.instance.assigned_to === user_id;
    if (!canAssign) {
      return res.status(403).json({ error: 'Only the template creator or current assignee can reassign this instance' });
    }

    // Update instance assignment
    await db
      .update(recurring_instances)
      .set({ 
        assigned_to: assigned_to,
        updated_at: new Date().toISOString()
      })
      .where(eq(recurring_instances.id, instanceId));

    res.json({ 
      success: true, 
      message: 'Instance assigned successfully',
      type: 'instance_assignment',
      instance_id: instanceId,
      template_id: instance.instance.template_id,
      occurrence_date: instance.instance.occurrence_date,
      assigned_to: assigned_to 
    });

  } catch (error) {
    console.error('Error assigning instance:', error);
    res.status(500).json({ error: 'Failed to assign instance' });
  }
});

/**
 * Phase 5.5: Get verification attempts for specific instance
 * Shows only attempts for this occurrence, not the entire series
 */
router.get('/instance/:instanceId/verification-attempts', async (req, res) => {
  try {
    const { user_id } = req;
    const { instanceId } = req.params;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const attempts = await getInstanceVerificationAttempts(instanceId, user_id);
    
    res.json({ 
      success: true,
      instance_id: instanceId,
      attempts: attempts,
      total_attempts: attempts.length
    });

  } catch (error) {
    console.error('Error getting instance verification attempts:', error);
    if (error.message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to get verification attempts' });
  }
});

/**
 * Phase 5.6: Create verification attempt for specific instance
 * Independent verification per occurrence
 */
router.post('/instance/:instanceId/verify', async (req, res) => {
  try {
    const { user_id } = req;
    const { instanceId } = req.params;
    const { verification_image_url, ai_verification_result, ai_feedback } = req.body;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const attempt = await createInstanceVerificationAttempt(instanceId, user_id, {
      verification_image_url,
      ai_verification_result,
      ai_feedback
    });
    
    res.json({ 
      success: true,
      message: 'Verification attempt created successfully',
      attempt: attempt
    });

  } catch (error) {
    console.error('Error creating instance verification attempt:', error);
    if (error.message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to create verification attempt' });
  }
});

/**
 * Phase 5.7: Get shared instances for verification
 * Shows instances shared with the user that may need verification
 */
router.get('/shared-instances/verification', async (req, res) => {
  try {
    const { user_id } = req;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sharedInstances = await getSharedInstancesForVerification(user_id);
    
    res.json({ 
      success: true,
      shared_instances: sharedInstances,
      total_count: sharedInstances.length
    });

  } catch (error) {
    console.error('Error getting shared instances for verification:', error);
    res.status(500).json({ error: 'Failed to get shared instances' });
  }
});

export default router;