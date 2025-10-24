import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, BellOff, Clock, Flame, Users, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferences {
  user_id: string;
  push_enabled: boolean;
  shared_item_completed: boolean;
  shared_item_verification_request: boolean;
  shared_item_assigned: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  streak_risk_alert: boolean;
  streak_milestone_alert: boolean;
  community_invitation: boolean;
  community_member_joined: boolean;
  verification_approved: boolean;
  verification_rejected: boolean;
  manual_review_completed: boolean;
  created_at: string;
  updated_at: string;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pushPermissionState, setPushPermissionState] = useState<"default" | "granted" | "denied">("default");

  // Fetch notification preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      return await apiRequest("/api/notification-preferences");
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return await apiRequest("/api/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Request push permission mutation
  const requestPushPermissionMutation = useMutation({
    mutationFn: async (granted: boolean) => {
      return await apiRequest("/api/notification-preferences/request-permission", {
        method: "POST",
        body: JSON.stringify({ granted }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
    },
  });

  // Check browser notification permission
  React.useEffect(() => {
    if ("Notification" in window) {
      setPushPermissionState(Notification.permission);
    }
  }, []);

  const handlePushToggle = async (enabled: boolean) => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    if (enabled) {
      // Request permission
      const permission = await Notification.requestPermission();
      setPushPermissionState(permission);

      if (permission === "granted") {
        await requestPushPermissionMutation.mutateAsync(true);
        toast({
          title: "Notifications Enabled",
          description: "You will now receive push notifications.",
        });
      } else {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    } else {
      // Disable notifications
      await requestPushPermissionMutation.mutateAsync(false);
      toast({
        title: "Notifications Disabled",
        description: "You will no longer receive push notifications.",
      });
    }
  };

  const handleToggle = (field: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [field]: value });
  };

  const handleTimeChange = (time: string) => {
    updatePreferencesMutation.mutate({ daily_reminder_time: time });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Failed to load notification preferences</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Push Notifications Master Toggle */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {preferences.push_enabled ? (
              <Bell className="h-5 w-5 text-green-500" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">Push Notifications</h3>
              <p className="text-sm text-muted-foreground">
                {preferences.push_enabled
                  ? "Receive browser push notifications"
                  : "Enable to receive real-time notifications"}
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.push_enabled}
            onCheckedChange={handlePushToggle}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>
        {pushPermissionState === "denied" && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-4">
            <p className="text-sm text-orange-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          </div>
        )}
      </div>

      {/* Shared Item Notifications */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-foreground">Shared Items</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="shared-completed" className="text-sm font-medium text-foreground">
                Item Completed
              </Label>
              <p className="text-xs text-muted-foreground">
                When someone completes your shared item
              </p>
            </div>
            <Switch
              id="shared-completed"
              checked={preferences.shared_item_completed}
              onCheckedChange={(checked) => handleToggle("shared_item_completed", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="shared-verification" className="text-sm font-medium text-foreground">
                Manual Verification Requested
              </Label>
              <p className="text-xs text-muted-foreground">
                When someone requests manual verification
              </p>
            </div>
            <Switch
              id="shared-verification"
              checked={preferences.shared_item_verification_request}
              onCheckedChange={(checked) => handleToggle("shared_item_verification_request", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="shared-assigned" className="text-sm font-medium text-foreground">
                Item Assigned to You
              </Label>
              <p className="text-xs text-muted-foreground">
                When you're assigned a shared item
              </p>
            </div>
            <Switch
              id="shared-assigned"
              checked={preferences.shared_item_assigned}
              onCheckedChange={(checked) => handleToggle("shared_item_assigned", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Daily Reminder */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-foreground">Daily Reminder</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="daily-reminder" className="text-sm font-medium text-foreground">
                Enable Daily Reminder
              </Label>
              <p className="text-xs text-muted-foreground">
                Remind you of incomplete items
              </p>
            </div>
            <Switch
              id="daily-reminder"
              checked={preferences.daily_reminder_enabled}
              onCheckedChange={(checked) => handleToggle("daily_reminder_enabled", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          {preferences.daily_reminder_enabled && (
            <div>
              <Label htmlFor="reminder-time" className="text-sm font-medium text-foreground">
                Reminder Time
              </Label>
              <Input
                id="reminder-time"
                type="time"
                value={preferences.daily_reminder_time}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
                className="mt-2 bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll remind you at {preferences.daily_reminder_time} every day
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Streak Alerts */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-foreground">Streak Alerts</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="streak-risk" className="text-sm font-medium text-foreground">
                Streak at Risk
              </Label>
              <p className="text-xs text-muted-foreground">
                Alert when your streak is about to break
              </p>
            </div>
            <Switch
              id="streak-risk"
              checked={preferences.streak_risk_alert}
              onCheckedChange={(checked) => handleToggle("streak_risk_alert", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="streak-milestone" className="text-sm font-medium text-foreground">
                Milestone Achievements
              </Label>
              <p className="text-xs text-muted-foreground">
                Celebrate 7, 30, 100+ day streaks
              </p>
            </div>
            <Switch
              id="streak-milestone"
              checked={preferences.streak_milestone_alert}
              onCheckedChange={(checked) => handleToggle("streak_milestone_alert", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Verification Notifications */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold text-foreground">Verification</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="verification-approved" className="text-sm font-medium text-foreground">
                Verification Approved
              </Label>
              <p className="text-xs text-muted-foreground">
                When your photo verification is approved
              </p>
            </div>
            <Switch
              id="verification-approved"
              checked={preferences.verification_approved}
              onCheckedChange={(checked) => handleToggle("verification_approved", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="verification-rejected" className="text-sm font-medium text-foreground">
                Verification Rejected
              </Label>
              <p className="text-xs text-muted-foreground">
                When your photo verification is rejected
              </p>
            </div>
            <Switch
              id="verification-rejected"
              checked={preferences.verification_rejected}
              onCheckedChange={(checked) => handleToggle("verification_rejected", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="manual-review" className="text-sm font-medium text-foreground">
                Manual Review Completed
              </Label>
              <p className="text-xs text-muted-foreground">
                When a manual review is completed
              </p>
            </div>
            <Switch
              id="manual-review"
              checked={preferences.manual_review_completed}
              onCheckedChange={(checked) => handleToggle("manual_review_completed", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Community Notifications */}
      <div className="bg-card/30 rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-foreground">Community</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="community-invitation" className="text-sm font-medium text-foreground">
                Community Invitations
              </Label>
              <p className="text-xs text-muted-foreground">
                When you're invited to a community
              </p>
            </div>
            <Switch
              id="community-invitation"
              checked={preferences.community_invitation}
              onCheckedChange={(checked) => handleToggle("community_invitation", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="community-member" className="text-sm font-medium text-foreground">
                Member Joins Community
              </Label>
              <p className="text-xs text-muted-foreground">
                When someone joins your community
              </p>
            </div>
            <Switch
              id="community-member"
              checked={preferences.community_member_joined}
              onCheckedChange={(checked) => handleToggle("community_member_joined", checked)}
              disabled={!preferences.push_enabled || updatePreferencesMutation.isPending}
            />
          </div>
        </div>
      </div>

      {!preferences.push_enabled && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            Enable push notifications above to configure individual notification types
          </p>
        </div>
      )}
    </div>
  );
}
