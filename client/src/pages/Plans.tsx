
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
import { Repeat, Calendar, Clock, Camera, Share2, Users, ChevronDown, ChevronUp, AlertCircle, ClockIcon, CalendarDays, Check, Menu } from 'lucide-react';
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
  const [filter, setFilter] = useState('all'); // 'all', 'one-time', 'recurring'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open', 'completed'
  const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
    queryKey: ['plans-items'],
    queryFn: () => {
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
      return apiRequest(`/api/today/personal-progress?date=${today}`);
    },
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



  // Extract items from grouped format returned by personal-progress endpoint
  const items = data ? [
    ...(data.tasks || []),
    ...(data.habits || []),
    ...(data.goals || []),
    ...(data.projects || [])
  ] : [];

  // Debug logging
  console.log('Plans Page Debug:', {
    rawData: data,
    extractedItems: items,
    itemCount: items.length,
    itemsByType: {
      tasks: data?.tasks?.length || 0,
      habits: data?.habits?.length || 0,
      goals: data?.goals?.length || 0,
      projects: data?.projects?.length || 0
    }
  });

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

    // First apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const titleMatch = item.title?.toLowerCase().includes(searchLower);
        const descriptionMatch = item.description?.toLowerCase().includes(searchLower);
        const whyItMattersMatch = item.why_it_matters?.toLowerCase().includes(searchLower);
        return titleMatch || descriptionMatch || whyItMattersMatch;
      });
    }

    // Then apply main recurrence filter
    if (filter === 'one-time') {
      filtered = filtered.filter((item: any) => !item.recurrence_type || item.recurrence_type === 'once');
    } else if (filter === 'recurring') {
      filtered = filtered.filter((item: any) => item.recurrence_type && item.recurrence_type !== 'once');
    }
    // 'all' filter - no additional filtering needed, show all items

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

    // Debug filtered results
    console.log('Filtering Debug:', {
      originalItems: items.length,
      afterSearch: searchTerm ? filtered.length : 'no search',
      afterRecurrenceFilter: filtered.length,
      filters: {
        searchTerm,
        filter,
        itemTypeFilter,
        statusFilter,
        userId: user?.uid
      },
      filteredItems: filtered.map(item => ({
        id: item.id,
        title: item.title,
        item_type: item.item_type,
        assigned_to: item.assigned_to,
        created_by: item.created_by,
        recurrence_type: item.recurrence_type
      }))
    });

    return filtered;
  }, [items, searchTerm, filter, itemTypeFilter, statusFilter, user?.uid]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center py-8 text-white">Loading your plans...</div>
      </div>
    );
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
    <div className="min-h-screen bg-page">
      <div className="w-full max-w-sm mx-auto bg-page min-h-screen text-primary-theme">

        {/* Header Section */}
        <div className="pt-4 px-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-primary-theme">Plans</h1>
            <Button variant="ghost" size="sm" className="p-2">
              <Menu className="h-5 w-5 text-gray-400" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <Input
              placeholder="Search your plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>

          {/* Advanced Filters */}
          <div className="mb-4">
            <h3 className="text-white font-medium mb-3">Advanced Filters</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All Items" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="open" className="text-white">All Items</SelectItem>
                    <SelectItem value="completed" className="text-white">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Priority</label>
                <Select defaultValue="all">
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all" className="text-white">All</SelectItem>
                    <SelectItem value="high" className="text-white">High</SelectItem>
                    <SelectItem value="medium" className="text-white">Medium</SelectItem>
                    <SelectItem value="low" className="text-white">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Due Date</label>
                <Select defaultValue="all">
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All Dates" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all" className="text-white">All Dates</SelectItem>
                    <SelectItem value="today" className="text-white">Today</SelectItem>
                    <SelectItem value="week" className="text-white">This Week</SelectItem>
                    <SelectItem value="month" className="text-white">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Type</label>
                <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all" className="text-white">All Types</SelectItem>
                    <SelectItem value="task" className="text-white">Tasks</SelectItem>
                    <SelectItem value="habit" className="text-white">Habits</SelectItem>
                    <SelectItem value="goal" className="text-white">Goals</SelectItem>
                    <SelectItem value="project" className="text-white">Projects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Overdue Items Alert */}
          {overdueItems.length > 0 && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-red-400 font-medium text-sm">{overdueItems.length} Overdue Items</p>
                    <p className="text-red-300 text-xs">These need immediate attention</p>
                  </div>
                </div>
                <div className="bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                  {overdueItems.length}
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4">
            {[
              { id: "all", label: "All" },
              { id: "habit", label: "Habits" },
              { id: "task", label: "Tasks" },
              { id: "goal", label: "Goals" },
              { id: "project", label: "Projects" },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={itemTypeFilter === tab.id ? "default" : "ghost"}
                size="sm"
                className={`rounded-full px-3 py-1 text-sm transition-all ${
                  itemTypeFilter === tab.id
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
                onClick={() => setItemTypeFilter(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="px-4 space-y-3 pb-20">
          {filteredItems.map((item: any) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
              onClick={() => setEditingItem(item)}
            >
              <div className="flex items-center gap-3">
                {/* Icon based on item type */}
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  {item.item_type === 'habit' && <Repeat className="h-4 w-4 text-gray-400" />}
                  {item.item_type === 'task' && <Check className="h-4 w-4 text-gray-400" />}
                  {item.item_type === 'goal' && <Calendar className="h-4 w-4 text-gray-400" />}
                  {item.item_type === 'project' && <CalendarDays className="h-4 w-4 text-gray-400" />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    {/* Recurrence indicator */}
                    {item.recurrence_type && item.recurrence_type !== 'once' && (
                      <span className="text-blue-400 text-xs flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {item.recurrence_type.charAt(0).toUpperCase() + item.recurrence_type.slice(1)}
                      </span>
                    )}
                  </div>
                  {item.due_date && (
                    <p className="text-gray-400 text-xs">
                      {(() => {
                        const [year, month, day] = item.due_date.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </p>
                  )}
                  {/* Display ID */}
                  {item.display_id && (
                    <p className="text-gray-500 text-xs font-mono">{item.display_id}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Warning badge for overdue items */}
                {isItemOverdue(item) && (
                  <div className="bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    !
                  </div>
                )}
                
                {/* Completion badge or count */}
                {item.recurrence_type && item.recurrence_type !== 'once' ? (
                  // For recurring items, show streak or count
                  <ItemStreakBadge 
                    itemId={item.id} 
                    recurrenceType={item.recurrence_type}
                  />
                ) : (
                  // For regular items, show verification icon if required
                  item.verify_required && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVerifyingItem(item);
                      }}
                    >
                      <Camera className="h-4 w-4 text-white" />
                    </Button>
                  )
                )}

                {/* Completion checkbox */}
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={isItemCompleted(item)}
                    disabled={item.verify_required && isItemCompleted(item)}
                    className={`h-5 w-5 rounded-full border-2 ${
                      isItemCompleted(item)
                        ? "border-blue-500 bg-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" 
                        : "border-gray-500 bg-transparent"
                    }`}
                    onCheckedChange={async (checked) => {
                      try {
                        const today = new Date().toISOString().split('T')[0];
                        if (item.recurrence_type && item.recurrence_type !== 'once') {
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
                        
                        queryClient.invalidateQueries({ queryKey: ['items'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/items'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/today'] });
                        // Invalidate streak cache to update header immediately
                        queryClient.invalidateQueries({ queryKey: ['/api/streak/overall'] });
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
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              {itemTypeFilter === 'all' && <p>No items found.</p>}
              {itemTypeFilter !== 'all' && <p>No {itemTypeFilter} items found.</p>}
            </div>
          )}
        </div>
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
