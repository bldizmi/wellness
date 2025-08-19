import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "member" | "admin" | "pilot";
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole = "member",
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, loading, userData } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (loading) return;

    if (!user) {
      setLocation(redirectTo);
      return;
    }

    if (userData && userData.role !== requiredRole) {
      setLocation("/today");
    }
  }, [user, loading, userData, requiredRole, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user && userData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading user data...
      </div>
    );
  }

  return <>{children}</>;
}
