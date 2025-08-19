import { Router } from 'express';
import { getVisibleItems, getSharedItems } from '../services/itemVisibilityService';
import { db } from '../db';
import { items } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// GET /api/items - Only return items user is assigned to, shared with, or created
router.get('/', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Get all items visible to the user using centralized visibility service
    const visibleItems = await getVisibleItems(user_id);

    // Transform to expected format with explicit verify_required handling
    const formattedItems = visibleItems.map(item => ({
      id: item.id,
      display_id: item.display_id,
      created_by: item.created_by,
      assigned_to: item.assigned_to,
      shared_with: item.shared_with,
      title: item.title,
      item_type: item.item_type,
      recurrence_type: item.recurrence_type,
      due_date: item.due_date,
      time_frame: item.time_frame,
      verify_required: Boolean(item.verify_required),
      why_it_matters: item.why_it_matters,
      created_at: item.created_at,
      completed_at: item.completed_at,
      status: item.status,
      verified: item.verified,
      verified_by: item.verified_by,
      verified_at: item.verified_at,
      community_id: item.community_id
    }));

    res.json({ items: formattedItems });
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/shared - Items user didn't create but has access to
router.get('/shared', async (req, res) => {
  try {
    const { user_id } = req;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get shared items (not created by user but has access via assigned_to or shared_with)
    const sharedItems = await getSharedItems(user_id);

    // Transform to expected format
    const formattedItems = sharedItems.map(item => ({
      id: item.id,
      created_by: item.created_by,
      assigned_to: item.assigned_to,
      shared_with: item.shared_with,
      title: item.title,
      item_type: item.item_type,
      recurrence_type: item.recurrence_type,
      due_date: item.due_date,
      time_frame: item.time_frame,
      verify_required: item.verify_required,
      why_it_matters: item.why_it_matters,
      created_at: item.created_at,
      completed_at: item.completed_at,
      status: item.status,
      verified: item.verified,
      verified_by: item.verified_by,
      verified_at: item.verified_at,
      community_id: item.community_id
    }));

    res.json({ shared_items: formattedItems });
  } catch (error) {
    console.error('Error fetching shared items:', error);
    res.status(500).json({ error: 'Failed to fetch shared items' });
  }
});

export default router;