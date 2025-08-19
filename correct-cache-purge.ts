// Correct the namespace issue - purge 2025-08-08, not 2025-08-09
import { cacheService } from './server/services/cacheService';

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';

console.log('🔧 NAMESPACE CORRECTION: Purging correct test date');

// Your test was on 2025-08-08, not 2025-08-09
const correctDate = '2025-08-08';
const cacheKey = `personal-progress-v2-${correctDate}`;

try {
  cacheService.invalidate(userId, cacheKey);
  console.log(`✅ PURGED CORRECT KEY: ${cacheKey}`);
  console.log(`Full key: development:${userId}:${cacheKey}:`);
} catch (error) {
  console.log(`❌ ERROR: ${(error as Error).message}`);
}

console.log('');
console.log('🎯 READY FOR MONITORING:');
console.log('- TTL restored to 120,000ms');
console.log('- Correct cache key purged');
console.log('- Monitoring for cache logs with ttl_ms=120000');