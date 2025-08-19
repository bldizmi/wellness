import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import RewardsTab from "@/components/RewardsTab";

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
      <div className="flex items-center justify-center min-h-screen">
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
    <div className="container mx-auto px-4 py-6 pb-24 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Your Insights
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your progress and performance metrics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Community
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Rewards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          {personalInsights && (
            <>
              {/* Hero Section - Performance Overview */}
              <div className="grid grid-cols-2 gap-4">
                {/* Day Streak */}
                <Card className="text-center p-6">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Flame className="h-8 w-8 text-orange-500" />
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {personalInsights.currentStreaks[0]?.count || 0}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Day Streak
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Score (30 Days) */}
                <Card className="text-center p-6">
                  <CardContent className="p-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center space-y-3 cursor-help">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                            <div className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-1">
                              {personalInsights.completionRate.thisWeek}%
                              <div className="text-green-500 text-lg">↗</div>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-600 dark:text-gray-400 font-medium">
                                Trust Score
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-500">
                                Last 30 Days
                              </p>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Items completed ÷ Items due in last 30 days</p>
                          <p className="text-xs opacity-75">Example: 5 completed ÷ 10 due = 50%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardContent>
                </Card>

                {/* Top Category */}
                <Card className="text-center p-6">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center space-y-3">
                      <Trophy className="h-8 w-8 text-yellow-500" />
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {personalInsights.topPerformingItems[0]?.type || 'None'}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Top Category
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Score (All Time) */}
                <Card className="text-center p-6">
                  <CardContent className="p-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center space-y-3 cursor-help">
                            <Star className="h-8 w-8 text-blue-500" />
                            <div className="text-4xl font-bold text-gray-900 dark:text-white">
                              {personalInsights.trustScore}%
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <p className="text-gray-600 dark:text-gray-400 font-medium">
                                  Trust Score
                                </p>
                                <button 
                                  className="p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                                  title="Based on completion rate for verified tasks and follow-through on commitments"
                                >
                                  <Info className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-500">
                                All Time
                              </p>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Items completed ÷ Items due across all time</p>
                          <p className="text-xs opacity-75">Example: 5 completed ÷ 10 due = 50%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              </div>





              {/* What's Working Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <TrendingUp className="h-5 w-5" />
                    What's Working
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Last 30 Days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {personalInsights.topPerformingItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {item.type}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.count} {item.type.toLowerCase() === 'habits' ? 'completions' : 'items completed'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {item.completionRate}%
                      </Badge>
                    </div>
                  ))}
                  
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {personalInsights.aiInsights[0] || "Keep up the great work with your routines!"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Areas for Growth */}
              {personalInsights.areasForGrowth.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Target className="h-5 w-5" />
                      Growth Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {personalInsights.areasForGrowth.map((area, index) => (
                      <div key={index} className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {area.type}
                          </p>
                          <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
                            {area.completionRate}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {area.suggestion}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* DoubleCheck Stats - Bottom Section */}
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100 font-semibold">
                    <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    DoubleCheck Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Two-column layout for This Week vs All Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* This Week Column */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 pb-2 border-b border-purple-200 dark:border-purple-700">
                          This Week
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 text-center">
                            {personalInsights.doubleCheckStats.itemsVerifiedThisWeek}
                          </div>
                          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium text-center">Items Verified</p>
                        </div>
                        <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {personalInsights.doubleCheckStats.averagePhotos.toFixed(1)}
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium text-center">Avg Photos</p>
                        </div>
                        <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {formatTime(personalInsights.timeSavedThisWeek)}
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium text-center">
                            <span className="text-xs">minutes</span><br />Time Saved
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* All Time Column */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 pb-2 border-b border-purple-200 dark:border-purple-700">
                          All Time
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50/20 dark:bg-purple-950/10 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
                          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {personalInsights.doubleCheckStats.itemsVerified}
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium text-center">Items Verified</p>
                        </div>
                        <div className="p-3 bg-purple-50/20 dark:bg-purple-950/10 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
                          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {personalInsights.doubleCheckStats.averagePhotos.toFixed(1)}
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium text-center">Avg Photos</p>
                        </div>
                        <div className="p-3 bg-purple-50/20 dark:bg-purple-950/10 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
                          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {formatTime(personalInsights.timeSavedTotal)}
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium text-center">
                            <span className="text-xs">minutes</span><br />Time Saved
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="community" className="space-y-6">
          {communityLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : communityInsights ? (
            <>
              {/* Community and Member Selection */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Community Dropdown - only show if user has multiple communities */}
                {userCommunities?.communities && userCommunities.communities.length > 1 && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Community
                    </label>
                    <Select value={selectedCommunityId} onValueChange={setSelectedCommunityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select community" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Communities</SelectItem>
                        {userCommunities.communities.map((community: Community) => (
                          <SelectItem key={community.id} value={community.id}>
                            {community.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Member Dropdown */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Member
                  </label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {communityMembers?.members?.map((member: CommunityMember) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.display_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Community Impact - Smaller Section */}
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100 text-lg">
                    <Users className="h-4 w-4" />
                    {communityInsights.selectedMember ? `${communityInsights.selectedMember}'s Impact` : 'Community Impact'}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="p-1 rounded-full hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-colors"
                          >
                            <Info className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Time saved vs traditional verification methods</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {formatTime(communityInsights.totalTimeSaved)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {communityInsights.selectedMember 
                          ? `saved by ${communityInsights.selectedMember}`
                          : `saved across ${communityInsights.memberCount} members`
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <Heart className="h-5 w-5 text-red-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        More family time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Community Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {Number(communityInsights.communityStats.totalItems).toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Items Shared
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {Number(communityInsights.communityStats.totalVerifications).toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      DoubleCheck Verifications
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {Number(communityInsights.communityStats.avgCompletionRate)}%
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Trust Score
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Verifiers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    {communityInsights.selectedMember ? `${communityInsights.selectedMember}'s Activity` : 'Most Helpful Verifiers'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {communityInsights.topVerifiers.map((verifier, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {verifier.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {verifier.verificationsCount} verifications
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {verifier.trustScore}% trust
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Popular Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-blue-500" />
                    {communityInsights.selectedMember ? `${communityInsights.selectedMember}'s Favorite Tasks` : 'Popular Shared Items'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {communityInsights.popularItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {item.type}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.count} items shared
                        </p>
                      </div>
                      <Badge variant="outline">
                        {item.avgPhotos.toFixed(1)} avg photos
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
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

        <TabsContent value="rewards" className="space-y-6">
          <RewardsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}