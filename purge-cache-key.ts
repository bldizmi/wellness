// Targeted cache key purge for investigation
import { cacheService } from './server/services/cacheService';

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
const date = '2025-08-08';
const cacheKey = `personal-progress-v2-${date}`;

console.log('🎯 TARGETED CACHE PURGE: Deleting specific cache key only');
console.log('User ID:', userId);
console.log('Cache Key:', cacheKey);
console.log('Full Key:', `development:${userId}:${cacheKey}:`);

try {
  // Delete the specific cache key
  cacheService.invalidate(userId, cacheKey);
  
  console.log('✅ CACHE KEY INVALIDATED:', `development:${userId}:${cacheKey}:`);
  console.log('🔍 CACHE PURGE COMPLETE - Ready for testing');
  
} catch (error) {
  console.error('❌ CACHE PURGE ERROR:', (error as Error).message);
  process.exit(1);
}