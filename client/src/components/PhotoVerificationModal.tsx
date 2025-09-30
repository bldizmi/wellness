import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  HelpCircle,
  Image,
  Users,
  Info,
  Trash2,
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { PhotoPrivacyNotice } from "@/components/PhotoPrivacyNotice";

interface PhotoVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string;
  } | null;
  onVerificationComplete: (verified: boolean) => void;
}

interface VerificationResult {
  success: boolean;
  item?: any;
  verification?: {
    ai_verification_result: "complete" | "not_complete" | "unclear";
    ai_feedback: string;
  };
  error?: string;
}

export function PhotoVerificationModal({
  open,
  onOpenChange,
  item,
  onVerificationComplete,
}: PhotoVerificationModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!item) throw new Error("No item selected");

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      return await apiRequest(`/api/item/${item.id}/verify-photo`, {
        method: "POST",
        body: formData,
        headers: {
          "X-User-Timezone": userTimezone,
        },
      });
    },
    onSuccess: (result: VerificationResult) => {
      setVerificationResult(result);

      // If verified as complete, show success screen with confetti
      if (result.verification?.ai_verification_result === "complete") {
        setShowSuccess(true);

        // Trigger confetti celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });

        // Auto-close after 3.5 seconds and mark as complete
        setTimeout(() => {
          onVerificationComplete(true);
          onOpenChange(false);
        }, 3500);
      }

      // Invalidate comprehensive Today page caches after photo verification
      queryClient.invalidateQueries({
        queryKey: ["/api/today/personal-progress"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/today/shared"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/today/personal-progress/week"],
        exact: false,
      });

      // Legacy cache invalidation for backward compatibility
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (error: any) => {
      let message = "Verification failed";
      if (error?.response?.data?.error) {
        message = error.response.data.error;
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const validateAndAddFiles = (newFiles: File[]) => {
    // Filter out invalid files
    const validFiles = newFiles.filter((file) => {
      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not an image file.`,
          variant: "destructive",
        });
        return false;
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 5MB.`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles((prevFiles) => {
      // Prevent duplicates based on file name and size
      const existingFiles = new Set(
        prevFiles.map((f) => `${f.name}-${f.size}`),
      );

      const uniqueNewFiles = validFiles.filter(
        (file) => !existingFiles.has(`${file.name}-${file.size}`),
      );

      const totalFiles = prevFiles.length + uniqueNewFiles.length;

      // Check total file limit
      if (totalFiles > 5) {
        const allowedCount = 5 - prevFiles.length;
        toast({
          title: "File Limit Exceeded",
          description: `You can only upload up to 5 photos total. Adding ${allowedCount} of ${uniqueNewFiles.length} selected files.`,
          variant: "destructive",
        });
        return [...prevFiles, ...uniqueNewFiles.slice(0, allowedCount)];
      }

      if (uniqueNewFiles.length === 0) {
        toast({
          title: "Duplicate Files",
          description: "Some files were already selected.",
        });
      }

      return [...prevFiles, ...uniqueNewFiles];
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      validateAndAddFiles(files);
    }
    // Reset the input value so the same file can be selected again if needed
    event.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      verifyMutation.mutate(selectedFiles);
    }
  };

  const handleRetry = () => {
    setSelectedFiles([]);
    setVerificationResult(null);
  };

  const handleVerifyWithoutAI = async () => {
    try {
      // Use dedicated manual review endpoint instead of item update
      const response = await apiRequest(
        `/api/item/${item?.id}/request-manual-review`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "User requested verification without AI",
          }),
        },
      );

      toast({
        title: "Review Requested",
        description:
          "Item submitted for manual review by community members or admins",
      });

      // Invalidate comprehensive Today page caches after manual review request
      queryClient.invalidateQueries({
        queryKey: ["/api/today/personal-progress"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/today/shared"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/today/personal-progress/week"],
        exact: false,
      });

      // Legacy cache invalidation for backward compatibility
      queryClient.invalidateQueries({ queryKey: ["/api/today"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      onVerificationComplete(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request manual review",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setVerificationResult(null);
    setShowSuccess(false);
    onOpenChange(false);
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "complete":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified Complete
          </Badge>
        );
      case "not_complete":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Not Complete
          </Badge>
        );
      case "unclear":
        return (
          <Badge variant="secondary" className="bg-orange-500 text-white">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unclear
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-sm h-[550px] p-0 overflow-hidden fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]"
        onInteractOutside={handleClose}
      >
        <DialogTitle className="sr-only">Photo Verification</DialogTitle>
        {showSuccess ? (
          <>
            {/* Success Screen */}
            <div className="flex-1 p-4 space-y-4 pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Task Completed!
                </h3>

                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-left">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>AI Feedback:</strong>
                    <br />
                    {verificationResult?.verification?.ai_feedback
                      ?.split("\n")
                      .map((line, index) =>
                        line.trim() ? (
                          <span key={index}>
                            {line}
                            <br />
                          </span>
                        ) : (
                          <br key={index} />
                        ),
                      )}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : !verificationResult ? (
          <>
            {/* Content */}
            <div className="flex-1 p-4 space-y-3 pt-6">
              {/* Task Info */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {item?.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Please upload photos to complete this task
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(item?.shared_with ||
                      item?.shared_with_me ||
                      item?.assigned_to) && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-2">
                            <HelpCircle className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            Uploads are visible to task collaborators
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Privacy Notice */}
              <PhotoPrivacyNotice />

              {/* Photo Upload Area */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                {selectedFiles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="w-full h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center p-2">
                            <Image className="h-6 w-6 text-gray-500" />
                            <p className="text-xs truncate w-full">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0 p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}

                      {/* Add more files option */}
                      {selectedFiles.length < 5 && (
                        <div
                          className="w-full h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() =>
                            document
                              .getElementById("photo-upload-more")
                              ?.click()
                          }
                        >
                          <Plus className="h-6 w-6 text-gray-400" />
                          <p className="text-xs text-muted-foreground">
                            Add More
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedFiles.length} photo
                      {selectedFiles.length !== 1 ? "s" : ""} selected
                      {selectedFiles.length < 5 &&
                        ` (${5 - selectedFiles.length} more allowed)`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">No photos selected</p>
                    <p className="text-xs text-muted-foreground">
                      Tap below to take photos or select from gallery
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() =>
                      document.getElementById("photo-camera")?.click()
                    }
                    disabled={
                      verifyMutation.isPending || selectedFiles.length >= 5
                    }
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      document.getElementById("photo-upload")?.click()
                    }
                    disabled={
                      verifyMutation.isPending || selectedFiles.length >= 5
                    }
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>

                {selectedFiles.length > 0 && (
                  <>
                    <Button
                      onClick={handleUpload}
                      disabled={verifyMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {verifyMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing with AI...
                        </>
                      ) : (
                        `Verify ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? "s" : ""} with AI`
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFiles([])}
                      disabled={verifyMutation.isPending}
                      className="w-full"
                    >
                      Clear All
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Hidden file inputs */}
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={verifyMutation.isPending}
              className="hidden"
              multiple
            />
            <input
              id="photo-upload-more"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={verifyMutation.isPending}
              className="hidden"
              multiple
            />
            <input
              id="photo-camera"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              disabled={verifyMutation.isPending}
              className="hidden"
            />
          </>
        ) : (
          <>
            {/* Results Content */}
            <div className="flex-1 p-4 space-y-4 pt-6">
              <div className="text-center space-y-3">
                {getResultBadge(
                  verificationResult.verification?.ai_verification_result || "",
                )}

                <div className="p-4 bg-muted rounded-lg text-left">
                  <p className="text-sm">
                    <strong>AI Feedback:</strong>
                    <br />
                    {verificationResult.verification?.ai_feedback
                      ?.split("\n")
                      .map((line, index) =>
                        line.trim() ? (
                          <span key={index}>
                            {line}
                            <br />
                          </span>
                        ) : (
                          <br key={index} />
                        ),
                      )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {verificationResult.verification?.ai_verification_result ===
                "complete" ? (
                  <Button onClick={handleClose} className="w-full">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleRetry} className="w-full">
                      <Camera className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again Later
                    </Button>
                    <Button
                      onClick={handleVerifyWithoutAI}
                      variant="outline"
                      className="w-full"
                    >
                      Verify without AI
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
