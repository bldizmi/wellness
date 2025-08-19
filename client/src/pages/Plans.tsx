
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CreateOrEditItemModal } from '@/components/CreateOrEditItemModal';
import { PhotoVerificationModal } from '@/components/PhotoVerificationModal';
import { Repeat, Calendar, Clock, Camera, Share2, Users, ChevronDown, ChevronUp, AlertCircle, ClockIcon, CalendarDays, Check } from 'lucide-react';
import { ItemStreakBadge } from '@/components/ItemStreakBadge';
import { useAuth } from '@/contexts/AuthContext';

import { DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const itemTypes = ['all', 'task', 'habit', 'goal', 'project', 'chore'];
const statusOptions = ['all', 'complete', 'incomplete', 'past_due', 'upcoming'];

export default function Plans() {
  const [editingItem, setEditingItem] = useState(null);
  const [verifyingItem, setVerifyingItem] = useState(null);
  const [sharingItem, setSharingItem] = useState(null);
  const [selectedCommunity, setSelectedCommunity] = useState("");
  const [shareVisibility, setShareVisibility] = useState("community");
  const [filter, setFilter] = useState('one-time'); // 'one-time', 'recurring'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open', 'completed'
  const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();



  // Helper function to check if item is completed
  const isItemCompleted = (item: any) => {
    if (item.recurrence_type && item.recurrence_type !== 'once') {
      // For recurring items, ONLY check date-specific completion status from item_completions table
      return item.is_completed_for_date;
    }
    // For one-time items, check completed_at OR verified status
    return item.completed_at || (item.verify_required && item.status === 'complete') || (item.verified && item.ai_verification_result === 'complete');
  };

  // Helper function to check if item is overdue (only for incomplete Tasks, Goals, Projects)
  const isItemOverdue = (item: any) => {
    // Only check overdue for Tasks, Goals, and Projects (not Habits)
    if (item.item_type === 'habit') return false;
    
    // Must have a due date and be incomplete
    if (!item.due_date || isItemCompleted(item)) return false;
    
    // Parse due date without timezone conversion
    const [year, month, day] = item.due_date.split('-');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    return dueDate < today;
  };

  // Helper function to calculate days overdue
  const getDaysOverdue = (item: any) => {
    if (!item.due_date) return 0;
    
    const [year, month, day] = item.due_date.split('-');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper function to group overdue items by time ranges
  const groupOverdueItems = (overdueItems: any[]) => {
    const groups = {
      combined: [] as any[], // 1-7 days (combines recent and moderate)
      longterm: [] as any[] // Over a week
    };

    overdueItems.forEach(item => {
      const daysOverdue = getDaysOverdue(item);
      if (daysOverdue <= 7) {
        groups.combined.push(item);
      } else {
        groups.longterm.push(item);
      }
    });

    // Sort combined items by days overdue (most recent first)
    groups.combined.sort((a, b) => getDaysOverdue(a) - getDaysOverdue(b));
    groups.longterm.sort((a, b) => getDaysOverdue(a) - getDaysOverdue(b));

    return groups;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['items'],
    queryFn: () => apiRequest('/api/items'),
    staleTime: 0,
    refetchInterval: 1000
  });

  // Fetch user communities for sharing
  const { data: communities } = useQuery({
    queryKey: ['/api/community'],
    queryFn: async () => {
      return await apiRequest('/api/community');
    },
  });

  // Share item mutation
  const shareItemMutation = useMutation({
    mutationFn: async ({ itemId, communityId, visibility }: { itemId: string; communityId: string; visibility: string }) => {
      return await apiRequest(`/api/item/${itemId}/share`, {
        method: 'POST',
        body: JSON.stringify({ community_id: communityId, visibility })
      });
    },
    onSuccess: () => {
      // Invalidate comprehensive Today page caches after sharing item
      queryClient.invalidateQueries({ 
        queryKey: ['/api/today/personal-progress'], 
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/today/shared'], 
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/today/personal-progress/week'], 
        exact: false
      });
      
      // Legacy cache invalidation for backward compatibility
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today'] });
      
      toast({ title: "Success", description: "Item shared successfully!" });
      setSharingItem(null);
      setSelectedCommunity("");
      setShareVisibility("community");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to share item", variant: "destructive" });
    },
  });



  const items = data?.items || [];

  // Calculate overdue items (Tasks, Goals, Projects only - not Habits)
  const overdueItems = useMemo(() => {
    return items.filter(isItemOverdue);
  }, [items]);

  // Group overdue items by time ranges
  const overdueGroups = useMemo(() => {
    return groupOverdueItems(overdueItems);
  }, [overdueItems]);

  // Filter items based on all selected filters - stacked properly
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let filtered = [...items];

    // First apply main recurrence filter
    if (filter === 'one-time') {
      filtered = filtered.filter((item: any) => !item.recurrence_type || item.recurrence_type === 'once');
    } else if (filter === 'recurring') {
      filtered = filtered.filter((item: any) => item.recurrence_type && item.recurrence_type !== 'once');
    }

    // Then apply type filters (stacked on top of recurrence filter)
    if (itemTypeFilter === 'shared') {
      filtered = filtered.filter((item: any) => {
        // Show items shared BY user (created by user and shared with others)
        const sharedByUser = item.shared_with && 
                            item.shared_with.length > 0 &&
                            item.created_by === user?.uid;
        
        // Show items shared WITH user (user is in shared_with array) BUT NOT assigned to them
        const sharedWithUser = item.shared_with && 
                              Array.isArray(item.shared_with) &&
                              item.shared_with.includes(user?.uid) &&
                              item.assigned_to !== user?.uid;
        
        return sharedByUser || sharedWithUser;
      });
    } else if (itemTypeFilter === 'open') {
      filtered = filtered.filter((item: any) => item.assigned_to === null);
    } else if (itemTypeFilter !== 'all') {
      filtered = filtered.filter((item: any) => item.item_type === itemTypeFilter);
    }

    // Finally apply status filter
    if (statusFilter === 'completed') {
      filtered = filtered.filter((item: any) => isItemCompleted(item));
    } else if (statusFilter === 'open') {
      filtered = filtered.filter((item: any) => !isItemCompleted(item));
    }

    return filtered;
  }, [items, filter, itemTypeFilter, statusFilter, user?.uid]);

  if (isLoading) {
    return <div className="text-center py-8">Loading your plans...</div>;
  }

  if (isError) {
    return <div className="text-center py-8 text-red-500">Error loading plans. Please refresh the page.</div>;
  }

  // Helper function to get recurrence badge info
  const getRecurrenceBadge = (item: any) => {
    if (!item.recurrence_type || item.recurrence_type === 'once') return null;
    
    const type = item.recurrence_type;
    let label = type.charAt(0).toUpperCase() + type.slice(1);
    let variant: "default" | "secondary" | "outline" = "secondary";
    
    if (type === 'daily') {
      label = 'Daily';
      variant = "default";
    } else if (type === 'weekly') {
      if (item.by_day && item.by_day.length > 0) {
        label = `Weekly (${item.by_day.length} days)`;
      } else {
        label = 'Weekly';
      }
      variant = "outline";
    } else if (type === 'monthly') {
      if (item.by_monthday) {
        label = `Monthly (${item.by_monthday}${getOrdinalSuffix(item.by_monthday)})`;
      } else if (item.by_week && item.by_day) {
        label = `Monthly (${item.by_week}${getOrdinalSuffix(item.by_week)} ${item.by_day[0]})`;
      } else {
        label = 'Monthly';
      }
      variant = "secondary";
    } else if (type === 'yearly') {
      if (item.by_month && item.by_monthday) {
        label = `Yearly (${item.by_month} ${item.by_monthday})`;
      } else {
        label = 'Yearly';
      }
      variant = "outline";
    } else if (type === 'custom') {
      label = 'Custom';
      variant = "secondary";
    }
    
    return { label, variant };
  };

  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (num: number) => {
    const suffix = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return suffix[(v - 20) % 10] || suffix[v] || suffix[0];
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-2 pt-2">
        <h1 className="text-2xl font-bold">Your Plans</h1>
        <p className="text-sm text-muted-foreground">Everything you've created</p>
        
        {/* Overdue Section */}
        {overdueItems.length > 0 && (
          <div className="mt-3 p-3 border border-orange-200 rounded-lg bg-orange-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-orange-600" />
                <h2 className="text-base font-semibold text-orange-800">Let's catch up on these</h2>
                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 px-1.5 py-0.5">
                  {overdueItems.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOverdueCollapsed(!isOverdueCollapsed)}
                className="h-6 w-6 p-0 text-orange-600 hover:bg-orange-100"
              >
                {isOverdueCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </Button>
            </div>
            
            {!isOverdueCollapsed && (
              <div className="space-y-2">
                {/* Combined overdue (1-7 days) */}
                {overdueGroups.combined.length > 0 && (
                  <div className="space-y-1">
                    {(showAllOverdue ? overdueGroups.combined : overdueGroups.combined.slice(0, 5)).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-orange-200">
                        <div className="flex-1 cursor-pointer" onClick={() => setEditingItem(item)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0">
                                {getDaysOverdue(item)}d
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="capitalize">{item.item_type}</span>
                              <span>• Due {(() => {
                                const [year, month, day] = item.due_date.split('-');
                                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              })()}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingItem(item)}
                          className="text-xs ml-2 h-6 px-2"
                        >
                          Reschedule
                        </Button>
                      </div>
                    ))}
                    
                    {overdueGroups.combined.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllOverdue(!showAllOverdue)}
                        className="w-full h-6 text-xs text-orange-600 hover:bg-orange-100"
                      >
                        {showAllOverdue ? 'Show Less' : `Show ${overdueGroups.combined.length - 5} More`}
                      </Button>
                    )}
                  </div>
                )}

                {/* Long-term overdue (over a week) */}
                {overdueGroups.longterm.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-orange-700 mb-1 mt-3">Over a Week</h3>
                    <div className="space-y-1">
                      {overdueGroups.longterm.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-red-200">
                          <div className="flex-1 cursor-pointer" onClick={() => setEditingItem(item)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                                <Badge variant="outline" className="text-xs bg-red-100 text-red-700 px-1.5 py-0">
                                  {getDaysOverdue(item)}d
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="capitalize">{item.item_type}</span>
                                <span>• Due {(() => {
                                  const [year, month, day] = item.due_date.split('-');
                                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                })()}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingItem(item)}
                            className="text-xs ml-2 h-6 px-2"
                          >
                            Reschedule
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success message when no overdue items */}
        {overdueItems.length === 0 && items.length > 0 && (
          <div className="mt-4 p-3 border border-green-200 rounded-lg bg-green-50/50">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">All caught up! Great job staying on top of things 🌟</p>
            </div>
          </div>
        )}
        
        {/* Main Filter Tabs - Compact and Sticky */}
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          <Button
            variant={filter === 'one-time' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('one-time')}
            className="rounded-full h-7 text-xs px-3"
          >
            One-time ({items.filter((item: any) => !item.recurrence_type || item.recurrence_type === 'once').length})
          </Button>
          <Button
            variant={filter === 'recurring' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('recurring')}
            className="rounded-full h-7 text-xs px-3"
          >
            <Repeat className="h-3 w-3 mr-1" />
            Recurring ({items.filter((item: any) => item.recurrence_type && item.recurrence_type !== 'once').length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="p-1 h-5 w-5 rounded-full"
          >
            {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {/* Collapsible Secondary Filters - Compact */}
        {showAdvancedFilters && (
          <div className="mt-1.5 space-y-1.5 pb-1">
            {/* Status Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground min-w-[50px]">Status:</span>
              <div className="flex gap-1">
                <Button
                  variant={statusFilter === 'open' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('open')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Open
                </Button>
                <Button
                  variant={statusFilter === 'completed' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('completed')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Completed
                </Button>
              </div>
            </div>

            {/* Item Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground min-w-[40px]">Type:</span>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={itemTypeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('all')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant={itemTypeFilter === 'task' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('task')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Tasks
                </Button>
                <Button
                  variant={itemTypeFilter === 'habit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('habit')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Habits
                </Button>
                <Button
                  variant={itemTypeFilter === 'goal' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('goal')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Goals
                </Button>
                <Button
                  variant={itemTypeFilter === 'project' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('project')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  Projects
                </Button>
                <Button
                  variant={itemTypeFilter === 'shared' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('shared')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Shared ({items.filter((item: any) => {
                    // Apply recurrence filter first, then check if shared
                    let filteredForCount = [...items];
                    if (filter === 'one-time') {
                      filteredForCount = filteredForCount.filter((i: any) => !i.recurrence_type || i.recurrence_type === 'once');
                    } else if (filter === 'recurring') {
                      filteredForCount = filteredForCount.filter((i: any) => i.recurrence_type && i.recurrence_type !== 'once');
                    }
                    return filteredForCount.find((i: any) => i.id === item.id) && 
                           item.shared_with && 
                           item.shared_with.length > 0 && 
                           item.created_by === user?.uid;
                  }).length})
                </Button>
                <Button
                  variant={itemTypeFilter === 'open' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setItemTypeFilter('open')}
                  className="rounded-full h-6 px-2 text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Open ({items.filter((item: any) => {
                    // Apply recurrence filter first, then check if open
                    let filteredForCount = [...items];
                    if (filter === 'one-time') {
                      filteredForCount = filteredForCount.filter((i: any) => !i.recurrence_type || i.recurrence_type === 'once');
                    } else if (filter === 'recurring') {
                      filteredForCount = filteredForCount.filter((i: any) => i.recurrence_type && i.recurrence_type !== 'once');
                    }
                    return filteredForCount.find((i: any) => i.id === item.id) && item.assigned_to === null;
                  }).length})
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="space-y-2">
        {filteredItems.map((item: any) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between">
              <div 
                className="flex-1 cursor-pointer" 
                onClick={() => setEditingItem(item)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{item.title}</p>
                  {/* Verification status badges */}
                  {item.verify_required && (
                    <>
                      {(item.status === 'completed' || item.status === 'complete') && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <Check className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {item.status === 'pending_manual_review' && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center">
                          <span className="text-red-600 font-bold mr-1">!</span>
                          Pending
                        </Badge>
                      )}
                      {(!item.status || (item.status !== 'completed' && item.status !== 'complete' && item.status !== 'pending_manual_review')) && (item.ai_verification_result === 'not_complete' || item.ai_verification_result === 'unclear') && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {(!item.status || (item.status !== 'completed' && item.status !== 'complete' && item.status !== 'pending_manual_review')) && !item.ai_verification_result && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <Camera className="w-3 h-3 mr-1" />
                          Photo Required
                        </Badge>
                      )}
                    </>
                  )}
                  {getRecurrenceBadge(item) && (
                    <Badge variant={getRecurrenceBadge(item)?.variant} className="text-xs px-2 py-0.5">
                      <Repeat className="h-3 w-3 mr-1" />
                      {getRecurrenceBadge(item)?.label}
                    </Badge>
                  )}
                  {/* Show streak badge for recurring items */}
                  {item.recurrence_type && item.recurrence_type !== 'once' && (
                    <ItemStreakBadge 
                      itemId={item.id} 
                      recurrenceType={item.recurrence_type}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{item.item_type}</span>
                  {item.due_date && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {(() => {
                          // Parse date without timezone conversion
                          const [year, month, day] = item.due_date.split('-');
                          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                          return date.toLocaleDateString();
                        })()}
                      </div>
                    </>
                  )}
                  {item.time_frame && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.time_frame}m
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Share button - only show for user's own items */}
                {!item.shared_with_me && communities && communities.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharingItem(item);
                    }}
                  >
                    <Share2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </Button>
                )}
                
                <div className="flex items-center justify-center w-10 h-10" onClick={(e) => e.stopPropagation()}>
                  {item.verify_required ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-10 w-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVerifyingItem(item);
                      }}
                    >
                      <Camera className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </Button>
                  ) : (
                    <div className="h-10 w-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center">
                      <Checkbox 
                        checked={isItemCompleted(item)}
                        disabled={item.verify_required && isItemCompleted(item)}
                        className={`h-4 w-4 rounded-full border-2 ${
                          isItemCompleted(item)
                            ? "border-green-500 bg-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" 
                            : "border-gray-400 dark:border-gray-500 bg-transparent"
                        }`}
                        onCheckedChange={async (checked) => {
                          try {
                            // Handle completion for recurring items or simple completion for non-recurring
                            const today = new Date().toISOString().split('T')[0];
                            if (item.recurrence_type && item.recurrence_type !== 'once') {
                              // For recurring items, use the new completion system
                              if (checked) {
                                await apiRequest(`/api/item/${item.id}/complete`, {
                                  method: 'POST',
                                  body: JSON.stringify({ completion_date: today })
                                });
                              } else {
                                await apiRequest(`/api/item/${item.id}/completions/${today}`, {
                                  method: 'DELETE'
                                });
                              }
                            } else {
                              // For non-recurring items, use the traditional completion system
                              const cleanData = {
                                title: item.title,
                                item_type: item.item_type,
                                recurrence_type: item.recurrence_type || 'once',
                                custom_recurrence: item.custom_recurrence || '',
                                due_date: item.due_date,
                                time_frame: item.time_frame || undefined,
                                verify_required: !!item.verify_required,
                                why_it_matters: item.why_it_matters || '',
                                completed_at: checked ? new Date().toISOString() : null,
                              };

                              await apiRequest(`/api/item/${item.id}`, {
                                method: 'PUT',
                                body: JSON.stringify(cleanData)
                              });
                            }
                            
                            // Refresh all relevant queries
                            queryClient.invalidateQueries({ queryKey: ['items'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/items'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/today'] });
                          } catch (error: any) {
                            toast({ 
                              title: "Error", 
                              description: error.message || "Failed to update completion", 
                              variant: "destructive" 
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {filter === 'all' && <p>No items yet. Create your first item with the + button!</p>}
            {filter === 'one-time' && <p>No one-time items found.</p>}
            {filter === 'recurring' && <p>No recurring items found.</p>}
          </div>
        )}
      </div>

      {/* Edit Modal - Using unified CreateOrEditItemModal */}
      <CreateOrEditItemModal 
        isOpen={!!editingItem} 
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
      />

      {/* Photo Verification Modal */}
      <PhotoVerificationModal 
        open={!!verifyingItem}
        onOpenChange={(open) => !open && setVerifyingItem(null)}
        item={verifyingItem}
        onVerificationComplete={() => {
          setVerifyingItem(null);
          queryClient.invalidateQueries({ queryKey: ['items'] });
        }}
      />

      {/* Sharing Modal */}
      {sharingItem && (
        <Dialog open={!!sharingItem} onOpenChange={(open) => !open && setSharingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Item</DialogTitle>
              <DialogDescription>
                Share "{(sharingItem as any)?.title}" with your community for collaboration and support.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Community</Label>
                <Select value={selectedCommunity} onValueChange={setSelectedCommunity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a community" />
                  </SelectTrigger>
                  <SelectContent>
                    {communities?.map((community: any) => (
                      <SelectItem key={community.id} value={community.id}>
                        {community.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={shareVisibility} onValueChange={setShareVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community">Visible to all community members</SelectItem>
                    <SelectItem value="admins">Visible to community admins only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setSharingItem(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => shareItemMutation.mutate({ 
                    itemId: (sharingItem as any)?.id, 
                    communityId: selectedCommunity, 
                    visibility: shareVisibility 
                  })}
                  disabled={!selectedCommunity || shareItemMutation.isPending}
                >
                  {shareItemMutation.isPending ? "Sharing..." : "Share Item"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
