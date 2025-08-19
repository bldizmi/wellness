import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gift,
  Plus,
  Target,
  Calendar,
  Users,
  Trophy,
  Clock,
  Sparkles,
  TrendingUp,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import confetti from "canvas-confetti";

// Types
interface Reward {
  id: string;
  created_by: string;
  creator_name?: string;
  shared_with: string[] | null;
  title: string;
  description?: string;
  target_metric: string;
  target_value?: string;
  duration_type: string;
  duration_value?: string;
  start_date?: string;
  end_date?: string;
  status:
    | "pending"
    | "approved"
    | "active"
    | "completed"
    | "expired"
    | "rejected";
  approved_by?: string;
  approved_at?: string;
  completed_at?: string;
  delivered_by?: string;
  delivered_at?: string;
  rejection_reason?: string;
  community_id?: string;
  created_at: string;
  updated_at: string;
}

interface CreateRewardData {
  title: string;
  description?: string;
  target_metric: string;
  target_value?: string;
  duration_type: string;
  duration_value?: string;
  start_date?: string;
  end_date?: string;
  shared_with: string[];
  community_id?: string;
}

interface ProgressHistoryEntry {
  id: string;
  progress_percentage: number;
  milestone_reached?: string;
  recorded_at: string;
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  tooltipText?: string;
}

// Achievement celebration function
const triggerAchievementCelebration = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#A18CFF", "#8B5CF6", "#7C3AED", "#6D28D9"],
  });
};

// Progress History Component
interface ProgressHistoryProps {
  rewardId: string;
}

function ProgressHistory({ rewardId }: ProgressHistoryProps) {
  const { data: progressHistory, isLoading } = useQuery({
    queryKey: ["/api/rewards", rewardId, "progress-history"],
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">Loading progress history...</div>
    );
  }

  const history = (progressHistory as any)?.progressHistory || [];

  if (history.length === 0) {
    return null; // Hide when no progress data instead of showing message
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium">Progress History</span>
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {history.map((entry: ProgressHistoryEntry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-purple-600">
                {entry.progress_percentage}%
              </div>
              {entry.milestone_reached && (
                <Badge variant="secondary" className="text-xs">
                  {entry.milestone_reached}
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(entry.recorded_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  tooltipText = "Progress tracking",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative cursor-help">
            <svg className="transform -rotate-90" width={size} height={size}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="text-purple-500 transition-all duration-500 ease-in-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="absolute -top-1 -right-1">
              <Info className="h-3 w-3 text-gray-400 opacity-50" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function calculateProgress(
  reward: Reward,
  personalInsights?: any,
): {
  progress: number;
  daysLeft: number;
  status: string;
  tooltipText: string;
  currentValue: number;
  targetValue: number;
} {
  if (!reward.start_date || !reward.end_date) {
    return {
      progress: 0,
      daysLeft: 0,
      status: "No dates set",
      tooltipText: "Missing start or end date",
      currentValue: 0,
      targetValue: 0,
    };
  }

  const now = new Date();
  const startDate = new Date(reward.start_date);
  const endDate = new Date(reward.end_date);
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (now < startDate) {
    const daysUntilStart = Math.ceil(
      (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      progress: 0,
      daysLeft: daysUntilStart,
      status: `Starts in ${daysUntilStart} days`,
      tooltipText: "Reward period hasn't started yet",
      currentValue: 0,
      targetValue: parseFloat(reward.target_value || "0") || 0,
    };
  }

  if (now > endDate) {
    return {
      progress: 100,
      daysLeft: 0,
      status: "Expired",
      tooltipText: "Reward period has ended",
      currentValue: 0,
      targetValue: parseFloat(reward.target_value || "0") || 0,
    };
  }

  // Get current metric value based on reward type
  let currentValue = 0;
  const targetValue = parseFloat(String(reward.target_value || "0")) || 0;

  if (personalInsights) {
    switch (reward.target_metric) {
      case "completion_rate":
        // Use new Trust Score 30 Days as completion rate
        currentValue = Number(personalInsights.trustScore30Days) || 0;
        break;
      case "daily_streak":
        currentValue = Number(personalInsights.currentStreaks?.[0]?.count) || 0;
        break;
      case "trust_score":
        // Use new Trust Score All Time for trust score metric
        currentValue = Number(personalInsights.trustScore) || 0;
        break;
      default:
        currentValue = 0;
    }
  }

  // Calculate progress toward goal (not time-based)
  const progress =
    targetValue > 0 && !isNaN(currentValue) && !isNaN(targetValue)
      ? Math.min(100, Math.max(0, (currentValue / targetValue) * 100))
      : 0;

  // Generate status message based on progress
  let status = "";
  if (progress >= 100) {
    status = "Goal achieved! 🎉";
  } else if (progress >= 90) {
    status = "So close! Almost there!";
  } else if (progress >= 70) {
    status = "Great progress! Keep going!";
  } else if (progress >= 50) {
    status = "Making solid progress!";
  } else if (progress >= 25) {
    status = "Getting started!";
  } else {
    status = "Just beginning your journey!";
  }

  const metricDisplayName =
    reward.target_metric === "completion_rate"
      ? "Completion Rate"
      : reward.target_metric === "daily_streak"
        ? "Daily Streak"
        : reward.target_metric === "trust_score"
          ? "Trust Score"
          : reward.target_metric;

  const tooltipText = `Progress toward goal: ${Number(currentValue || 0).toFixed(1)}${reward.target_metric === "completion_rate" ? "%" : ""} / ${targetValue}${reward.target_metric === "completion_rate" ? "%" : ""} ${metricDisplayName}`;

  return {
    progress: isNaN(progress) ? 0 : Math.round(progress),
    daysLeft,
    status,
    tooltipText,
    currentValue: isNaN(currentValue) ? 0 : currentValue,
    targetValue: isNaN(targetValue) ? 0 : targetValue,
  };
}

function useMotivationalMessage(
  progress: number,
  daysLeft: number,
  rewardType: string,
) {
  return useQuery({
    queryKey: [
      "/api/rewards/motivational-message",
      { progress, daysLeft, rewardType },
    ],
    queryFn: () =>
      apiRequest(
        `/api/rewards/motivational-message?progress=${progress}&daysLeft=${daysLeft}&rewardType=${encodeURIComponent(rewardType)}`,
      ),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: progress > 0 && daysLeft > 0,
  });
}

// Community Member Selector Component
interface CommunityMemberSelectorProps {
  communityId: string;
  selectedMembers: string[];
  onMembersChange: (members: string[]) => void;
  userProfile: any;
}

function CommunityMemberSelector({
  communityId,
  selectedMembers,
  onMembersChange,
  userProfile,
}: CommunityMemberSelectorProps) {
  const {
    data: communityMembers,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/community/${communityId}/members`],
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading)
    return <div className="text-sm text-gray-500">Loading members...</div>;
  if (error)
    return <div className="text-sm text-red-500">Error loading members</div>;
  if (!communityMembers) return null;

  const availableMembers =
    (communityMembers as any).members?.filter(
      (member: any) => member.user_id !== userProfile?.user_id,
    ) || [];

  const toggleMember = (memberId: string) => {
    const newSelection = selectedMembers.includes(memberId)
      ? selectedMembers.filter((id) => id !== memberId)
      : [...selectedMembers, memberId];
    onMembersChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">Select Approvers</Label>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {availableMembers.map((member: any) => (
          <div key={member.user_id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`member-${member.user_id}`}
              checked={selectedMembers.includes(member.user_id)}
              onChange={() => toggleMember(member.user_id)}
              className="rounded border-gray-300"
            />
            <label
              htmlFor={`member-${member.user_id}`}
              className="text-sm cursor-pointer"
            >
              {member.display_name || member.username}
            </label>
          </div>
        ))}
      </div>
      {selectedMembers.length > 0 && (
        <p className="text-xs text-gray-500">
          {selectedMembers.length} member(s) selected for approval
        </p>
      )}
    </div>
  );
}

interface RewardProgressCardProps {
  reward: Reward;
  progressData: {
    progress: number;
    daysLeft: number;
    status: string;
    tooltipText: string;
    currentValue: number;
    targetValue: number;
  };
  onEdit: (reward: Reward) => void;
}

function RewardProgressCard({
  reward,
  progressData,
  onEdit,
}: RewardProgressCardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: aiMessage } = useMotivationalMessage(
    progressData.progress,
    progressData.daysLeft,
    reward.target_metric,
  );

  // Fetch approver details
  const { data: approverProfile } = useQuery({
    queryKey: ["/api/profile", reward.approved_by],
    enabled: !!reward.approved_by,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  // Delete reward mutation
  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest(`/api/rewards/${rewardId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Reward deleted",
        description: "Reward has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards", "shared"] });
      setShowDeleteConfirm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reward",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, approverDisplayName?: string) => {
    const variants = {
      pending:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      completed:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    const variant =
      variants[status as keyof typeof variants] || variants.pending;

    let displayText = status.charAt(0).toUpperCase() + status.slice(1);
    if (status === "approved" && approverDisplayName) {
      displayText = `Approved by ${approverDisplayName}`;
    }

    return (
      <Badge className={`${variant} rounded-full text-xs px-2 py-1`}>
        {displayText}
      </Badge>
    );
  };

  const isActive = reward.status === "approved" || reward.status === "active";

  return (
    <>
      <Card
        className="overflow-hidden border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300 cursor-pointer"
        onClick={() => setShowEditModal(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5 text-purple-500" />
                {reward.title}
                {getStatusBadge(
                  reward.status,
                  (approverProfile as any)?.display_name,
                )}
              </CardTitle>
              {reward.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {reward.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-yellow-500" />
            <span>
              <strong>Goal:</strong>{" "}
              {reward.target_metric
                .split("_")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
              {reward.target_value && (
                <span className="text-gray-600 dark:text-gray-400">
                  {" "}
                  (Target: {reward.target_value})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span>
              <strong>Duration:</strong> {reward.duration_value}{" "}
              {reward.duration_type}
            </span>
          </div>

          {/* Start and End Dates */}
          {reward.start_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-green-500" />
              <span>
                <strong>Start:</strong>{" "}
                {new Date(reward.start_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {reward.end_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-red-500" />
              <span>
                <strong>End:</strong>{" "}
                {new Date(reward.end_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Progress Section for Active Rewards */}
          {isActive && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-800 dark:text-purple-200">
                  Progress Tracking
                </h4>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {progressData.daysLeft} days left
                </Badge>
              </div>

              {/* AI Motivational Message */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                <p className="text-sm text-purple-800 dark:text-purple-200 italic">
                  "
                  {(aiMessage as any)?.message ||
                    "Every day you show up, you grow stronger!"}
                  "
                </p>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <ProgressRing
                  progress={progressData.progress}
                  tooltipText={progressData.tooltipText}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {progressData.status}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {reward.status === "rejected" && reward.rejection_reason && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
              <strong>Rejection reason:</strong> {reward.rejection_reason}
            </div>
          )}

          {/* Progress History */}
          {isActive && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <ProgressHistory rewardId={reward.id} />
            </div>
          )}

          {/* Reward ID for reference */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Reward ID: {reward.id.substring(0, 5)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Delete Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Would you like to edit or delete this reward?</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  onEdit(reward);
                }}
              >
                Edit Details
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowEditModal(false);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete "{reward.title}"? This action
              cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteRewardMutation.mutate(reward.id)}
                disabled={deleteRewardMutation.isPending}
              >
                {deleteRewardMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function RewardsTab() {
  const [activeRewardsTab, setActiveRewardsTab] = useState("my-rewards");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState<CreateRewardData>(() => {
    const today = new Date().toISOString().split("T")[0];
    const initialEndDate = (() => {
      const start = new Date(today);
      start.setDate(start.getDate() + 7); // Default 1 week
      return start.toISOString().split("T")[0];
    })();

    return {
      title: "",
      description: "",
      target_metric: "",
      target_value: "",
      duration_type: "weeks",
      duration_value: "1",
      start_date: today,
      end_date: initialEndDate,
      shared_with: [],
      community_id: "",
    };
  });

  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
    staleTime: 1000 * 60 * 10,
  });

  const { data: communities } = useQuery({
    queryKey: ["/api/community"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: userRewards, isLoading: userRewardsLoading } = useQuery({
    queryKey: ["/api/rewards"],
    staleTime: 1000 * 60 * 2,
  });

  const { data: sharedRewards, isLoading: sharedRewardsLoading } = useQuery({
    queryKey: ["/api/rewards/shared"],
    staleTime: 1000 * 60 * 2,
  });

  // Fetch personal insights for metric dropdown
  const { data: personalInsights } = useQuery({
    queryKey: ["/api/insights/personal"],
    staleTime: 1000 * 60 * 5,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper function to calculate end date based on start date and duration
  const calculateEndDate = (
    startDate: string,
    durationValue: string,
    durationType: string,
  ) => {
    if (!startDate || !durationValue) return "";

    const start = new Date(startDate);
    const duration = parseInt(durationValue);

    if (durationType === "days") {
      start.setDate(start.getDate() + duration);
    } else if (durationType === "weeks") {
      start.setDate(start.getDate() + duration * 7);
    } else if (durationType === "months") {
      start.setMonth(start.getMonth() + duration);
    }

    return start.toISOString().split("T")[0];
  };

  // Helper function to get metric options from insights data
  const getMetricOptions = () => {
    if (!personalInsights) return [];

    const insights = personalInsights as any;
    return [
      {
        value: "completion_rate",
        label: `Overall Completion Rate (Currently: ${insights.completionRate?.thisWeek || 0}%)`,
        currentValue: insights.completionRate?.thisWeek || 0,
        unit: "%",
      },
      {
        value: "daily_streak",
        label: `Daily Activity Streak (Currently: ${insights.currentStreaks?.[0]?.count || 0} days)`,
        currentValue: insights.currentStreaks?.[0]?.count || 0,
        unit: "days",
      },
      {
        value: "trust_score",
        label: `Trust Score (Currently: ${insights.trustScore || 0}%)`,
        currentValue: insights.trustScore || 0,
        unit: "%",
      },
    ];
  };

  // Automatically update end date when duration changes
  const updateDuration = (
    field: "duration_value" | "duration_type",
    value: string,
  ) => {
    const updatedData = { ...formData, [field]: value };
    const startDate =
      updatedData.start_date ||
      formData.start_date ||
      new Date().toISOString().split("T")[0];
    const endDate = calculateEndDate(
      startDate,
      updatedData.duration_value || "1",
      updatedData.duration_type,
    );
    setFormData((prev) => ({ ...prev, [field]: value, end_date: endDate }));
  };

  // Automatically update end date when start date changes
  const updateStartDate = (value: string) => {
    const endDate = calculateEndDate(
      value,
      formData.duration_value || "1",
      formData.duration_type,
    );
    setFormData((prev) => ({ ...prev, start_date: value, end_date: endDate }));
  };

  // Get all shared rewards and separate by status
  const allSharedRewards = (sharedRewards as any)?.rewards || [];
  const pendingApprovals = allSharedRewards.filter(
    (reward: Reward) => reward.status === "pending",
  );

  const createRewardMutation = useMutation({
    mutationFn: async (data: CreateRewardData) => {
      return await apiRequest("/api/rewards", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      handleCloseModal();
      toast({
        title: "Reward created",
        description: "Your reward has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reward",
        variant: "destructive",
      });
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: async (data: CreateRewardData & { id: string }) => {
      const { id, ...updateData } = data;
      return await apiRequest(`/api/rewards/${id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      handleCloseModal();
      toast({
        title: "Reward updated",
        description: "Your reward has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reward",
        variant: "destructive",
      });
    },
  });

  const approveRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest(`/api/rewards/${rewardId}/approve`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      // Trigger achievement celebration
      triggerAchievementCelebration();

      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      toast({
        title: "Reward approved! 🎉",
        description: "The reward has been approved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve reward",
        variant: "destructive",
      });
    },
  });

  const rejectRewardMutation = useMutation({
    mutationFn: async ({
      rewardId,
      reason,
    }: {
      rewardId: string;
      reason: string;
    }) => {
      return await apiRequest(`/api/rewards/${rewardId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      toast({
        title: "Reward rejected",
        description: "The reward has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject reward",
        variant: "destructive",
      });
    },
  });

  const handleEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      title: reward.title,
      description: reward.description || "",
      target_metric: reward.target_metric,
      target_value: reward.target_value || "",
      duration_type: reward.duration_type,
      duration_value: reward.duration_value || "",
      start_date: reward.start_date || "",
      end_date: reward.end_date || "",
      shared_with: reward.shared_with || [],
      community_id: reward.community_id || "",
    });
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingReward(null);
    setFormData({
      title: "",
      description: "",
      target_metric: "",
      target_value: "",
      duration_type: "weeks",
      duration_value: "1",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      shared_with: [],
      community_id: "",
    });
  };

  const handleCreateReward = () => {
    if (editingReward) {
      updateRewardMutation.mutate({ ...formData, id: editingReward.id });
    } else {
      createRewardMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Rewards
          </h2>
        </div>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600">
              <Plus className="h-4 w-4" />
              Create Reward
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingReward ? "Edit Reward" : "Create New Reward"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., iPhone 16 Pro, Concert tickets..."
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What makes this reward special?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_metric">Metric Target *</Label>
                <Select
                  value={formData.target_metric}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      target_metric: value,
                      target_value: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a metric to track..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getMetricOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.target_metric && (
                <div className="space-y-2">
                  <Label htmlFor="target_value">Target Value *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="target_value"
                      type="number"
                      min="0"
                      onKeyDown={(e) => {
                        // Prevent minus key
                        if (e.key === "-") {
                          e.preventDefault();
                        }
                      }}
                      onPaste={(e) => {
                        // Prevent pasting negative values
                        const pasteData = e.clipboardData.getData("text");
                        if (pasteData.startsWith("-")) {
                          e.preventDefault();
                        }
                      }}
                      placeholder={(() => {
                        const option = getMetricOptions().find(
                          (opt) => opt.value === formData.target_metric,
                        );
                        return option
                          ? `${option.currentValue + (option.unit === "%" ? 10 : 3)}`
                          : "0";
                      })()}
                      value={formData.target_value}
                      onChange={(e) => {
                        const value = Math.max(0, Number(e.target.value));
                        setFormData((prev) => ({
                          ...prev,
                          target_value: value.toString(),
                        }));
                      }}
                    />
                    <span className="text-sm text-gray-500">
                      {getMetricOptions().find(
                        (opt) => opt.value === formData.target_metric,
                      )?.unit || ""}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="duration">Track progress for</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="duration_value"
                    type="number"
                    min="1"
                    onKeyDown={(e) => {
                      // Prevent minus key
                      if (e.key === "-") {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      // Prevent pasting negative values
                      const pasteData = e.clipboardData.getData("text");
                      if (pasteData.startsWith("-")) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="1"
                    value={formData.duration_value}
                    onChange={(e) =>
                      updateDuration("duration_value", e.target.value)
                    }
                  />
                  <Select
                    value={formData.duration_type}
                    onValueChange={(value) =>
                      updateDuration("duration_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.duration_value && formData.duration_type && (
                  <p className="text-sm text-gray-500">
                    Track progress for {formData.duration_value}{" "}
                    {formData.duration_type}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-800"
                  />
                  <p className="text-xs text-gray-500">
                    Automatically calculated based on duration
                  </p>
                </div>
              </div>

              {/* Community Sharing Section */}
              {communities && (communities as any).communities?.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <Label className="text-sm font-medium">
                      Who can approve this reward?
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="community_select">Select Community</Label>
                    <Select
                      value={formData.community_id}
                      onValueChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          community_id: value,
                          shared_with: [],
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a community..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(communities as any).communities.map(
                          (community: any) => (
                            <SelectItem key={community.id} value={community.id}>
                              {community.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.community_id && (
                    <CommunityMemberSelector
                      communityId={formData.community_id}
                      selectedMembers={formData.shared_with}
                      onMembersChange={(members) =>
                        setFormData((prev) => ({
                          ...prev,
                          shared_with: members,
                        }))
                      }
                      userProfile={userProfile}
                    />
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateReward}
                  disabled={
                    createRewardMutation.isPending ||
                    updateRewardMutation.isPending ||
                    !formData.title ||
                    !formData.target_metric
                  }
                >
                  {createRewardMutation.isPending ||
                  updateRewardMutation.isPending
                    ? editingReward
                      ? "Updating..."
                      : "Creating..."
                    : editingReward
                      ? "Update Reward"
                      : "Create Reward"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeRewardsTab} onValueChange={setActiveRewardsTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-rewards">My Rewards</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Shared Rewards
            {pendingApprovals.length > 0 && (
              <Badge className="ml-2 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-rewards" className="space-y-4">
          {userRewardsLoading ? (
            <div className="text-center py-8">Loading your rewards...</div>
          ) : !userRewards || !(userRewards as any).rewards?.length ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No rewards yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first reward to start tracking achievements! ✨
              </p>
            </div>
          ) : (
            <>
              {/* Active Rewards */}
              {(userRewards as any).rewards.filter(
                (reward: Reward) =>
                  reward.status === "approved" || reward.status === "active",
              ).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Active Rewards
                  </h3>
                  {(userRewards as any).rewards
                    .filter(
                      (reward: Reward) =>
                        reward.status === "approved" ||
                        reward.status === "active",
                    )
                    .map((reward: Reward) => (
                      <RewardProgressCard
                        key={reward.id}
                        reward={reward}
                        progressData={calculateProgress(
                          reward,
                          personalInsights,
                        )}
                        onEdit={handleEditReward}
                      />
                    ))}
                </div>
              )}

              {/* Recent Rewards */}
              {(userRewards as any).rewards.filter(
                (reward: Reward) =>
                  !["approved", "active"].includes(reward.status),
              ).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-500" />
                    Recent Rewards
                  </h3>
                  {(userRewards as any).rewards
                    .filter(
                      (reward: Reward) =>
                        !["approved", "active"].includes(reward.status),
                    )
                    .map((reward: Reward) => (
                      <RewardProgressCard
                        key={reward.id}
                        reward={reward}
                        progressData={calculateProgress(
                          reward,
                          personalInsights,
                        )}
                        onEdit={handleEditReward}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          {sharedRewardsLoading ? (
            <div className="text-center py-8">Loading shared rewards...</div>
          ) : !allSharedRewards.length ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No shared rewards
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                When community members share rewards with you, they'll appear
                here.
              </p>
            </div>
          ) : (
            allSharedRewards.map((reward: Reward) => (
              <Card
                key={reward.id}
                className={`border-l-4 ${
                  reward.status === "pending"
                    ? "border-l-yellow-500"
                    : reward.status === "approved"
                      ? "border-l-green-500"
                      : reward.status === "rejected"
                        ? "border-l-red-500"
                        : "border-l-gray-500"
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift
                      className={`h-5 w-5 ${
                        reward.status === "pending"
                          ? "text-yellow-500"
                          : reward.status === "approved"
                            ? "text-green-500"
                            : reward.status === "rejected"
                              ? "text-red-500"
                              : "text-gray-500"
                      }`}
                    />
                    {reward.title}
                    {reward.status === "pending" && (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pending Your Approval
                      </Badge>
                    )}
                    {reward.status === "approved" && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        You Approved
                      </Badge>
                    )}
                    {reward.status === "rejected" && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Rejected
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Requested by {reward.creator_name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reward.description && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {reward.description}
                      </p>
                    </div>
                  )}

                  {/* Progress Circle for all statuses */}
                  <div className="flex items-center justify-center py-4">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="relative w-20 h-20">
                        <svg
                          className="w-20 h-20 transform -rotate-90"
                          viewBox="0 0 80 80"
                        >
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 36}`}
                            strokeDashoffset={`${2 * Math.PI * 36 * (1 - calculateProgress(reward, personalInsights).progress / 100)}`}
                            className={`${
                              reward.status === "approved"
                                ? "text-green-500"
                                : reward.status === "rejected"
                                  ? "text-red-500"
                                  : "text-yellow-500"
                            } transition-all duration-500 ease-in-out`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-semibold">
                            {Math.round(
                              calculateProgress(reward, personalInsights)
                                .progress,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Current Progress
                      </p>
                    </div>
                  </div>

                  {/* Goal Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Target
                        className={`h-4 w-4 ${
                          reward.status === "pending"
                            ? "text-yellow-500"
                            : reward.status === "approved"
                              ? "text-green-500"
                              : reward.status === "rejected"
                                ? "text-red-500"
                                : "text-gray-500"
                        }`}
                      />
                      <span>
                        <strong>Tracking:</strong>{" "}
                        {reward.target_metric
                          .split("_")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1),
                          )
                          .join(" ")}
                        {reward.target_value && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {" "}
                            (Target: {reward.target_value}%)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">%</span>
                      </div>
                      <span>
                        <strong>Target:</strong> {reward.target_value}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>
                        <strong>Duration:</strong> {reward.duration_value}{" "}
                        {reward.duration_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>
                        <strong>Timeline:</strong>{" "}
                        {(() => {
                          const startDate = reward.start_date
                            ? new Date(reward.start_date).toLocaleDateString()
                            : "Not set";
                          const endDate = reward.end_date
                            ? new Date(reward.end_date).toLocaleDateString()
                            : "Not set";
                          return `${startDate} - ${endDate}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {reward.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveRewardMutation.mutate(reward.id)}
                        disabled={approveRewardMutation.isPending}
                      >
                        {approveRewardMutation.isPending
                          ? "Approving..."
                          : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          const reason = prompt(
                            "Why are you rejecting this reward?",
                          );
                          if (reason) {
                            rejectRewardMutation.mutate({
                              rewardId: reward.id,
                              reason,
                            });
                          }
                        }}
                        disabled={rejectRewardMutation.isPending}
                      >
                        {rejectRewardMutation.isPending
                          ? "Rejecting..."
                          : "Reject"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
