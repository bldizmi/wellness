import { Request, Response } from 'express';
import { storage } from '../storage';
import { verifyTaskWithPhoto } from '../services/aiVisionService';
import multer from 'multer';

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

/**
 * Upload photo and verify task completion with AI
 */
export const verifyItemWithPhoto = [
  upload.single('photo'),
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const userId = req.user_id!;

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No photo uploaded' 
        });
      }

      // Get the item to verify
      const items = await storage.getUserItems(userId);
      const item = items.find(i => i.id === itemId);

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      if (!item.verify_required) {
        return res.status(400).json({ 
          success: false, 
          error: 'This item does not require verification' 
        });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');

      // Use AI to verify the task completion
      const verificationResult = await verifyTaskWithPhoto(item.title, base64Image);

      // Store the image URL (in a real app, you'd upload to cloud storage)
      const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Update the item with verification results
      const updatedItem = await storage.verifyItemWithPhoto(
        userId,
        itemId,
        userId,
        verificationResult.ai_verification_result === 'complete' ? 'complete' : 'pending_review',
        verificationResult.ai_verification_result === 'complete'
      );

      if (!updatedItem) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update item' 
        });
      }

      res.json({
        success: true,
        item: {
          ...updatedItem,
          image_url: imageUrl,
          ai_verification_result: verificationResult.ai_verification_result,
          ai_feedback: verificationResult.ai_feedback
        },
        verification: verificationResult
      });

    } catch (error) {
      console.error('Photo verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process photo verification' 
      });
    }
  }
];