import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { MoodCheckModal } from "./MoodCheck";
import MoodCheck from "./MoodCheck";

export default function TestLogin() {
  const [, setLocation] = useLocation();
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [showMobileWelcome, setShowMobileWelcome] = useState(false);

  const handleDesktopLogin = () => {
    // Simulate login then show mood check modal
    setShowDesktopModal(true);
  };

  const handleMobileLogin = () => {
    // Simulate login then show mobile welcome screen
    setShowMobileWelcome(true);
  };

  if (showMobileWelcome) {
    return <MoodCheck isModal={false} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Test Login Flow
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Choose how you want to test the mood check-in experience
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Desktop Test</CardTitle>
            <p className="text-sm text-gray-600">
              Simulates login → mood check-in modal popup → Today page
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleDesktopLogin}
              className="w-full"
            >
              Test Desktop Login Flow
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mobile Test</CardTitle>
            <p className="text-sm text-gray-600">
              Simulates login → full-screen mood welcome → Today page
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleMobileLogin}
              className="w-full"
              variant="outline"
            >
              Test Mobile Login Flow
            </Button>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/today')}
            className="text-gray-500 hover:text-gray-700"
          >
            Skip to Today page
          </Button>
        </div>
      </div>

      {/* Desktop Modal */}
      <MoodCheckModal 
        open={showDesktopModal} 
        onOpenChange={(open) => {
          setShowDesktopModal(open);
          if (!open) {
            setLocation('/today');
          }
        }}
      />
    </div>
  );
}