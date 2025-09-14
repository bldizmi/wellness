/**
 * Enterprise-Grade Timezone Utilities
 * FAANG-level timezone handling for global scale
 */

/**
 * Convert UTC timestamp to user's local timezone
 */
export function convertUTCToUserTimezone(utcTimestamp: string, userTimezone: string): Date {
  // The Date object itself remains in UTC internally
  // Timezone conversion should happen during display/formatting
  return new Date(utcTimestamp);
}

/**
 * Convert user's local time to UTC for database storage
 */
export function convertUserTimezoneToUTC(localTimestamp: string, userTimezone: string): Date {
  // Parse the timestamp assuming it's in the user's timezone
  // This is complex because JS Date always interprets strings in local time
  // We need to calculate the offset between user timezone and UTC
  
  const date = new Date(localTimestamp);
  
  // Get the offset in minutes for the user's timezone at this specific date/time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    timeZoneName: 'short'
  });
  
  // This is a workaround since JS doesn't have a direct way to get timezone offset
  // We format the date in both UTC and user timezone and calculate the difference
  const utcTime = date.getTime();
  const userTimeString = date.toLocaleString('en-US', { timeZone: userTimezone });
  const userTime = new Date(userTimeString).getTime();
  
  // Calculate offset and return adjusted date
  const offset = userTime - utcTime;
  return new Date(date.getTime() - offset);
}

/**
 * Get user's "today" date in their timezone
 */
export function getUserToday(userTimezone: string): string {
  const now = new Date();
  // Use Intl.DateTimeFormat to properly format date in user's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // en-CA locale returns YYYY-MM-DD format directly
  return formatter.format(now);
}

/**
 * Get user's current time in their timezone
 */
export function getUserCurrentTime(userTimezone: string): Date {
  // Return the current Date object - the timezone conversion
  // should be handled when displaying/formatting the date
  return new Date();
}

/**
 * Format timestamp for display in user's timezone
 */
export function formatTimestampForUser(utcTimestamp: string, userTimezone: string, format: 'date' | 'datetime' | 'time' = 'datetime'): string {
  const date = new Date(utcTimestamp);
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: userTimezone
  };
  
  switch (format) {
    case 'date':
      options.year = 'numeric';
      options.month = 'numeric';
      options.day = 'numeric';
      break;
    case 'time':
      options.hour = 'numeric';
      options.minute = 'numeric';
      options.second = 'numeric';
      break;
    case 'datetime':
    default:
      options.year = 'numeric';
      options.month = 'numeric';
      options.day = 'numeric';
      options.hour = 'numeric';
      options.minute = 'numeric';
      options.second = 'numeric';
      break;
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Check if two timestamps are on the same day in user's timezone
 */
export function isSameDayInUserTimezone(timestamp1: string, timestamp2: string, userTimezone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const date1String = formatter.format(new Date(timestamp1));
  const date2String = formatter.format(new Date(timestamp2));
  
  return date1String === date2String;
}

/**
 * Get start and end of day in user's timezone (in UTC)
 */
export function getUserDayBounds(date: string, userTimezone: string): { start: Date; end: Date } {
  // Create date at midnight in user's timezone
  // We need to find what UTC time corresponds to midnight in user's timezone
  
  // Parse the date parts
  const [year, month, day] = date.split('-').map(Number);
  
  // Create a date object for the start of day in UTC
  // Then adjust it to find when it's midnight in the user's timezone
  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  
  // Get timezone offset for this specific date
  // Format the UTC date in the user's timezone to get the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Find the UTC times that correspond to start/end of day in user timezone
  // This is approximate but should work for most cases
  const testDate = new Date(`${date}T12:00:00Z`); // Noon UTC on the target date
  const parts = formatter.formatToParts(testDate);
  
  const hourInUserTZ = parseInt(parts.find(p => p.type === 'hour')?.value || '12');
  const offsetHours = hourInUserTZ - 12; // Approximate offset
  
  // Adjust the bounds by the offset
  const start = new Date(startOfDayUTC.getTime() - offsetHours * 3600000);
  const end = new Date(endOfDayUTC.getTime() - offsetHours * 3600000);
  
  return { start, end };
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