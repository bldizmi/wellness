import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  MessageSquare,
  Upload,
  Eye,
  X,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PhotoViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string;
  } | null;
  onSubmitPhotos?: () => void; // Callback to switch to submission modal
}

interface PendingReviewItem {
  id: string;
  title: string;
  item_type: string;
  created_by: any;
  assigned_to: any;
  community_id: string;
  image_urls: string[];
  ai_feedback: string;
  manual_review_requested_at: string;
  manual_review_reason: string;
}

interface PendingReviewsResponse {
  items: PendingReviewItem[];
}

export function PhotoViewerModal({
  open,
  onOpenChange,
  item,
  onSubmitPhotos,
}: PhotoViewerModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);

  // For completed items: Fetch verification history (has image_urls from attempts)
  const { data: verificationHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["/api/item", item?.id, "verification-history"],
    queryFn: () => apiRequest(`/api/item/${item?.id}/verification-history`),
    enabled: !!item?.id && open,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // For non-completed items: Fetch pending reviews (same as admin) 
  const { data: pendingReviews, isLoading: isLoadingPending } = useQuery<PendingReviewsResponse>({
    queryKey: ["/api/manual-review/pending"],
    enabled: !!item?.id && open,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const isLoading = isLoadingHistory || isLoadingPending;

  // Find the specific item in pending reviews (for non-completed items)
  const pendingItem = pendingReviews?.items?.find(pendingItem => pendingItem.id === item?.id);
  
  // For completed items, get the most recent verification attempt
  const latestAttempt = verificationHistory?.attempts?.[0]; // Most recent attempt
  
  // Determine which data source to use - ensure arrays are properly handled
  const pendingImages = Array.isArray(pendingItem?.image_urls) ? pendingItem.image_urls : [];
  const historyImages = Array.isArray(latestAttempt?.image_urls) ? latestAttempt.image_urls : [];
  
  const currentImages = pendingImages.length > 0 ? pendingImages : historyImages;
  const currentAiFeedback = pendingItem?.ai_feedback || latestAttempt?.ai_feedback || (item as any)?.ai_feedback;
  const currentImage = currentImages[selectedImageIndex];

  const handleClose = () => {
    setSelectedImageIndex(0);
    setShowFullImage(false);
    onOpenChange(false);
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % currentImages.length);
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
  };


  if (showFullImage && currentImage) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black">
          <DialogTitle className="sr-only">Full Image View</DialogTitle>
          <div className="relative w-full h-full">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setShowFullImage(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={currentImage}
              alt={`Verification photo ${selectedImageIndex + 1}`}
              className="w-full h-full object-contain"
            />
            {currentImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-black/50 text-white hover:bg-black/70"
                  onClick={handlePrevImage}
                  disabled={currentImages.length <= 1}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="bg-black/50 text-white px-3 py-1 rounded text-sm">
                  {selectedImageIndex + 1} / {currentImages.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-black/50 text-white hover:bg-black/70"
                  onClick={handleNextImage}
                  disabled={currentImages.length <= 1}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md h-[600px] p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Task Photos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Task Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
              {item?.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              Submitted photos for this task
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading photos...</p>
            </div>
          ) : currentImages.length === 0 ? (
            // Empty State - No photos submitted yet
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No photos submitted yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This task requires photo verification. Upload photos to complete it.
                </p>
                <Button 
                  onClick={() => {
                    handleClose();
                    onSubmitPhotos?.();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Submit Photos
                </Button>
              </div>
            </div>
          ) : (
            // Show photos directly
            <>
              {/* Photos Grid */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {currentImages.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setSelectedImageIndex(index);
                        setShowFullImage(true);
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`Verification photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Click any photo to view full size
                </p>
              </div>

              {/* AI Feedback */}
              {currentAiFeedback && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">AI Feedback</span>
                  </div>
                  <p className="text-sm">
                    {currentAiFeedback.split('\n').map((line, index) => (
                      <span key={index}>
                        {line}
                        {index < currentAiFeedback.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    handleClose();
                    onSubmitPhotos?.();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Submit New Photos
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}