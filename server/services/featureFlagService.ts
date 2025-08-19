/**
 * FAANG-Level Feature Flag Service
 * 
 * Enables safe, gradual rollout of Phase 3 optimizations
 * with A/B testing and emergency rollback capabilities
 */

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: Map<string, boolean> = new Map();
  private userFlags: Map<string, Set<string>> = new Map();
  
  private constructor() {
    // Initialize from environment
    this.initializeFlags();
  }
  
  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }
  
  private initializeFlags(): void {
    // Global feature flags
    this.flags.set('phase3_calendar_queries', process.env.PHASE3_CALENDAR_QUERIES === 'true');
    this.flags.set('phase3_week_batch_queries', process.env.PHASE3_WEEK_BATCH_QUERIES === 'true');
    this.flags.set('phase3_shared_items_queries', process.env.PHASE3_SHARED_ITEMS_QUERIES === 'true');
    
    // EMERGENCY ROLLBACK: Disable Phase 3 until data migration is complete
    // Development user always gets new features
    // if (process.env.NODE_ENV === 'development') {
    //   this.enableUserForFlag('feykLj0oBPQLaa7JU0WpNXxoiz33', 'phase3_calendar_queries');
    //   this.enableUserForFlag('feykLj0oBPQLaa7JU0WpNXxoiz33', 'phase3_week_batch_queries');
    //   this.enableUserForFlag('feykLj0oBPQLaa7JU0WpNXxoiz33', 'phase3_shared_items_queries');
    // }
  }
  
  /**
   * Check if user should use Phase 3 optimizations
   */
  public shouldUsePhase3CalendarQueries(userId: string): boolean {
    return this.isEnabledForUser(userId, 'phase3_calendar_queries');
  }
  
  public shouldUsePhase3WeekBatchQueries(userId: string): boolean {
    return this.isEnabledForUser(userId, 'phase3_week_batch_queries');
  }
  
  public shouldUsePhase3SharedItemsQueries(userId: string): boolean {
    return this.isEnabledForUser(userId, 'phase3_shared_items_queries');
  }
  
  /**
   * Enable feature for specific user
   */
  public enableUserForFlag(userId: string, flagName: string): void {
    if (!this.userFlags.has(userId)) {
      this.userFlags.set(userId, new Set());
    }
    this.userFlags.get(userId)!.add(flagName);
    
    console.log(`🚀 FEATURE FLAG: Enabled ${flagName} for user ${userId}`);
  }
  
  /**
   * Disable feature for specific user (emergency rollback)
   */
  public disableUserForFlag(userId: string, flagName: string): void {
    if (this.userFlags.has(userId)) {
      this.userFlags.get(userId)!.delete(flagName);
      console.log(`🚫 FEATURE FLAG: Disabled ${flagName} for user ${userId}`);
    }
  }
  
  /**
   * Check if feature is enabled for user
   */
  private isEnabledForUser(userId: string, flagName: string): boolean {
    // Check user-specific flags first
    if (this.userFlags.has(userId) && this.userFlags.get(userId)!.has(flagName)) {
      return true;
    }
    
    // Fall back to global flag
    return this.flags.get(flagName) || false;
  }
  
  /**
   * Get all enabled flags for user (for debugging)
   */
  public getUserFlags(userId: string): string[] {
    const userFlags = this.userFlags.get(userId) || new Set();
    const globalFlags = Array.from(this.flags.entries())
      .filter(([_, enabled]) => enabled)
      .map(([flag, _]) => flag);
    
    return [...Array.from(userFlags), ...globalFlags];
  }
  
  /**
   * Emergency rollback - disable all Phase 3 features
   */
  public emergencyRollback(): void {
    console.log('🚨 EMERGENCY ROLLBACK: Disabling all Phase 3 features');
    
    this.flags.set('phase3_calendar_queries', false);
    this.flags.set('phase3_week_batch_queries', false);
    this.flags.set('phase3_shared_items_queries', false);
    
    // Clear all user-specific flags
    this.userFlags.clear();
  }
}

export const featureFlagService = FeatureFlagService.getInstance();