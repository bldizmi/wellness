import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, BarChart3, Clock4, Settings, LogOut } from "lucide-react";
import { useLocation } from "wouter";

interface SlideUpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SlideUpDrawer({ open, onOpenChange }: SlideUpDrawerProps) {
  const [, navigate] = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleLogout = () => {
    // Handle logout logic here
    onOpenChange(false);
    // You could add actual logout logic here
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto rounded-t-xl border-t bg-white dark:bg-gray-900 p-0 max-h-[70vh] max-w-md mx-auto">
        <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Menu
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Navigate to different sections
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => handleNavigation('/profile')}
          >
            <User className="mr-3 h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">Profile</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => handleNavigation('/insights')}
          >
            <BarChart3 className="mr-3 h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">Insights</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => handleNavigation('/mood-history')}
          >
            <Clock4 className="mr-3 h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">Mood History</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => handleNavigation('/settings')}
          >
            <Settings className="mr-3 h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">Settings</span>
          </Button>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-4">
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-left hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-red-600 dark:text-red-400">Log Out</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}