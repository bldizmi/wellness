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
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("habits");
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

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
      toast({
        title: "Error",
        description: `Failed to update ${item.title}`,
        variant: "destructive",
      });
    },
    onSuccess: async (data, { item, checked }) => {
      // Simple invalidation - let React Query handle the refetch
      await queryClient.invalidateQueries();

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

  console.log("Personal progress data:", personalProgressData);

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

    return [
      ...(data.tasks || []),
      ...(data.habits || []),
      ...(data.goals || []),
      ...(data.projects || []),
    ];
  }, [todayData]);

  // Filter items based on active tab - using separate endpoints for performance
  const filteredItems = useMemo(() => {
    if (!user?.uid) return [];

    if (activeTab === "habits") {
      // Show habits assigned to the user from personal progress data
      return allItems.filter(
        (item) =>
          item.item_type.toLowerCase() === "habit" &&
          item.assigned_to === user.uid,
      );
    }
    if (activeTab === "focus") {
      // Show tasks, goals, projects assigned to the user from personal progress data
      const focusTypes = ["task", "project", "goal"];
      return allItems.filter(
        (item) =>
          focusTypes.includes(item.item_type.toLowerCase()) &&
          item.assigned_to === user.uid,
      );
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

  // Simplified card design
  const renderNewItem = (item: ItemData, index: number) => {
    const isCompleted = isItemCompleted(item);
    const isSkipped = (item as any).is_skipped_for_date;
    const dueTime = formatDueTime(item);

    return (
      <div
        key={item.id}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:dark:shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-all duration-150 hover:scale-[1.02] cursor-pointer"
        onClick={() => setEditingItem(item)}
      >
        <div className="flex items-center justify-between">
          {/* Left side: Title and due time */}
          <div className="flex-1 min-w-0">
            <h3
              className={`text-base font-medium truncate ${
                isCompleted
                  ? "text-gray-400 dark:text-gray-500 line-through"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {item.title}
            </h3>
            {item.created_by !== user?.uid && item.created_by && (
              <p className="text-xs italic text-gray-400 dark:text-gray-500 mt-1">
                created by {getCommunityMemberName(item.created_by)}
              </p>
            )}
            {dueTime && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {dueTime}
              </p>
            )}
          </div>

          {/* Right side: Completion status */}
          <div
            className="flex items-center ml-3"
            onClick={(e) => e.stopPropagation()}
          >
            {item.verify_required && !isCompleted ? (
              <Button
                variant="ghost"
                size="sm"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-150 hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setVerifyingItem(item);
                }}
              >
                <Camera className="h-6 w-6 text-blue-600 dark:text-blue-400 transition-transform duration-150" />
              </Button>
            ) : (
              <button
                className={`p-2 rounded-lg transition-all duration-150 hover:scale-110 ${
                  isCompleted
                    ? "text-white bg-blue-600 hover:bg-blue-700 shadow-md"
                    : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-600"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemCompletion(item, !isCompleted);

                  // Add celebratory micro-interaction on completion
                  if (!isCompleted) {
                    // Create a temporary celebration effect
                    const button = e.currentTarget;
                    button.style.transform = "scale(1.2)";
                    setTimeout(() => {
                      button.style.transform = "";
                    }, 200);
                  }
                }}
                disabled={isSkipped}
              >
                <Check
                  className={`h-4 w-4 transition-all duration-200 ${
                    isCompleted ? "scale-110" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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

    const needsVerification =
      item.verify_required || item.title.toLowerCase().includes("verify");

    if (
      checked &&
      needsVerification &&
      !item.is_completed_for_date &&
      !item.completed_at
    ) {
      setVerifyingItem(item);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 min-h-screen">
        {/* Month Label and Calendar */}
        <div className="pt-10 px-6">
          {/* Month label above calendar */}
          <div className="mb-0">
            <p className="text-base font-semibold text-gray-500 dark:text-gray-400">
              {new Date(selectedDate).toLocaleDateString("en-US", {
                month: "long",
              })}
            </p>
          </div>

          {/* 7-Day Calendar Strip */}
          <div className="-mx-6 -mt-1">
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 pb-6 pt-2">
          <div className="flex gap-3">
            {[
              { id: "habits", label: "Habits" },
              { id: "focus", label: "Focus" },
              { id: "shared", label: "Shared" },
            ].map((tab) => {
              const status = getFilterStatus(tab.id);
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full px-4 py-2 flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {status.totalCount > 0 &&
                    (status.isAllComplete ? (
                      <span className="text-green-400 text-sm">✓</span>
                    ) : status.incompleteCount > 0 ? (
                      <span
                        className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center font-medium"
                        style={{ backgroundColor: "#A18CFF" }}
                      >
                        {status.incompleteCount}
                      </span>
                    ) : null)}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Section Headers and Items */}
        <div className="px-6 pb-20">
          {/* All Done Celebration - when everything is completed */}
          {filteredItems.length > 0 &&
            filteredItems.every(
              (item) =>
                isItemCompleted(item) || (item as any).is_skipped_for_date,
            ) && (
              <div className="text-center py-16 px-6 mb-8">
                <div className="max-w-sm mx-auto">
                  <div className="text-7xl mb-6 animate-bounce">🎉</div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    Amazing work!
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-300 mb-4">
                    You crushed everything on your list today. Time to
                    celebrate!
                  </p>
                  <div className="flex justify-center space-x-2 text-2xl">
                    <span className="animate-pulse delay-100">✨</span>
                    <span className="animate-pulse delay-200">🌟</span>
                    <span className="animate-pulse delay-300">💫</span>
                  </div>
                </div>
              </div>
            )}

          {/* To Do Section */}
          {activeTab === "shared"
            ? // Shared items grouped by assignee
              (() => {
                const sharedGroups = groupSharedItemsByAssignee(
                  filteredItems.filter(
                    (item) =>
                      !isItemCompleted(item) &&
                      !(item as any).is_skipped_for_date,
                  ),
                );
                return (
                  sharedGroups.length > 0 && (
                    <div className="mb-8">
                      <div className="text-center mb-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          To Do
                        </h2>
                      </div>
                      <div className="space-y-6">
                        {sharedGroups.map((group, groupIndex) => (
                          <div
                            key={`group-${groupIndex}`}
                            className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Assigned to {group.assignee}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {group.completedCount}/{group.totalCount}{" "}
                                  complete
                                </span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                  {group.percentage}%
                                </span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {group.items.map(renderNewItem)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                );
              })()
            : // Regular To Do section for other tabs
              filteredItems.some(
                (item) =>
                  !isItemCompleted(item) && !(item as any).is_skipped_for_date,
              ) && (
                <div className="mb-8">
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      To Do
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {filteredItems
                      .filter(
                        (item) =>
                          !isItemCompleted(item) &&
                          !(item as any).is_skipped_for_date,
                      )
                      .sort((a, b) => {
                        // Sort by due time if present, otherwise by type
                        if (a.due_date && b.due_date) {
                          return (
                            new Date(a.due_date).getTime() -
                            new Date(b.due_date).getTime()
                          );
                        }
                        if (a.due_date && !b.due_date) return -1;
                        if (!a.due_date && b.due_date) return 1;
                        return a.item_type.localeCompare(b.item_type);
                      })
                      .map(renderNewItem)}
                  </div>
                </div>
              )}

          {/* Done Section - Enhanced celebratory design */}
          {filteredItems.some((item) => isItemCompleted(item)) && (
            <div className="mt-8">
              {/* Horizontal divider with centered "Done" label */}
              <div className="relative flex items-center justify-center mb-6">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-green-200 to-transparent dark:via-green-800"></div>
                <div className="relative bg-white dark:bg-gray-900 px-4">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-all duration-150 hover:scale-105"
                  >
                    Done (
                    {
                      filteredItems.filter((item) => isItemCompleted(item))
                        .length
                    }
                    )
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${
                        showCompleted ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Done items with celebratory background treatment */}
              {showCompleted && (
                <div className="bg-gradient-to-b from-green-50/70 to-green-50/30 dark:from-green-900/20 dark:to-green-900/10 rounded-xl p-4 border border-green-100/50 dark:border-green-800/30">
                  {activeTab === "shared" ? (
                    // Shared completed items grouped by assignee
                    (() => {
                      const completedSharedGroups = groupSharedItemsByAssignee(
                        filteredItems.filter((item) => isItemCompleted(item)),
                      );
                      return completedSharedGroups.length > 0 ? (
                        <div className="space-y-6">
                          {completedSharedGroups.map((group, groupIndex) => (
                            <div key={`completed-group-${groupIndex}`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
                                  Assigned to {group.assignee}
                                </h4>
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  {group.completedCount} completed
                                </span>
                              </div>
                              <div className="space-y-3">
                                {group.items.map((item, index) => (
                                  <div
                                    key={item.id}
                                    className="animate-in slide-in-from-left duration-300"
                                    style={{
                                      animationDelay: `${index * 100}ms`,
                                    }}
                                  >
                                    {renderNewItem(item, index)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()
                  ) : (
                    // Regular completed items for other tabs
                    <div className="space-y-4">
                      {filteredItems
                        .filter((item) => isItemCompleted(item))
                        .map((item, index) => (
                          <div
                            key={item.id}
                            className="animate-in slide-in-from-left duration-300"
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            {renderNewItem(item, index)}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Encouraging message at bottom of completed section */}
                  <div className="mt-4 pt-4 border-t border-green-200/50 dark:border-green-700/50 text-center">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Nice work! Keep it up! 🌟
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skipped Section */}
          {filteredItems.some((item) => (item as any).is_skipped_for_date) && (
            <div className="mb-6">
              <h2 className="text-base font-normal text-gray-600 dark:text-gray-400 mb-4">
                Skipped
              </h2>
              <div className="space-y-4">
                {filteredItems
                  .filter((item) => (item as any).is_skipped_for_date)
                  .map(renderNewItem)}
              </div>
            </div>
          )}

          {/* Empty state with encouraging messaging */}
          {filteredItems.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="max-w-sm mx-auto">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {activeTab === "tasks"
                    ? "You're all caught up!"
                    : activeTab === "habits"
                      ? "No habits for today!"
                      : activeTab === "goals"
                        ? "No goals set for today!"
                        : "No projects active today!"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeTab === "tasks"
                    ? "Take a moment to relax or tackle something fun!"
                    : activeTab === "habits"
                      ? "Perfect time to start building new healthy routines."
                      : activeTab === "goals"
                        ? "Ready to set some exciting goals for today?"
                        : "Maybe it's time to start something new and creative!"}
                </p>
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
