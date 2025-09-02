import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Plus,
  Share2,
  Users,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Check,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CreateOrEditItemModal } from "@/components/CreateOrEditItemModal";
import { PhotoVerificationModal } from "@/components/PhotoVerificationModal";
import { SlideUpDrawer } from "@/components/SlideUpDrawer";
import { ItemStreakBadge } from "@/components/ItemStreakBadge";
import { WeekCalendarStrip } from "@/components/WeekCalendarStrip";
import { useAuth } from "@/contexts/AuthContext";

interface ItemData {
  id: string;
  display_id?: string;
  title: string;
  item_type: string;
  recurrence_type?: string;
  custom_recurrence?: string;
  due_date?: string;
  time_frame?: number;
  time_of_day?: string;
  verify_required?: boolean;
  is_chore?: boolean;
  why_it_matters?: string;
  created_at: string;
  completed_at?: string;
  status?: string;
  shared_with_me?: boolean;
  shared_by_name?: string;
  is_completed_for_date?: boolean;
  completion_date?: string;
  created_by?: string;
  assigned_to?: string;
  shared_with?: string[];
  ai_verification_result?: string;
  occurrence_date?: string;
  is_recurring?: boolean;
  streak_count?: number; // Add streak data if available from backend
}

interface TodayData {
  date: string;
  tasks: ItemData[];
  habits: ItemData[];
  goals: ItemData[];
  projects: ItemData[];
}

interface TodayResponse {
  success: boolean;
  today: TodayData;
}

export default function Today() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);
  const [verifyingItem, setVerifyingItem] = useState<ItemData | null>(null);
  const [sharingItem, setSharingItem] = useState<ItemData | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<string>("");
  const [shareVisibility, setShareVisibility] = useState<string>("community");
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("habits");
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  // Calendar date selection state
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD format
  );

  // Component mount effect
  useEffect(() => {
    // console.log(`🔄 MOUNT: Today component mounted`);
  }, []);

  // Handle date selection - React Query will automatically fetch new data
  const handleDateSelect = (date: string) => {
    console.log(
      `📅 TODAY PAGE: Date selected: ${date}, previous: ${selectedDate}`,
    );

    // Only update if date actually changed
    if (date !== selectedDate) {
      setSelectedDate(date);
      console.log(`📅 TODAY PAGE: Date changed, updated to: ${date}`);
    } else {
      console.log(`📅 TODAY PAGE: Same date selected, no action needed`);
    }
  };

  // Add effect to track selectedDate changes
  useEffect(() => {
    console.log(`🔍 EFFECT: selectedDate changed to: ${selectedDate}`);
  }, [selectedDate]);

  // Simple completion mutation without complex optimistic updates
  const completionMutation = useMutation({
    mutationFn: async ({
      item,
      checked,
      completionDate,
    }: {
      item: ItemData;
      checked: boolean;
      completionDate: string;
    }) => {
      const endpoint = checked
        ? `/api/item/${item.id}/complete`
        : `/api/item/${item.id}/completions/${completionDate}`;
      const method = checked ? "POST" : "DELETE";
      const body = checked
        ? JSON.stringify({ completion_date: completionDate })
        : undefined;

      console.log(`🚀 COMPLETION REQUEST: ${method} ${endpoint}`);
      return apiRequest(endpoint, { method, body });
    },
    onError: (err, { item }) => {
      console.error("Completion error:", err);
      // Remove item from loading state
      setLoadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      toast({
        title: "Error",
        description: `Failed to update ${item.title}`,
        variant: "destructive",
      });
    },
    onSuccess: async (data, { item, checked }) => {
      // Remove item from loading state
      setLoadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });

      // FIXED: Use specific cache key invalidation like other working mutations
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/today/personal-progress", selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/today/shared", selectedDate],
        }),
      ]);

      // Show success feedback
      if (checked) {
        toast({
          title: "Success",
          description: `${item.title} completed!`,
        });
      }
    },
  });

  // Fetch personal progress items for selected date - assignment-based filtering
  const {
    data: personalProgressData,
    isLoading: isLoadingPersonal,
    isFetching: isFetchingPersonal,
  } = useQuery({
    queryKey: ["/api/today/personal-progress", selectedDate],
    queryFn: async () => {
      console.log(
        `🔍 FRONTEND API CALL: Sending request to /api/today/personal-progress?date=${selectedDate}`,
      );
      const response = await apiRequest(
        `/api/today/personal-progress?date=${selectedDate}`,
      );
      console.log(
        `🔍 FRONTEND RESPONSE: Received personal progress data for date ${selectedDate}:`,
        response,
      );
      console.log(
        `🔍 FRONTEND RESPONSE: Personal progress items - Tasks: ${response?.tasks?.length || 0}, Habits: ${response?.habits?.length || 0}, Goals: ${response?.goals?.length || 0}, Projects: ${response?.projects?.length || 0}`,
      );

      return response;
    },
    staleTime: 0, // Always considered stale for freshness
    gcTime: 60 * 1000, // Keep in cache for 1 minute
    refetchOnWindowFocus: false, // Disable to prevent race conditions
    refetchOnMount: true, // Fetch fresh data on mount
    refetchOnReconnect: false, // Disable automatic refetch
    refetchInterval: false, // No background refetch
    enabled: !!selectedDate,
  });

  // DEBUG: Log the actual data structure we're getting from the API
  console.log("🔍 DEBUG: Personal progress data:", personalProgressData);

  // Fetch shared items for selected date - items shared with user but not assigned to them
  const {
    data: sharedData,
    isLoading: isLoadingShared,
    isFetching: isFetchingShared,
  } = useQuery({
    queryKey: ["/api/today/shared", selectedDate],
    queryFn: async () => {
      console.log(
        `🔍 FRONTEND API CALL: Sending request to /api/today/shared?date=${selectedDate}`,
      );
      const response = await apiRequest(
        `/api/today/shared?date=${selectedDate}`,
      );
      console.log(
        `🔍 FRONTEND RESPONSE: Received shared data for date ${selectedDate}:`,
        response,
      );
      console.log(
        `🔍 FRONTEND RESPONSE: Shared items - Tasks: ${response?.tasks?.length || 0}, Habits: ${response?.habits?.length || 0}, Goals: ${response?.goals?.length || 0}, Projects: ${response?.projects?.length || 0}`,
      );

      return response;
    },
    staleTime: 0, // Always considered stale for freshness
    gcTime: 60 * 1000, // Keep in cache for 1 minute
    refetchOnWindowFocus: false, // Disable to prevent race conditions
    refetchOnMount: true, // Fetch fresh data on mount
    refetchOnReconnect: false, // Disable automatic refetch
    refetchInterval: false, // No background refetch
    enabled: !!selectedDate,
  });

  // Combine loading states and create combined data structure for existing UI
  const isLoading = isLoadingPersonal || isLoadingShared;
  const isFetching = isFetchingPersonal || isFetchingShared;

  // Create a combined todayData object that matches the existing UI expectations
  const todayData = useMemo(() => {
    if (!personalProgressData && !sharedData) return null;

    // Personal progress data will be used for Habits and Focus tabs
    const personalData = personalProgressData || {
      tasks: [],
      habits: [],
      goals: [],
      projects: [],
    };

    // Shared data will be used for Shared tab
    const combinedSharedData = sharedData || {
      tasks: [],
      habits: [],
      goals: [],
      projects: [],
    };

    // For backward compatibility, return personal data as the main data
    // The shared data will be accessed separately for the Shared tab
    return personalData;
  }, [personalProgressData, sharedData]);

  // Never show loading screen for date changes to eliminate refresh appearance
  const showLoading = false;

  // console.log(
  //   `🔍 RENDER: Current selectedDate state: ${selectedDate}, showLoading: ${showLoading}`,
  // );

  // Helper function to get community member name
  const getCommunityMemberName = (userId: string) => {
    const communitiesData = communities as any;
    if (!communitiesData?.communities) return "Unknown User";

    for (const community of communitiesData.communities) {
      if (community.members) {
        const member = community.members.find((m: any) => m.user_id === userId);
        if (member) {
          return (
            member.display_name ||
            member.username ||
            member.email ||
            "Unknown User"
          );
        }
      }
    }
    return "Unknown User";
  };

  // Group shared items by assignee with completion progress
  const groupSharedItemsByAssignee = (items: ItemData[]) => {
    const groups: {
      [key: string]: {
        assignee: string;
        items: ItemData[];
        completedCount: number;
        totalCount: number;
        percentage: number;
      };
    } = {};

    items.forEach((item) => {
      if (item.assigned_to) {
        const assigneeId = item.assigned_to;
        const assigneeName = getCommunityMemberName(assigneeId);

        if (!groups[assigneeId]) {
          groups[assigneeId] = {
            assignee: assigneeName,
            items: [],
            completedCount: 0,
            totalCount: 0,
            percentage: 0,
          };
        }

        groups[assigneeId].items.push(item);
        groups[assigneeId].totalCount++;

        if (isItemCompleted(item)) {
          groups[assigneeId].completedCount++;
        }

        groups[assigneeId].percentage =
          groups[assigneeId].totalCount > 0
            ? Math.round(
                (groups[assigneeId].completedCount /
                  groups[assigneeId].totalCount) *
                  100,
              )
            : 0;
      }
    });

    return Object.values(groups).sort((a, b) => b.percentage - a.percentage); // Sort by completion percentage desc
  };

  // Fetch user communities for sharing
  const { data: communities } = useQuery({
    queryKey: ["/api/community"],
    staleTime: 5 * 60 * 1000, // 5 minutes - matches insights page pattern
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
  });

  // Get all items as a flat array
  const allItems = useMemo(() => {
    // Handle both old and new API response formats
    const data = todayData?.today || (todayData as any);
    if (!data) return [];

    const items = [
      ...(data.tasks || []),
      ...(data.habits || []),
      ...(data.goals || []),
      ...(data.projects || []),
    ];

    return items;
  }, [todayData]);

  // Filter items based on active tab - using separate endpoints for performance
  const filteredItems = useMemo(() => {
    if (!user?.uid) return [];

    if (activeTab === "habits") {
      // Show habits assigned to the user from personal progress data
      const habitsFromPersonal = personalProgressData?.habits || [];
      return habitsFromPersonal.filter((item) => item.assigned_to === user.uid);
    }
    if (activeTab === "focus") {
      // Show tasks, goals, projects assigned to the user from personal progress data
      const focusItems = [
        ...(personalProgressData?.tasks || []),
        ...(personalProgressData?.goals || []),
        ...(personalProgressData?.projects || []),
      ];
      return focusItems.filter((item) => item.assigned_to === user.uid);
    }
    if (activeTab === "shared") {
      // Use shared data endpoint for shared items - exclude habits as they are not shareable
      if (!sharedData) return [];

      return [
        ...(sharedData.tasks || []),
        // habits are filtered out at backend level - they don't appear in shared sections
        ...(sharedData.goals || []),
        ...(sharedData.projects || []),
      ];
    }
    return allItems;
  }, [allItems, activeTab, user?.uid, sharedData]);

  //console.log("Filtered items:", filteredItems);

  // Helper functions for filter status indicators
  const getFilterStatus = (filterType: string) => {
    let categoryItems: ItemData[] = [];

    if (filterType === "habits") {
      categoryItems = allItems.filter(
        (item) => item.item_type === "habit" && item.assigned_to === user?.uid,
      );
    } else if (filterType === "focus") {
      categoryItems = allItems.filter(
        (item) =>
          (item.item_type === "task" ||
            item.item_type === "goal" ||
            item.item_type === "project") &&
          item.assigned_to === user?.uid,
      );
    } else if (filterType === "shared") {
      // Use shared data endpoint for shared items count - exclude habits as they are not shareable
      if (!sharedData) {
        categoryItems = [];
      } else {
        categoryItems = [
          ...(sharedData.tasks || []),
          // habits are filtered out at backend level - they don't appear in shared sections
          ...(sharedData.goals || []),
          ...(sharedData.projects || []),
        ];
      }
    }

    const incompleteCount = categoryItems.filter(
      (item) => !isItemCompleted(item) && !(item as any).is_skipped_for_date,
    ).length;

    const isAllComplete = categoryItems.length > 0 && incompleteCount === 0;

    return { incompleteCount, isAllComplete, totalCount: categoryItems.length };
  };

  // Get combined or tab-specific progress data for progress line
  const getTabProgress = (tabId: string) => {
    // For Habits and Focus tabs, combine progress
    if (tabId === "habits" || tabId === "focus") {
      // Get all personal items (habits + focus items)
      const habitsFromPersonal = personalProgressData?.habits || [];
      const habitsAssignedToUser = habitsFromPersonal.filter((item) => item.assigned_to === user?.uid);
      
      const focusItems = [
        ...(personalProgressData?.tasks || []),
        ...(personalProgressData?.goals || []),
        ...(personalProgressData?.projects || []),
      ];
      const focusAssignedToUser = focusItems.filter((item) => item.assigned_to === user?.uid);
      
      // Combine all personal items (habits + focus)
      const allPersonalItems = [...habitsAssignedToUser, ...focusAssignedToUser];
      
      const incompleteCount = allPersonalItems.filter(
        (item) => !isItemCompleted(item) && !(item as any).is_skipped_for_date
      ).length;
      
      const completedCount = allPersonalItems.length - incompleteCount;
      const progressPercentage =
        allPersonalItems.length > 0 ? (completedCount / allPersonalItems.length) * 100 : 0;
      
      // Use a unified color for combined progress
      return {
        completed: completedCount,
        total: allPersonalItems.length,
        percentage: progressPercentage,
        color: "from-blue-500 to-purple-600", // Gradient combining both colors
      };
    }
    
    // For Shared tab, calculate separately
    if (tabId === "shared") {
      const status = getFilterStatus(tabId);
      const completedCount = status.totalCount - status.incompleteCount;
      const progressPercentage =
        status.totalCount > 0 ? (completedCount / status.totalCount) * 100 : 0;
      
      return {
        completed: completedCount,
        total: status.totalCount,
        percentage: progressPercentage,
        color: "from-gray-500 to-gray-600",
      };
    }
    
    // Default fallback
    const status = getFilterStatus(tabId);
    const completedCount = status.totalCount - status.incompleteCount;
    const progressPercentage =
      status.totalCount > 0 ? (completedCount / status.totalCount) * 100 : 0;
    
    return {
      completed: completedCount,
      total: status.totalCount,
      percentage: progressPercentage,
      color: "from-blue-500 to-blue-600",
    };
  };

  // Format time for display
  const formatTimeFrame = (minutes?: number) => {
    if (!minutes) return "No estimate";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  };

  // Format selected date
  const formatDate = () => {
    // Parse YYYY-MM-DD format correctly to avoid timezone issues
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    // console.log(
    //   `📅 FORMAT DATE: selectedDate="${selectedDate}" -> parsed date="${date.toLocaleDateString()}", formatted="${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}"`,
    // );
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  // Format time for display
  const formatTime = (item: ItemData) => {
    if (item.due_date) {
      const dueDate = new Date(item.due_date);
      return dueDate.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return null; // Don't show "No estimate" - just show nothing if no time
  };

  // Format due time for new card design
  const formatDueTime = (item: ItemData) => {
    if (item.due_date) {
      const dueDate = new Date(item.due_date);
      return dueDate.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return null;
  };

  // New design card component matching the reference image
  const renderNewDesignItem = (item: ItemData, index: number) => {
    const isCompleted = isItemCompleted(item);
    const isSkipped = (item as any).is_skipped_for_date;
    const isLoading = loadingItems.has(item.id);

    return (
      <div
        key={item.id}
        className="bg-gray-800 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:bg-gray-750"
        onClick={() => setEditingItem(item)}
      >
        <div className="flex items-center justify-between">
          {/* Left side: Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm mb-1">
              {item.title}
            </h3>

            {/* Metadata row */}
            <div className="flex items-center gap-3 text-xs">
              {/* Streak indicator - calculate for all recurring items */}
              {(() => {
                const streakCount = calculateStreak(item);
                return streakCount > 0 ? (
                  <div className="flex items-center gap-1">
                    <span className="text-orange-500">🔥</span>
                    <span className="text-orange-500 font-medium">
                      {streakCount} day streak
                    </span>
                  </div>
                ) : null;
              })()}

              {/* Photo verification indicator */}
              {item.verify_required && (
                <div className="flex items-center gap-1">
                  <span className="text-blue-400">📸</span>
                  <span className="text-blue-400">View photos</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Status indicator */}
          <div
            className="flex items-center ml-3"
            onClick={(e) => e.stopPropagation()}
          >
            {item.verify_required && !isCompleted ? (
              <button
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center transition-all hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setVerifyingItem(item);
                }}
              >
                <Camera className="h-4 w-4 text-white" />
              </button>
            ) : (
              <button
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-accent-primary border-accent-primary hover:bg-accent-hover"
                    : "border-gray-500 bg-transparent hover:border-gray-400"
                } ${isLoading ? "opacity-75 cursor-not-allowed" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemCompletion(item, !isCompleted);
                }}
                disabled={isSkipped || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  isCompleted && <Check className="h-4 w-4 text-white" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Group items by time categories using time_of_day field - exclude completed items
  const groupItemsByTime = (items: ItemData[]) => {
    console.log(
      `🕒 TIME_OF_DAY FRONTEND DEBUG: Grouping ${items.length} items:`,
    );
    items.forEach((item) => {
      console.log(
        `  - "${item.title}": time_of_day="${item.time_of_day}" (type: ${typeof item.time_of_day}), completed: ${isItemCompleted(item)}`,
      );
    });

    // Filter out completed items so they only appear in Done section
    const incompleteItems = items.filter((item) => !isItemCompleted(item));

    const morning = incompleteItems.filter(
      (item) => item.time_of_day === "morning",
    );
    const afternoon = incompleteItems.filter(
      (item) => item.time_of_day === "afternoon",
    );
    const anytime = incompleteItems.filter(
      (item) =>
        item.time_of_day === undefined ||
        item.time_of_day === null ||
        item.time_of_day === "anytime",
    );

    console.log(`🕒 TIME_OF_DAY FRONTEND DEBUG: Grouping results:`, {
      total_items: items.length,
      incomplete_items: incompleteItems.length,
      completed_items: items.length - incompleteItems.length,
      morning: morning.length,
      afternoon: afternoon.length,
      anytime: anytime.length,
    });

    // DEBUG: Show which items went to each group
    console.log(`🕒 TIME_OF_DAY FRONTEND DEBUG: Group contents:`);
    console.log(
      "  Morning:",
      morning.map((i) => `"${i.title}" (${i.time_of_day})`),
    );
    console.log(
      "  Afternoon:",
      afternoon.map((i) => `"${i.title}" (${i.time_of_day})`),
    );
    console.log(
      "  Anytime:",
      anytime.map((i) => `"${i.title}" (${i.time_of_day})`),
    );

    return { morning, afternoon, anytime };
  };

  // Render time-based sections
  const renderTimeBasedSections = () => {
    const timeGroups = groupItemsByTime(filteredItems);
    const sections = [
      {
        key: "morning",
        label: "Morning",
        icon: "🌅",
        items: timeGroups.morning,
      },
      {
        key: "afternoon",
        label: "Afternoon",
        icon: "☀️",
        items: timeGroups.afternoon,
      },
      {
        key: "anytime",
        label: "Anytime",
        icon: "⏰",
        items: timeGroups.anytime,
      },
    ];

    return sections
      .filter((section) => section.items.length > 0)
      .map((section) => (
        <div key={section.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-xs">{section.icon}</span>
            </div>
            <h2 className="text-white font-medium text-base">
              {section.label}
            </h2>
          </div>
          <div className="space-y-2">
            {section.items.map((item, index) =>
              renderNewDesignItem(item, index),
            )}
          </div>
        </div>
      ));
  };

  // Render assignment-based sections for shared items
  const renderAssignmentSections = () => {
    const sharedGroups = groupSharedItemsByAssignee(filteredItems);

    return sharedGroups.map((group, groupIndex) => {
      // Filter out completed items from the group for display in the main section
      const incompleteItems = group.items.filter(item => !isItemCompleted(item));
      
      // Skip this group if all items are completed (they'll show in Done section)
      if (incompleteItems.length === 0) {
        return null;
      }
      
      return (
        <div key={`group-${groupIndex}`} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {group.assignee.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-white font-semibold">
                  Assigned to {group.assignee}
                </h2>
                <p className="text-gray-400 text-sm">
                  {group.completedCount}/{group.totalCount} complete •{" "}
                  {group.percentage}%
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {incompleteItems.map((item, index) => renderNewDesignItem(item, index))}
          </div>
        </div>
      );
    }).filter(Boolean); // Remove null entries
  };

  // Keep original render function for backwards compatibility
  const renderNewItem = renderNewDesignItem;

  // Helper function to check if item is completed
  const isItemCompleted = (item: any) => {
    // DEBUG: Log completion check for debugging
    if (
      item.title?.includes("Test check box") ||
      item.title?.includes("Test recur")
    ) {
      // console.log(
      //   `🔍 COMPLETION CHECK: ${item.title} (${item.occurrence_date}) - status: ${item.status}, completed_at: ${item.completed_at}, is_recurring: ${item.is_recurring}`,
      // );
    }

    // PRIMARY: Check status='complete' first for all items (covers AI verification)
    if (item.status === "complete" || item.status === "completed") {
      return true;
    }

    // For recurring items (check both old and new architecture fields)
    if (
      item.is_recurring ||
      (item.recurrence_type && item.recurrence_type !== "once")
    ) {
      return item.is_completed_for_date;
    }

    // For one-time items, check additional completion indicators
    return !!(
      item.completed_at ||
      (item.verified && item.ai_verification_result === "complete")
    );
  };

  // Calculate streak for recurring items (habits, tasks, goals, projects)
  const calculateStreak = (item: ItemData) => {
    // Only calculate streaks for recurring items (habits, tasks, goals, projects)
    if (
      !item.is_recurring &&
      (!item.recurrence_type || item.recurrence_type === "once")
    ) {
      return 0;
    }

    // Check if this item is completed today
    const isCompletedToday =
      (item as any).is_completed_for_date === true ||
      item.status === "completed" ||
      item.status === "complete";

    if (isCompletedToday) {
      // For now, return 1 if completed today
      // This can be enhanced to calculate actual historical streaks
      return 1;
    }

    return 0;
  };

  // Calculate overall streak (for the yellow circle)
  const getOverallStreak = () => {
    if (!personalProgressData) {
      return 0;
    }

    // Count completed habits for today
    const allHabits = personalProgressData.habits || [];
    const completedHabits = allHabits.filter((habit) => {
      // Use the correct completion field from the data structure
      const completed =
        habit.is_completed_for_date === true ||
        habit.status === "completed" ||
        habit.status === "complete";
      return completed;
    });

    // Return the count of completed habits today
    // This will show 0 if no habits are completed, or the actual count
    return completedHabits.length;
  };

  // Share item mutation
  const shareItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      communityId,
      visibility,
    }: {
      itemId: string;
      communityId: string;
      visibility: string;
    }) => {
      return await apiRequest(`/api/item/${itemId}/share`, {
        method: "POST",
        body: JSON.stringify({ community_id: communityId, visibility }),
      });
    },
    onSuccess: () => {
      // FIX: Invalidate specific cache keys instead of broad patterns
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/today/personal-progress", selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/today/shared", selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/community"],
        }),
      ]);

      toast({ title: "Success", description: "Item shared successfully!" });
      setSharingItem(null);
      setSelectedCommunity("");
      setShareVisibility("community");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to share item",
        variant: "destructive",
      });
    },
  });

  const handleManualRefresh = useCallback(async () => {
    console.log("🔄 MANUAL REFRESH: Force refreshing all data");

    await Promise.all([
      queryClient.refetchQueries({
        queryKey: ["/api/today/personal-progress", selectedDate],
      }),
      queryClient.refetchQueries({
        queryKey: ["/api/today/shared", selectedDate],
      }),
    ]);
  }, [selectedDate]);

  // 5. FIX: Add effect to handle date changes more reliably
  useEffect(() => {
    console.log(
      `📅 DATE CHANGE EFFECT: selectedDate changed to: ${selectedDate}`,
    );

    // Small delay to ensure React Query has time to process the change
    const timeoutId = setTimeout(() => {
      handleManualRefresh();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedDate, handleManualRefresh]);

  // Handle item completion with immediate server update
  const handleItemCompletion = async (item: ItemData, checked: boolean) => {
    console.log(
      `🔥 COMPLETION CLICK: ${item.title} (${item.id}), checked: ${checked}, verify_required: ${item.verify_required}`,
    );

    // Add item to loading state
    setLoadingItems((prev) => new Set([...prev, item.id]));

    const needsVerification =
      item.verify_required || item.title.toLowerCase().includes("verify");

    if (
      checked &&
      needsVerification &&
      !item.is_completed_for_date &&
      !item.completed_at
    ) {
      setVerifyingItem(item);
      // Remove from loading state since we're opening verification modal
      setLoadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      return;
    }

    const completionDate = item.occurrence_date || selectedDate;

    // Execute mutation immediately - no batching delay
    completionMutation.mutate({
      item,
      checked,
      completionDate,
    });
  };

  // Render individual item with enhanced mobile design
  const renderItem = (item: ItemData) => {
    const isSkipped = (item as any).is_skipped_for_date;
    const itemClasses = isSkipped
      ? "bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4 border-l-4 border-gray-300 dark:border-gray-500 opacity-75 gpu-accelerated transition-all duration-150 hover:scale-[1.02] hover:shadow-md shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
      : "bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border-l-4 border-gray-200 dark:border-gray-600 gpu-accelerated transition-all duration-150 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]";

    return (
      <div key={item.id} data-item-id={item.id} className={itemClasses}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Item content */}
            <div
              className="flex-1 cursor-pointer"
              onClick={() => setEditingItem(item)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                      {item.title}
                    </h3>
                    {/* Verification status badges */}
                    {item.verify_required && (
                      <>
                        {(item.status === "completed" ||
                          item.status === "complete") && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                        {item.status === "pending_manual_review" && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center"
                          >
                            <span className="text-red-600 font-bold mr-1">
                              !
                            </span>
                            Pending
                          </Badge>
                        )}
                        {(!item.status ||
                          (item.status !== "completed" &&
                            item.status !== "complete" &&
                            item.status !== "pending_manual_review")) &&
                          (item.ai_verification_result === "not_complete" ||
                            item.ai_verification_result === "unclear") && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                            >
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        {(!item.status ||
                          (item.status !== "completed" &&
                            item.status !== "complete" &&
                            item.status !== "pending_manual_review")) &&
                          !item.ai_verification_result && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              <Camera className="w-3 h-3 mr-1" />
                              Photo Required
                            </Badge>
                          )}
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.shared_with_me
                      ? `Shared by ${item.shared_by_name || "Someone"}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTime(item)}
                  </span>

                  {/* Share button - only show for user's own items */}
                  {!item.shared_with_me &&
                    communities &&
                    Array.isArray((communities as any)?.communities) &&
                    (communities as any).communities.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 hover:scale-110"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharingItem(item);
                        }}
                      >
                        <Share2 className="h-4 w-4 text-gray-500 dark:text-gray-400 transition-colors duration-150" />
                      </Button>
                    )}

                  {/* Completion status - checkbox for regular items, camera for verify_required */}
                  <div
                    className="flex items-center justify-center w-10 h-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.verify_required && !isItemCompleted(item) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-10 w-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm gpu-accelerated transition-all duration-150 hover:scale-110 hover:border-blue-400 dark:hover:border-blue-500 active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVerifyingItem(item);
                        }}
                      >
                        <Camera className="h-5 w-5 text-gray-600 dark:text-gray-400 gpu-accelerated transition-colors duration-150" />
                      </Button>
                    ) : (
                      <div className="h-10 w-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center gpu-accelerated">
                        <Checkbox
                          checked={isItemCompleted(item)}
                          onCheckedChange={(checked) => {
                            handleItemCompletion(item, !!checked);
                          }}
                          disabled={
                            isSkipped ||
                            (item.verify_required && isItemCompleted(item))
                          }
                          className={`h-4 w-4 rounded-full border-2 gpu-accelerated transition-all duration-150 active:scale-90 ${
                            isItemCompleted(item)
                              ? "border-green-500 bg-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              : isSkipped
                                ? "border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-600"
                                : "border-gray-400 dark:border-gray-500 bg-transparent"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (showLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto p-4">
          <div className="text-center py-8">Loading your day...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="w-full max-w-sm mx-auto bg-gray-950 min-h-screen text-white">
        {/* Header with Day Name and Date - Clickable to toggle calendar */}
        <div className="pt-10 px-4 pb-4">
          <div
            className="flex flex-col items-center justify-center mb-4 cursor-pointer hover:bg-gray-800 rounded-lg py-2 px-4 transition-colors duration-200"
            onClick={() => setIsCalendarVisible(!isCalendarVisible)}
          >
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white mb-1">
                {(() => {
                  const [year, month, day] = selectedDate.split("-").map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString("en-US", {
                    weekday: "long",
                  });
                })()}
              </h1>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  isCalendarVisible ? "rotate-180" : ""
                }`}
              />
            </div>
            <p className="text-gray-400 text-sm">
              {(() => {
                const [year, month, day] = selectedDate.split("-").map(Number);
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
              })()}
            </p>
          </div>
        </div>

        {/* 7-Day Calendar Strip - Collapsible */}
        {isCalendarVisible && (
          <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </div>
        )}

        {/* Progress indicator - Combined for Habits/Focus, separate for Shared */}
        <div className="px-4 mb-6">
          <div className="text-right">
            <span className="text-gray-400 text-sm">
              {(() => {
                // Use combined progress for Habits and Focus tabs
                const progressKey = (activeTab === "habits" || activeTab === "focus") ? "habits" : activeTab;
                return `${getTabProgress(progressKey).completed}/${getTabProgress(progressKey).total}`;
              })()}
            </span>
          </div>
        </div>

        {/* Dynamic progress line - Combined for Habits/Focus */}
        <div className="px-4 mb-4">
          <div className="h-0.5 w-full bg-gray-600 rounded-full relative">
            <div
              className={`h-0.5 bg-gradient-to-r ${(() => {
                // Use combined progress for Habits and Focus tabs
                const progressKey = (activeTab === "habits" || activeTab === "focus") ? "habits" : activeTab;
                return getTabProgress(progressKey).color;
              })()} rounded-full absolute left-0 transition-all duration-300 ease-in-out`}
              style={{ width: `${(() => {
                // Use combined progress for Habits and Focus tabs
                const progressKey = (activeTab === "habits" || activeTab === "focus") ? "habits" : activeTab;
                return getTabProgress(progressKey).percentage;
              })()}%` }}
            ></div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-6">
          <div className="flex gap-3 justify-center">
            {[
              { id: "habits", label: "Habits", icon: "🔄" },
              { id: "focus", label: "Focus", icon: "🎯" },
              { id: "shared", label: "Shared", icon: "👥" },
            ].map((tab) => {
              const status = getFilterStatus(tab.id);
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium ${
                    isActive
                      ? "bg-accent-primary text-white"
                      : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {status.totalCount > 0 && status.incompleteCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] h-4 flex items-center justify-center font-bold leading-none">
                      {status.incompleteCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-4 pb-20">
          {/* Time-based sections for habits and focus */}
          {(activeTab === "habits" || activeTab === "focus") && (
            <div className="space-y-6">{renderTimeBasedSections()}</div>
          )}

          {/* Assignment-based sections for shared */}
          {activeTab === "shared" && (
            <div className="space-y-6">{renderAssignmentSections()}</div>
          )}

          {/* Done Section */}
          {filteredItems.some((item) => isItemCompleted(item)) && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <span className="text-green-400 text-base">✓</span>
                <span className="text-white font-medium text-sm">Done</span>
                <span className="text-gray-400 text-xs ml-auto">
                  {filteredItems.filter((item) => isItemCompleted(item)).length}{" "}
                  completed
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-gray-400 transition-transform ${
                    showCompleted ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showCompleted && (
                <div className="space-y-2">
                  {filteredItems
                    .filter((item) => isItemCompleted(item))
                    .map((item, index) => (
                      <div key={item.id} className="opacity-60">
                        {renderNewDesignItem(item, index)}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="text-gray-400 text-lg">
                No items for {activeTab} today
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <SlideUpDrawer open={showMenuDrawer} onOpenChange={setShowMenuDrawer} />
        {editingItem && (
          <CreateOrEditItemModal
            item={editingItem as any}
            isOpen={!!editingItem}
            onOpenChange={(open) => !open && setEditingItem(null)}
            onSuccess={() => {
              console.log(
                "🔄 TODAY: Item modal success, forcing comprehensive refresh",
              );

              // 1. Force refresh of all Today page data
              handleManualRefresh();

              // 2. Calculate and invalidate current week specifically
              const today = new Date();
              const dayOfWeek = today.getDay();
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() - dayOfWeek);
              const startDateString = startOfWeek.toISOString().split("T")[0];

              // 3. Comprehensive week query invalidation
              queryClient.removeQueries({
                predicate: (query) => {
                  const key = query.queryKey[0] as string;
                  return key === "/api/today/personal-progress/week";
                },
              });

              // 4. Force immediate refetch of week data
              queryClient.refetchQueries({
                queryKey: [
                  "/api/today/personal-progress/week",
                  startDateString,
                ],
              });

              console.log(
                `✅ TODAY: Forced refresh complete for week starting ${startDateString}`,
              );
            }}
          />
        )}
        {verifyingItem && (
          <PhotoVerificationModal
            item={verifyingItem as any}
            open={!!verifyingItem}
            onOpenChange={(open) => !open && setVerifyingItem(null)}
            onVerificationComplete={(verified: boolean) => {
              setVerifyingItem(null);
              queryClient.invalidateQueries({ queryKey: ["/api/today"] });
              queryClient.invalidateQueries({ queryKey: ["items"] });
              if (verified) {
                toast({ title: "Task verified successfully!" });
              }
            }}
          />
        )}

        {/* Sharing Modal */}
        {sharingItem && (
          <Dialog
            open={!!sharingItem}
            onOpenChange={(open) => !open && setSharingItem(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share Task</DialogTitle>
                <DialogDescription>
                  Share "{sharingItem.title}" with your community for
                  collaboration and support.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Community</Label>
                  <Select
                    value={selectedCommunity}
                    onValueChange={setSelectedCommunity}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a community" />
                    </SelectTrigger>
                    <SelectContent>
                      {(communities as any)?.communities?.map(
                        (community: any) => (
                          <SelectItem key={community.id} value={community.id}>
                            {community.name}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select
                    value={shareVisibility}
                    onValueChange={setShareVisibility}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="community">
                        Visible to all community members
                      </SelectItem>
                      <SelectItem value="admins">
                        Visible to community admins only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSharingItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      shareItemMutation.mutate({
                        itemId: sharingItem.id,
                        communityId: selectedCommunity,
                        visibility: shareVisibility,
                      })
                    }
                    disabled={!selectedCommunity || shareItemMutation.isPending}
                  >
                    {shareItemMutation.isPending ? "Sharing..." : "Share Task"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
