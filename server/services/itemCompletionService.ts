import { db } from '../db';
import { item_completions, items } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CompletionStreak {
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  completion_rate: number; // percentage
}

/**
 * Complete an item for a specific date
 */
export async function completeItemForDate(
  itemId: string,
  userId: string,
  completionDate: string, // YYYY-MM-DD format
  verificationData?: any
): Promise<void> {
  const completionId = nanoid();
  
  await db.insert(item_completions).values({
    id: completionId,
    item_id: itemId,
    user_id: userId,
    completion_date: completionDate,
    completed_at: new Date().toISOString(),
    verification_data: verificationData,
    created_at: new Date().toISOString(),
  });
}

/**
 * Check if an item is completed for a specific date
 */
export async function isItemCompletedForDate(
  itemId: string,
  userId: string,
  completionDate: string
): Promise<boolean> {
  const completion = await db
    .select()
    .from(item_completions)
    .where(
      and(
        eq(item_completions.item_id, itemId),
        eq(item_completions.user_id, userId),
        eq(item_completions.completion_date, completionDate)
      )
    )
    .limit(1);

  return completion.length > 0;
}

/**
 * Remove completion for a specific date (undo completion)
 */
export async function removeCompletionForDate(
  itemId: string,
  userId: string,
  completionDate: string
): Promise<void> {
  await db
    .delete(item_completions)
    .where(
      and(
        eq(item_completions.item_id, itemId),
        eq(item_completions.user_id, userId),
        eq(item_completions.completion_date, completionDate)
      )
    );
}

/**
 * Get completion history for an item
 */
export async function getItemCompletionHistory(
  itemId: string,
  userId: string,
  limit: number = 30
): Promise<any[]> {
  const completions = await db
    .select()
    .from(item_completions)
    .where(
      and(
        eq(item_completions.item_id, itemId),
        eq(item_completions.user_id, userId)
      )
    )
    .orderBy(item_completions.completion_date)
    .limit(limit);

  return completions;
}

/**
 * Calculate completion streak for a recurring item
 */
export async function calculateCompletionStreak(
  itemId: string,
  userId: string,
  recurrenceType: string
): Promise<CompletionStreak> {
  const completions = await db
    .select()
    .from(item_completions)
    .where(
      and(
        eq(item_completions.item_id, itemId),
        eq(item_completions.user_id, userId)
      )
    )
    .orderBy(item_completions.completion_date);

  if (completions.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      total_completions: 0,
      completion_rate: 0
    };
  }

  // Calculate streaks based on recurrence type
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = new Date().toISOString().split('T')[0];
  const completionDates = completions.map(c => c.completion_date).sort();
  
  // For daily items, check consecutive days
  if (recurrenceType === 'daily') {
    const expectedDates = generateExpectedDates(completions[0].completion_date, today, 'daily');
    
    for (let i = expectedDates.length - 1; i >= 0; i--) {
      const expectedDate = expectedDates[i];
      if (completionDates.includes(expectedDate)) {
        currentStreak++;
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (expectedDate === today) {
          // Today not completed yet, don't break streak
          continue;
        }
        break;
      }
    }
  }

  // Calculate completion rate
  const totalExpectedCompletions = getTotalExpectedCompletions(
    completions[0].completion_date,
    today,
    recurrenceType
  );
  
  const completionRate = totalExpectedCompletions > 0 
    ? Math.round((completions.length / totalExpectedCompletions) * 100)
    : 0;

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_completions: completions.length,
    completion_rate: completionRate
  };
}

/**
 * Generate expected dates for recurrence pattern
 */
function generateExpectedDates(startDate: string, endDate: string, recurrenceType: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (recurrenceType === 'daily') {
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  }
  
  // Add logic for weekly, monthly, etc. as needed
  
  return dates;
}

/**
 * Calculate total expected completions for a time period
 */
function getTotalExpectedCompletions(
  startDate: string,
  endDate: string,
  recurrenceType: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  switch (recurrenceType) {
    case 'daily':
      return diffDays + 1;
    case 'weekly':
      return Math.ceil(diffDays / 7);
    case 'monthly':
      return Math.ceil(diffDays / 30);
    default:
      return 1;
  }
}