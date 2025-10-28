import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Users, History, ChevronDown, X, Trash2 } from "lucide-react";
import { VerificationHistoryTab } from "./VerificationHistoryTab";
import { ItemOwnershipBadges } from "./ItemOwnershipBadges";

interface CreateOrEditItemModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  onSuccess?: () => void;
}

export function CreateOrEditItemModal({
  isOpen,
  onOpenChange,
  item,
  onSuccess,
}: CreateOrEditItemModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!item;

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    item_type: "task" as const,
    due_date: "",
    time_frame: undefined as number | undefined,
    time_of_day: "anytime" as "morning" | "afternoon" | "anytime",
    verify_required: false,
    why_it_matters: "",
    recurrence_type: "once" as const,
    by_day: [] as string[],
    by_monthday: undefined as number | undefined,
    by_month: "",
    by_week: undefined as number | undefined,
    custom_recurrence: "",
    shared_with: [] as string[],
    assigned_to: user?.uid || "",
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [markComplete, setMarkComplete] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionStrategy, setDeletionStrategy] = useState<"all" | "future">("future");
  const [isItemRecurring, setIsItemRecurring] = useState(false);

  // Type options
  const typeOptions = [
    { value: "task", label: "Task" },
    { value: "habit", label: "Habit" },
    { value: "goal", label: "Goal" },
    { value: "project", label: "Project" },
  ];

  // Recurrence options
  const recurrenceOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" },
  ];

  // Weekdays for weekly/monthly recurrence
  const weekdays = [
    { value: "monday", label: "Mon" },
    { value: "tuesday", label: "Tue" },
    { value: "wednesday", label: "Wed" },
    { value: "thursday", label: "Thu" },
    { value: "friday", label: "Fri" },
    { value: "saturday", label: "Sat" },
    { value: "sunday", label: "Sun" },
  ];

  // Months for yearly recurrence
  const months = [
    { value: "january", label: "January" },
    { value: "february", label: "February" },
    { value: "march", label: "March" },
    { value: "april", label: "April" },
    { value: "may", label: "May" },
    { value: "june", label: "June" },
    { value: "july", label: "July" },
    { value: "august", label: "August" },
    { value: "september", label: "September" },
    { value: "october", label: "October" },
    { value: "november", label: "November" },
    { value: "december", label: "December" },
  ];

  // Fetch user's communities first
  const { data: userCommunities } = useQuery({
    queryKey: ["/api/community"],
    enabled: isOpen,
  });

  // Fetch collaborators using optimized single-query endpoint
  // This replaces the N+1 anti-pattern with a single database call
  const { data: collaboratorsData, refetch: refetchCollaborators } = useQuery({
    queryKey: ["/api/community/collaborators"],
    enabled:
      isOpen &&
      userCommunities?.communities &&
      userCommunities.communities.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });

  const communityMembers = Array.isArray(collaboratorsData?.collaborators)
    ? collaboratorsData.collaborators
    : [];

  // Refetch collaborators when share popover opens
  const handleSharePopoverChange = (open: boolean) => {
    setSharePopoverOpen(open);
    if (open) {
      refetchCollaborators(); // Fetch fresh data when opening
    }
  };

  // Initialize form data when editing
  useEffect(() => {
    if (isEditing && item) {
      // Add safety checks for potentially undefined fields
      const safeItem = {
        title: item.title || "",
        item_type: item.item_type || "task",
        due_date: item.due_date || "",
        time_frame: item.time_frame || undefined,
        time_of_day: (item.time_of_day as "morning" | "afternoon" | "anytime") || "anytime",
        verify_required: !!item.verify_required,
        why_it_matters: item.why_it_matters || "",
        recurrence_type: item.recurrence_type || "daily",
        by_day: Array.isArray(item.by_day) ? item.by_day : [],
        by_monthday: item.by_monthday || undefined,
        by_month: item.by_month || "",
        by_week: item.by_week || undefined,
        custom_recurrence: item.custom_recurrence || "",
        shared_with: Array.isArray(item.shared_with) ? item.shared_with : [],
        assigned_to: item.assigned_to || user?.uid || "",
      };

      setFormData(safeItem);
      setIsRecurring(
        !!(safeItem.recurrence_type && safeItem.recurrence_type !== "once"),
      );
      setSelectedMembers(safeItem.shared_with);
    } else if (isOpen) {
      // Reset form for creation only when modal opens
      setFormData({
        title: "",
        item_type: "task",
        due_date: "",
        time_frame: undefined,
        time_of_day: "anytime",
        verify_required: false,
        why_it_matters: "",
        recurrence_type: "once",
        by_day: [],
        by_monthday: undefined,
        by_month: "",
        by_week: undefined,
        custom_recurrence: "",
        shared_with: [],
        assigned_to: user?.uid || "",
      });
      setIsRecurring(false);
      setSelectedMembers([]);
      setMarkComplete(false);
      setUploadedImage(null);
    }
  }, [isEditing, item?.id, isOpen, user?.uid]);

  // Determine if item is recurring based on available data
  useEffect(() => {
    if (isEditing && item) {
      if (item.template_id) {
        // New architecture: Use is_recurring field from template
        setIsItemRecurring(item.is_recurring === true);
      } else {
        // Legacy architecture: check recurrence_type
        setIsItemRecurring(item.recurrence_type && item.recurrence_type !== "once");
      }
    } else {
      setIsItemRecurring(false);
    }
  }, [isEditing, item]);

  // Update field helper
  const updateField = (field: string, value: any) => {
    // DEBUG: Log field updates for time_of_day
    if (field === "time_of_day") {
      console.log("🔍 DEBUG: updateField time_of_day =", value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle frequency toggle
  const handleFrequencyToggle = (recurring: boolean) => {
    setIsRecurring(recurring);
    if (!recurring) {
      updateField("recurrence_type", "once");
    } else {
      updateField("recurrence_type", "daily");
    }
  };

  // Handle weekday toggle for weekly recurrence
  const toggleWeekday = (day: string) => {
    const currentDays = formData.by_day || [];
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    updateField("by_day", updatedDays);
  };

  // Handle member selection
  const toggleMemberSelection = (memberId: string) => {
    const updated = selectedMembers.includes(memberId)
      ? selectedMembers.filter((id) => id !== memberId)
      : [...selectedMembers, memberId];
    setSelectedMembers(updated);
    updateField("shared_with", updated);
  };

  // Remove member
  const removeMember = (memberId: string) => {
    const updated = selectedMembers.filter((id) => id !== memberId);
    setSelectedMembers(updated);
    updateField("shared_with", updated);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = isEditing ? `/api/item/${item.id}` : "/api/item";
      const method = isEditing ? "PUT" : "POST";

      console.log(
        `🔍 FRONTEND MUTATION: ${method} ${endpoint} with data:`,
        data,
      );

      // Handle photo upload for verification if marking complete
      if (
        isEditing &&
        markComplete &&
        formData.verify_required &&
        uploadedImage
      ) {
        const formDataWithPhoto = new FormData();
        formDataWithPhoto.append("photo", uploadedImage);

        return apiRequest(`/api/item/${item.id}/verify`, {
          method: "POST",
          body: formDataWithPhoto,
        });
      }

      return apiRequest(endpoint, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (result) => {
      console.log(
        "🔄 MODAL SUCCESS: Starting comprehensive cache invalidation",
      );

      // CRITICAL FIX: Use the EXACT same week calculation logic as WeekCalendarStrip
      const calculateWeekStart = (date: Date) => {
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const startDate = new Date(date);
        startDate.setDate(date.getDate() - dayOfWeek); // Go back to Sunday
        return startDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      };

      // Get current date info
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];
      const currentWeekStart = calculateWeekStart(today);

      // Calculate all potentially affected dates
      const datesToInvalidate = new Set<string>();
      const weeksToInvalidate = new Set<string>();

      // Add today
      datesToInvalidate.add(todayString);
      weeksToInvalidate.add(currentWeekStart);

      // If item has a due date, add that date and its week
      if (formData.due_date) {
        const dueDate = new Date(formData.due_date);
        datesToInvalidate.add(formData.due_date);
        weeksToInvalidate.add(calculateWeekStart(dueDate));
      }

      // For recurring items, add next 7 days to ensure calendar updates
      if (isRecurring) {
        for (let i = 0; i < 7; i++) {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + i);
          const futureDateString = futureDate.toISOString().split("T")[0];
          datesToInvalidate.add(futureDateString);
        }
      }

      console.log("📅 DATES TO INVALIDATE:", Array.from(datesToInvalidate));
      console.log("📅 WEEKS TO INVALIDATE:", Array.from(weeksToInvalidate));

      // Cancel any in-flight queries to prevent race conditions
      await Promise.all([
        ...Array.from(datesToInvalidate).map((date) =>
          queryClient.cancelQueries({
            queryKey: ["/api/today/personal-progress", date],
          }),
        ),
        ...Array.from(weeksToInvalidate).map((weekStart) =>
          queryClient.cancelQueries({
            queryKey: ["/api/today/personal-progress/week", weekStart],
          }),
        ),
      ]);

      // Invalidate and refetch all affected queries
      const invalidationPromises = [
        // Invalidate each specific date
        ...Array.from(datesToInvalidate).map((date) =>
          queryClient.invalidateQueries({
            queryKey: ["/api/today/personal-progress", date],
            exact: true,
          }),
        ),
        // Invalidate each specific week
        ...Array.from(weeksToInvalidate).map((weekStart) =>
          queryClient.invalidateQueries({
            queryKey: ["/api/today/personal-progress/week", weekStart],
            exact: true,
          }),
        ),
        // Invalidate shared data
        ...Array.from(datesToInvalidate).map((date) =>
          queryClient.invalidateQueries({
            queryKey: ["/api/today/shared", date],
            exact: true,
          }),
        ),
      ];

      await Promise.all(invalidationPromises);

      // Force immediate refetch of critical data
      const refetchPromises = [
        // Refetch current week for calendar
        queryClient.refetchQueries({
          queryKey: ["/api/today/personal-progress/week", currentWeekStart],
          exact: true,
        }),
        // Refetch today's data
        queryClient.refetchQueries({
          queryKey: ["/api/today/personal-progress", todayString],
          exact: true,
        }),
      ];

      try {
        await Promise.all(refetchPromises);
        console.log("✅ All critical data refetched successfully");
      } catch (error) {
        console.error("❌ Error refetching data:", error);
      }

      // Also invalidate general queries
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overdue/count"] });

      console.log(
        "✅ MODAL SUCCESS: Comprehensive cache invalidation complete",
      );

      toast({
        title: isEditing ? "Item updated" : "Item created",
        description: `Your ${formData.item_type} has been ${isEditing ? "updated" : "created"} successfully.`,
      });

      if (!isEditing && result?.item) {
        setTimeout(() => {
          onOpenChange(false);
          onSuccess?.();
        }, 1500);
      } else {
        onOpenChange(false);
        onSuccess?.();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message || `Failed to ${isEditing ? "update" : "create"} item.`,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id) {
        console.error("❌ DELETE ERROR: No item ID provided");
        throw new Error("No item ID");
      }

      console.log(
        `🗑️ FRONTEND DELETE START: Deleting item "${item.id}" (${item.display_id}) with strategy: ${deletionStrategy}`,
      );

      try {
        const response = await apiRequest(`/api/item/${item.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            strategy: deletionStrategy
          }),
        });

        console.log(`✅ FRONTEND DELETE API SUCCESS:`, response);
        return response;
      } catch (error) {
        console.error(`❌ FRONTEND DELETE API ERROR:`, error);
        throw error;
      }
    },

    onSuccess: async (response) => {
      console.log(
        "🎉 DELETE MUTATION SUCCESS - Starting comprehensive cache invalidation",
      );

      try {
        // Show success message
        toast({
          title: "Item deleted successfully",
          description: "The item has been removed from your list.",
        });

        // Close modal and delete dialog immediately
        setDeleteDialogOpen(false);
        onOpenChange(false);
        onSuccess?.();

        // COMPREHENSIVE CACHE INVALIDATION (same as create/edit but for deletion)
        const calculateWeekStart = (date: Date) => {
          const dayOfWeek = date.getDay();
          const startDate = new Date(date);
          startDate.setDate(date.getDate() - dayOfWeek);
          return startDate.toISOString().split("T")[0];
        };

        // Get current date info
        const today = new Date();
        const todayString = today.toISOString().split("T")[0];
        const currentWeekStart = calculateWeekStart(today);

        // Calculate all potentially affected dates
        const datesToInvalidate = new Set<string>();
        const weeksToInvalidate = new Set<string>();

        // Add today and current week
        datesToInvalidate.add(todayString);
        weeksToInvalidate.add(currentWeekStart);

        // If item had a due date, add that date and its week
        if (item?.due_date) {
          const dueDate = new Date(item.due_date);
          datesToInvalidate.add(item.due_date);
          weeksToInvalidate.add(calculateWeekStart(dueDate));
        }

        // For recurring items, add next 7 days to ensure calendar updates
        if (item?.template_id && item?.is_recurring) {
          for (let i = 0; i < 7; i++) {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + i);
            const futureDateString = futureDate.toISOString().split("T")[0];
            datesToInvalidate.add(futureDateString);
          }
        }

        console.log(
          "🗑️ DELETE CACHE: Invalidating dates:",
          Array.from(datesToInvalidate),
        );
        console.log(
          "🗑️ DELETE CACHE: Invalidating weeks:",
          Array.from(weeksToInvalidate),
        );

        // Cancel any in-flight queries to prevent race conditions
        await Promise.all([
          ...Array.from(datesToInvalidate).map((date) =>
            queryClient.cancelQueries({
              queryKey: ["/api/today/personal-progress", date],
            }),
          ),
          ...Array.from(weeksToInvalidate).map((weekStart) =>
            queryClient.cancelQueries({
              queryKey: ["/api/today/personal-progress/week", weekStart],
            }),
          ),
        ]);

        // Invalidate and refetch all affected queries
        const invalidationPromises = [
          // Invalidate each specific date
          ...Array.from(datesToInvalidate).map((date) =>
            queryClient.invalidateQueries({
              queryKey: ["/api/today/personal-progress", date],
              exact: true,
            }),
          ),
          // Invalidate each specific week
          ...Array.from(weeksToInvalidate).map((weekStart) =>
            queryClient.invalidateQueries({
              queryKey: ["/api/today/personal-progress/week", weekStart],
              exact: true,
            }),
          ),
          // Invalidate shared data
          ...Array.from(datesToInvalidate).map((date) =>
            queryClient.invalidateQueries({
              queryKey: ["/api/today/shared", date],
              exact: true,
            }),
          ),
        ];

        await Promise.all(invalidationPromises);

        // Force immediate refetch of critical data
        const refetchPromises = [
          // Refetch current week for calendar
          queryClient.refetchQueries({
            queryKey: ["/api/today/personal-progress/week", currentWeekStart],
            exact: true,
          }),
          // Refetch today's data
          queryClient.refetchQueries({
            queryKey: ["/api/today/personal-progress", todayString],
            exact: true,
          }),
        ];

        await Promise.all(refetchPromises);

        // Also invalidate general queries
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
        queryClient.invalidateQueries({ queryKey: ["/api/overdue/count"] });

        console.log(
          "✅ DELETE SUCCESS: All caches invalidated and UI updated locally",
        );
      } catch (error) {
        console.error("❌ DELETE CACHE ERROR:", error);
        // Still show success since the item was deleted on server
        toast({
          title: "Item deleted",
          description:
            "The item was deleted successfully. Please refresh if needed.",
        });
      }
    },

    onError: async (error: any) => {
      console.error("❌ DELETE MUTATION ERROR:", error);

      // If item not found (404), treat as successful deletion
      if (error.status === 404 || error.message?.includes("not found")) {
        console.log("⚠️ ITEM ALREADY DELETED: Treating as success");

        toast({
          title: "Item removed",
          description: "The item has been removed.",
        });

        setDeleteDialogOpen(false);
        onOpenChange(false);
        onSuccess?.();
      } else {
        // Real error - don't reload
        console.error("💥 REAL DELETE ERROR:", error);
        toast({
          title: "Delete failed",
          description:
            error.message || "Failed to delete item. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Handle save
  const handleSave = () => {
    // DEBUG: Log form state before save
    console.log("🔍 DEBUG: formData.time_of_day =", formData.time_of_day);
    console.log("🔍 DEBUG: Full formData =", formData);

    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your item.",
        variant: "destructive",
      });
      return;
    }

    if (formData.time_frame !== undefined && formData.time_frame < 0) {
      toast({
        title: "Invalid time",
        description: "Time cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    // Get client's local date and timezone for server context
    const clientDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const saveData = {
      ...formData,
      recurrence_type: isRecurring ? formData.recurrence_type : "once",
      by_day:
        isRecurring && formData.recurrence_type === "weekly"
          ? formData.by_day
          : undefined,
      by_monthday:
        isRecurring && ["monthly", "yearly"].includes(formData.recurrence_type)
          ? formData.by_monthday
          : undefined,
      by_month:
        isRecurring && formData.recurrence_type === "yearly"
          ? formData.by_month
          : undefined,
      by_week:
        isRecurring && formData.recurrence_type === "monthly"
          ? formData.by_week
          : undefined,
      custom_recurrence:
        isRecurring && formData.recurrence_type === "custom"
          ? formData.custom_recurrence
          : undefined,
      shared_with: selectedMembers,
      completed_at:
        isEditing && markComplete ? new Date().toISOString() : undefined,
      // CLIENT DATE CONTEXT: Send user's local date for "starting today" logic
      client_date: clientDate,
      client_timezone: clientTimezone,
    };

    // DEBUG: Log save data before sending including client context
    console.log(`🌍 CLIENT DATE DEBUG: Sending client context - Date: ${clientDate}, Timezone: ${clientTimezone}`);
    console.log("🔍 DEBUG: saveData.time_of_day =", saveData.time_of_day);
    console.log("🔍 DEBUG: Full saveData =", saveData);

    saveMutation.mutate(saveData);
  };

  // Handle delete - now opens dialog instead of window.confirm
  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  // Confirm delete - called when user confirms in dialog
  const confirmDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 bg-background border-border"
        aria-describedby="modal-description"
      >
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div>
            <h2
              className="text-2xl font-bold text-foreground"
              id="modal-title"
            >
              {isEditing ? "Edit Item" : "Create New Item"}
            </h2>
            <p id="modal-description" className="sr-only">
              {isEditing
                ? "Edit and update your item details"
                : "Create a new task, habit, goal, or project"}
            </p>
            {/* Show ownership badges for both edit and create modes */}
            {isEditing && item && (
              <div className="mt-2">
                <ItemOwnershipBadges item={item} showAssignment={true} />
              </div>
            )}

            {/* Show preview badges in create mode based on current form state */}
            {!isEditing && (
              <div className="mt-2 flex gap-2">
                {selectedMembers.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    Shared
                  </span>
                )}
                {formData.assigned_to === null &&
                  selectedMembers.length > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      Open for Anyone
                    </span>
                  )}
              </div>
            )}
          </div>

          {/* Unified Tab Structure for both creation and editing */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList
              className={`grid w-full bg-muted ${isEditing && formData.verify_required ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <TabsTrigger value="details">Details</TabsTrigger>
              {isEditing && formData.verify_required && (
                <TabsTrigger
                  value="verification"
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Verification History
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Frequency Toggle */}
              <div className="flex gap-2 bg-muted rounded-xl p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFrequencyToggle(false)}
                  className={`flex-1 rounded-lg transition-all font-medium ${
                    !isRecurring
                      ? "bg-accent-primary text-white shadow-md hover:bg-accent-hover"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  }`}
                >
                  One-time
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFrequencyToggle(true)}
                  className={`flex-1 rounded-lg transition-all font-medium ${
                    isRecurring
                      ? "bg-accent-primary text-white shadow-md hover:bg-accent-hover"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  }`}
                >
                  Recurring
                </Button>
              </div>

              {/* Recurrence Options */}
              {isRecurring && (
                <div className="space-y-4">
                  {/* Recurrence Type Selection */}
                  <div className="flex gap-2 flex-wrap">
                    {recurrenceOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          formData.recurrence_type === option.value
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          updateField("recurrence_type", option.value)
                        }
                        className={`rounded-full ${
                          formData.recurrence_type === option.value
                            ? "bg-accent-primary hover:bg-accent-hover text-white"
                            : "border-border text-foreground hover:bg-accent/10"
                        }`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>

                  {/* Weekly Options */}
                  {formData.recurrence_type === "weekly" && (
                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">
                        Select days:
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        {weekdays.map((day) => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={
                              formData.by_day?.includes(day.value)
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => toggleWeekday(day.value)}
                            className={`rounded-full px-3 ${
                              formData.by_day?.includes(day.value)
                                ? "bg-accent-primary hover:bg-accent-hover text-white"
                                : "border-border text-foreground hover:bg-accent/10"
                            }`}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly Options */}
                  {formData.recurrence_type === "monthly" && (
                    <div className="space-y-3">
                      <Label className="text-sm text-foreground">
                        Repeat on:
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Day of month
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.by_monthday || ""}
                            onChange={(e) =>
                              updateField(
                                "by_monthday",
                                parseInt(e.target.value) || undefined,
                              )
                            }
                            placeholder="15"
                            className="rounded-lg bg-background border-2 border-border focus:border-accent-primary text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Week number
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="4"
                            value={formData.by_week || ""}
                            onChange={(e) =>
                              updateField(
                                "by_week",
                                parseInt(e.target.value) || undefined,
                              )
                            }
                            placeholder="3"
                            className="rounded-lg bg-background border-2 border-border focus:border-accent-primary text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>
                      {formData.by_week && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Day of week
                          </Label>
                          <div className="flex gap-2 flex-wrap">
                            {weekdays.map((day) => (
                              <Button
                                key={day.value}
                                type="button"
                                variant={
                                  formData.by_day?.includes(day.value)
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => toggleWeekday(day.value)}
                                className={`rounded-full px-3 ${
                                  formData.by_day?.includes(day.value)
                                    ? "bg-accent-primary hover:bg-accent-hover text-white"
                                    : "border-border text-foreground hover:bg-accent/10"
                                }`}
                              >
                                {day.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Yearly Options */}
                  {formData.recurrence_type === "yearly" && (
                    <div className="space-y-3">
                      <Label className="text-sm text-foreground">
                        Repeat in:
                      </Label>
                      <Select
                        value={formData.by_month || ""}
                        onValueChange={(value) =>
                          updateField("by_month", value)
                        }
                      >
                        <SelectTrigger className="rounded-lg bg-background border-2 border-border focus:border-accent-primary text-foreground">
                          <SelectValue placeholder="Select month" className="placeholder:text-muted-foreground" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {formData.by_month && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Day of month
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.by_monthday || ""}
                            onChange={(e) =>
                              updateField(
                                "by_monthday",
                                parseInt(e.target.value) || undefined,
                              )
                            }
                            placeholder="15"
                            className="rounded-lg bg-background border-2 border-border focus:border-accent-primary text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Recurrence */}
                  {formData.recurrence_type === "custom" && (
                    <Textarea
                      value={formData.custom_recurrence || ""}
                      onChange={(e) =>
                        updateField("custom_recurrence", e.target.value)
                      }
                      placeholder="Describe your custom recurrence pattern..."
                      rows={2}
                      className="rounded-xl border-2 border-border focus:border-accent-primary bg-background text-foreground placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              )}

              {/* Title Input */}
              <Input
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="What would you like to accomplish?"
                className="text-lg py-3 rounded-xl border-2 border-border focus:border-accent-primary bg-background font-medium placeholder:text-muted-foreground text-foreground"
              />

              {/* Type Selection */}
              <div className="flex gap-2 flex-wrap">
                {typeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      formData.item_type === option.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => updateField("item_type", option.value)}
                    className={`rounded-full ${
                      formData.item_type === option.value
                        ? "bg-accent-primary hover:bg-accent-hover text-white"
                        : "border-border text-foreground hover:bg-accent/10"
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {/* Optional Fields in Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-foreground mb-2 block">
                    {isRecurring ? "Start Date" : "Due Date"}
                  </Label>
                  <Input
                    type="date"
                    value={formData.due_date || ""}
                    onChange={(e) => updateField("due_date", e.target.value)}
                    disabled={formData.item_type === "habit"}
                    className={`rounded-lg border-2 focus:border-accent-primary ${
                      formData.item_type === "habit"
                        ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
                        : "bg-background border-border text-foreground"
                    }`}
                  />
                  {formData.item_type === "habit" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      For habits, this date sets when the habit pattern begins
                    </p>
                  )}
                  {isRecurring && formData.item_type !== "habit" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      This is when the recurring pattern will start
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-foreground mb-2 block">
                    Time (min)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.time_frame || ""}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        updateField("time_frame", value);
                      } else if (e.target.value === "") {
                        updateField("time_frame", undefined);
                      }
                    }}
                    placeholder="30"
                    className="rounded-lg bg-background border-2 border-border focus:border-accent-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Time of Day Selection */}
                <div>
                  <Label className="text-sm text-foreground mb-2 block">
                    Time of Day
                  </Label>
                  <div className="flex gap-2">
                    {[
                      { value: "morning", label: "Morning", icon: "🌅" },
                      { value: "afternoon", label: "Afternoon", icon: "☀️" },
                      { value: "anytime", label: "Anytime", icon: "⏰" }
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={formData.time_of_day === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateField("time_of_day", option.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                          formData.time_of_day === option.value
                            ? "bg-accent-primary hover:bg-accent-hover text-white"
                            : "border-border text-foreground hover:bg-accent/10"
                        }`}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Photo Verification Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Verify with photo</span>
                </div>
                <Checkbox
                  checked={formData.verify_required || false}
                  onCheckedChange={(checked) =>
                    updateField("verify_required", checked)
                  }
                  className="rounded"
                />
              </div>

              {/* Share With Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-sm font-medium text-foreground">
                    Share with community members
                  </Label>
                </div>

                {communityMembers.length === 0 ? (
                  <div className="p-4 rounded-xl border-2 border-border bg-muted">
                    <p className="text-sm text-muted-foreground text-center">
                      To share items, create or join a community from your
                      profile.
                    </p>
                  </div>
                ) : (
                  <>
                    <Popover
                      open={sharePopoverOpen}
                      onOpenChange={handleSharePopoverChange}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between rounded-xl border-2 border-border bg-background hover:bg-accent/10 text-foreground"
                        >
                          <span className="text-foreground">
                            {selectedMembers.length === 0
                              ? "Share with..."
                              : `${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 flex flex-col" align="start" style={{ maxHeight: 'min(400px, 60vh)' }}>
                        <div className="p-3 border-b border-border flex-shrink-0">
                          <h4 className="font-medium text-sm text-foreground">
                            Select community members
                          </h4>
                        </div>
                        <div className="overflow-y-scroll overscroll-contain touch-pan-y flex-1 min-h-0" style={{ maxHeight: 'min(350px, 55vh)' }}>
                          {communityMembers.length > 0 ? (
                            communityMembers.map((member: any) => (
                              <div
                                key={member.user_id}
                                className="flex items-center gap-3 p-3 hover:bg-accent/10 cursor-pointer"
                                onClick={() =>
                                  toggleMemberSelection(member.user_id)
                                }
                              >
                                <Checkbox
                                  checked={selectedMembers.includes(
                                    member.user_id,
                                  )}
                                  onChange={() => {}} // Handled by onClick above
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {member.display_name || "Unknown"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {member.community_name || "Community"}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                              No community members found
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Members Pills */}
                    {selectedMembers.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {selectedMembers.map((memberId) => {
                            const member = communityMembers.find(
                              (m: any) => m.user_id === memberId,
                            );
                            return member ? (
                              <div
                                key={memberId}
                                className="flex items-center gap-2 bg-blue-900/30 text-blue-200 px-3 py-1 rounded-full text-sm"
                              >
                                <span>{member.display_name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-blue-800/50 rounded-full"
                                  onClick={() => removeMember(memberId)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : null;
                          })}
                        </div>

                        {/* Assignment Section */}
                        <div className="p-3 bg-accent/10 rounded-xl">
                          <Label className="text-sm font-medium text-foreground mb-2 block">
                            Assigned to
                          </Label>
                          <Select
                            value={formData.assigned_to === null ? "open" : (formData.assigned_to || "creator")}
                            onValueChange={(value) =>
                              updateField(
                                "assigned_to",
                                value === "creator"
                                  ? user?.uid
                                  : value === "open"
                                    ? null
                                    : value,
                              )
                            }
                          >
                            <SelectTrigger className="bg-background border-border text-foreground">
                              <SelectValue placeholder="Select assignee">
                                {(() => {
                                  if (formData.assigned_to === null) {
                                    return "Open for anyone to complete";
                                  }
                                  if (
                                    !formData.assigned_to ||
                                    formData.assigned_to === user?.uid
                                  ) {
                                    return `${user?.displayName || user?.email || "You"} (creator)`;
                                  }
                                  const assignedMember = communityMembers.find(
                                    (m: any) =>
                                      m.user_id === formData.assigned_to,
                                  );
                                  return assignedMember
                                    ? assignedMember.display_name
                                    : "Unknown user";
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="creator">
                                {user?.displayName || user?.email || "You"}{" "}
                                (creator)
                              </SelectItem>
                              <SelectItem value="open">
                                Open for anyone to complete
                              </SelectItem>
                              {selectedMembers.map((memberId) => {
                                const member = communityMembers.find(
                                  (m: any) => m.user_id === memberId,
                                );
                                return member ? (
                                  <SelectItem key={memberId} value={memberId}>
                                    {member.display_name}
                                  </SelectItem>
                                ) : null;
                              })}
                            </SelectContent>
                          </Select>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formData.assigned_to === null && selectedMembers.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Anyone who can see this item can mark it as complete
                              </p>
                            )}
                            {formData.assigned_to === user?.uid && (
                              <p className="text-xs text-muted-foreground">
                                Only you can mark this as complete
                              </p>
                            )}
                            {formData.assigned_to &&
                              formData.assigned_to !== user?.uid && (
                                <p className="text-xs text-muted-foreground">
                                  Only the assigned person can mark this as
                                  complete
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Why it matters */}
              <Textarea
                value={formData.why_it_matters || ""}
                onChange={(e) => updateField("why_it_matters", e.target.value)}
                placeholder="Why does this matter to you? (optional)"
                rows={2}
                className="rounded-xl border-2 border-border focus:border-accent-primary bg-background text-foreground placeholder:text-muted-foreground"
              />
            </TabsContent>

            {isEditing && formData.verify_required && (
              <TabsContent value="verification" className="mt-6">
                <VerificationHistoryTab
                  itemId={item?.id || ""}
                  currentUserId={user?.uid}
                  itemCreatedBy={item?.created_by}
                  itemStatus={item?.status}
                  onClose={() => onOpenChange(false)}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sticky Footer */}
        <div className="bg-muted/50 border-t border-border p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Display ID for all items - show after creation */}
            <div className="flex items-center">
              {item?.display_id ? (
                <span className="text-xs text-gray-500 font-mono">
                  {item.display_id}
                </span>
              ) : isEditing ? (
                <span className="text-xs text-gray-500 font-mono">
                  Loading...
                </span>
              ) : (
                <div></div>
              )}
            </div>

            <div className="flex gap-3 ml-auto">
              {isEditing && (
                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      className="text-red-400 border-red-700 hover:bg-red-900/20 transition-all duration-150 hover:scale-105"
                    >
                      <Trash2 className="h-4 w-4 mr-2 transition-transform duration-150" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-[500px] bg-background border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                        <Trash2 className="h-5 w-5 text-red-400" />
                        {isItemRecurring
                          ? "Delete Recurring Item"
                          : "Delete Item"
                        }
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-foreground">
                        {isItemRecurring ? (
                          <div className="space-y-4">
                            <p>
                              This is a recurring item. Choose how to delete "{item?.title || "this item"}":
                            </p>
                            <RadioGroup 
                              value={deletionStrategy} 
                              onValueChange={(value) => setDeletionStrategy(value as "all" | "future")}
                              className="space-y-3"
                            >
                              <div className="flex items-start space-x-2 p-3 rounded-lg border border-border hover:border-accent">
                                <RadioGroupItem value="future" id="future" className="mt-1" />
                                <div className="grid gap-1.5 leading-none">
                                  <Label
                                    htmlFor="future"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground cursor-pointer"
                                  >
                                    Stop Future Occurrences Only
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Keeps past completions and data intact. Preserves historical data for reporting and insights.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-2 p-3 rounded-lg border border-border hover:border-accent">
                                <RadioGroupItem value="all" id="all" className="mt-1" />
                                <div className="grid gap-1.5 leading-none">
                                  <Label
                                    htmlFor="all"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground cursor-pointer"
                                  >
                                    Delete All History
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Removes all past completions, data, and photos. Will impact reporting, insights, and rewards. Cannot be undone.
                                  </p>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                        ) : (
                          <p>
                            Are you sure you want to delete "{item?.title || "this item"}"? This action cannot be undone.
                          </p>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-background border-border text-foreground hover:bg-accent/10">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDelete}
                        disabled={deleteMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className="rounded-xl transition-all duration-150 hover:scale-105"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !formData.title.trim()}
                className="bg-accent-primary hover:bg-accent-hover text-white rounded-xl px-6 transition-all duration-150 hover:scale-105"
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : isEditing
                    ? "Update"
                    : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
