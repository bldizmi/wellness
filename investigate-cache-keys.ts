// Investigate exact cache keys and purge correct ones
import { cacheService } from './server/services/cacheService';

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';

// Get current cache statistics to see what keys exist
const stats = cacheService.getStats();

console.log('🔍 CACHE INVESTIGATION: Current cache state');
console.log('Total cache entries:', stats.size);
console.log('');

// Filter for personal-progress keys for this user
const personalProgressKeys = stats.entries.filter(key => 
  key.includes(userId) && key.includes('personal-progress-v2')
);

console.log('📋 PERSONAL PROGRESS CACHE KEYS FOR USER:', userId);
personalProgressKeys.forEach(key => {
  console.log('  -', key);
});

// Today's dates (both possible UTC/PT)
const dates = ['2025-08-08', '2025-08-09'];

console.log('');
console.log('🎯 PURGING PERSONAL PROGRESS KEYS FOR DATES:', dates.join(', '));

dates.forEach(date => {
  const cacheKey = `personal-progress-v2-${date}`;
  const fullKey = `development:${userId}:${cacheKey}:`;
  
  try {
    cacheService.invalidate(userId, cacheKey);
    console.log('✅ PURGED:', fullKey);
  } catch (error) {
    console.log('❌ ERROR PURGING:', fullKey, '-', (error as Error).message);
  }
});

console.log('');
console.log('🔍 CACHE INVESTIGATION COMPLETE');
console.log('Ready for completion test to capture exact key usage and TTL values');