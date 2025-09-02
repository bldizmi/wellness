import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Layers, Zap, Trophy, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Header() {
  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });
  
  // Fetch overall user streak from dedicated API
  const { data: streakData } = useQuery({
    queryKey: ["/api/streak/overall"],
    queryFn: async () => {
      return await apiRequest("/api/streak/overall");
    },
    staleTime: 30000,
  });
  const [location, navigate] = useLocation();

  // Get current streak from API
  const getOverallStreak = () => {
    if (!streakData?.streak) {
      return 0;
    }

    // Return the current streak (consecutive days with at least one completion)
    return streakData.streak.current_streak;
  };


  return (
    <header className="sticky top-0 z-50 w-full bg-gray-900">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* Mobile Search Icon - positioned ~20px from edges */}
          <div className="md:hidden ml-[20px] mt-[5px]">
            <Button
              variant="ghost"
              size="icon"
              className="hover:opacity-80 transition-opacity"
            >
              <Search className="h-6 w-6 text-gray-300" />
            </Button>
          </div>

          {/* Mobile Welcome Message - positioned in upper right */}
          {/* <div className="md:hidden mr-[20px] text-sm text-gray-500">
            Hi, {(profile as any)?.display_name || 'there'}!
          </div> */}
          {/* Mobile Streak Indicator */}
          <div className="md:hidden mr-[20px] flex items-center gap-1">
            <span className="text-orange-500 text-lg">🔥</span>
            <span className="text-orange-500 font-bold text-sm">{getOverallStreak()}</span>
          </div>

          {/* Desktop Search Icon - positioned ~20px from edges */}
          <div className="hidden md:flex lg:hidden ml-[20px] mt-[5px]">
            <Button
              variant="ghost"
              size="icon"
              className="hover:opacity-80 transition-opacity"
            >
              <Search className="h-6 w-6 text-gray-300" />
            </Button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex lg:hidden items-center gap-1">
            <Link href="/today">
              <Button
                variant={location === "/today" ? "default" : "ghost"}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/plans">
              <Button
                variant={location === "/plans" ? "default" : "ghost"}
                className="flex items-center gap-2"
              >
                <Layers className="h-4 w-4" />
                Plans
              </Button>
            </Link>
            <Link href="/insights">
              <Button
                variant={location === "/insights" ? "default" : "ghost"}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Insights
              </Button>
            </Link>
            <Link href="/rewards">
              <Button
                variant={location === "/rewards" ? "default" : "ghost"}
                className="flex items-center gap-2"
              >
                <Trophy className="h-4 w-4" />
                Rewards
              </Button>
            </Link>
          </nav>

          {/* Tablet Welcome Message - positioned after navigation */}
          <div className="hidden md:flex lg:hidden text-sm text-gray-500 ml-4">
            Hi, {(profile as any)?.display_name || "there"}!
          </div>
        </div>
      </div>
    </header>
  );
}
