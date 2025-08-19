import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { storage } from '../storage.js';

const router = Router();

// Feature flag for new recurring system
const useNewRecurringSystem = process.env.FEATURE_NEW_RECURRING === 'true';

// Validation schemas
const completeInstanceSchema = z.object({
  completion_date: z.string().optional(),
  notes: z.string().optional(),
  verification_data: z.object({
    photo_url: z.string().optional(),
    ai_verification_result: z.string().optional(),
    verified_by: z.string().optional(),
    verified_at: z.string().optional(),
  }).optional(),
});

const instanceParamsSchema = z.object({
  templateId: z.string(),
  instanceId: z.string(),
});

/**
 * POST /api/recurring/:templateId/instances/:instanceId/complete
 * Complete a specific instance of a recurring item
 */
router.post('/:templateId/instances/:instanceId/complete', authMiddleware, async (req, res) => {
  try {
    const { templateId, instanceId } = instanceParamsSchema.parse(req.params);
    const completionData = completeInstanceSchema.parse(req.body);
    const userId = req.user_id;

    if (!useNewRecurringSystem) {
      return res.status(501).json({ 
        error: 'New recurring system not enabled',
        feature_flag: 'FEATURE_NEW_RECURRING' 
      });
    }

    // Verify template exists and user has access
    const template = await storage.getRecurringTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check user permissions (creator, assigned_to, or shared_with)
    const hasAccess = template.created_by === userId || 
                     template.assigned_to === userId ||
                     (template.shared_with && template.shared_with.includes(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create instance completion record
    const completionRecord = {
      id: `${templateId}_${instanceId}_completion`,
      template_id: templateId,
      instance_id: instanceId,
      user_id: userId,
      completion_date: completionData.completion_date || new Date().toISOString().split('T')[0],
      completed_at: new Date().toISOString(),
      notes: completionData.notes,
      verification_data: completionData.verification_data,
      status: 'completed',
    };

    await storage.createInstanceCompletion(completionRecord);

    // Log completion for audit trail
    console.log(`✅ NEW RECURRING: Instance ${instanceId} of template ${templateId} completed by user ${userId}`);

    res.json({ 
      success: true, 
      completion: completionRecord,
      message: 'Instance completed successfully' 
    });

  } catch (error) {
    console.error('❌ NEW RECURRING: Error completing instance:', error);
    res.status(500).json({ error: 'Failed to complete instance' });
  }
});

/**
 * DELETE /api/recurring/:templateId/instances/:instanceId/complete
 * Remove completion from a specific instance
 */
router.delete('/:templateId/instances/:instanceId/complete', authMiddleware, async (req, res) => {
  try {
    const { templateId, instanceId } = instanceParamsSchema.parse(req.params);
    const userId = req.user_id;

    if (!useNewRecurringSystem) {
      return res.status(501).json({ 
        error: 'New recurring system not enabled',
        feature_flag: 'FEATURE_NEW_RECURRING' 
      });
    }

    // Verify template exists and user has access
    const template = await storage.getRecurringTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check user permissions
    const hasAccess = template.created_by === userId || 
                     template.assigned_to === userId ||
                     (template.shared_with && template.shared_with.includes(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove completion record
    const completionId = `${templateId}_${instanceId}_completion`;
    await storage.deleteInstanceCompletion(completionId);

    // Log removal for audit trail
    console.log(`🔄 NEW RECURRING: Instance ${instanceId} completion removed from template ${templateId} by user ${userId}`);

    res.json({ 
      success: true, 
      message: 'Instance completion removed successfully' 
    });

  } catch (error) {
    console.error('❌ NEW RECURRING: Error removing instance completion:', error);
    res.status(500).json({ error: 'Failed to remove instance completion' });
  }
});

/**
 * GET /api/recurring/:templateId/instances/:instanceId/history
 * Get completion history for a specific instance
 */
router.get('/:templateId/instances/:instanceId/history', authMiddleware, async (req, res) => {
  try {
    const { templateId, instanceId } = instanceParamsSchema.parse(req.params);
    const userId = req.user_id;

    if (!useNewRecurringSystem) {
      return res.status(501).json({ 
        error: 'New recurring system not enabled',
        feature_flag: 'FEATURE_NEW_RECURRING' 
      });
    }

    // Verify template exists and user has access
    const template = await storage.getRecurringTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check user permissions
    const hasAccess = template.created_by === userId || 
                     template.assigned_to === userId ||
                     (template.shared_with && template.shared_with.includes(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get completion history for this instance
    const history = await storage.getInstanceCompletionHistory(templateId, instanceId);

    res.json({ 
      success: true, 
      template_id: templateId,
      instance_id: instanceId,
      history: history || [],
      total_completions: history?.length || 0
    });

  } catch (error) {
    console.error('❌ NEW RECURRING: Error getting instance history:', error);
    res.status(500).json({ error: 'Failed to get instance history' });
  }
});

/**
 * GET /api/recurring/:templateId/instances
 * Get all instances for a recurring template with completion status
 */
router.get('/:templateId/instances', authMiddleware, async (req, res) => {
  try {
    const { templateId } = z.object({ templateId: z.string() }).parse(req.params);
    const userId = req.user_id;

    if (!useNewRecurringSystem) {
      return res.status(501).json({ 
        error: 'New recurring system not enabled',
        feature_flag: 'FEATURE_NEW_RECURRING' 
      });
    }

    // Verify template exists and user has access
    const template = await storage.getRecurringTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check user permissions
    const hasAccess = template.created_by === userId || 
                     template.assigned_to === userId ||
                     (template.shared_with && template.shared_with.includes(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate instances for the template (last 30 days, next 7 days)
    const instances = await storage.generateRecurringInstances(templateId, {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    res.json({ 
      success: true, 
      template: template,
      instances: instances || [],
      total_instances: instances?.length || 0
    });

  } catch (error) {
    console.error('❌ NEW RECURRING: Error getting template instances:', error);
    res.status(500).json({ error: 'Failed to get template instances' });
  }
});

export default router;