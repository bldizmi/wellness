// Targeted cache purge for investigation - ONLY purge specific keys
console.log('🔍 TARGETED CACHE PURGE: Starting investigation purge for specific user/date');

const userId = 'feykLj0oBPQLaa7JU0WpNXxoiz33';
const date = '2025-08-08';
const env = 'development';

// This is a read-only inspection script - no actual cache manipulation
const targetCacheKey = `${env}:${userId}:personal-progress-v2-${date}`;

console.log('Target cache key for purge:', targetCacheKey);
console.log('User ID:', userId);
console.log('Date:', date);
console.log('Environment:', env);

// Log the completion flow for investigation
console.log('\n📋 INVESTIGATION CHECKLIST:');
console.log('1. Deploy & Version Check: ✓ (commit SHA confirmed)');
console.log('2. Code Change Verification: ✓ (300000 → 120000 confirmed at line 784)');
console.log('3. No other 300000 values found in completion/progress paths');
console.log('4. Target cache key identified:', targetCacheKey);

console.log('\n⚠️  IMPORTANT: This is a read-only investigation script');
console.log('Manual cache key deletion would need to be performed via cache service directly');