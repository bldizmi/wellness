import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, TrendingUp, Target, Calendar } from "lucide-react";

interface ItemStreakBadgeProps {
  itemId: string;
  recurrenceType?: string;
  className?: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  completion_rate: number;
}

export function ItemStreakBadge({ itemId, recurrenceType, className }: ItemStreakBadgeProps) {
  // Only show streak for recurring items
  if (!recurrenceType || recurrenceType === 'once') {
    return null;
  }

  const { data: streakData, isLoading } = useQuery({
    queryKey: [`/api/item/${itemId}/streak`],
    enabled: !!(itemId && recurrenceType && recurrenceType !== 'once'),
  });

  if (isLoading || !streakData?.streak) {
    return null;
  }

  const streak: StreakData = streakData.streak;

  // Don't show if no completions yet
  if (streak.total_completions === 0) {
    return null;
  }

  const getStreakIcon = () => {
    if (streak.current_streak >= 7) return <Flame className="h-3 w-3 mr-1" />;
    if (streak.current_streak >= 3) return <TrendingUp className="h-3 w-3 mr-1" />;
    return <Target className="h-3 w-3 mr-1" />;
  };

  const getStreakColor = () => {
    if (streak.current_streak >= 7) return "bg-orange-500 text-white hover:bg-orange-600";
    if (streak.current_streak >= 3) return "bg-blue-500 text-white hover:bg-blue-600";
    return "bg-gray-500 text-white hover:bg-gray-600";
  };

  const getTooltipContent = () => {
    return (
      <div className="text-sm space-y-1">
        <div className="font-medium">Streak Information</div>
        <div>Current streak: {streak.current_streak} days</div>
        <div>Longest streak: {streak.longest_streak} days</div>
        <div>Total completions: {streak.total_completions}</div>
        <div>Completion rate: {streak.completion_rate}%</div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={`text-xs px-2 py-0.5 ${getStreakColor()} ${className}`}
          >
            {getStreakIcon()}
            {streak.current_streak}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}