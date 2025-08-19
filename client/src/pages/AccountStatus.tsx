import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Mail, Home } from "lucide-react";

interface AccountStatusProps {
  status?: "terminated" | "suspended" | "invited";
  message?: string;
}

export default function AccountStatus({
  status = "invited",
  message,
}: AccountStatusProps) {
  const [, setLocation] = useLocation();

  const getStatusInfo = () => {
    switch (status) {
      case "terminated":
        return {
          title: "Account Terminated",
          description: "Your account has been permanently terminated.",
          defaultMessage:
            "Your account access has been revoked. If you believe this is an error, please contact our support team.",
          icon: <AlertTriangle className="h-12 w-12 text-red-500" />,
          variant: "destructive" as const,
        };
      case "suspended":
        return {
          title: "Account Suspended",
          description: "Your account has been temporarily suspended.",
          defaultMessage:
            "Your account is temporarily suspended. Please contact support to resolve this issue.",
          icon: <AlertTriangle className="h-12 w-12 text-yellow-500" />,
          variant: "default" as const,
        };
      case "invited":
        return {
          title: "Complete Your Setup",
          description: "Welcome! Please complete your account setup.",
          defaultMessage:
            "You've been invited to join MindDouble. Please complete your account setup to get started.",
          icon: <Mail className="h-12 w-12 text-blue-500" />,
          variant: "default" as const,
        };
      default:
        return {
          title: "Account Issue",
          description: "There's an issue with your account.",
          defaultMessage: "Please contact support for assistance.",
          icon: <AlertTriangle className="h-12 w-12 text-gray-500" />,
          variant: "default" as const,
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleContactSupport = () => {
    // You can replace this with your actual support contact method
    window.location.href =
      "mailto:support@minddouble.com?subject=Account Status Issue";
  };

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">{statusInfo.icon}</div>
          <CardTitle className="text-2xl">{statusInfo.title}</CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            {message || statusInfo.defaultMessage}
          </p>

          <div className="space-y-2">
            {status === "invited" ? (
              <Button onClick={() => setLocation("/setup")} className="w-full">
                Complete Setup
              </Button>
            ) : (
              <Button
                onClick={handleContactSupport}
                className="w-full"
                variant={statusInfo.variant}
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            )}

            <Button onClick={handleGoHome} variant="outline" className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
