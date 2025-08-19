import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Shield,
  Clock,
  Settings,
  Eye,
  EyeOff,
  Edit3,
  Camera,
  Upload,
  Users,
  Plus,
  UserPlus,
  Trash2,
  MoreVertical,
  UserMinus,
  ShieldOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const lifeStages = [
  "student",
  "adult",
  "parent",
  "single parent",
  "entrepreneur",
  "employee",
];
const valuesList = [
  "growth",
  "rest",
  "freedom",
  "connection",
  "achievement",
  "play",
];
const aiNudgeLevels = ["none", "light", "moderate", "coach"];
const tonePreferences = ["friendly", "direct", "gentle"];
const focusWindows = ["morning", "evening", "variable"];

// Community Member List Component
function CommunityMemberList({
  communityId,
  currentUserRole,
}: {
  communityId: string;
  currentUserRole: string;
}) {
  const {
    data: membersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/community", communityId, "members"],
    queryFn: () => apiRequest(`/api/community/${communityId}/members`),
  });

  // Debug logging
  console.log("🔍 FRONTEND: Community members data:", {
    membersData,
    isLoading,
    error,
    communityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 max-h-60 overflow-y-auto">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
            >
              <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    console.error("❌ FRONTEND: Error fetching members:", error);
    return (
      <div className="space-y-3 max-h-60 overflow-y-auto">
        <div className="text-center py-8 text-red-500">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Failed to load members</p>
        </div>
      </div>
    );
  }

  const members = membersData?.members || [];
  console.log("🔍 FRONTEND: Extracted members array:", members);

  if (members.length === 0) {
    return (
      <div className="space-y-3 max-h-60 overflow-y-auto">
        <div className="text-center py-8 text-gray-500">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No members found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-60 overflow-y-auto">
      {members.map((member: any) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {(member.display_name ||
                member.username ||
                member.email ||
                "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">
                {member.display_name || member.username || member.email}
                <span className="font-normal text-gray-500 ml-2">
                  {member.email}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                member.role === "owner"
                  ? "default"
                  : member.role === "admin"
                    ? "secondary"
                    : "outline"
              }
            >
              {member.role === "owner"
                ? "Owner"
                : member.role === "admin"
                  ? "Admin"
                  : "Member"}
            </Badge>
            {(currentUserRole === "owner" || currentUserRole === "admin") &&
              member.role !== "owner" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {currentUserRole === "owner" && member.role !== "admin" && (
                      <DropdownMenuItem>
                        <Shield className="h-3 w-3 mr-2" />
                        Promote to Admin
                      </DropdownMenuItem>
                    )}
                    {currentUserRole === "owner" && member.role === "admin" && (
                      <DropdownMenuItem>
                        <ShieldOff className="h-3 w-3 mr-2" />
                        Remove Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-red-600">
                      <UserMinus className="h-3 w-3 mr-2" />
                      Remove Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Community management state
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityType, setNewCommunityType] = useState("family");
  const [inviteEmail, setInviteEmail] = useState("");
  const [leaveCommunityConfirm, setLeaveCommunityConfirm] = useState<{
    isOpen: boolean;
    community: any;
    step: "initial" | "delete_confirm";
  }>({ isOpen: false, community: null, step: "initial" });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<{
    isOpen: boolean;
    community: any;
  }>({ isOpen: false, community: null });
  const [showInvitations, setShowInvitations] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<any>(null);

  // Preset avatar options - clean, professional colors
  const presetAvatars = [
    "https://api.dicebear.com/7.x/initials/svg?seed=User1&backgroundColor=3b82f6&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User2&backgroundColor=8b5cf6&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User3&backgroundColor=06b6d4&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User4&backgroundColor=10b981&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User5&backgroundColor=f59e0b&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User6&backgroundColor=ef4444&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User7&backgroundColor=8b5a3c&textColor=ffffff",
    "https://api.dicebear.com/7.x/initials/svg?seed=User8&backgroundColor=6b7280&textColor=ffffff",
  ];

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      return await apiRequest("/api/profile");
    },
  });

  // Fetch mood history for the mood tab
  const { data: moodHistory } = useQuery({
    queryKey: ["/api/mood/history"],
    queryFn: async () => {
      return await apiRequest("/api/mood/history");
    },
  });

  // Fetch user communities
  const { data: communitiesData, isLoading: communitiesLoading } = useQuery({
    queryKey: ["/api/community"],
    queryFn: async () => {
      return await apiRequest("/api/community");
    },
  });

  const communities = communitiesData?.communities || [];

  // Fetch pending invitations
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ["/api/community/invitations/pending"],
    queryFn: async () => {
      return await apiRequest("/api/community/invitations/pending");
    },
  });

  const pendingInvitations = invitationsData?.invitations || [];

  // Fetch community-specific invitations when community is selected
  const {
    data: communityInvitationsData,
    isLoading: communityInvitationsLoading,
  } = useQuery({
    queryKey: ["/api/community", selectedCommunity?.id, "invitations"],
    queryFn: async () => {
      if (!selectedCommunity?.id) return { invitations: [] };
      return await apiRequest(
        `/api/community/${selectedCommunity.id}/invitations`,
      );
    },
    enabled: !!selectedCommunity?.id,
  });

  const communityInvitations = communityInvitationsData?.invitations || [];

  const mutation = useMutation({
    mutationFn: async (updatedProfile: any) => {
      return await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(updatedProfile),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Profile updated successfully!" });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const passwordChangeMutation = useMutation({
    mutationFn: async (passwordData: {
      currentPassword: string;
      newPassword: string;
    }) => {
      return await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully!",
      });
      setIsPasswordChangeOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: string, value: any) => {
    if (!profile) return;
    const updatedProfile = { ...profile, [field]: value };
    queryClient.setQueryData(["/api/profile"], updatedProfile);
    mutation.mutate({ [field]: value });
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    passwordChangeMutation.mutate({ currentPassword, newPassword });
  };

  // Community management mutations
  const createCommunityMutation = useMutation({
    mutationFn: async (communityData: { name: string; type: string }) => {
      return await apiRequest("/api/community", {
        method: "POST",
        body: JSON.stringify(communityData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
      toast({
        title: "Success",
        description: "Community created successfully!",
      });
      setIsCreateCommunityOpen(false);
      setNewCommunityName("");
      setNewCommunityType("family");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create community",
        variant: "destructive",
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async ({
      communityId,
      email,
    }: {
      communityId: string;
      email: string;
    }) => {
      return await apiRequest(`/api/community/${communityId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/community", selectedCommunity?.id, "invitations"],
      });
      toast({ title: "Success", description: "Invitation sent!" });
      setInviteEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest(`/api/community/invitations/${invitationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/community", selectedCommunity?.id, "invitations"],
      });
      toast({
        title: "Success",
        description: "Invitation revoked successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke invitation",
        variant: "destructive",
      });
    },
  });

  const leaveCommunityMutation = useMutation({
    mutationFn: async ({
      communityId,
      confirmLeave,
      confirmDelete,
    }: {
      communityId: string;
      confirmLeave: boolean;
      confirmDelete?: boolean;
    }) => {
      return await apiRequest(`/api/community/${communityId}/leave`, {
        method: "POST",
        body: JSON.stringify({
          confirm_leave: confirmLeave,
          confirm_delete: confirmDelete,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
      const action = data.action;
      if (action === "delete") {
        toast({
          title: "Success",
          description: "Community deleted successfully",
        });
      } else {
        toast({ title: "Success", description: "Left community successfully" });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async ({
      communityId,
      email,
    }: {
      communityId: string;
      email: string;
    }) => {
      return await apiRequest(`/api/community/${communityId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: email }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
      toast({ title: "Success", description: "Invitation sent successfully!" });
      setInviteEmail("");
      setIsInviteModalOpen({ isOpen: false, community: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const handleInvitationMutation = useMutation({
    mutationFn: async ({
      invitationId,
      action,
    }: {
      invitationId: string;
      action: "accept" | "decline";
    }) => {
      return await apiRequest(
        `/api/community/invitations/${invitationId}/${action}`,
        {
          method: "POST",
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/community/invitations/pending"],
      });
      toast({
        title: "Success",
        description: "Invitation processed successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process invitation",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      // Convert file to base64 for now (in production, you'd upload to a file storage service)
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        handleChange("avatar_url", base64);
        setIsAvatarModalOpen(false);
        setUploadingAvatar(false);
        toast({
          title: "Success",
          description: "Avatar updated successfully!",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadingAvatar(false);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive",
      });
    }
  };

  const handlePresetAvatar = (avatarUrl: string) => {
    handleChange("avatar_url", avatarUrl);
    setIsAvatarModalOpen(false);
    toast({ title: "Success", description: "Avatar updated!" });
  };

  const toggleValue = (value: string) => {
    if (!profile) return;
    const current = profile.values || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    handleChange("values", updated);
  };

  const toggleLifeStage = (stage: string) => {
    if (!profile) return;
    const current = profile.life_stage || [];
    const updated = current.includes(stage)
      ? current.filter((s: string) => s !== stage)
      : [...current, stage];
    handleChange("life_stage", updated);
  };

  if (isLoading)
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );

  if (isError)
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">
              Failed to load profile. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="w-full px-4 sm:max-w-4xl sm:mx-auto sm:p-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-none sm:rounded-xl px-4 py-6 -mx-4 sm:mx-0">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 max-w-4xl mx-auto">
          <div className="relative">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
              <AvatarImage
                src={profile?.avatar_url}
                alt={profile?.display_name || profile?.username}
              />
              <AvatarFallback className="text-sm sm:text-lg">
                {profile?.display_name
                  ? getInitials(profile.display_name)
                  : profile?.username
                    ? getInitials(profile.username)
                    : "U"}
              </AvatarFallback>
            </Avatar>

            {/* Camera overlay button */}
            <Dialog
              open={isAvatarModalOpen}
              onOpenChange={setIsAvatarModalOpen}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 shadow-md"
                  variant="secondary"
                >
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Avatar</DialogTitle>
                  <DialogDescription>
                    Upload your own photo or choose from our preset avatars.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Upload Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Upload Your Photo
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={() =>
                          document.querySelector('input[type="file"]')?.click()
                        }
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingAvatar ? "Uploading..." : "Browse"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supports JPG, PNG, GIF up to 5MB
                    </p>
                  </div>

                  <Separator />

                  {/* Preset Avatars */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Choose a Preset Avatar
                    </Label>
                    <div className="grid grid-cols-4 gap-3">
                      {presetAvatars.map((avatarUrl, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="h-16 w-16 p-0 rounded-full hover:ring-2 hover:ring-blue-500"
                          onClick={() => handlePresetAvatar(avatarUrl)}
                        >
                          <Avatar className="h-14 w-14">
                            <AvatarImage
                              src={avatarUrl}
                              alt={`Preset avatar ${index + 1}`}
                            />
                            <AvatarFallback>A{index + 1}</AvatarFallback>
                          </Avatar>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsAvatarModalOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="sm:flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {profile?.display_name || profile?.username || "User"}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 flex items-center justify-center sm:justify-start gap-2 mt-1">
              <Mail className="h-4 w-4" />
              {profile?.email || "No email set"}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {profile?.role || "Member"}
              </Badge>
              <Badge
                variant={
                  profile?.status === "active" ? "default" : "destructive"
                }
              >
                {profile?.status || "Active"}
              </Badge>
              {profile?.verified && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200"
                >
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="flex w-full overflow-x-auto pb-2 sm:grid sm:grid-cols-5 gap-2">
          <TabsTrigger
            value="account"
            className="flex flex-col items-center justify-center p-2 min-w-[56px]"
          >
            <User className="h-4 w-4" />
            <span className="text-xs mt-1 hidden sm:block">Account</span>
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="flex flex-col items-center justify-center p-2 min-w-[56px]"
          >
            <Users className="h-4 w-4" />
            <span className="text-xs mt-1 hidden sm:block">Community</span>
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="flex flex-col items-center justify-center p-2 min-w-[56px]"
          >
            <Settings className="h-4 w-4" />
            <span className="text-xs mt-1 hidden sm:block">Preferences</span>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex flex-col items-center justify-center p-2 min-w-[56px]"
          >
            <Shield className="h-4 w-4" />
            <span className="text-xs mt-1 hidden sm:block">Security</span>
          </TabsTrigger>
          <TabsTrigger
            value="mood"
            className="flex flex-col items-center justify-center p-2 min-w-[56px]"
          >
            <Clock className="h-4 w-4" />
            <span className="text-xs mt-1 hidden sm:block">Mood</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    placeholder="Enter your name"
                    value={profile?.display_name || ""}
                    onChange={(e) =>
                      handleChange("display_name", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={profile?.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profile?.avatar_url || ""}
                  onChange={(e) => handleChange("avatar_url", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Life Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Life Stages</Label>
                <div className="grid grid-cols-2 gap-3">
                  {lifeStages.map((stage) => (
                    <div key={stage} className="flex items-center space-x-2">
                      <Checkbox
                        id={`life_stage_${stage}`}
                        checked={profile?.life_stage?.includes(stage) || false}
                        onCheckedChange={() => toggleLifeStage(stage)}
                      />
                      <Label
                        htmlFor={`life_stage_${stage}`}
                        className="text-sm font-normal"
                      >
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="work_context">Work Context</Label>
                <Input
                  id="work_context"
                  placeholder="e.g., remote, 9-to-5, freelance"
                  value={profile?.work_context || ""}
                  onChange={(e) => handleChange("work_context", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wake_time">Wake Time</Label>
                  <Input
                    id="wake_time"
                    placeholder="07:30"
                    value={profile?.wake_time || ""}
                    onChange={(e) => handleChange("wake_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleep_time">Sleep Time</Label>
                  <Input
                    id="sleep_time"
                    placeholder="22:00"
                    value={profile?.sleep_time || ""}
                    onChange={(e) => handleChange("sleep_time", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {valuesList.map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={value}
                      checked={profile?.values?.includes(value) || false}
                      onCheckedChange={() => toggleValue(value)}
                    />
                    <Label htmlFor={value} className="text-sm font-normal">
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Goals & AI Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goals">Overall Goals</Label>
                <Textarea
                  id="goals"
                  placeholder="e.g., become more present, build a business, get healthy"
                  value={profile?.overall_goals?.join(", ") || ""}
                  onChange={(e) =>
                    handleChange(
                      "overall_goals",
                      e.target.value
                        .split(",")
                        .map((g) => g.trim())
                        .filter((g) => g.length > 0),
                    )
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>AI Nudge Level</Label>
                  <Select
                    value={profile?.ai_nudge_level || ""}
                    onValueChange={(val) => handleChange("ai_nudge_level", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select nudge level" />
                    </SelectTrigger>
                    <SelectContent>
                      {aiNudgeLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tone Preference</Label>
                  <Select
                    value={profile?.tone_preference || ""}
                    onValueChange={(val) =>
                      handleChange("tone_preference", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {tonePreferences.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone.charAt(0).toUpperCase() + tone.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Focus Window</Label>
                  <Select
                    value={profile?.focus_window || ""}
                    onValueChange={(val) => handleChange("focus_window", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When do you focus best?" />
                    </SelectTrigger>
                    <SelectContent>
                      {focusWindows.map((window) => (
                        <SelectItem key={window} value={window}>
                          {window.charAt(0).toUpperCase() + window.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications"
                  checked={profile?.notification_opt_in || false}
                  onCheckedChange={(checked) =>
                    handleChange("notification_opt_in", checked)
                  }
                />
                <Label htmlFor="notifications" className="text-sm font-normal">
                  Enable notifications
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                My Communities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Create or join communities to share tasks and get support from
                  family, friends, or teammates.
                </p>
              </div>

              {/* Pending Invitations Section */}
              {pendingInvitations.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      Pending Invitations
                    </h4>
                    <Badge variant="secondary">
                      {pendingInvitations.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {pendingInvitations.map((invitation: any) => {
                      // Safely parse the expiration date
                      const expiresDate = invitation.expires_at
                        ? new Date(invitation.expires_at)
                        : null;
                      const isValidDate =
                        expiresDate && !isNaN(expiresDate.getTime());

                      return (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {invitation.community_name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Invited by {invitation.inviter_email}
                            </p>
                            <p className="text-xs text-gray-500">
                              Expires:{" "}
                              {isValidDate
                                ? expiresDate.toLocaleDateString()
                                : "No expiration"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleInvitationMutation.mutate({
                                  invitationId: invitation.id,
                                  action: "accept",
                                })
                              }
                              disabled={handleInvitationMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleInvitationMutation.mutate({
                                  invitationId: invitation.id,
                                  action: "decline",
                                })
                              }
                              disabled={handleInvitationMutation.isPending}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* This was moved up */}
                <Dialog
                  open={isCreateCommunityOpen}
                  onOpenChange={setIsCreateCommunityOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create Community
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Community</DialogTitle>
                      <DialogDescription>
                        Start a new community to share tasks and collaborate
                        with others.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="community-name">Community Name</Label>
                        <Input
                          id="community-name"
                          placeholder="Enter community name"
                          value={newCommunityName}
                          onChange={(e) => setNewCommunityName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Community Type</Label>
                        <Select
                          value={newCommunityType}
                          onValueChange={setNewCommunityType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="family">Family</SelectItem>
                            <SelectItem value="friends">Friends</SelectItem>
                            <SelectItem value="work">Work Team</SelectItem>
                            <SelectItem value="study">Study Group</SelectItem>
                            <SelectItem value="hobby">Hobby Group</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateCommunityOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() =>
                            createCommunityMutation.mutate({
                              name: newCommunityName,
                              type: newCommunityType,
                            })
                          }
                          disabled={
                            !newCommunityName.trim() ||
                            createCommunityMutation.isPending
                          }
                        >
                          {createCommunityMutation.isPending
                            ? "Creating..."
                            : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {communitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
                    ></div>
                  ))}
                </div>
              ) : communities?.length > 0 ? (
                <div className="space-y-3">
                  {communities.map((community: any) => (
                    <Card
                      key={community.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                      onClick={() => setSelectedCommunity(community)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-lg">
                                {community.name}
                              </h3>
                              <Badge
                                variant={
                                  community.user_role === "owner"
                                    ? "default"
                                    : community.user_role === "admin"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {community.user_role === "owner"
                                  ? "Owner"
                                  : community.user_role === "admin"
                                    ? "Admin"
                                    : "Member"}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                              <p>{community.member_count || 0} members</p>
                              <p>
                                Created{" "}
                                {new Date(
                                  community.created_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {community.user_role !== "owner" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeaveCommunityConfirm({
                                  isOpen: true,
                                  community,
                                  step: "initial",
                                });
                              }}
                              disabled={leaveCommunityMutation.isPending}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Leave
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>You haven't joined any communities yet.</p>
                  <p className="text-sm">
                    Create your first community to start collaborating!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Detail Modal */}
        {selectedCommunity && (
          <Dialog
            open={!!selectedCommunity}
            onOpenChange={() => setSelectedCommunity(null)}
          >
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {selectedCommunity.name}
                  <Badge
                    variant={
                      selectedCommunity.user_role === "owner"
                        ? "default"
                        : selectedCommunity.user_role === "admin"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {selectedCommunity.user_role === "owner"
                      ? "Owner"
                      : selectedCommunity.user_role === "admin"
                        ? "Admin"
                        : "Member"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Created{" "}
                  {new Date(selectedCommunity.created_at).toLocaleDateString()}{" "}
                  • {selectedCommunity.member_count || 0} members
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="members" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  {(selectedCommunity.user_role === "admin" ||
                    selectedCommunity.user_role === "owner") && (
                    <TabsTrigger value="invitations">Invitations</TabsTrigger>
                  )}
                </TabsList>

                {/* Members Tab */}
                <TabsContent value="members" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Community Members</h3>
                    {(selectedCommunity.user_role === "admin" ||
                      selectedCommunity.user_role === "owner") && (
                      <Button
                        onClick={() =>
                          setIsInviteModalOpen({
                            isOpen: true,
                            community: selectedCommunity,
                          })
                        }
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Invite Member
                      </Button>
                    )}
                  </div>

                  <CommunityMemberList
                    communityId={selectedCommunity.id}
                    currentUserRole={selectedCommunity.user_role}
                  />

                  <div className="flex gap-2 pt-4 border-t">
                    {selectedCommunity.user_role !== "owner" && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setLeaveCommunityConfirm({
                            isOpen: true,
                            community: selectedCommunity,
                            step: "initial",
                          });
                          setSelectedCommunity(null);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Leave Community
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setSelectedCommunity(null)}
                    >
                      Close
                    </Button>
                  </div>
                </TabsContent>

                {/* Invitations Tab */}
                {(selectedCommunity.user_role === "admin" ||
                  selectedCommunity.user_role === "owner") && (
                  <TabsContent value="invitations" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">
                        Pending Invitations
                      </h3>
                      <Button
                        onClick={() =>
                          setIsInviteModalOpen({
                            isOpen: true,
                            community: selectedCommunity,
                          })
                        }
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Send Invitation
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {communityInvitationsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="animate-pulse space-y-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                            </div>
                          ))}
                        </div>
                      ) : communityInvitations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No pending invitations</p>
                          <p className="text-xs">
                            Send invitations to grow your community
                          </p>
                        </div>
                      ) : (
                        communityInvitations.map((invitation: any) => (
                          <div
                            key={invitation.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-500" />
                                <span className="font-medium text-sm">
                                  {invitation.invitee_email}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Invited by{" "}
                                {invitation.inviter_name ||
                                  invitation.inviter_email}{" "}
                                • Expires{" "}
                                {new Date(
                                  invitation.expires_at,
                                ).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                revokeInvitationMutation.mutate(invitation.id)
                              }
                              disabled={revokeInvitationMutation.isPending}
                              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            >
                              {revokeInvitationMutation.isPending
                                ? "Revoking..."
                                : "Revoke"}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </DialogContent>
          </Dialog>
        )}

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-gray-600">
                    Last changed:{" "}
                    {profile?.last_login
                      ? new Date(profile.last_login).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
                <Dialog
                  open={isPasswordChangeOpen}
                  onOpenChange={setIsPasswordChangeOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new one.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">
                          Current Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showCurrentPassword ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() =>
                              setShowCurrentPassword(!showCurrentPassword)
                            }
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">
                          Confirm New Password
                        </Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsPasswordChangeOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handlePasswordChange}
                          disabled={passwordChangeMutation.isPending}
                        >
                          {passwordChangeMutation.isPending
                            ? "Changing..."
                            : "Change Password"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Account Status</h3>
                    <p className="text-sm text-gray-600">
                      Your account is {profile?.status || "active"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      profile?.status === "active" ? "default" : "destructive"
                    }
                  >
                    {profile?.status || "Active"}
                  </Badge>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Verification</h3>
                    <p className="text-sm text-gray-600">
                      {profile?.verified
                        ? "Your email is verified"
                        : "Email verification pending"}
                    </p>
                  </div>
                  <Badge variant={profile?.verified ? "default" : "secondary"}>
                    {profile?.verified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mood History Tab */}
        <TabsContent value="mood" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Your Mood Journey
              </CardTitle>
              <p className="text-gray-600 text-sm">
                Track your emotional well-being over time
              </p>
            </CardHeader>
            <CardContent>
              {moodHistory?.moods && moodHistory.moods.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {moodHistory.moods.map((mood: any) => (
                    <div
                      key={mood.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{mood.mood_emoji}</span>
                        <div>
                          <div className="text-sm font-medium">
                            {new Date(mood.created_at).toLocaleDateString(
                              undefined,
                              {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(mood.created_at).toLocaleTimeString(
                              undefined,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No mood check-ins yet.</p>
                  <p className="text-sm mt-1">
                    Start tracking your mood to see your journey here!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enhanced Leave/Delete Community Confirmation Dialog */}
      <Dialog
        open={leaveCommunityConfirm.isOpen}
        onOpenChange={(open) =>
          setLeaveCommunityConfirm({
            isOpen: open,
            community: null,
            step: "initial",
          })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {leaveCommunityConfirm.step === "delete_confirm"
                ? "Delete Community"
                : leaveCommunityConfirm.community?.role === "owner"
                  ? "Transfer Ownership Required"
                  : "Leave Community"}
            </DialogTitle>
            <DialogDescription>
              {leaveCommunityConfirm.step === "delete_confirm" ? (
                <>
                  <strong className="text-red-600">
                    Final Confirmation Required
                  </strong>
                  <br />
                  <br />
                  This will permanently delete "
                  {leaveCommunityConfirm.community?.name}" for all members. All
                  shared tasks will only be visible to their original creators.
                  <br />
                  <br />
                  <strong>This action cannot be undone.</strong>
                </>
              ) : leaveCommunityConfirm.community?.role === "owner" ? (
                <>
                  As the owner of "{leaveCommunityConfirm.community?.name}", you
                  must transfer ownership to another member before leaving.
                  <br />
                  <br />
                  Alternatively, you can delete the entire community if you no
                  longer want it to exist.
                </>
              ) : (
                <>
                  Are you sure you want to leave "
                  {leaveCommunityConfirm.community?.name}"?
                  <br />
                  <br />
                  <strong>This action cannot be undone.</strong> You will lose
                  access to all shared tasks and conversations in this
                  community.
                  {leaveCommunityConfirm.community?.role === "admin" && (
                    <>
                      <br />
                      <br />
                      <em>
                        Note: As an admin, please ensure there are other admins
                        or an owner to manage the community after you leave.
                      </em>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() =>
                setLeaveCommunityConfirm({
                  isOpen: false,
                  community: null,
                  step: "initial",
                })
              }
            >
              Cancel
            </Button>

            {leaveCommunityConfirm.step === "delete_confirm" ? (
              <Button
                variant="destructive"
                onClick={() => {
                  if (leaveCommunityConfirm.community) {
                    leaveCommunityMutation.mutate({
                      communityId: leaveCommunityConfirm.community.id,
                      confirmLeave: true,
                      confirmDelete: true,
                    });
                    setLeaveCommunityConfirm({
                      isOpen: false,
                      community: null,
                      step: "initial",
                    });
                  }
                }}
                disabled={leaveCommunityMutation.isPending}
              >
                {leaveCommunityMutation.isPending
                  ? "Deleting..."
                  : "Yes, Delete Community"}
              </Button>
            ) : leaveCommunityConfirm.community?.role === "owner" ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() =>
                    setLeaveCommunityConfirm({
                      ...leaveCommunityConfirm,
                      step: "delete_confirm",
                    })
                  }
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Community
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // TODO: Implement transfer ownership flow
                    toast({
                      title: "Transfer Ownership",
                      description: "Transfer ownership feature coming soon",
                      variant: "default",
                    });
                  }}
                >
                  Transfer Ownership
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => {
                  if (leaveCommunityConfirm.community) {
                    leaveCommunityMutation.mutate({
                      communityId: leaveCommunityConfirm.community.id,
                      confirmLeave: true,
                    });
                    setLeaveCommunityConfirm({
                      isOpen: false,
                      community: null,
                      step: "initial",
                    });
                  }
                }}
                disabled={leaveCommunityMutation.isPending}
              >
                {leaveCommunityMutation.isPending
                  ? "Leaving..."
                  : "Yes, Leave Community"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog
        open={isInviteModalOpen.isOpen}
        onOpenChange={(open) =>
          setIsInviteModalOpen({ isOpen: open, community: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Invite Member to {isInviteModalOpen.community?.name}
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join this community. The invitee will
              receive an in-app notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="Enter email address to invite"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInviteModalOpen({ isOpen: false, community: null });
                  setInviteEmail("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (isInviteModalOpen.community && inviteEmail.trim()) {
                    sendInviteMutation.mutate({
                      communityId: isInviteModalOpen.community.id,
                      email: inviteEmail.trim(),
                    });
                  }
                }}
                disabled={!inviteEmail.trim() || sendInviteMutation.isPending}
              >
                {sendInviteMutation.isPending
                  ? "Sending..."
                  : "Send Invitation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="text-center text-sm text-gray-500">
        Changes are saved automatically
      </div>
    </div>
  );
}
