import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import BottomNavigation from "@/components/BottomNavigation";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MoodCheck from "@/pages/MoodCheck";
import Welcome from "@/pages/Welcome";
import TestLogin from "@/pages/TestLogin";
import Today from "@/pages/Today";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import CreateWithAI from "@/pages/CreateWithAI";
import Plans from "@/pages/Plans";
import Insights from "@/pages/Insights";
import Rewards from "@/pages/Rewards";
import AdminUsers from "@/pages/AdminUsers";
import AdminPrompts from "@/pages/AdminPrompts";
import AccountStatus from "@/pages/AccountStatus";

import Header from "@/components/Header";
import DesktopSidebar from "@/components/DesktopSidebar";
import SmartRouter from "@/components/SmartRouter";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";

function Router() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [userStatusChecked, setUserStatusChecked] = React.useState(false);
  const [userStatus, setUserStatus] = React.useState<string | null>(null);
  const hideBottomNav = location === "/" || location === "/login";
  const isAuthenticated = !!user;

  // Check user status when user is authenticated
  React.useEffect(() => {
    const checkUserStatus = async () => {
      if (!loading && user && !userStatusChecked) {
        try {
          // Fetch user status from your database
          const response = await apiRequest("/api/profile/status");
          setUserStatus(response.status);

          // If user is terminated, sign them out
          if (response.status === "terminated") {
            await auth.signOut();
            toast({
              title: "Account Deactivated",
              description:
                "Your account has been deactivated. Please contact support if you believe this is an error.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Success", description: "Signed in successfully!" });
          }
        } catch (error) {
          console.error("Failed to check user status:", error);
          // Handle error - maybe allow access or sign out based on your preference
          setUserStatus("active"); // Or handle differently
        } finally {
          setUserStatusChecked(true);
        }
      }
    };

    checkUserStatus();
  }, [user, loading, userStatusChecked, toast]);

  // Reset status check when user changes
  React.useEffect(() => {
    if (!user) {
      setUserStatusChecked(false);
      setUserStatus(null);
    }
  }, [user]);

  // Auto-route authenticated users away from login page (UPDATED)
  React.useEffect(() => {
    if (
      !loading &&
      user &&
      userStatusChecked &&
      userStatus !== "terminated" &&
      location === "/login"
    ) {
      setLocation("/today");
    }
  }, [user, loading, location, setLocation, userStatusChecked, userStatus]);

  // Redirect authenticated users from home to today (UPDATED)
  React.useEffect(() => {
    if (
      !loading &&
      user &&
      userStatusChecked &&
      userStatus !== "terminated" &&
      location === "/"
    ) {
      setLocation("/today");
    }
  }, [user, loading, location, setLocation, userStatusChecked, userStatus]);

  // Show loading state while checking authentication OR user status
  if (loading || (user && !userStatusChecked)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }
  // For login/test-login routes, always show without sidebar
  if (location === "/login" || location === "/test-login") {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/test-login" component={TestLogin} />
      </Switch>
    );
  }

  // For authenticated users, show normal layout with sidebar
  if (isAuthenticated) {
    return (
      <>
        <DesktopSidebar />
        <div className="lg:ml-64">
          <Header />
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/mood">
              <ProtectedRoute>
                <MoodCheck />
              </ProtectedRoute>
            </Route>
            <Route path="/welcome">
              <ProtectedRoute>
                <Welcome />
              </ProtectedRoute>
            </Route>
            <Route path="/test-login" component={TestLogin} />
            <Route path="/admin">
              <ProtectedRoute requiredRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/prompts">
              <ProtectedRoute requiredRole="admin">
                <AdminPrompts />
              </ProtectedRoute>
            </Route>
            <Route path="/today">
              <ProtectedRoute>
                <Today />
              </ProtectedRoute>
            </Route>
            <Route path="/profile">
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            </Route>
            <Route path="/plans">
              <ProtectedRoute>
                <Plans />
              </ProtectedRoute>
            </Route>
            <Route path="/insights">
              <ProtectedRoute>
                <Insights />
              </ProtectedRoute>
            </Route>
            <Route path="/rewards">
              <ProtectedRoute>
                <Rewards />
              </ProtectedRoute>
            </Route>
            <Route path="/404">
              <NotFound />
            </Route>
            <Route>
              <Redirect to="/404" />
            </Route>
          </Switch>
        </div>
        {!hideBottomNav && <BottomNavigation />}
        <FloatingActionButton />
      </>
    );
  }

  // For unauthenticated users, redirect to login
  return <Redirect to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <SmartRouter>
              <Router />
            </SmartRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
