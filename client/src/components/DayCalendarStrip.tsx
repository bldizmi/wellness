import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemData {
  id: string;
  is_completed_for_date?: boolean;
  status?: string;
  completed_at?: string;
}

interface DayData {
  tasks: ItemData[];
  habits: ItemData[];
  goals: ItemData[];
  projects: ItemData[];
}

interface DayCalendarStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export function DayCalendarStrip({ selectedDate, onDateSelect }: DayCalendarStripProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Generate 7 days around current week with offset
  const days = useMemo(() => {
    const baseDate = new Date(); // User's local timezone
    const weekOffsetDays = weekOffset * 7;
    
    return Array.from({ length: 7 }, (_, i) => {
      // Calculate day offset: 5 days before center + index + week offset (to include June 21st)
      const dayOffset = weekOffsetDays - 5 + i;
      
      // Create date string directly to avoid timezone conversion issues
      const baseYear = baseDate.getFullYear();
      const baseMonth = baseDate.getMonth();
      const baseDay = baseDate.getDate();
      
      // Create target date by adding day offset
      const targetDate = new Date(baseYear, baseMonth, baseDay + dayOffset);
      
      // Generate date string directly from components to ensure consistency
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const todayForComparison = new Date();
      const todayString = todayForComparison.toLocaleDateString('en-CA');
      
      console.log(`📅 Calendar date generation: dayOffset=${dayOffset}, targetDate=${targetDate.toISOString()}, dateString=${dateString}`);
      console.log(`📅 Date construction audit: baseYear=${baseYear}, baseMonth=${baseMonth}, baseDay=${baseDay}, final dayOffset=${dayOffset}`);
      console.log(`📅 User will see: ${targetDate.getDate()}, API will receive: ${dateString}`);
      
      return {
        date: dateString, // YYYY-MM-DD format
        display: targetDate.toLocaleDateString('en-US', { 
          weekday: 'narrow',
          day: 'numeric'
        }),
        isToday: dateString === todayString,
        dayOfWeek: targetDate.getDay()
      };
    });
  }, [weekOffset]);

  // Fetch completion data for all visible days
  const dayQueries = days.map(day => 
    useQuery({
      queryKey: ['/api/today', day.date],
      queryFn: () => apiRequest(`/api/today?client_date=${day.date}`),
      staleTime: 1000 * 60 * 5, // 5 minutes for calendar completion status
      retry: 1,
      refetchOnWindowFocus: false
    })
  );

  // Calculate completion status for each day
  const getDayCompletionStatus = (dayIndex: number) => {
    const query = dayQueries[dayIndex];
    if (!query.data?.today) return { completed: 0, total: 0, percentage: 0 };

    const data = query.data.today;
    const allItems = [
      ...(data.tasks || []),
      ...(data.habits || []),
      ...(data.goals || []),
      ...(data.projects || [])
    ];

    const total = allItems.length;
    const completed = allItems.filter(item => 
      item.is_completed_for_date === true || 
      item.status === 'complete' || 
      item.status === 'completed'
    ).length;

    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0
    };
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        {/* Previous week button */}
        <button
          onClick={() => navigateWeek('prev')}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Days strip */}
        <div className="flex items-center space-x-2 flex-1 justify-center">
          {days.map((day, index) => {
            const status = getDayCompletionStatus(index);
            const isSelected = day.date === selectedDate;
            const isLoading = dayQueries[index].isLoading;

            // CRITICAL DEBUG: Log what user sees vs what gets sent
            const displayDate = new Date(day.date).getDate(); // What user sees
            const actualValue = day.date; // What gets sent to API
            
            // DEBUGGING: Log every cell render with click handler status
            console.log(`🔧 RENDER: Calendar cell ${index} - Display: ${displayDate}, Date: ${actualValue}, Key: ${day.date}, Click attached: true`);
            
            return (
              <button
                key={day.date}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`🎯 CELL CLICKED: Day ${displayDate}, Date: ${actualValue}, Index: ${index}`);
                  onDateSelect(day.date);
                }}
                className={cn(
                  "flex flex-col items-center p-2 transition-all duration-200 min-w-[44px] cursor-pointer",
                  "hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg",
                  "border-4 border-red-500 bg-yellow-100 dark:bg-yellow-900" // VISIBLE DEBUGGING BORDERS
                )}
              >
                {/* Day letter */}
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                </div>

                {/* Date with completion ring */}
                <div className="relative flex items-center justify-center">
                  {isLoading ? (
                    <div className="w-8 h-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {displayDate}
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Background circle - dashed by default */}
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                        day.isToday 
                          ? "border-solid border-green-500 bg-green-50 dark:bg-green-900/20" // Green solid ring for today
                          : status.total === 0
                          ? "border-dashed border-gray-300 dark:border-gray-600" // Gray dashed if no items
                          : status.percentage === 100
                          ? "border-solid border-blue-500 bg-blue-50 dark:bg-blue-900/20" // Solid blue if all complete
                          : "border-dashed border-gray-400 dark:border-gray-500", // Dashed if incomplete
                        isSelected && "ring-2 ring-blue-400 ring-offset-1"
                      )}>
                        <span 
                          className={cn(
                            "text-sm font-medium pointer-events-none", // Prevent span from blocking clicks
                            day.isToday 
                              ? "text-green-700 dark:text-green-300"
                              : status.percentage === 100 && status.total > 0
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-600 dark:text-gray-400"
                          )}
                        >
                          {new Date(day.date).getDate()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Next week button */}
        <button
          onClick={() => navigateWeek('next')}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}