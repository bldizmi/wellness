import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProgressRing } from "./ProgressRing";
import { useAuth } from "@/contexts/AuthContext";

interface WeekCalendarStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export function WeekCalendarStrip({
  selectedDate,
  onDateSelect,
}: WeekCalendarStripProps) {
  const { user } = useAuth();

  // Week labels for Sunday through Saturday
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Local state for immediate visual feedback on date clicks
  const [localSelectedDate, setLocalSelectedDate] = useState(selectedDate);

  // Sync local state with parent when selectedDate changes
  useEffect(() => {
    setLocalSelectedDate(selectedDate);
  }, [selectedDate]);

  // Force refetch when component receives new data signals
  useEffect(() => {
    // Listen for cache updates and refetch if needed
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === "/api/today/personal-progress/week") {
        // If a week query was removed or invalidated, log it
        if (event.type === "removed") {
          console.log("📅 CALENDAR: Week cache removed, will fetch fresh data");
        } else if (
          event.type === "updated" &&
          event.action?.type === "invalidate"
        ) {
          console.log("📅 CALENDAR: Week cache invalidated");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Start of week containing the selected date (Sunday)
  const [startOfWeek, setStartOfWeek] = useState(() => {
    // Parse the selected date to find its week
    const [year, month, day] = selectedDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayOfWeek = selectedDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startDate = new Date(selectedDateObj);
    startDate.setDate(selectedDateObj.getDate() - dayOfWeek); // Go back to Sunday
    return startDate;
  });

  // Update week view when selectedDate changes externally
  useEffect(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayOfWeek = selectedDateObj.getDay();
    const newStartDate = new Date(selectedDateObj);
    newStartDate.setDate(selectedDateObj.getDate() - dayOfWeek);

    // Only update if we're showing a different week
    if (newStartDate.getTime() !== startOfWeek.getTime()) {
      setStartOfWeek(newStartDate);
      console.log(
        `📅 STICKY NAV: Updated week view to show week containing ${selectedDate}`,
      );
    }
  }, [selectedDate]); // Removed startOfWeek from deps to prevent infinite loop

  // Generate 7 consecutive days starting from startOfWeek
  const days = useMemo(() => {
    const today = new Date();
    const todayString = today.toLocaleDateString("en-CA"); // YYYY-MM-DD format

    return Array.from({ length: 7 }, (_, i) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      // console.log(`📅 Week calendar: Day ${i} (${weekLabels[i]}) - Date: ${dateString}, Display: ${currentDate.getDate()}`);

      return {
        date: dateString,
        displayNumber: currentDate.getDate(),
        dayLabel: weekLabels[i],
        isToday: dateString === todayString,
        dayOfWeek: i, // 0 = Sunday, 1 = Monday, etc.
      };
    });
  }, [startOfWeek]);

  // Fetch personal progress data for all 7 days in one batch request
  const startDateString = startOfWeek.toISOString().split("T")[0];
  const weekQuery = useQuery({
    queryKey: ["/api/today/personal-progress/week", startDateString],
    queryFn: () => {
      console.log(
        `🔍 WEEK CALENDAR QUERY: Fetching fresh data for week starting ${startDateString}`,
      );
      return apiRequest(
        `/api/today/personal-progress/week?start_date=${startDateString}`,
      );
    },
    staleTime: 0, // Always fetch fresh
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 0, // No retries to avoid confusion
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: false,
    enabled: true, // Enable to get personal progress data for progress rings
  });

  // Transform batched data to individual day queries for compatibility
  const dayQueries = days.map((day) => ({
    data: weekQuery.data?.[day.date] || null,
    isLoading: weekQuery.isLoading,
    error: weekQuery.error,
  }));

  // Calculate completion status for each day
  const getDayCompletionStatus = (dayIndex: number) => {
    const query = dayQueries[dayIndex];
    const dayDate = days[dayIndex]?.date;

    if (!query.data) {
      return {
        completed: 0,
        total: 0,
        percentage: 0,
        isLoading: query.isLoading,
      };
    }

    // All items from personal progress endpoint are already filtered to user's personal items
    const allItems = [
      ...(query.data.tasks || []),
      ...(query.data.habits || []),
      ...(query.data.goals || []),
      ...(query.data.projects || []),
    ];
    //console.log("All items:", allItems);
    const total = allItems.length;
    if (total === 0) {
      return { completed: 0, total: 0, percentage: 0, isLoading: false };
    }

    // Count completed items using comprehensive completion logic
    const completed = allItems.filter((item) => {
      // Enhanced logging for debugging recurring items
      const isRecurring =
        item.recurrence_type && item.recurrence_type !== "once";

      if (isRecurring) {
        // For recurring items: check completion record OR AI verification OR manual completion
        const isCompleted = !!(
          item.is_completed_for_date ||
          (item.verified && item.ai_verification_result === "complete") ||
          item.status === "complete" ||
          item.status === "completed"
        );

        // Debug log for recurring items on current day
        if (dayDate === new Date().toISOString().split("T")[0]) {
          console.log(`📊 CALENDAR ITEM: ${item.title}`, {
            is_completed_for_date: item.is_completed_for_date,
            status: item.status,
            verified: item.verified,
            ai_result: item.ai_verification_result,
            completed: isCompleted,
          });
        }

        return isCompleted;
      } else {
        // For one-time items: check any completion indicator
        return !!(
          item.completed_at ||
          item.status === "complete" ||
          item.status === "completed" ||
          (item.verified && item.ai_verification_result === "complete")
        );
      }
    }).length;

    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage, isLoading: false };
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    const newStart = new Date(startOfWeek);
    newStart.setDate(startOfWeek.getDate() - 7);
    setStartOfWeek(newStart);
    console.log(
      `📅 NAVIGATION: Previous week, new start: ${newStart.toLocaleDateString("en-CA")}`,
    );
  };

  const goToNextWeek = () => {
    const newStart = new Date(startOfWeek);
    newStart.setDate(startOfWeek.getDate() + 7);
    setStartOfWeek(newStart);
    console.log(
      `📅 NAVIGATION: Next week, new start: ${newStart.toLocaleDateString("en-CA")}`,
    );
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const newStart = new Date(today);
    newStart.setDate(today.getDate() - dayOfWeek);
    setStartOfWeek(newStart);

    // Also select today's date
    const todayString = today.toLocaleDateString("en-CA"); // YYYY-MM-DD format
    onDateSelect(todayString);

    console.log(
      `📅 NAVIGATION: Jump to today's week, new start: ${newStart.toLocaleDateString("en-CA")}, selected today: ${todayString}`,
    );
  };

  // Check if selected date is today's date
  const isSelectedDateToday = () => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    return selectedDate === today;
  };

  const handleDateClick = (date: string, dayIndex: number) => {
    // Set local state immediately for instant visual feedback
    setLocalSelectedDate(date);

    // Then notify parent component
    onDateSelect(date);
  };

  return (
    <div className="bg-gray-950 py-3">
      {/* Calendar strip with navigation - matching the reference image exactly */}
      <div className="flex items-center justify-between px-4">
        {/* Previous week button */}
        <button
          onClick={goToPreviousWeek}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>

        {/* Days horizontal strip */}
        <div className="flex items-center justify-center gap-3">
          {days.map((day, index) => {
            const status = getDayCompletionStatus(index);
            const isSelected = day.date === localSelectedDate;
            const isLoading = status.isLoading;
            const today = new Date();
            const isFuture = new Date(day.date) > today;

            return (
              <button
                key={day.date}
                onClick={() => handleDateClick(day.date, index)}
                className="flex flex-col items-center transition-all duration-200 cursor-pointer"
              >
                {/* Day letter */}
                <div className="text-xs font-normal text-gray-400 mb-0.5">
                  {day.dayLabel}
                </div>

                {/* Date number with selection indicator - exactly matching reference */}
                <div className="relative">
                  {isSelected ? (
                    /* Selected date - blue circle with white text */
                    <div className="bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center">
                      <span className="text-white font-medium text-xs">
                        {day.displayNumber}
                      </span>
                    </div>
                  ) : (
                    /* Unselected dates - light gray circle with gray text */
                    <div className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center">
                      <span className="text-gray-400 font-normal text-xs">
                        {day.displayNumber}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Next week button */}
        <button
          onClick={goToNextWeek}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
