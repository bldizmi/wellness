import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, Heart, Settings, Home, Layers, Zap, Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import symbolPath from "@assets/symbol.png";

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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { logout, user } = useAuth();
  const initials = ((profile as any)?.display_name || "U")
    .charAt(0)
    .toUpperCase();
  const isAdmin = (profile as any)?.role === "admin";

  // Get current streak from API
  const getOverallStreak = () => {
    if (!streakData?.streak) {
      return 0;
    }

    // Return the current streak (consecutive days with at least one completion)
    return streakData.streak.current_streak;
  };

  const handleLogout = async () => {
    setShowMobileMenu(false);
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleProfile = () => {
    setShowMobileMenu(false);
    navigate("/profile");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-gray-900">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* Mobile Logo with Dropdown - positioned ~20px from edges */}
          <div className="md:hidden ml-[20px] mt-[5px]">
            <DropdownMenu
              open={showMobileMenu}
              onOpenChange={setShowMobileMenu}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:opacity-80 transition-opacity"
                >
                  <img
                    src={symbolPath}
                    alt="MindDouble"
                    className="w-[50px] h-[50px]"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 mt-2">
                <DropdownMenuItem
                  onClick={() => {
                    setShowMobileMenu(false);
                    navigate("/");
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Heart className="h-4 w-4" />
                  Vibe Check
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleProfile}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => {
                      setShowMobileMenu(false);
                      navigate("/admin");
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

          {/* Desktop Logo with User Menu - positioned ~20px from edges */}
          <div className="hidden md:flex lg:hidden ml-[20px] mt-[5px]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="hover:opacity-80 transition-opacity"
                >
                  <img
                    src={symbolPath}
                    alt="MindDouble"
                    className="w-[50px] h-[50px]"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link href="/mood" className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Vibe Check
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
