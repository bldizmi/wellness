import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { insertMoodSchema } from '@shared/schema';
import { reflectOnMood } from '../services/aiService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/mood/check-in
router.post('/check-in', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Validate request body
    const validationResult = insertMoodSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const { mood_emoji, timestamp } = validationResult.data;
    
    // Create mood check-in
    const newMood = await storage.saveMood(user_id, {
      mood_emoji,
      timestamp: timestamp || new Date().toISOString()
    });
    
    // Generate a reflection on the mood (async, don't wait for it)
    let reflection: string | null = null;
    reflectOnMood(mood_emoji)
      .then(result => {
        reflection = result;
      })
      .catch(error => {
        console.error('Error generating mood reflection:', error);
      });
    
    res.status(201).json({ 
      success: true, 
      mood: newMood,
      reflection: reflection
    });
  } catch (error) {
    console.error('Error saving mood:', error);
    res.status(500).json({ error: 'Failed to save mood check-in' });
  }
});

// GET /api/mood/check-in - Check if user has already checked in today
router.get('/check-in', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get client date from query parameter (YYYY-MM-DD format)
    const clientDate = req.query.date as string;
    
    if (!clientDate) {
      return res.status(400).json({ error: 'Client date is required' });
    }
    
    // Fetch moods history
    const moods = await storage.getUserMoods(user_id);
    
    // Check if user has already checked in on the specified date
    const todayMood = moods.find(mood => {
      const moodDate = new Date(mood.timestamp).toISOString().split('T')[0];
      return moodDate === clientDate;
    });
    
    res.status(200).json({ 
      success: true, 
      hasCheckedInToday: !!todayMood,
      todayMood: todayMood || null
    });
  } catch (error) {
    console.error('Error checking mood status:', error);
    res.status(500).json({ error: 'Failed to check mood status' });
  }
});

// GET /api/mood/history
router.get('/history', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Fetch moods history
    const moods = await storage.getUserMoods(user_id);
    
    // Sort by timestamp, newest first
    moods.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    res.status(200).json({ 
      success: true, 
      moods 
    });
  } catch (error) {
    console.error('Error fetching mood history:', error);
    res.status(500).json({ error: 'Failed to fetch mood history' });
  }
});

export default router;
