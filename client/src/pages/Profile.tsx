import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronRight, 
  Settings as SettingsIcon, 
  Heart, 
  ChevronDown, 
  User,
  Users,
  Eye,
  Bell,
  Smartphone,
  Shield,
  HelpCircle,
  LogOut,
  Palette
} from "lucide-react";
import { useLocation } from "wouter";
import { useTheme, ThemeMode, ThemeVariant, THEME_COLORS, getThemeDisplayName } from "@/contexts/ThemeContext";

export default function Profile() {
  const [, navigate] = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const { theme, updateMode, updateVariant } = useTheme();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      return await apiRequest("/api/profile");
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleVibeCheck = () => {
    toggleSection("vibecheck");
  };

  const handleAppearanceToggle = () => {
    toggleSection("appearance");
  };

  const selectMode = (mode: ThemeMode) => {
    updateMode(mode);
    // Keep dropdown open to allow color selection
  };

  const selectVariant = (variant: ThemeVariant) => {
    updateVariant(variant);
    setExpandedSections(prev => prev.filter(s => s !== "appearance"));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="p-4 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-20 mb-8"></div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-gray-700 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-24"></div>
                <div className="h-3 bg-gray-700 rounded w-32"></div>
              </div>
            </div>
            <div className="h-6 bg-gray-700 rounded w-16"></div>
          </div>
          <div className="mt-8 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="text-center text-red-400 mt-20">
          <p>Failed to load profile. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <SettingsIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-gray-400">Customize your Mind Double experience</p>
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={profile?.avatar_url}
                alt={profile?.display_name || profile?.username}
              />
              <AvatarFallback className="text-lg bg-blue-600 font-semibold">
                {profile?.display_name
                  ? getInitials(profile.display_name)
                  : profile?.username
                    ? getInitials(profile.username)
                    : "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {profile?.display_name || profile?.username || "User"}
              </div>
              <div className="text-sm text-gray-400">
                {profile?.email || "user@example.com"}
              </div>
            </div>
          </div>
          <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">
            Family Plan
          </Badge>
        </div>
      </div>

      {/* Vibe Check Section */}
      <div className="px-4 py-3">
        <div 
          className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg cursor-pointer hover:bg-gray-800/40 transition-colors"
          onClick={handleVibeCheck}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-medium">Vibe Check</div>
              <div className="text-sm text-gray-400">How are you feeling today?</div>
            </div>
          </div>
          <ChevronDown 
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              expandedSections.includes("vibecheck") ? "rotate-180" : ""
            }`} 
          />
        </div>
        
        {/* Vibe Check Dropdown */}
        {expandedSections.includes("vibecheck") && (
          <div className="mt-2 p-3 bg-gray-800/20 rounded-lg space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {["😊", "😐", "😔", "😴", "😡", "🤔"].map((emoji) => (
                <button
                  key={emoji}
                  className="p-3 text-2xl bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors"
                  onClick={() => {
                    console.log("Selected mood:", emoji);
                    toggleSection("vibecheck");
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="px-4 space-y-6">
        {/* Account Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Account</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Profile</div>
                  <div className="text-sm text-gray-400">Manage your account information</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <Users className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Family & Community</div>
                  <div className="text-sm text-gray-400">Manage family connections and community settings</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Preferences</h3>
          <div className="space-y-1">
            <div 
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
              onClick={handleAppearanceToggle}
            >
              <div className="flex items-center space-x-3">
                <Palette className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Appearance</div>
                  <div className="text-sm text-gray-400">Current: {getThemeDisplayName(theme)}</div>
                </div>
              </div>
              <ChevronDown 
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                  expandedSections.includes("appearance") ? "rotate-180" : ""
                }`} 
              />
            </div>
            
            {/* Enhanced Appearance Dropdown */}
            {expandedSections.includes("appearance") && (
              <div className="mt-3 ml-6 space-y-4">
                {/* Mode Selection */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Theme Mode</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(['dark', 'light', 'neutral'] as ThemeMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={`p-2 rounded-md text-sm transition-colors border ${
                          theme.mode === mode 
                            ? "bg-accent-primary text-white border-accent-primary" 
                            : "text-gray-300 hover:bg-gray-800/40 border-gray-600"
                        }`}
                        onClick={() => selectMode(mode)}
                      >
                        {mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'Neutral'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Variant Selection */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Color Accent</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {THEME_COLORS[theme.mode].map((color, index) => (
                      <button
                        key={color.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                          theme.variant === index 
                            ? "bg-gray-800/60 border border-accent-primary" 
                            : "hover:bg-gray-800/40 border border-transparent"
                        }`}
                        onClick={() => selectVariant(index as ThemeVariant)}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.color }}
                        />
                        <span className="text-sm text-white font-medium">{color.name}</span>
                        {theme.variant === index && (
                          <div className="w-2 h-2 bg-accent-primary rounded-full ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <Bell className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Notifications</div>
                  <div className="text-sm text-gray-400">Manage notification preferences and settings</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <Smartphone className="h-4 w-4 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Mobile App Features</span>
                  <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs">New</Badge>
                </div>
                <div className="text-sm text-gray-400">Camera verification, offline mode</div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Privacy & Security Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Privacy & Security</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <Shield className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Privacy Settings</div>
                  <div className="text-sm text-gray-400">Control your data and privacy preferences</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Support</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <HelpCircle className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Help & Support</div>
                  <div className="text-sm text-gray-400">Get help and contact support</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Mind Double Version */}
        <div className="text-center py-6">
          <div className="text-lg font-bold">Mind Double</div>
          <div className="text-sm text-gray-400">Version 1.0.0</div>
          <div className="text-xs text-gray-500 mt-1">Built with ❤️ for families and teens</div>
        </div>

        {/* Sign Out Button */}
        <div className="pb-20">
          <button 
            onClick={handleSignOut}
            className="flex items-center space-x-3 p-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer w-full"
          >
            <LogOut className="h-4 w-4" />
            <div>
              <div className="font-medium text-left">Sign Out</div>
              <div className="text-sm text-red-400">Sign out of your account</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}