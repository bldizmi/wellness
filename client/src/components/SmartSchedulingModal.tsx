import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, SkipForward } from 'lucide-react';

interface SmartSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
}

export function SmartSchedulingModal({ 
  open, 
  onOpenChange, 
  item 
}: SmartSchedulingModalProps) {
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'skip' | 'early' | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const skipMutation = useMutation({
    mutationFn: async ({ reason }: { reason?: string }) => {
      return apiRequest(`/api/item/${item.id}/skip`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item skipped for today" });
      queryClient.invalidateQueries({ queryKey: ['/api/today'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      onOpenChange(false);
      setReason('');
      setMode(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to skip item", 
        variant: "destructive" 
      });
    },
  });

  const earlyCompleteMutation = useMutation({
    mutationFn: async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return apiRequest(`/api/item/${item.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ date_override: tomorrow })
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item completed early for tomorrow" });
      queryClient.invalidateQueries({ queryKey: ['/api/today'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      onOpenChange(false);
      setMode(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to complete item early", 
        variant: "destructive" 
      });
    },
  });

  if (!open || !item) return null;

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowFormatted = tomorrow.toLocaleDateString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Smart Scheduling</DialogTitle>
          <DialogDescription>
            Manage "{item.title}" occurrence without losing your streak
          </DialogDescription>
        </DialogHeader>

        {!mode && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => setMode('skip')}
            >
              <div className="flex items-center gap-3">
                <SkipForward className="h-5 w-5 text-orange-500" />
                <div className="text-left">
                  <div className="font-medium">Skip for Today</div>
                  <div className="text-sm text-muted-foreground">
                    Won't count as missed - maintains streak
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => setMode('early')}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Complete Tomorrow Early</div>
                  <div className="text-sm text-muted-foreground">
                    Mark {tomorrowFormatted} as complete now
                  </div>
                </div>
              </div>
            </Button>
          </div>
        )}

        {mode === 'skip' && (
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Skipping won't break your streak, but won't count as completed either.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Sick day, traveling, etc."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setMode(null)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={() => skipMutation.mutate({ reason: reason || undefined })}
                disabled={skipMutation.isPending}
                className="flex-1"
              >
                {skipMutation.isPending ? "Skipping..." : "Skip Today"}
              </Button>
            </div>
          </div>
        )}

        {mode === 'early' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You're completing this item early for {tomorrowFormatted}. 
                This will count toward tomorrow's occurrence.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setMode(null)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={() => earlyCompleteMutation.mutate()}
                disabled={earlyCompleteMutation.isPending}
                className="flex-1"
              >
                {earlyCompleteMutation.isPending ? "Completing..." : "Complete Early"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}