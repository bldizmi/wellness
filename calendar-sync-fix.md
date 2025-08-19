# Calendar Sync Fix - Recurring Task Completion Issue

## Problem Description
When marking a recurring task as complete, the calendar would:
1. Initially update correctly (e.g., 0/1 → 1/1)
2. Then revert back to the incomplete state (1/1 → 0/1)
3. Only show correctly after server restart

## Root Cause
**Race Condition between Multiple Queries**

The issue was caused by multiple React Query instances fighting over the same cache:
1. Optimistic update would set the task as complete
2. Background refetch would fetch stale data from server
3. Stale data would overwrite the fresh update
4. Multiple queries with `refetchOnWindowFocus` were creating race conditions

## Solution Implemented

### 1. **Aggressive Query Cancellation**
```typescript
// Cancel ALL related queries to prevent interference
await queryClient.cancelQueries({ 
  predicate: (query) => {
    const key = query.queryKey[0] as string;
    return key?.includes('/api/today/personal-progress') || 
           key?.includes('/api/today/shared');
  }
});
```

### 2. **Cache Removal Instead of Invalidation**
```typescript
// Remove week cache entirely to force fresh fetch
queryClient.removeQueries({
  queryKey: ["/api/today/personal-progress/week", calendarStartDate],
  exact: true
});
```

### 3. **Controlled Refetch with Delay**
```typescript
// Wait for server to process the update
await new Promise(resolve => setTimeout(resolve, 100));

// Force fresh fetch with fetchQuery instead of refetchQueries
await queryClient.fetchQuery({
  queryKey: ["/api/today/personal-progress/week", calendarStartDate],
  queryFn: () => apiRequest(`/api/today/personal-progress/week?start_date=${calendarStartDate}`),
  staleTime: 0,
});
```

### 4. **Disabled Automatic Background Refetches**
```typescript
// Prevent race conditions from automatic refetches
refetchOnWindowFocus: false,
refetchOnReconnect: false,
refetchInterval: false,
gcTime: 30 * 1000, // Short cache time to prevent stale data
```

## Files Modified

### `/client/src/pages/Today.tsx`
- Cancel all queries before optimistic updates
- Remove week cache entirely on completion
- Use `fetchQuery` instead of `refetchQueries` for controlled fetch
- Add 100ms delay before refetching to ensure server processing
- Disable automatic background refetches

### `/client/src/components/WeekCalendarStrip.tsx`
- Reduced `gcTime` to 30 seconds
- Disabled `refetchOnWindowFocus` and `refetchOnReconnect`
- Added cache event listener for debugging

## Testing Instructions

1. **Create a recurring task**
   - Should show "Start Date" instead of "Due Date"

2. **Mark recurring task as complete**
   - Calendar should update immediately (e.g., 0/1 → 1/1)
   - Should NOT revert back
   - Progress should persist through:
     - Page navigation
     - Tab switching
     - Window focus changes
     - Page refresh

3. **Verify no server restart needed**
   - Completion state should persist without restarting server
   - All UI components should stay in sync

## Key Improvements

1. **No More Race Conditions**: Queries are properly coordinated
2. **Fresh Data Guaranteed**: Cache removal ensures no stale data
3. **Controlled Updates**: Manual fetch control prevents background interference
4. **Persistent State**: Completions persist properly without server restart

## Debug Logs to Monitor

- `🛑 CANCELLED` - Query cancellation
- `🗑️ REMOVED` - Cache removal
- `✅ FRESH FETCH` - Successful data fetch
- `📊 CALENDAR ITEM` - Completion counting
- `📅 CALENDAR` - Calendar-specific events

## Performance Considerations

- Slightly more API calls due to cache removal
- 100ms delay on completions (imperceptible to users)
- Reduced background refetches improve overall performance
- More predictable cache behavior

## Future Improvements

Consider implementing:
1. WebSocket for real-time updates
2. Optimistic updates with server-sent events
3. Redux or Zustand for centralized state management
4. Server-side completion timestamps to detect stale data