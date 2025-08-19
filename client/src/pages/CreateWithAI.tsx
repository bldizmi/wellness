import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocation } from 'wouter';

interface StructuredItem {
  title?: string;
  item_type?: string;
  due_date?: string;
  time_frame?: number;
  why_it_matters?: string;
  is_chore?: boolean;
}

export default function CreateWithAI() {
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState('');
  const [structuredItem, setStructuredItem] = useState<StructuredItem | null>(null);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['/api/profile']
  });

  const generate = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/ai/create-item-from-prompt', {
        method: 'POST',
        body: JSON.stringify({ input: prompt, profile })
      });
      return response;
    },
    onSuccess: (data) => setStructuredItem(data)
  });

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/item', {
        method: 'POST',
        body: JSON.stringify(structuredItem)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/today'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/plans');
    }
  });

  const handleUpdate = (field: keyof StructuredItem, value: any) => {
    setStructuredItem(prev => prev ? { ...prev, [field]: value } : { [field]: value });
  };

  return (
    <div className="relative max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Create with AI</h1>
      
      <Textarea
        placeholder="Describe your task or chore in natural language..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[100px]"
      />
      
      <Button 
        onClick={() => generate.mutate()} 
        disabled={generate.isPending || !prompt.trim()}
        className="w-full"
      >
        {generate.isPending ? 'Generating...' : 'Generate Task'}
      </Button>

      {structuredItem && (
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              placeholder="Task title"
              value={structuredItem.title || ''}
              onChange={(e) => handleUpdate('title', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Type</label>
            <Select value={structuredItem.item_type || ''} onValueChange={(val) => handleUpdate('item_type', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="habit">Habit</SelectItem>
                <SelectItem value="goal">Goal</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Due Date</label>
            <Input
              type="date"
              value={structuredItem.due_date || ''}
              onChange={(e) => handleUpdate('due_date', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Estimated Time (minutes)</label>
            <Input
              type="number"
              placeholder="30"
              value={structuredItem.time_frame || ''}
              onChange={(e) => handleUpdate('time_frame', parseInt(e.target.value) || '')}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Why is this important?</label>
            <Textarea
              placeholder="Explain why this matters to you..."
              value={structuredItem.why_it_matters || ''}
              onChange={(e) => handleUpdate('why_it_matters', e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_chore"
              checked={structuredItem.is_chore || false}
              onCheckedChange={(checked) => handleUpdate('is_chore', checked)}
            />
            <label htmlFor="is_chore" className="text-sm font-medium">
              This is a chore (can be verified with photos)
            </label>
          </div>

          <Button 
            onClick={() => save.mutate()} 
            disabled={save.isPending}
            className="w-full"
          >
            {save.isPending ? 'Saving...' : 'Save Item'}
          </Button>
        </Card>
      )}

      <p className="text-sm text-muted-foreground text-center">
        or{' '}
        <button 
          className="underline text-primary hover:text-primary/80" 
          onClick={() => navigate('/create')}
        >
          create a task manually
        </button>
      </p>
    </div>
  );
}