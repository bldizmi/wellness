/**
 * Intelligent caching service for performance optimization
 * Provides automatic cache invalidation and graceful fallbacks
 */

import { createLogger } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private logger = createLogger();

  constructor() {
    // Start automatic cleanup of expired entries
    setInterval(() => this.cleanupExpired(), this.CLEANUP_INTERVAL);
    
    this.logger.info('Cache service initialized', {
      default_ttl_ms: this.DEFAULT_TTL,
      cleanup_interval_ms: this.CLEANUP_INTERVAL,
    });
  }

  /**
   * Generate cache key with user isolation
   */
  private generateKey(userId: string, operation: string, params?: any): string {
    const env = process.env.NODE_ENV || 'development';
    const paramString = params ? JSON.stringify(params) : '';
    return `${env}:${userId}:${operation}:${paramString}`;
  }

  /**
   * Get cached data if valid, otherwise return null
   */
  get<T>(userId: string, operation: string, params?: any): T | null {
    const key = this.generateKey(userId, operation, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.logger.cache('get', key, false, { userId, operation });
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.cache('get', key, false, { userId, operation, reason: 'expired' });
      return null;
    }

    this.logger.cache('get', key, true, { userId, operation, age_ms: Date.now() - entry.timestamp });
    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(userId: string, operation: string, data: T, params?: any, ttl?: number): void {
    const key = this.generateKey(userId, operation, params);
    const now = Date.now();
    const expiresAt = now + (ttl || this.DEFAULT_TTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    });
    
    this.logger.cache('set', key, true, { 
      userId, 
      operation, 
      ttl_ms: ttl || this.DEFAULT_TTL,
      data_size: JSON.stringify(data).length 
    });
  }

  /**
   * Invalidate cache for specific user and operation
   */
  invalidate(userId: string, operation: string, params?: any): void {
    const invalidatedKeys: string[] = [];
    
    if (params) {
      const key = this.generateKey(userId, operation, params);
      
      // D) Invalidate wrapper echo (when correlationId is present)
      const correlationId = (this.logger as any).correlationId;
      if (correlationId) {
        console.log(`CACHE_INVALIDATE_CALL ${JSON.stringify({
          full_key: key,
          caller: "itemCompletion.ts",
          correlationId: correlationId
        })}`);
      }
      
      this.cache.delete(key);
      invalidatedKeys.push(key);
    } else {
      // Invalidate all entries for this user and operation
      const prefix = this.generateKey(userId, operation);
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          invalidatedKeys.push(key);
        }
      }
    }
    
    // PHASE 0: Mirror cache invalidation to INFO for correlation
    if (invalidatedKeys.length > 0) {
      this.logger.info('Cache INVALIDATE', {
        userId,
        operation,
        invalidated_keys: invalidatedKeys,
        key_count: invalidatedKeys.length
      });
    }
  }

  /**
   * Invalidate all cache entries for a user
   */
  invalidateUser(userId: string): void {
    const env = process.env.NODE_ENV || 'development';
    const prefix = `${env}:${userId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Clear all cache entries (for testing/debugging)
   */
  clear(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const cacheService = new CacheService();