import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

interface CreateWithAIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWithAIModal({ open, onOpenChange }: CreateWithAIModalProps) {
  const [prompt, setPrompt] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ['/api/profile']
  });

  const generate = useMutation({
    mutationFn: async () => {
      // Get today's date in YYYY-MM-DD format using local date (not UTC)
      const today = new Date();
      const client_date = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      console.log('Frontend sending client_date:', client_date);
      const response = await apiRequest('/api/ai/create-item-from-prompt', {
        method: 'POST',
        body: JSON.stringify({ input: prompt, profile, client_date })
      });
      return response;
    },
    onSuccess: (data) => {
      // Auto-save the generated task immediately
      if (data?.item) {
        queryClient.invalidateQueries({ queryKey: ['/api/today'] });
        queryClient.invalidateQueries({ queryKey: ['/api/items'] });
        onOpenChange(false);
        // Reset form
        setPrompt('');
        // Show success toast
        toast({
          title: "Task created! 🎉",
          description: `"${data.item.title}" has been added to your list.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create task. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    generate.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-0 shadow-xl rounded-2xl p-0 gap-0 overflow-hidden">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What items would you like me to create and track for you?"
                className="w-full h-24 p-4 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={generate.isPending}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={generate.isPending}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!prompt.trim() || generate.isPending}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                {generate.isPending ? 'Creating...' : 'Create with AI'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}