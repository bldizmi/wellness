/**
 * Enterprise-Grade Timezone Utilities
 * FAANG-level timezone handling for global scale
 */

/**
 * Convert UTC timestamp to user's local timezone
 */
export function convertUTCToUserTimezone(utcTimestamp: string, userTimezone: string): Date {
  const utcDate = new Date(utcTimestamp);
  return new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
}

/**
 * Convert user's local time to UTC for database storage
 */
export function convertUserTimezoneToUTC(localTimestamp: string, userTimezone: string): Date {
  // Create date as if it's in user's timezone
  const localDate = new Date(localTimestamp);
  
  // Get timezone offset
  const userDate = new Date(localDate.toLocaleString("en-US", { timeZone: userTimezone }));
  const utcDate = new Date(localDate.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = userDate.getTime() - utcDate.getTime();
  
  // Adjust for timezone
  return new Date(localDate.getTime() - offset);
}

/**
 * Get user's "today" date in their timezone
 */
export function getUserToday(userTimezone: string): string {
  const now = new Date();
  const userDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  return userDate.toISOString().split('T')[0];
}

/**
 * Get user's current time in their timezone
 */
export function getUserCurrentTime(userTimezone: string): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
}

/**
 * Format timestamp for display in user's timezone
 */
export function formatTimestampForUser(utcTimestamp: string, userTimezone: string, format: 'date' | 'datetime' | 'time' = 'datetime'): string {
  const userDate = convertUTCToUserTimezone(utcTimestamp, userTimezone);
  
  switch (format) {
    case 'date':
      return userDate.toLocaleDateString();
    case 'time':
      return userDate.toLocaleTimeString();
    case 'datetime':
    default:
      return userDate.toLocaleString();
  }
}

/**
 * Check if two timestamps are on the same day in user's timezone
 */
export function isSameDayInUserTimezone(timestamp1: string, timestamp2: string, userTimezone: string): boolean {
  const date1 = convertUTCToUserTimezone(timestamp1, userTimezone);
  const date2 = convertUTCToUserTimezone(timestamp2, userTimezone);
  
  return date1.toDateString() === date2.toDateString();
}

/**
 * Get start and end of day in user's timezone (in UTC)
 */
export function getUserDayBounds(date: string, userTimezone: string): { start: Date; end: Date } {
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59.999`);
  
  const startUTC = convertUserTimezoneToUTC(startOfDay.toISOString(), userTimezone);
  const endUTC = convertUserTimezoneToUTC(endOfDay.toISOString(), userTimezone);
  
  return { start: startUTC, end: endUTC };
}

/**
 * Detect user's timezone from browser
 */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect timezone, defaulting to UTC');
    return 'UTC';
  }
}

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get common timezone options for UI
 */
export function getCommonTimezones(): { value: string; label: string }[] {
  return [
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
    { value: 'UTC', label: 'UTC' },
  ];
}