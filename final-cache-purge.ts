// Final cache purge after TTL fix deployed
import { cacheService } from './server/services/cacheService';

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';

console.log('🧹 FINAL CACHE PURGE: After TTL fix deployment');

// Purge both possible date variations
const dates = ['2025-08-08', '2025-08-09'];

dates.forEach(date => {
  const cacheKey = `personal-progress-v2-${date}`;
  try {
    cacheService.invalidate(userId, cacheKey);
    console.log(`✅ PURGED: ${cacheKey}`);
  } catch (error) {
    console.log(`❌ ERROR: ${cacheKey} - ${(error as Error).message}`);
  }
});

console.log('');
console.log('📊 NEW TTL CONFIGURATION:');
console.log('- Cache TTL: 30,000ms (30 seconds)');
console.log('- Previous: 120,000ms (2 minutes)');
console.log('- Fix: Prevents completion state reversions');
console.log('');
console.log('🎯 READY FOR FINAL TEST');
console.log('Cache purged, TTL reduced, ready to test completion accuracy');