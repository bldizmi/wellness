import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import MoodIcon, { MOOD_OPTIONS } from "@/components/MoodIcons";
import confetti from "canvas-confetti";

// Types for our responses
interface MoodData {
  id: string;
  mood_emoji: string;
  timestamp: string;
  created_at: string;
}

interface MoodHistoryResponse {
  success: boolean;
  moods: MoodData[];
}

interface MoodCheckProps {
  isModal?: boolean;
  onClose?: () => void;
  onSkip?: () => void;
}

export default function MoodCheck({ isModal = false, onClose, onSkip }: MoodCheckProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch mood history
  const { data: moodHistory } = useQuery<MoodHistoryResponse>({ 
    queryKey: ['/api/mood/history'],
  });

  // Submit mood mutation
  const { mutate: submitMood, isPending } = useMutation({
    mutationFn: async (emoji: string) => {
      return await apiRequest('/api/mood/check-in', {
        method: 'POST',
        body: JSON.stringify({
          mood_emoji: emoji,
          timestamp: new Date().toISOString()
        })
      });
    },
    onSuccess: (data) => {
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "Mood recorded!",
        description: "Thank you for checking in today.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mood/history'] });
      setSelectedMood(null);
      
      if (isModal && onClose) {
        onClose();
      } else {
        setLocation('/today');
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not save your mood. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle mood selection
  const handleMoodSelect = (moodId: string) => {
    const mood = MOOD_OPTIONS.find(m => m.id === moodId);
    if (mood) {
      setSelectedMood(mood.emoji);
    }
  };

  // Handle mood submit
  const handleSubmit = () => {
    if (selectedMood) {
      submitMood(selectedMood);
    }
  };

  // Handle skip
  const handleSkip = () => {
    // Store skip status in localStorage (optional - for backward compatibility)
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem('moodSkippedDate', today);
    
    if (isModal && onSkip) {
      onSkip();
    } else if (isModal && onClose) {
      onClose();
    } else {
      setLocation('/today');
    }
  };

  const MoodGrid = () => (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {MOOD_OPTIONS.map((mood) => {
        const isSelected = selectedMood === mood.emoji;
        return (
          <Button
            key={mood.id}
            variant={isSelected ? "default" : "outline"}
            className={`p-4 h-auto flex flex-col gap-2 transition-all ${
              isSelected ? "ring-2 ring-primary scale-105" : "hover:scale-105"
            }`}
            onClick={() => handleMoodSelect(mood.id)}
          >
            <MoodIcon mood={mood.id} size={48} />
            <span className="text-xs font-medium">{mood.label}</span>
          </Button>
        );
      })}
    </div>
  );

  // Mobile welcome screen (full page)
  if (!isModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Vibe check...
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              How are you feeling right now?
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <MoodGrid />
            
            <Button 
              className="w-full h-12 text-lg font-medium" 
              disabled={!selectedMood || isPending}
              onClick={handleSubmit}
            >
              {isPending ? "Checking in..." : "Check In"}
            </Button>
          </div>

          <div className="text-center">
            <Button 
              variant="ghost" 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={handleSkip}
            >
              Skip for now
            </Button>
          </div>


        </div>
      </div>
    );
  }

  // Desktop modal content
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Vibe check...
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          How are you feeling right now?
        </p>
      </div>

      <MoodGrid />
      
      <div className="flex gap-3">
        <Button 
          variant="outline"
          className="flex-1" 
          onClick={handleSkip}
        >
          Skip
        </Button>
        <Button 
          className="flex-1" 
          disabled={!selectedMood || isPending}
          onClick={handleSubmit}
        >
          {isPending ? "Checking in..." : "Check In"}
        </Button>
      </div>


    </div>
  );
}

// Export a modal wrapper for desktop use
export function MoodCheckModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <MoodCheck 
          isModal={true} 
          onClose={() => onOpenChange(false)}
          onSkip={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}