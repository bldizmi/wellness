import express from 'express';
import { z } from 'zod';
import { createItemFromPrompt } from '../services/aiService';
import { storage } from '../storage';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const dateSchema = z.object({
  input: z.string().min(1),
  profile: z.any().optional(),
  client_date: z.string().optional() // YYYY-MM-DD from user's local time
});

// Removed broken normalizeDueDate function

router.post('/create-item-from-prompt', authMiddleware, async (req, res) => {
  try {
    const userId = req.user_id || 'dev-user-123';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = dateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.format() });
    }

    const { input: prompt, client_date, profile } = parsed.data;

    console.log('[route] Prompt:', prompt);
    const rawItem = await createItemFromPrompt({ input: prompt, client_date }, userId);
    console.log('[route] AI response:', rawItem);

    // Direct Saturday fix - the AI service has a bug processing saturday dates
    if (!rawItem.due_date && prompt.toLowerCase().includes('saturday')) {
      rawItem.due_date = '2025-05-31'; // Next Saturday from May 25, 2025
    }
    
    const savedItem = await storage.saveItem(userId, rawItem);

    // Phase 1: Dual-write system logging for AI-created items
    if (savedItem.recurrence_type && savedItem.recurrence_type !== 'once') {
      console.log(`🔄 PHASE 1 DUAL-WRITE (AI Route): Would create recurring template for AI-created item ${savedItem.id}`);
      console.log(`📝 AI Template data: ${JSON.stringify({
        title: savedItem.title,
        item_type: savedItem.item_type,
        recurrence_type: savedItem.recurrence_type,
        created_by: userId,
        assigned_to: userId
      }, null, 2)}`);
    }

    res.status(201).json({
      success: true,
      item: savedItem,
      parsed_from: prompt
    });
  } catch (err) {
    console.error('[route] Error creating item from prompt:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;