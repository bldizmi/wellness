import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocation } from 'wouter';
import { Plus, Sparkles, Edit } from 'lucide-react';
import { CreateWithAIModal } from './CreateWithAIModal';
import { CreateOrEditItemModal } from './CreateOrEditItemModal';

export function FloatingActionButton() {
  const [location] = useLocation();
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Only show the FAB on desktop views (md and up), not mobile, and not on login page
  if (location === '/login') {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setShowChoiceModal(!showChoiceModal)}
        className="hidden md:flex fixed bottom-[20px] right-[20px] z-50 h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700 hover:scale-110"
        size="icon"
      >
        <Plus className="h-10 w-10 stroke-[3] transition-transform duration-200" />
        <span className="sr-only">Create new item</span>
      </Button>
      
      {/* Choice Menu - positioned above the FAB */}
      {showChoiceModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowChoiceModal(false)}
          />
          
          {/* Menu options positioned above the button in bottom-right */}
          <div className="fixed bottom-24 right-[20px] z-50 space-y-3">
            <Button
              className="w-48 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center gap-3 text-base font-medium shadow-lg backdrop-blur-sm transition-all duration-150 hover:scale-105"
              onClick={() => {
                setShowChoiceModal(false);
                setShowAIModal(true);
              }}
            >
              <Sparkles className="h-5 w-5 transition-transform duration-150" />
              AI Assistant
            </Button>
            
            <Button
              className="w-48 h-14 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full flex items-center justify-center gap-3 text-base font-medium shadow-lg backdrop-blur-sm border border-gray-200 dark:border-gray-600 transition-all duration-150 hover:scale-105"
              onClick={() => {
                setShowChoiceModal(false);
                setShowManualModal(true);
              }}
            >
              <Edit className="h-5 w-5 transition-transform duration-150" />
              Create
            </Button>
          </div>
        </>
      )}
      
      {/* AI Modal (streamlined, no "Edit First" option) */}
      <CreateWithAIModal 
        open={showAIModal} 
        onOpenChange={setShowAIModal} 
      />
      
      {/* Manual Creation Modal */}
      <CreateOrEditItemModal 
        isOpen={showManualModal} 
        onOpenChange={setShowManualModal}
        item={null} // null indicates creation mode
      />
    </>
  );
}