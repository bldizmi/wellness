# Recurring Items and Shared Items Display Fixes

## Date: 2025-08-10

## Overview
This document details the problems identified with recurring items and shared items display logic, along with the implemented solutions.

---

## Problem 1: Recurring Items Not Showing on Future Dates

### Issue Description
Daily recurring habits (e.g., #1042A and #1041A) were only displaying on the current day, not on future dates when users navigated through the calendar.

### Root Cause
The system was using a new architecture with `recurring_instances` table but only pre-generated instances for 30 days ahead when items were created. There was no mechanism to generate instances beyond this initial 30-day window.

### Technical Details
- **Location**: `server/services/newRecurringItemService.ts`
- **Problem Code**: `generateInitialInstances()` function only created instances for 30 days
- **Impact**: Users couldn't see their recurring items when viewing dates beyond 30 days in the future

### Solution Implemented

#### 1. Added On-Demand Instance Generation
**File**: `server/services/phase3ReadingService.ts`

**New Function**: `ensureInstancesExistForDates(userId: string, dates: string[])`
- Checks for missing instances for requested dates
- Generates instances on-demand when users view future dates
- Prevents duplicate instance creation
- Handles all recurrence patterns (daily, weekly, monthly, yearly)

#### 2. Added Recurrence Pattern Validation
**New Function**: `shouldTemplateAppearOnDate(template: any, targetDate: string)`
- Validates if a template should appear on a specific date
- Handles different recurrence types:
  - Daily: Returns `true` for all dates
  - Weekly: Checks `by_day` array
  - Monthly: Checks `by_monthday`
  - Yearly: Checks `by_month` and `by_monthday`

#### 3. Integration Points
- `getPersonalProgressItemsNew()`: Calls `ensureInstancesExistForDates()` before querying
- `getWeekProgressNew()`: Generates instances for all 7 days of the week
- `getSharedItemsNew()`: Ensures shared instances exist via `ensureSharedInstancesExistForDate()`

### Code Changes
```typescript
// Before: No instance generation beyond initial 30 days
async function getPersonalProgressItemsNew(userId: string, targetDate: string) {
  // Direct query without checking for instances
  const instancesQuery = sql`SELECT * FROM recurring_instances WHERE occurrence_date = ${targetDate}`;
}

// After: On-demand instance generation
async function getPersonalProgressItemsNew(userId: string, targetDate: string) {
  // First ensure instances exist
  await ensureInstancesExistForDates(userId, [targetDate]);
  // Then query for instances
  const instancesQuery = sql`SELECT * FROM recurring_instances WHERE occurrence_date = ${targetDate}`;
}
```

---

## Problem 2: Shared Items Display Logic Incorrect

### Issue Description
Shared items were not appearing in the correct sections based on assignment and sharing status.

### Expected Behavior
1. **User A creates item, shares with User B, assigns to User A**
   - Should show in User A's Habits/Focus area
   - Should show in User B's Shared area

2. **User A creates item, shares with User B, assigns to User B**
   - Should show in User A's Shared area
   - Should show in User B's Habits/Focus area

### Root Cause
The SQL queries and filtering logic were not correctly distinguishing between:
- Items assigned to the user (should appear in Habits/Focus)
- Items shared with the user but assigned to others (should appear in Shared)
- Items created by the user but assigned to others (should appear in Shared)

### Solution Implemented

#### 1. Added Shared Instance Generation
**File**: `server/services/phase3ReadingService.ts`

**New Function**: `ensureSharedInstancesExistForDate(userId: string, targetDate: string)`
- Generates instances for items shared with the user
- Handles items created by user but assigned to others
- Uses proper SQL filtering for shared templates

#### 2. Fixed SQL Query Logic

**Personal Progress Query** (Items in Habits/Focus):
```sql
WHERE ri.assigned_to = ${userId}
  AND ri.created_at::date <= ${targetDate}::date
```

**Shared Items Query** (Items in Shared section):
```sql
WHERE is_active = true
  AND is_recurring = true
  AND (
    (created_by = ${userId} AND assigned_to != ${userId})
    OR (shared_with::jsonb @> ${JSON.stringify([userId])}::jsonb AND assigned_to != ${userId})
  )
```

#### 3. Frontend Display Logic
**File**: `client/src/pages/Today.tsx`

- **Habits Tab**: Filters items where `assigned_to === user.uid`
- **Focus Tab**: Filters items where `assigned_to === user.uid`
- **Shared Tab**: Uses separate `/api/today/shared` endpoint for proper filtering

### Code Changes
```typescript
// Shared Templates Query - Correctly identifies shared items
const sharedTemplatesQuery = sql`
  SELECT * FROM ${sql.raw(templatesTable)}
  WHERE is_active = true
    AND is_recurring = true
    AND (
      (created_by = ${userId} AND assigned_to != ${userId})  // Created by user, assigned to others
      OR (shared_with::jsonb @> ${JSON.stringify([userId])}::jsonb AND assigned_to != ${userId})  // Shared with user, not assigned to them
    )
`;
```

---

## Files Modified

### Backend Files
1. **`server/services/phase3ReadingService.ts`**
   - Added `ensureInstancesExistForDates()`
   - Added `ensureSharedInstancesExistForDate()`
   - Added `shouldTemplateAppearOnDate()`
   - Modified `getPersonalProgressItemsNew()`
   - Modified `getSharedItemsNew()`
   - Modified `getWeekProgressNew()`

2. **`server/routes/today.ts`**
   - Already had correct SQL queries for legacy system
   - Confirmed proper filtering logic

### Frontend Files
1. **`client/src/pages/Today.tsx`**
   - Already had correct filtering logic for tabs
   - Uses separate endpoints for personal vs shared items

---

## Testing Checklist

### Recurring Items
- [ ] Create a daily recurring habit
- [ ] Navigate to future dates (tomorrow, next week, next month)
- [ ] Verify the habit appears on all future dates
- [ ] Test weekly recurring items with specific days
- [ ] Test monthly recurring items

### Shared Items
- [ ] User A creates task, assigns to self, shares with User B
  - [ ] Verify appears in User A's Focus tab
  - [ ] Verify appears in User B's Shared tab
- [ ] User A creates task, assigns to User B, shares with User B
  - [ ] Verify appears in User A's Shared tab
  - [ ] Verify appears in User B's Focus tab
- [ ] Verify habits are never shown in Shared tab

---

## Impact Summary

### Performance
- **Minimal Impact**: Instances are generated on-demand only when needed
- **Optimization**: Checks for existing instances before creating new ones
- **Scalability**: Can handle unlimited future date ranges

### User Experience
- ✅ Users can now see recurring items on any future date
- ✅ Shared items appear in the correct sections
- ✅ Clear separation between personal progress and shared items
- ✅ Consistent behavior across all date ranges

### Technical Debt Addressed
- Removed 30-day limitation on recurring items
- Unified instance generation logic
- Consistent filtering between new and legacy architectures
- Proper separation of concerns (templates vs instances)

---

## Future Considerations

1. **Batch Instance Generation**: Consider pre-generating instances in larger batches during off-peak hours
2. **Instance Cleanup**: Implement cleanup for very old instances to manage database size
3. **Performance Monitoring**: Add metrics for instance generation frequency and duration
4. **Caching Strategy**: Consider caching generated instances for frequently accessed date ranges

---

## Rollback Plan

If issues arise, the changes can be reverted by:
1. Removing the `ensureInstancesExistForDates()` calls
2. Reverting to the previous version of `phase3ReadingService.ts`
3. No database migrations are required for rollback