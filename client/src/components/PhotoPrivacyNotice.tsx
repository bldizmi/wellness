import React, { useState } from 'react';
import { Shield, Clock, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PhotoPrivacyNotice() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <Shield className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
        <div 
          className="flex items-center gap-2 cursor-pointer font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-blue-600" />
          ) : (
            <ChevronRight className="h-3 w-3 text-blue-600" />
          )}
          <span>Photo Privacy & Security</span>
        </div>
        
        {isExpanded && (
          <div className="space-y-2 mt-3 ml-5">
            <div className="flex items-start gap-2">
              <Clock className="h-3 w-3 mt-0.5 text-blue-600" />
              <span>Photos are automatically deleted after 14 days</span>
            </div>
            <div className="flex items-start gap-2">
              <Trash2 className="h-3 w-3 mt-0.5 text-blue-600" />
              <span>You can delete photos immediately using "Delete Now" in verification history</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-3 w-3 mt-0.5 text-blue-600" />
              <span>Only you and assigned community members can view your photos</span>
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}