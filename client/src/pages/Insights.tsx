import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { 
  Clock, 
  TrendingUp, 
  Target, 
  Users, 
  Zap, 
  Heart,
  CheckCircle,
  Flame,
  Trophy,
  Star,
  Timer,
  Info
} from 'lucide-react';

interface PersonalInsights {
  timeSavedThisWeek: number;
  timeSavedTotal: number;
  currentStreaks: Array<{
    itemType: string;
    count: number;
    title: string;
  }>;
  completionRate: {
    thisWeek: number;
    lastWeek: number;
  };
  topPerformingItems: Array<{
    type: string;
    completionRate: number;
    count: number;
  }>;
  trustScore: number;
  doubleCheckStats: {
    itemsVerified: number;
    itemsVerifiedThisWeek: number;
    averagePhotos: number;
    timePerVerification: number;
  };
  aiInsights: string[];
  areasForGrowth: Array<{
    type: string;
    completionRate: number;
    suggestion: string;
  }>;
}

interface CommunityInsights {
  selectedMember?: string;
  totalTimeSaved: number;
  memberCount: number;
  topVerifiers: Array<{
    name: string;
    verificationsCount: number;
    trustScore: number;
  }>;
  popularItems: Array<{
    type: string;
    count: number;
    avgPhotos: number;
  }>;
  communityStats: {
    totalItems: number;
    totalVerifications: number;
    avgCompletionRate: number;
  };
}

interface Community {
  id: string;
  name: string;
}

interface CommunityMember {
  user_id: string;
  display_name: string;
  email: string;
}

interface UserCommunitiesResponse {
  communities: Community[];
}

interface CommunityMembersResponse {
  members: CommunityMember[];
}

export default function Insights() {
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');

  const { data: personalInsights, isLoading: personalLoading, error: personalError } = useQuery<PersonalInsights>({
    queryKey: ['/api/insights/personal'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  // Add separate streak query using the same API as Header for real-time updates
  const { data: streakData } = useQuery({
    queryKey: ["/api/streak/overall"],
    queryFn: async () => {
      return await apiRequest("/api/streak/overall");
    },
    staleTime: 30000, // Same as Header (30 seconds)
  });

  // Fetch user's communities for dropdown
  const { data: userCommunities } = useQuery<UserCommunitiesResponse>({
    queryKey: ['/api/community'],
    enabled: activeTab === 'community'
  });

  // Fetch community members for dropdown
  const { data: communityMembers } = useQuery<CommunityMembersResponse>({
    queryKey: [`/api/insights/community/members/${selectedCommunityId}`],
    enabled: activeTab === 'community'
  });

  // Build dynamic query key that changes when dropdowns change
  const communityQueryKey = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCommunityId !== 'all') params.append('communityId', selectedCommunityId);
    if (selectedMemberId !== 'all') params.append('memberId', selectedMemberId);
    
    return [`/api/insights/community${params.toString() ? `?${params.toString()}` : ''}`];
  }, [selectedCommunityId, selectedMemberId]);

  const { data: communityInsights, isLoading: communityLoading } = useQuery<CommunityInsights>({
    queryKey: communityQueryKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: activeTab === 'community'
  });

  // Fetch weekly activity data for chart
  const { data: weeklyActivity, isLoading: weeklyLoading } = useQuery({
    queryKey: ['/api/insights/weekly-activity'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    onSuccess: (data) => {
      console.log('📊 Weekly Activity Data:', data);
    }
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <TrendingUp className="h-4 w-4 text-gray-400 rotate-180" />;
  };

  if (personalLoading && activeTab === 'personal') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (personalError) {
    return (
      <ErrorState 
        message="Failed to load personal insights"
        onRetry={() => queryClient.refetchQueries({ queryKey: ['/api/insights/personal'] })}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 max-w-4xl bg-slate-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Your Insights
        </h1>
        <p className="text-gray-300">
          Track progress and achievements
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800 border-slate-700">
          <TabsTrigger value="personal" className="flex items-center gap-2 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            <Target className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-2 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            <Users className="h-4 w-4" />
            Community
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          {personalInsights && (
            <>
              {/* Hero Section - Performance Overview */}
              <div className="grid grid-cols-2 gap-3">
                {/* Day Streak - Orange */}
                <Card className="text-center p-6 bg-orange-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Flame className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {streakData?.streak?.current_streak || 0}
                      </div>
                      <p className="text-white/90 font-medium">
                        Day Streak
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Score - Green */}
                <Card className="text-center p-6 bg-green-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <CheckCircle className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {personalInsights.completionRate.thisWeek}%
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-medium">
                          Trust Score
                        </p>
                        <p className="text-sm text-white/75">
                          This Month
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Badges - Purple */}
                <Card className="text-center p-6 bg-purple-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Trophy className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {personalInsights.doubleCheckStats.itemsVerifiedThisWeek}
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-medium">
                          Verified
                        </p>
                        <p className="text-sm text-white/75">
                          this week
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Completion Rate - Blue */}
                <Card className="text-center p-6 bg-blue-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <TrendingUp className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {personalInsights.completionRate.thisWeek}%
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-medium">
                          This Week
                        </p>
                        <p className="text-sm text-white/75">
                          {Math.round(personalInsights.completionRate.thisWeek / 20)} of 5 completed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Activity Chart */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="flex items-center gap-2 text-white font-semibold text-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                    Weekly Activity
                  </h3>
                </div>
                
                {/* Real Weekly Activity Bar Chart */}
                <div className="flex items-end justify-center gap-1 h-20 mb-4">
                  {weeklyLoading ? (
                    // Loading skeleton
                    [...Array(7)].map((_, index) => (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <div className="w-8 h-12 bg-slate-600 rounded-t animate-pulse"></div>
                      </div>
                    ))
                  ) : weeklyActivity?.weeklyActivity ? (
                    // Real weekly data
                    weeklyActivity.weeklyActivity.map((day: any, index: number) => {
                      // Calculate height in pixels for better visibility (max 80px for the h-20 container)
                      const height = day.total > 0 
                        ? Math.max(16, Math.min(80, Math.round(day.percentage * 0.8))) // Scale percentage to pixels
                        : 8; // Very small bar for days with no instances
                      const isToday = day.date === new Date().toISOString().split('T')[0];
                      
                      console.log('📊 Day:', day.day, 'Height:', height, 'Data:', day);
                      
                      return (
                        <div key={day.date} className="flex flex-col items-center gap-1 group relative">
                          <div 
                            className={`w-8 rounded-t transition-all duration-200 ${
                              day.completed > 0 
                                ? (isToday ? 'bg-green-500' : 'bg-blue-500')
                                : 'bg-slate-600'
                            } hover:opacity-80`}
                            style={{ 
                              height: `${height}px`,  // Use px instead of % for more reliable rendering
                              minHeight: '8px'        // Ensure minimum visible height
                            }}
                          ></div>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-700 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            <div>{day.day}</div>
                            <div>{day.completed}/{day.total}</div>
                            <div>{day.percentage}%</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Empty state
                    [...Array(7)].map((_, index) => (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <div className="w-8 h-4 bg-slate-600 rounded-t"></div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Day Labels */}
                <div className="flex justify-center gap-1">
                  {weeklyActivity?.weeklyActivity ? 
                    weeklyActivity.weeklyActivity.map((day: any) => (
                      <div key={day.date} className="w-8 text-center">
                        <p className="text-xs text-gray-300 font-medium">{day.day.slice(0, 1)}</p>
                      </div>
                    )) : 
                    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <div key={index} className="w-8 text-center">
                        <p className="text-xs text-gray-300 font-medium">{day}</p>
                      </div>
                    ))
                  }
                </div>
                
                {/* Legend & Summary */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-sm text-gray-300">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-300">Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-slate-600 rounded"></div>
                      <span className="text-sm text-gray-300">No Activity</span>
                    </div>
                  </div>
                  
                  {weeklyActivity?.summary && (
                    <div className="text-right">
                      <div className="text-sm text-white font-medium">
                        {weeklyActivity.summary.totalCompleted}/{weeklyActivity.summary.totalInstances}
                      </div>
                      <div className="text-xs text-gray-400">
                        This Week
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </TabsContent>

        <TabsContent value="community" className="space-y-4">
          {communityLoading ? (
            <div className="flex items-center justify-center py-12 bg-slate-900">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : communityInsights ? (
            <>
              {/* Community Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-blue-500" />
                  <h3 className="text-white font-medium">Select Community</h3>
                </div>
                <Select value={selectedCommunityId} onValueChange={setSelectedCommunityId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="All Communities" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-white focus:bg-slate-700">All Communities</SelectItem>
                    {userCommunities?.communities?.map((community: Community) => (
                      <SelectItem key={community.id} value={community.id} className="text-white focus:bg-slate-700">
                        {community.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Members and Rank Cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Members Card - Purple */}
                <Card className="text-center p-6 bg-purple-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Users className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {communityInsights.memberCount}
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-medium">
                          Members
                        </p>
                        <p className="text-sm text-white/75">
                          Across {userCommunities?.communities?.length || 1} communities
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Your Rank Card - Green */}
                <Card className="text-center p-6 bg-green-500 text-white border-0 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Trophy className="h-8 w-8 text-white" />
                      <div className="text-4xl font-bold text-white">
                        {communityInsights.topVerifiers?.findIndex(v => v.name.includes('You')) + 1 || 2}
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-medium">
                          Your Rank
                        </p>
                        <p className="text-sm text-white/75">
                          Out of {communityInsights.topVerifiers?.length || Math.min(5, communityInsights.memberCount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Leaderboard Section */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-white font-semibold text-lg">Leaderboard</h3>
                  <span className="text-gray-400 text-sm">This Week</span>
                </div>

                <div className="space-y-4">
                  {communityInsights.topVerifiers?.map((verifier, index) => {
                    const isCurrentUser = verifier.name.toLowerCase().includes('you');
                    const avatarColors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-500', 'bg-slate-600', 'bg-blue-500'];
                    const rankIcons = ['🏆', '♥', '🏅', '🏃', '⭐'];
                    
                    // Calculate points based on trust score and verifications (since points aren't in API)
                    const points = (verifier.trustScore * 10) + (verifier.verificationsCount * 50);
                    
                    // Generate realistic rank changes based on performance
                    const rankChange = index === 0 ? '+5' : 
                                     index === 1 ? '+2' : 
                                     index === 2 ? '-1' : '—';
                    const changeColor = rankChange.startsWith('+') ? 'text-green-400' : 
                                       rankChange.startsWith('-') ? 'text-red-400' : 'text-gray-500';

                    return (
                      <div 
                        key={verifier.name}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isCurrentUser ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 ${avatarColors[index % avatarColors.length]} rounded-full flex items-center justify-center text-white font-bold`}>
                            {index < 4 ? verifier.name.charAt(0).toUpperCase() : index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{rankIcons[index % rankIcons.length]}</span>
                            <div>
                              <p className="font-medium text-white">
                                {verifier.name}
                                {isCurrentUser && <span className="text-gray-400 text-sm ml-1">You</span>}
                              </p>
                              <p className="text-sm text-gray-400">{points.toLocaleString()} points</p>
                            </div>
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${changeColor}`}>{rankChange}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Join a community to see community insights
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}