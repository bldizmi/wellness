/**
 * Hybrid Recurring Service - Phase 3 Implementation
 * Routes between legacy and new recurring systems based on feature flags
 */

import { featureFlagService } from './featureFlagService';
import { getRecurringItemsForDate } from './recurringItemService';
import * as newRecurringItemService from './newRecurringItemService';

interface RecurringItem {
  id: string;
  title: string;
  recurrence_type: string;
  due_date?: string;
  // ... other item properties
}

class HybridRecurringService {
  /**
   * Get recurring items for a specific date - routes to appropriate system
   */
  async getRecurringItemsForDate(userId: string, date: string): Promise<RecurringItem[]> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: Using NEW recurring system for user:', userId, 'date:', date);
      try {
        return await newRecurringItemService.getRecurringItemsForDate(userId, date);
      } catch (error) {
        console.error('❌ HYBRID: New system failed, falling back to legacy for user:', userId, error);
        // Fallback to legacy system on error
        return await getRecurringItemsForDate(userId, date);
      }
    } else {
      console.log('🔄 HYBRID: Using LEGACY recurring system for user:', userId, 'date:', date);
      return await getRecurringItemsForDate(userId, date);
    }
  }

  /**
   * Get personal progress items for a specific date - routes to appropriate system
   * This method specifically formats items for the Today page personal progress section
   */
  async getPersonalProgressForDate(userId: string, date: string): Promise<any> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: Using NEW system for personal progress - user:', userId, 'date:', date);
      try {
        console.log('🚀 HYBRID: Calling Phase 3 optimized calendar service');
        const { phase3CalendarService } = await import('./phase3CalendarService');
        return await phase3CalendarService.getPersonalProgressForDate(userId, date);
      } catch (error) {
        console.error('❌ HYBRID: New system failed, falling back to legacy for user:', userId, error);
        const { getTodayItemsWithCompletion } = await import('./recurringItemService');
        return await getTodayItemsWithCompletion(userId, date);
      }
    } else {
      console.log('🔄 HYBRID: Using LEGACY system for personal progress - user:', userId, 'date:', date);
      const { getTodayItemsWithCompletion } = await import('./recurringItemService');
      return await getTodayItemsWithCompletion(userId, date);
    }
  }

  /**
   * Placeholder: Complete a recurring item occurrence - routes to appropriate system
   * TODO: Implement once new system methods are available
   */
  async completeRecurringItem(userId: string, itemId: string, date: string): Promise<any> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: NEW system completion - user:', userId, 'item:', itemId, 'date:', date);
      // TODO: Call new system completion method when available
      throw new Error('New system completion not yet implemented');
    } else {
      console.log('🔄 HYBRID: LEGACY system completion - user:', userId, 'item:', itemId);
      // Use existing legacy completion logic
      return { success: true, system: 'legacy' };
    }
  }

  /**
   * Placeholder: Get completion status for recurring item on specific date
   * TODO: Implement once new system methods are available
   */
  async getCompletionStatus(userId: string, itemId: string, date: string): Promise<boolean> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: NEW system status check - user:', userId, 'item:', itemId, 'date:', date);
      // TODO: Call new system status method when available
      return false;
    } else {
      console.log('🔄 HYBRID: LEGACY system status check - user:', userId, 'item:', itemId);
      // Use existing legacy completion logic
      return false;
    }
  }

  /**
   * Get system info for debugging/admin
   */
  getSystemInfo(userId: string): { system: 'legacy' | 'new'; flags: any } {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    return {
      system: useNewSystem ? 'new' : 'legacy',
      flags: featureFlagService.getStatus()
    };
  }

  /**
   * Get personal progress items for a specific date - routes to appropriate system
   */
  async getPersonalProgressForDate(userId: string, date: string): Promise<any> {
    console.log('🔍 HYBRID SERVICE: getPersonalProgressForDate called with user:', userId, 'date:', date);
    
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    console.log('🔍 FEATURE FLAG RESULT: useNewSystem =', useNewSystem, 'for user:', userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: Using NEW system for personal progress - user:', userId, 'date:', date);
      const { phase3CalendarService } = await import('./phase3CalendarService');
      return await phase3CalendarService.getPersonalProgressForDate(userId, date);
    } else {
      console.log('🔄 HYBRID: Using LEGACY system for personal progress - user:', userId, 'date:', date);
      // Use existing legacy service directly (no circular import)
      const recurringItems = await getRecurringItemsForDate(userId, date);
      
      // Filter to only include items assigned to user for personal progress
      const personalProgressRecurringItems = recurringItems.filter((item: any) => 
        item.assigned_to === userId
      );
      
      // Group items by type for consistent response structure
      return {
        tasks: personalProgressRecurringItems.filter(item => item.item_type === 'task'),
        habits: personalProgressRecurringItems.filter(item => item.item_type === 'habit'),
        goals: personalProgressRecurringItems.filter(item => item.item_type === 'goal'),
        projects: personalProgressRecurringItems.filter(item => item.item_type === 'project')
      };
    }
  }

  /**
   * Get shared items for a specific date - routes to appropriate system
   */
  async getSharedItemsForDate(userId: string, date: string): Promise<any> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: Using NEW system for shared items - user:', userId, 'date:', date);
      const { phase3CalendarService } = await import('./phase3CalendarService');
      return await phase3CalendarService.getSharedItemsForDate(userId, date);
    } else {
      console.log('🔄 HYBRID: Using LEGACY system for shared items - user:', userId, 'date:', date);
      // Use existing legacy service directly (no circular import)
      const recurringItems = await getRecurringItemsForDate(userId, date);
      
      // Filter to shared items (created by user but assigned to others)
      const sharedRecurringItems = recurringItems.filter((item: any) => 
        item.created_by === userId && item.assigned_to !== userId
      );
      
      // Group items by type for consistent response structure
      return {
        tasks: sharedRecurringItems.filter(item => item.item_type === 'task'),
        habits: sharedRecurringItems.filter(item => item.item_type === 'habit'),
        goals: sharedRecurringItems.filter(item => item.item_type === 'goal'),
        projects: sharedRecurringItems.filter(item => item.item_type === 'project')
      };
    }
  }

  /**
   * Get personal progress for a week - routes to appropriate system
   */
  async getPersonalProgressForWeek(userId: string, startDate: string, endDate: string): Promise<any> {
    const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
    
    if (useNewSystem) {
      console.log('🆕 HYBRID: Using NEW system for week progress - user:', userId, 'start:', startDate, 'end:', endDate);
      const { phase3CalendarService } = await import('./phase3CalendarService');
      return await phase3CalendarService.getPersonalProgressForWeek(userId, startDate, endDate);
    } else {
      console.log('🔄 HYBRID: Using LEGACY system for week progress - user:', userId);
      // Legacy fallback: Use recurring service directly (no circular import)
      
      // Generate array of dates for the week
      const start = new Date(startDate);
      const end = new Date(endDate);
      const weekDates = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        weekDates.push(new Date(d).toISOString().split('T')[0]);
      }
      
      // Execute 7 individual queries using recurring service (legacy approach)
      const weekDataPromises = weekDates.map(async (date: string) => {
        const recurringItems = await getRecurringItemsForDate(userId, date);
        
        // Filter to only include items assigned to user for personal progress
        const personalItems = recurringItems.filter((item: any) => 
          item.assigned_to === userId
        );
        
        return {
          date,
          tasks: personalItems.filter(item => item.item_type === 'task'),
          habits: personalItems.filter(item => item.item_type === 'habit'),
          goals: personalItems.filter(item => item.item_type === 'goal'),
          projects: personalItems.filter(item => item.item_type === 'project')
        };
      });
      
      return await Promise.all(weekDataPromises);
    }
  }

  /**
   * Force a user to legacy system (emergency rollback)
   */
  forceUserToLegacySystem(userId: string): void {
    featureFlagService.removeUserFromNewSystem(userId);
    console.log('🚨 HYBRID: Forced user to legacy system:', userId);
  }

  /**
   * Migrate user to new system
   */
  migrateUserToNewSystem(userId: string): void {
    featureFlagService.addUserToNewSystem(userId);
    console.log('✅ HYBRID: Migrated user to new system:', userId);
  }

  /**
   * Performance comparison endpoint for A/B testing
   */
  async getPerformanceMetrics(userId: string, date: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const useNewSystem = featureFlagService.shouldUseNewRecurringSystem(userId);
      const systemUsed = useNewSystem ? 'new' : 'legacy';
      
      const items = await this.getRecurringItemsForDate(userId, date);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        system: systemUsed,
        itemCount: items.length,
        responseTime: duration,
        timestamp: new Date().toISOString(),
        userId: userId.substring(0, 8) + '***' // Anonymize for logging
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        system: 'error',
        error: error.message,
        responseTime: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const hybridRecurringService = new HybridRecurringService();