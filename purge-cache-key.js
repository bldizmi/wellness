// Targeted cache key purge for investigation
const cacheService = require('./server/services/cacheService.js');

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
const date = '2025-08-08';
const cacheKey = `personal-progress-v2-${date}`;

console.log('🎯 TARGETED CACHE PURGE: Deleting specific cache key only');
console.log('User ID:', userId);
console.log('Cache Key:', cacheKey);
console.log('Full Key:', `development:${userId}:${cacheKey}`);

try {
  // Delete the specific cache key
  const deleted = cacheService.delete(userId, cacheKey);
  
  if (deleted) {
    console.log('✅ CACHE KEY DELETED:', `development:${userId}:${cacheKey}`);
  } else {
    console.log('ℹ️ CACHE KEY NOT FOUND (already expired or not set):', `development:${userId}:${cacheKey}`);
  }
  
  console.log('🔍 CACHE PURGE COMPLETE - Ready for testing');
  
} catch (error) {
  console.error('❌ CACHE PURGE ERROR:', error.message);
  process.exit(1);
}