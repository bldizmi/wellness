import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose } from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserInfo {
  uid: string;
  username: string;
}

interface PendingReviewItem {
  id: string;
  title: string;
  item_type: string;
  created_by: UserInfo | null;
  assigned_to: UserInfo | null;
  community_id: string;
  image_urls: string[];
  ai_feedback: string;
  manual_review_requested_at: string;
  manual_review_reason: string;
}

export default function AdminPendingReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<PendingReviewItem | null>(
    null,
  );
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(
    null,
  );

  // Fetch pending review items
  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["/api/manual-review/pending"],
    queryFn: () => apiRequest("/api/manual-review/pending"),
  });
  console.log("Pending Items:", pendingItems);

  // Approve item mutation
  const approveMutation = useMutation({
    mutationFn: ({ itemId, message }: { itemId: string; message?: string }) =>
      apiRequest(`/api/manual-review/${itemId}/approve`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item approved and marked complete",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/manual-review/pending"],
      });
      setSelectedItem(null);
      setReviewMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve item",
        variant: "destructive",
      });
    },
  });

  // Reject item mutation
  const rejectMutation = useMutation({
    mutationFn: ({ itemId, message }: { itemId: string; message: string }) =>
      apiRequest(`/api/manual-review/${itemId}/reject`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item rejected with feedback",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/manual-review/pending"],
      });
      setSelectedItem(null);
      setReviewMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject item",
        variant: "destructive",
      });
    },
  });

  const handleReview = () => {
    if (!selectedItem || !reviewAction) return;

    if (reviewAction === "approve") {
      approveMutation.mutate({
        itemId: selectedItem.id,
        message: reviewMessage,
      });
    } else if (reviewAction === "reject") {
      if (!reviewMessage.trim()) {
        toast({
          title: "Error",
          description: "Rejection reason is required",
          variant: "destructive",
        });
        return;
      }
      rejectMutation.mutate({
        itemId: selectedItem.id,
        message: reviewMessage,
      });
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case "task":
        return "📋";
      case "habit":
        return "🔄";
      case "goal":
        return "🎯";
      case "project":
        return "📁";
      default:
        return "📝";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const items = pendingItems?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pending Manual Verifications</h1>
        <Badge variant="secondary" className="px-3 py-1">
          {items.length} pending
        </Badge>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Pending Reviews
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All manual verification requests have been processed.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item: PendingReviewItem) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {getItemTypeIcon(item.item_type)}
                    </span>
                    <h3 className="font-semibold">{item.title}</h3>
                    <Badge
                      variant="outline"
                      className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pending Review
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                      <strong>Type:</strong> {item.item_type}
                    </p>
                    <p>
                      <strong>Created by:</strong>{" "}
                      {item.created_by?.username || "Unknown"}
                    </p>
                    {item.assigned_to && (
                      <p>
                        <strong>Assigned to:</strong>{" "}
                        {item.assigned_to.username}
                      </p>
                    )}
                    {item.community_id && (
                      <p>
                        <strong>Community:</strong> {item.community_id}
                      </p>
                    )}
                    <p>
                      <strong>Requested:</strong>{" "}
                      {formatDistanceToNow(
                        new Date(item.manual_review_requested_at),
                      )}{" "}
                      ago
                    </p>
                    <p>
                      <strong>Reason:</strong> {item.manual_review_reason}
                    </p>
                  </div>

                  {item.ai_feedback && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm">
                        <strong>AI Feedback:</strong>
                        <br />
                        {item.ai_feedback}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Review Item: {item.title}</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        {item.image_urls?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">
                              Uploaded Photos:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {item.image_urls.map((url, index) => (
                                <img
                                  key={index}
                                  src={url}
                                  alt={`Verification photo ${index + 1}`}
                                  className="max-w-full h-40 rounded-lg border object-cover"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {item.ai_feedback && (
                          <div>
                            <h4 className="font-medium mb-2">AI Feedback:</h4>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <p className="text-sm">{item.ai_feedback}</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium mb-2">Review Decision:</h4>
                          <div className="flex gap-2 mb-3">
                            <Button
                              variant={
                                reviewAction === "approve"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setReviewAction("approve")}
                              className={
                                reviewAction === "approve"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant={
                                reviewAction === "reject"
                                  ? "destructive"
                                  : "outline"
                              }
                              onClick={() => setReviewAction("reject")}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>

                          <Textarea
                            placeholder={
                              reviewAction === "reject"
                                ? "Explain why this item is rejected (required)"
                                : "Optional message for the user"
                            }
                            value={reviewMessage}
                            onChange={(e) => setReviewMessage(e.target.value)}
                            className="mb-3"
                          />

                          <div className="flex gap-2 justify-end">
                            <DialogClose asChild>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(null);
                                  setReviewAction(null);
                                  setReviewMessage("");
                                }}
                              >
                                Cancel
                              </Button>
                            </DialogClose>
                            <Button
                              onClick={handleReview}
                              disabled={
                                !reviewAction ||
                                (reviewAction === "reject" &&
                                  !reviewMessage.trim()) ||
                                approveMutation.isPending ||
                                rejectMutation.isPending
                              }
                              className={
                                reviewAction === "approve"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : reviewAction === "reject"
                                    ? "bg-red-600 hover:bg-red-700"
                                    : ""
                              }
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              {reviewAction === "approve"
                                ? "Approve & Complete"
                                : "Reject with Feedback"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
