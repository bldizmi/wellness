
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { createLogger } from '../services/logger';

// Initialize Firebase Admin SDK in both development and production
const isDevelopment = process.env.NODE_ENV === 'development';

try {
  if (!admin.apps.length) {
    // Use environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Clean and format the private key
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Handle different possible formats
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Ensure proper PEM format
      if (!privateKey.includes('-----BEGIN')) {
        console.error('Invalid private key format: Missing PEM headers');
        throw new Error('Invalid private key format');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      const logger = createLogger();
      logger.info('Firebase Admin SDK initialized successfully', {
        projectId: process.env.FIREBASE_PROJECT_ID,
        environment: isDevelopment ? 'development' : 'production',
      });
    } else {
      const logger = createLogger();
      logger.error('Missing Firebase environment variables', {
        required: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'],
        environment: isDevelopment ? 'development' : 'production',
      });
      throw new Error('Firebase credentials required for authentication');
    }
  }
} catch (error) {
  const logger = createLogger();
  logger.error('Firebase Admin SDK initialization error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    environment: isDevelopment ? 'development' : 'production',
  });
  if (!isDevelopment) {
    logger.error('Firebase credentials check required for production');
  }
}

// Role assignment function
function getRoleForEmail(email: string | undefined): string {
  if (!email) return 'member';
  
  // Define role mappings
  const roleMap: Record<string, string> = {
    'georgewandhe@gmail.com': 'admin',
    // Add pilot users or other special roles here as needed
    // 'pilot@example.com': 'pilot',
  };
  
  return roleMap[email.toLowerCase()] || 'member';
}

// Function to ensure user exists in database
async function ensureUserExists(decodedToken: admin.auth.DecodedIdToken) {
  try {
    // First check if user exists by Firebase UID
    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, decodedToken.uid));

    if (existingUser) {
      return existingUser;
    }

    // If not found by UID, check if user exists by email (for migration)
    if (decodedToken.email) {
      [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, decodedToken.email));

      if (existingUser) {
        // Update existing user with Firebase UID and sync username to email
        const [updatedUser] = await db
          .update(users)
          .set({ 
            firebase_uid: decodedToken.uid,
            username: decodedToken.email, // Sync username to email
            verified: decodedToken.email_verified || existingUser.verified
          })
          .where(eq(users.email, decodedToken.email))
          .returning();

        const logger = createLogger();
        logger.audit('user_firebase_uid_linked', {
          email: updatedUser.email,
          database_id: updatedUser.id,
          firebase_uid: decodedToken.uid,
          username: updatedUser.username,
        });
        return updatedUser;
      }
    }

    // Create new user from Firebase data
    const newUser = {
      firebase_uid: decodedToken.uid,
      username: decodedToken.email || `user_${Date.now()}`, // Use email as username
      password: 'firebase_auth', // Placeholder since Firebase handles auth
      display_name: decodedToken.name || decodedToken.email || 'User',
      email: decodedToken.email || null,
      role: getRoleForEmail(decodedToken.email),
      status: 'active',
      verified: decodedToken.email_verified || false,
    };

    const [createdUser] = await db
      .insert(users)
      .values(newUser)
      .returning();

    const logger = createLogger();
    logger.audit('user_created', {
      email: createdUser.email,
      database_id: createdUser.id,
      firebase_uid: createdUser.firebase_uid,
      role: createdUser.role,
      verified: createdUser.verified,
    });
    return createdUser;
  } catch (error) {
    const logger = createLogger();
    logger.error('Error ensuring user exists', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

// Extend Express Request type to include user_id
declare global {
  namespace Express {
    interface Request {
      user_id?: string;
    }
  }
}

// Firebase authentication middleware
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Create logger with request context
    const logger = createLogger({
      correlationId: req.headers['x-correlation-id'] as string || `auth-${Date.now()}`,
      requestPath: req.path,
    });
    
    // STRICTLY require authorization header - NO fallbacks whatsoever
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.auth('token_missing', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    try {
      // Verify Firebase token regardless of environment
      if (admin.apps.length === 0) {
        logger.error('Firebase Admin not initialized', {
          path: req.path,
          method: req.method,
        });
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }
      
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Comprehensive audit logging for security tracking
      logger.auth('token_verified', {
        firebase_uid: decodedToken.uid,
        email: decodedToken.email,
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        email_verified: decodedToken.email_verified,
      });
      
      // Auto-sync user with database
      const user = await ensureUserExists(decodedToken);
      if (!user) {
        logger.error('User synchronization failed', {
          firebase_uid: decodedToken.uid,
          email: decodedToken.email,
          path: req.path,
        });
        return res.status(500).json({ error: 'User synchronization failed' });
      }
      
      // Use Firebase UID consistently across all requests
      req.user_id = decodedToken.uid;
      
      // Update last login with performance tracking
      const loginStart = Date.now();
      await db
        .update(users)
        .set({ last_login: new Date() })
        .where(eq(users.firebase_uid, decodedToken.uid));
      
      const loginDuration = Date.now() - loginStart;
      if (loginDuration > 50) {
        logger.warn('Slow last_login update', { duration_ms: loginDuration });
      }
      
      // Log successful authentication
      logger.auth('authenticated_access', {
        email: decodedToken.email,
        database_id: user.id,
        firebase_uid: decodedToken.uid,
        role: user.role,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      next();
    } catch (error) {
      logger.error('Token verification error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
      });
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    const logger = createLogger({
      correlationId: req.headers['x-correlation-id'] as string || `auth-error-${Date.now()}`,
      requestPath: req.path,
    });
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
