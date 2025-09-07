import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { setAuthTokenGetter } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface UserData {
  role: "member" | "admin" | "pilot";
  timezone?: string;
  // Add other user properties you need
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null; // Add user data from your database
  loading: boolean;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  refreshUserData: () => Promise<void>; // Add method to refresh user data
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  const fetchUserData = async (userId: string): Promise<UserData | null> => {
    try {
      // Don't set userDataLoaded to false here - it causes loading to flip
      // setUserDataLoaded(false); // REMOVE THIS LINE

      // Wait briefly to ensure auth state is settled
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get fresh token directly from auth.currentUser
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return null;
      }

      // Get ID token with forceRefresh to ensure it's fresh
      const token = await currentUser.getIdToken(true);
      //console.log("Using auth token:", token ? "exists" : "missing");

      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (response.status === 401) {
        // Force token refresh and retry once
        const freshToken = await currentUser.getIdToken(true);
        const retryResponse = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${freshToken}`,
          },
        });

        if (!retryResponse.ok) {
          console.error("Retry failed - forcing logout");
          await logout();
          return null;
        }
        return await retryResponse.json();
      }

      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.status}`);
      }

      const profileData = await response.json();
      return {
        role: profileData.role,
        email: profileData.email,
        username: profileData.username,
      };
    } catch (error) {
      console.error("Profile fetch error:", error);
      return null;
    } finally {
      // Only set to true when we're completely done
      setUserDataLoaded(true);
    }
  };

  const refreshUserData = async () => {
    if (user?.uid) {
      const data = await fetchUserData(user.uid);
      setUserData(data);
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const data = await fetchUserData(user.uid);
      // Only update if role actually changed
      if (data?.role !== userData?.role) {
        setUserData(data);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, userData?.role]);

  useEffect(() => {
    setAuthTokenGetter(getAuthToken);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      const previousUserId = user?.uid;
      const currentUserId = currentUser?.uid;

      if (previousUserId !== currentUserId) {
        queryClient.removeQueries();

        if (currentUser) {
          const data = await fetchUserData(currentUser.uid);
          setUserData(data);
        } else {
          setUserData(null);
          setUserDataLoaded(true);
        }
      }

      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [queryClient, user]);

  const logout = async () => {
    setLoading(true);
    // ... existing cache clearing
    await signOut(auth);
  };

  const value = {
    user,
    userData,
    loading,
    logout,
    getAuthToken,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
