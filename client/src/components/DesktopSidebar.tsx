import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  Layers,
  User,
  Plus,
  BarChart3,
  Users,
  Heart,
  LogOut,
  Settings,
  Zap,
  Trophy,
} from "lucide-react";
import symbolPath from "@assets/symbol.png";

export default function DesktopSidebar() {
  const { data: profile } = useQuery({ queryKey: ["/api/profile"] });
  // Fetch items data (same as Plans page)
  const { data: itemsData } = useQuery({
    queryKey: ["/api/items"],
    staleTime: 30000, // 30 seconds cache for performance
  });
  const [location, navigate] = useLocation();
  const { logout } = useAuth();
  const initials = ((profile as any)?.display_name || "U")
    .charAt(0)
    .toUpperCase();
  const isAdmin = profile && (profile as any)?.role === "admin";

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navItems = [
    { href: "/today", label: "Home", icon: Home },
    { href: "/plans", label: "Plans", icon: Layers },
    { href: "/insights", label: "Insights", icon: Zap },
    { href: "/rewards", label: "Rewards", icon: Trophy },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
  ];

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:bg-background lg:border-r lg:h-screen lg:fixed lg:left-0 lg:top-0">
      {/* Logo with User Menu - positioned ~20px from edges */}
      <div className="p-5 border-b ml-[20px] mt-[25px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 hover:bg-accent hover:text-accent-foreground transition-colors w-full justify-start p-3 cursor-pointer"
            >
              <img
                src={symbolPath}
                alt="MindDouble"
                className="w-[50px] h-[50px]"
              />
              <span className="font-bold text-lg">MindDouble</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-3 py-2 text-sm text-gray-500 border-b">
              Welcome back, {(profile as any)?.display_name || "there"}!
            </div>
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

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className="relative">
              <Button
                variant={location === href ? "default" : "ghost"}
                className="w-full justify-start gap-3"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
              {href === "/plans" && overdueCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold text-white rounded-full"
                  style={{ backgroundColor: "#A18CFF" }}
                >
                  {overdueCount > 9 ? "9+" : overdueCount}
                </Badge>
              )}
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}
