import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trophy,
  Edit,
  Home,
  Calendar,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";
import { CreateWithAIModal } from "./CreateWithAIModal";
import { CreateOrEditItemModal } from "./CreateOrEditItemModal";

export default function BottomNavigation() {
  const [location, navigate] = useLocation();
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Fetch items data (same as Plans page)
  const { data: itemsData } = useQuery({
    queryKey: ["/api/items"],
    staleTime: 30000,
  });

  console.log("Item Data:", itemsData);

  // Helper function to check if item is completed (copied from Plans page)
  const isItemCompleted = (item: any) => {
    if (item.recurrence_type && item.recurrence_type !== "once") {
      // For recurring items, ONLY check date-specific completion status from item_completions table
      return item.is_completed_for_date;
    }
    // For one-time items, check completed_at OR verified status
    return (
      item.completed_at ||
      (item.verify_required && item.status === "complete") ||
      (item.verified && item.ai_verification_result === "complete")
    );
  };

  // Helper function to check if item is overdue (copied from Plans page)
  const isItemOverdue = (item: any) => {
    // Only check overdue for Tasks, Goals, and Projects (not Habits)
    if (item.item_type === "habit") return false;

    // Must have a due date and be incomplete
    if (!item.due_date || isItemCompleted(item)) return false;

    // Parse due date without timezone conversion
    const [year, month, day] = item.due_date.split("-");
    const dueDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only

    return dueDate < today;
  };

  // Calculate overdue count using same logic as Plans page
  const overdueCount = useMemo(() => {
    if (!itemsData || !(itemsData as any)?.items) return 0;
    return (itemsData as any).items.filter(isItemOverdue).length;
  }, [itemsData]);

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-pb z-50">
        <div className="relative flex items-center justify-between px-6 py-3 max-w-md mx-auto">
          {/* Home/Today Button */}
          <button
            className={`flex flex-col items-center justify-center min-h-[60px] min-w-[60px] p-2 transition-all duration-150 bg-transparent hover:bg-transparent ${
              location === "/today"
                ? "text-accent-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate("/today")}
          >
            <Home
              className="h-6 w-6 mb-1"
              strokeWidth={2}
            />
            <span className="text-xs font-medium">Home</span>
          </button>

          {/* Plans Button */}
          <div className="relative">
            <button
              className={`flex flex-col items-center justify-center min-h-[60px] min-w-[60px] p-2 transition-all duration-150 bg-transparent hover:bg-transparent ${
                location === "/plans"
                  ? "text-accent-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => navigate("/plans")}
            >
              <Calendar
                className="h-6 w-6 mb-1"
                strokeWidth={2}
              />
              <span className="text-xs font-medium">Plans</span>
            </button>
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold text-white rounded-full"
                style={{ backgroundColor: "#A18CFF" }}
              >
                {overdueCount > 9 ? "9+" : overdueCount}
              </Badge>
            )}
          </div>

          {/* Insights Button */}
          <button
            className={`flex flex-col items-center justify-center min-h-[60px] min-w-[60px] p-2 transition-all duration-150 bg-transparent hover:bg-transparent ${
              location === "/insights"
                ? "text-accent-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate("/insights")}
          >
            <BarChart3
              className="h-6 w-6 mb-1"
              strokeWidth={2}
            />
            <span className="text-xs font-medium">Insights</span>
          </button>

          {/* Rewards Button */}
          <button
            className={`flex flex-col items-center justify-center min-h-[60px] min-w-[60px] p-2 transition-all duration-150 bg-transparent hover:bg-transparent ${
              location === "/rewards"
                ? "text-accent-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate("/rewards")}
          >
            <Trophy
              className="h-6 w-6 mb-1"
              strokeWidth={2}
            />
            <span className="text-xs font-medium">Rewards</span>
          </button>

          {/* Settings/Profile Button */}
          <button
            className={`flex flex-col items-center justify-center min-h-[60px] min-w-[60px] p-2 transition-all duration-150 bg-transparent hover:bg-transparent ${
              location === "/profile"
                ? "text-accent-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate("/profile")}
          >
            <Settings
              className="h-6 w-6 mb-1"
              strokeWidth={2}
            />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>

        {/* Floating + Button positioned 20px above Settings icon */}
        <div className="absolute bottom-[84px] right-[20px]">
          <Button
            onClick={() => setShowChoiceModal(!showChoiceModal)}
            className="h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-accent-primary hover:bg-accent-hover hover:scale-110"
            size="icon"
          >
            <Plus className="h-10 w-10 stroke-[3] transition-transform duration-200" />
            <span className="sr-only">Create new item</span>
          </Button>
        </div>
      </div>

      {/* Choice Menu - positioned above the navigation */}
      {showChoiceModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowChoiceModal(false)}
          />

          {/* Menu options positioned above the button */}
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 space-y-3">
            <Button
              className="w-48 h-14 bg-accent-primary hover:bg-accent-hover text-white rounded-full flex items-center justify-center gap-3 text-base font-medium shadow-lg backdrop-blur-sm transition-all duration-150 hover:scale-105"
              onClick={() => {
                setShowChoiceModal(false);
                setShowAIModal(true);
              }}
            >
              <Sparkles className="h-5 w-5 transition-transform duration-150" />
              AI Assistant
            </Button>

            <Button
              className="w-48 h-14 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full flex items-center justify-center gap-3 text-base font-medium shadow-lg backdrop-blur-sm border border-gray-200 dark:border-gray-600 transition-all duration-150 hover:scale-105"
              onClick={() => {
                setShowChoiceModal(false);
                setShowManualModal(true);
              }}
            >
              <Edit className="h-5 w-5 transition-transform duration-150" />
              Create
            </Button>
          </div>
        </>
      )}

      {/* AI Modal */}
      <CreateWithAIModal open={showAIModal} onOpenChange={setShowAIModal} />

      {/* Manual Creation Modal */}
      <CreateOrEditItemModal
        isOpen={showManualModal}
        onOpenChange={setShowManualModal}
        item={null}
      />
    </>
  );
}
