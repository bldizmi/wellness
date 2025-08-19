/**
 * Enterprise-Grade Timezone Detection Component
 * Automatically detects and syncs user timezone
 */

import { useEffect, useState } from 'react';
import { detectUserTimezone } from '@shared/timezoneUtils';
import { apiRequest } from '@/lib/queryClient';

interface TimezoneDetectorProps {
  userId?: string;
}

export function TimezoneDetector({ userId }: TimezoneDetectorProps) {
  useEffect(() => {
    if (!userId) return;

    const detectAndSyncTimezone = async () => {
      try {
        // Get current user timezone from server
        const currentTimezone = await apiRequest('GET', '/api/profile/timezone');
        
        // Detect browser timezone
        const detectedTimezone = detectUserTimezone();
        
        console.log('🕐 TIMEZONE DETECTION:', {
          current: currentTimezone.timezone,
          detected: detectedTimezone,
          userToday: currentTimezone.userToday
        });
        
        // Only update if different and detection was successful
        if (detectedTimezone !== currentTimezone.timezone && detectedTimezone !== 'UTC') {
          console.log(`🔄 TIMEZONE SYNC: Updating from ${currentTimezone.timezone} to ${detectedTimezone}`);
          
          await apiRequest('PUT', '/api/profile/timezone', {
            timezone: detectedTimezone
          });
          
          console.log('✅ TIMEZONE SYNC: Successfully updated user timezone');
        } else {
          console.log('✅ TIMEZONE SYNC: Timezone already correct or detection failed');
        }
        
      } catch (error) {
        console.warn('⚠️ TIMEZONE SYNC: Failed to sync timezone:', error);
        // Don't show error to user - this is a background enhancement
      }
    };

    // Run timezone detection on component mount
    detectAndSyncTimezone();
  }, [userId]);

  // This component renders nothing - it's purely for side effects
  return null;
}

/**
 * Hook for getting user's timezone-aware date information
 */
export function useUserTimezone() {
  const [timezoneInfo, setTimezoneInfo] = useState<{
    timezone: string;
    userToday: string;
    serverUTC: string;
  } | null>(null);

  useEffect(() => {
    const fetchTimezoneInfo = async () => {
      try {
        const info = await apiRequest('GET', '/api/profile/timezone');
        setTimezoneInfo(info);
      } catch (error) {
        console.warn('Failed to fetch timezone info:', error);
      }
    };

    fetchTimezoneInfo();
  }, []);

  return timezoneInfo;
}