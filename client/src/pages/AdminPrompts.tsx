import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Plus,
  Edit3,
  Play,
  History,
  Trash2,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  Save,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AiPrompt {
  id: string;
  name: string;
  type: string;
  version: number;
  content: string;
  variables?: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export default function AdminPrompts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [activeType, setActiveType] = useState<string>("image_verification");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<AiPrompt | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    content: "",
    variables: {} as Record<string, string>,
    metadata: {} as Record<string, any>,
  });
  
  // Test state
  const [testData, setTestData] = useState({
    content: "",
    sampleData: {
      taskTitle: "Take a walk in the evening",
      userTimezone: "America/New_York",
      imageCount: 2
    }
  });
  const [testResult, setTestResult] = useState<any>(null);

  // Fetch prompt types
  const { data: typesData } = useQuery({
    queryKey: ["/api/admin/prompts/types"],
    queryFn: async () => {
      const response = await apiRequest("/api/admin/prompts/types");
      return response.types || [];
    },
  });

  // Fetch prompts by type
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["/api/admin/prompts", { type: activeType }],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/prompts?type=${activeType}`);
      return response.prompts || [];
    },
    enabled: !!activeType,
  });

  // Fetch active prompt for current type
  const { data: activePromptData } = useQuery({
    queryKey: ["/api/admin/prompts", activeType, "active"],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/prompts/${activeType}/active`);
      return response;
    },
    enabled: !!activeType,
  });

  // Create prompt mutation
  const createPromptMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/prompts", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create prompt",
        variant: "destructive",
      });
    },
  });

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/admin/prompts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setShowEditModal(false);
      setSelectedPrompt(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update prompt",
        variant: "destructive",
      });
    },
  });

  // Activate prompt mutation
  const activatePromptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/prompts/${id}/activate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt activated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate prompt",
        variant: "destructive",
      });
    },
  });

  // Test prompt mutation
  const testPromptMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/prompts/test", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: "Test Complete",
        description: "Prompt tested successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test prompt",
        variant: "destructive",
      });
    },
  });

  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/prompts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setShowDeleteDialog(false);
      setSelectedPrompt(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete prompt",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      content: "",
      variables: {},
      metadata: {},
    });
  };

  const openCreateModal = () => {
    resetForm();
    setFormData(prev => ({ ...prev, type: activeType }));
    setShowCreateModal(true);
  };

  const openEditModal = (prompt: AiPrompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      type: prompt.type,
      content: prompt.content,
      variables: prompt.variables || {},
      metadata: prompt.metadata || {},
    });
    setShowEditModal(true);
  };

  const openTestModal = (prompt?: AiPrompt) => {
    if (prompt) {
      setTestData(prev => ({
        ...prev,
        content: prompt.content
      }));
    }
    setTestResult(null);
    setShowTestModal(true);
  };

  const handleSubmit = (isEdit: boolean = false) => {
    const data = {
      ...formData,
      is_active: false, // Don't auto-activate, let admin choose
    };

    if (isEdit && selectedPrompt) {
      updatePromptMutation.mutate({ id: selectedPrompt.id, data });
    } else {
      createPromptMutation.mutate(data);
    }
  };

  const handleActivate = (prompt: AiPrompt) => {
    activatePromptMutation.mutate(prompt.id);
  };

  const handleTest = () => {
    testPromptMutation.mutate(testData);
  };

  const handleDelete = () => {
    if (selectedPrompt) {
      deletePromptMutation.mutate(selectedPrompt.id);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('prompt-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + `{{${variable}}}` + after;
      
      setFormData(prev => ({ ...prev, content: newText }));
      
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  const activePrompt = promptsData?.find((p: AiPrompt) => p.is_active);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-red-400" />
            <div>
              <h1 className="text-2xl font-bold">AI Prompt Management</h1>
              <p className="text-gray-400">Customize AI prompts for different verification tasks</p>
            </div>
          </div>
          <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />
            Create New Prompt
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Prompt Types Tabs */}
        <Tabs value={activeType} onValueChange={setActiveType} className="mb-6">
          <TabsList className="bg-gray-800">
            {typesData?.map((type: string) => (
              <TabsTrigger
                key={type}
                value={type}
                className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
              >
                {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </TabsTrigger>
            )) || [
              <TabsTrigger key="image_verification" value="image_verification">
                Image Verification
              </TabsTrigger>
            ]}
          </TabsList>

          {/* Active Prompt Card */}
          {activePrompt && (
            <Card className="bg-gray-800 border-gray-700 mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <CardTitle className="text-green-300">Currently Active Prompt</CardTitle>
                    <Badge className="bg-green-600">v{activePrompt.version}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(activePrompt)}
                      className="border-gray-600 hover:bg-gray-700"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTestModal(activePrompt)}
                      className="border-gray-600 hover:bg-gray-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-300 mb-2">{activePrompt.name}</h4>
                    <div className="bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                        {activePrompt.content.substring(0, 200)}
                        {activePrompt.content.length > 200 && "..."}
                      </pre>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Updated {formatDistanceToNow(new Date(activePrompt.updated_at))} ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prompt History Table */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Prompt Versions ({promptsData?.length || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {promptsData && promptsData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead>Version</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promptsData.map((prompt: AiPrompt) => (
                      <TableRow key={prompt.id} className="border-gray-700">
                        <TableCell>
                          <Badge variant="outline">v{prompt.version}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{prompt.name}</TableCell>
                        <TableCell>
                          {prompt.is_active ? (
                            <Badge className="bg-green-600">Active</Badge>
                          ) : prompt.is_default ? (
                            <Badge variant="outline" className="border-blue-400 text-blue-400">
                              Default
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {formatDistanceToNow(new Date(prompt.created_at))} ago
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTestModal(prompt)}
                              className="h-8 w-8 p-0 hover:bg-gray-700"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(prompt)}
                              className="h-8 w-8 p-0 hover:bg-gray-700"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            {!prompt.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleActivate(prompt)}
                                className="h-8 w-8 p-0 hover:bg-green-700"
                                disabled={activatePromptMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {!prompt.is_active && !prompt.is_default && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPrompt(prompt);
                                  setShowDeleteDialog(true);
                                }}
                                className="h-8 w-8 p-0 hover:bg-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prompts found for this type</p>
                  <Button onClick={openCreateModal} className="mt-4 bg-red-600 hover:bg-red-700">
                    Create First Prompt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedPrompt(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl bg-slate-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>
              {showEditModal ? "Edit Prompt" : "Create New Prompt"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {showEditModal ? "Update the prompt content and settings" : "Create a new AI prompt template"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Prompt Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enhanced Image Analysis Prompt"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label htmlFor="type">Prompt Type</Label>
                <Input
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  placeholder="e.g., image_verification"
                  className="bg-gray-700 border-gray-600"
                  disabled={showEditModal}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="prompt-content">Prompt Content</Label>
              <Textarea
                id="prompt-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter your prompt template..."
                className="min-h-[300px] bg-gray-700 border-gray-600 font-mono text-sm"
              />
            </div>

            {/* Variable Helper */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium mb-2">Available Variables</h4>
              <p className="text-sm text-gray-400 mb-3">
                Click to insert variables into your prompt:
              </p>
              <div className="flex flex-wrap gap-2">
                {["taskTitle", "currentDate", "previousAttemptsSection", "imageCount"].map((variable) => (
                  <Button
                    key={variable}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => insertVariable(variable)}
                    className="border-gray-500 hover:bg-gray-600"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(showEditModal)}
              disabled={createPromptMutation.isPending || updatePromptMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {(createPromptMutation.isPending || updatePromptMutation.isPending) ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {showEditModal ? "Update Prompt" : "Create Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={showTestModal} onOpenChange={(open) => {
        if (!open) {
          setShowTestModal(false);
          setTestResult(null);
        }
      }}>
        <DialogContent className="max-w-4xl bg-slate-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Test Prompt</DialogTitle>
            <DialogDescription className="text-gray-400">
              Test your prompt with sample data to see how it renders
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-content">Prompt Content</Label>
              <Textarea
                id="test-content"
                value={testData.content}
                onChange={(e) => setTestData(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[200px] bg-gray-700 border-gray-600 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="task-title">Task Title</Label>
                <Input
                  id="task-title"
                  value={testData.sampleData.taskTitle}
                  onChange={(e) => setTestData(prev => ({
                    ...prev,
                    sampleData: { ...prev.sampleData, taskTitle: e.target.value }
                  }))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={testData.sampleData.userTimezone}
                  onChange={(e) => setTestData(prev => ({
                    ...prev,
                    sampleData: { ...prev.sampleData, userTimezone: e.target.value }
                  }))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label htmlFor="image-count">Image Count</Label>
                <Input
                  id="image-count"
                  type="number"
                  value={testData.sampleData.imageCount}
                  onChange={(e) => setTestData(prev => ({
                    ...prev,
                    sampleData: { ...prev.sampleData, imageCount: parseInt(e.target.value) || 1 }
                  }))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>

            {testResult && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Rendered Prompt Result
                </h4>
                <pre className="bg-gray-900 rounded p-3 text-sm overflow-x-auto whitespace-pre-wrap">
                  {testResult.renderedPrompt}
                </pre>
                {testResult.validation && !testResult.validation.valid && (
                  <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded">
                    <p className="text-red-400 text-sm">
                      Validation Issues: {testResult.validation.errors.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTestModal(false);
                setTestResult(null);
              }}
            >
              Close
            </Button>
            <Button
              onClick={handleTest}
              disabled={testPromptMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {testPromptMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-800 text-white border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete "{selectedPrompt?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}