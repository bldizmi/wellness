#!/usr/bin/env node

// Test the timezone fixes
import { 
  getUserToday, 
  formatTimestampForUser,
  isSameDayInUserTimezone,
  detectUserTimezone,
  getUserDayBounds
} from './shared/timezoneUtils.ts';

console.log('🧪 Testing Timezone Functions\n');

// Test various timezones
const testTimezones = [
  'America/New_York',    // EST/EDT (UTC-5/-4)
  'America/Los_Angeles', // PST/PDT (UTC-8/-7)
  'Europe/London',       // GMT/BST (UTC+0/+1)
  'Asia/Tokyo',         // JST (UTC+9)
  'Australia/Sydney',   // AEDT (UTC+11)
  'Pacific/Auckland'    // NZDT (UTC+13)
];

// Current time for testing
const now = new Date();
console.log(`Current UTC time: ${now.toISOString()}`);
console.log(`Current local time: ${now.toString()}\n`);

// Test getUserToday for each timezone
console.log('📅 Testing getUserToday():');
console.log('-'.repeat(50));
testTimezones.forEach(tz => {
  const today = getUserToday(tz);
  console.log(`${tz.padEnd(25)} → ${today}`);
});

console.log('\n📍 Testing with your browser timezone:');
const browserTz = detectUserTimezone();
console.log(`Detected timezone: ${browserTz}`);
console.log(`Today in your timezone: ${getUserToday(browserTz)}`);

// Test edge case: near midnight
console.log('\n🕐 Testing near midnight (11:30 PM in each timezone):');
console.log('-'.repeat(50));

// Create a test date at 11:30 PM UTC
const testDate = new Date();
testDate.setUTCHours(23, 30, 0, 0);

testTimezones.forEach(tz => {
  // Mock the current time as 11:30 PM in that timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const formatted = formatter.format(testDate);
  const today = getUserToday(tz);
  console.log(`${tz.padEnd(25)} → ${formatted} → Date: ${today}`);
});

// Test formatTimestampForUser
console.log('\n🕰️ Testing formatTimestampForUser():');
console.log('-'.repeat(50));
const testTimestamp = '2025-01-09T23:30:00Z'; // 11:30 PM UTC on Jan 9

testTimezones.forEach(tz => {
  const formatted = formatTimestampForUser(testTimestamp, tz, 'datetime');
  console.log(`${tz.padEnd(25)} → ${formatted}`);
});

// Test isSameDayInUserTimezone
console.log('\n📆 Testing isSameDayInUserTimezone():');
console.log('-'.repeat(50));
const timestamp1 = '2025-01-09T23:00:00Z'; // 11 PM UTC Jan 9
const timestamp2 = '2025-01-10T01:00:00Z'; // 1 AM UTC Jan 10

testTimezones.forEach(tz => {
  const sameDay = isSameDayInUserTimezone(timestamp1, timestamp2, tz);
  console.log(`${tz.padEnd(25)} → ${sameDay ? 'Same day' : 'Different days'}`);
});

console.log('\n✅ Timezone tests complete!');