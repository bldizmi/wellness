import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, AlertCircle, Camera, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import confetti from 'canvas-confetti';

interface VerificationAttempt {
  id: string;
  item_id: string;
  user_id: string;
  image_url: string;
  ai_verification_result: 'complete' | 'not_complete' | 'unclear';
  ai_feedback: string;
  created_at: string;
}

interface ReviewAction {
  id: string;
  item_id: string;
  reviewer_user_id: string;
  action: 'approve' | 'reject';
  message: string;
  created_at: string;
  reviewer_display_name: string;
}

interface VerificationHistoryTabProps {
  itemId: string;
  currentUserId?: string;
  itemCreatedBy?: string;
  itemStatus?: string;
}

export function VerificationHistoryTab({ 
  itemId, 
  currentUserId, 
  itemCreatedBy, 
  itemStatus 
}: VerificationHistoryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: historyData, isLoading, error } = useQuery({
    queryKey: ['/api/item', itemId, 'verification-history'],
    queryFn: () => apiRequest(`/api/item/${itemId}/verification-history`),
    enabled: !!itemId,
  });

  const [reviewComment, setReviewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: 'approve' | 'reject', reason?: string }) => {
      return await apiRequest(`/api/item/${itemId}/manual-review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          reason: reason || `Community member ${action}d the verification`
        })
      });
    },
    onSuccess: (data, variables) => {
      // Show confetti for approvals
      if (variables.action === 'approve') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        toast({
          title: "Item Approved! 🎉",
          description: "Successfully approved the manual verification request.",
        });
        
        // Auto-close modal after confetti celebration
        setTimeout(() => {
          // UI will update automatically through React Query cache invalidation below
          // No need for hard refresh which can cause state reversion
        }, 2000);
      } else {
        toast({
          title: "Item Rejected",
          description: "Successfully rejected the manual verification request.",
        });
      }
      
      // Refresh verification history and items list
      queryClient.invalidateQueries({ queryKey: ['/api/item', itemId, 'verification-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process review",
        variant: "destructive",
      });
    }
  });

  const handleApprove = () => {
    if (showCommentInput && pendingAction === 'approve') {
      // Execute approve with comment
      reviewMutation.mutate({ 
        action: 'approve', 
        reason: reviewComment.trim() || 'Community member approved the verification'
      });
      setShowCommentInput(false);
      setReviewComment('');
      setPendingAction(null);
    } else {
      // Show comment input for approve (optional)
      setShowCommentInput(true);
      setPendingAction('approve');
    }
  };

  const handleReject = () => {
    if (showCommentInput && pendingAction === 'reject') {
      // Validate required comment for reject
      if (!reviewComment.trim()) {
        toast({
          title: "Comment Required",
          description: "Please provide a reason for rejecting this verification.",
          variant: "destructive",
        });
        return;
      }
      // Execute reject with required comment
      reviewMutation.mutate({ 
        action: 'reject', 
        reason: reviewComment.trim()
      });
      setShowCommentInput(false);
      setReviewComment('');
      setPendingAction(null);
    } else {
      // Show comment input for reject (required)
      setShowCommentInput(true);
      setPendingAction('reject');
    }
  };

  const handleCancelComment = () => {
    setShowCommentInput(false);
    setReviewComment('');
    setPendingAction(null);
  };

  // Check if current user can review this item
  const canReview = currentUserId && 
                   currentUserId !== itemCreatedBy && 
                   itemStatus === 'pending_manual_review';

  // Show review result if completed
  const isReviewed = itemStatus === 'completed' || itemStatus === 'not_completed';
  const wasApproved = itemStatus === 'completed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error Loading History</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Unable to load verification history. Please try again.
        </p>
      </div>
    );
  }

  const attempts = historyData?.attempts || [];
  const reviewActions = historyData?.reviewActions || [];

  if (attempts.length === 0) {
    return (
      <div className="text-center py-8">
        <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Verification Attempts</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Photo verification attempts will appear here once submitted.
        </p>
      </div>
    );
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'not_complete':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Complete</Badge>;
      case 'not_complete':
        return <Badge variant="destructive">Not Complete</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Unclear</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Verification History</h3>
        <Badge variant="outline">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Manual Review Actions */}
      {canReview && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">Manual Review Required</h4>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This item has been submitted for community review. You can approve or reject it.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={reviewMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ThumbsUp className="w-4 h-4 mr-1" />
                {showCommentInput && pendingAction === 'approve' ? 'Confirm Approve' : 'Approve'}
              </Button>
              <Button
                onClick={handleReject}
                disabled={reviewMutation.isPending}
                size="sm"
                variant="destructive"
              >
                <ThumbsDown className="w-4 h-4 mr-1" />
                {showCommentInput && pendingAction === 'reject' ? 'Confirm Reject' : 'Reject'}
              </Button>
              {showCommentInput && (
                <Button
                  onClick={handleCancelComment}
                  disabled={reviewMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
          
          {/* Comment input section */}
          {showCommentInput && (
            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {pendingAction === 'reject' ? 'Reason for rejection (required):' : 'Comment (optional):'}
              </label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={pendingAction === 'reject' 
                  ? 'Please explain why you are rejecting this verification...' 
                  : 'Add any comments about this verification...'
                }
                className="min-h-[80px] bg-white dark:bg-gray-900"
                disabled={reviewMutation.isPending}
              />
            </div>
          )}
        </div>
      )}

      {/* Review Result Display */}
      {isReviewed && (
        <div className={`p-4 border rounded-lg ${
          wasApproved 
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {wasApproved ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <h4 className={`font-medium ${
              wasApproved ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }`}>
              Manual Review {wasApproved ? 'Approved' : 'Rejected'}
            </h4>
          </div>
          <p className={`text-sm mt-1 ${
            wasApproved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            This item has been {wasApproved ? 'approved' : 'rejected'} by a community member.
          </p>
        </div>
      )}

      {/* Manual Review Actions Audit Trail */}
      {reviewActions.length > 0 && (
        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Review History</h4>
          {reviewActions.map((action: ReviewAction) => (
            <div key={action.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {action.action === 'approve' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Badge variant={action.action === 'approve' ? 'default' : 'destructive'}>
                    {action.action.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    by {action.reviewer_display_name || 'Community Member'}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(action.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              
              {action.message && (
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-900 rounded border">
                  {action.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">Verification Attempts</h4>
        {attempts.map((attempt: VerificationAttempt) => (
          <div key={attempt.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getResultIcon(attempt.ai_verification_result)}
                {getResultBadge(attempt.ai_verification_result)}
              </div>
              <span className="text-sm text-gray-500">
                {format(new Date(attempt.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-2">AI Feedback:</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{attempt.ai_feedback}</p>
            </div>
            
            {attempt.image_url && (
              <div className="border rounded-lg overflow-hidden">
                <img 
                  src={attempt.image_url} 
                  alt="Verification attempt" 
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}