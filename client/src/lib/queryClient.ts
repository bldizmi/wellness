import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const text = await res.text();
      throw new Error(`${res.status}: ${text || res.statusText}`);
    } catch (parseError) {
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

// Global auth token getter - will be set by AuthContext
let getAuthTokenGlobal: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthTokenGlobal = getter;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    // Use the global auth token getter if available (from AuthContext)
    if (getAuthTokenGlobal) {
      const token = await getAuthTokenGlobal();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }

    // Fallback to direct Firebase auth check
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }
  
  return {};
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  const authHeaders = await getAuthHeaders();

  const headers: Record<string, string> = {
    ...authHeaders,
    ...(options.headers as Record<string, string> || {}),
  };

  // DEBUG: Log exact URL and API base for Phase 1 validation
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  if (url.includes('/complete')) {
    console.log(`🔗 API REQUEST URL: ${fullUrl}`);
    console.log(`📡 METHOD: ${options.method || 'GET'}`);
    console.log(`🔑 AUTH HEADERS: ${JSON.stringify(authHeaders)}`);
  }

  // Force cache bypass for personal-progress endpoint to prevent 304 responses
  if (url.includes('/api/today/personal-progress') && !url.includes('/week')) {
    console.log('🔧 CACHE BYPASS: Adding no-cache headers for personal-progress endpoint');
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }
  
  // Force cache refresh after test item creation
  if (url.includes('/api/today/personal-progress')) {
    headers['X-Force-Refresh'] = Date.now().toString();
  }

  // Don't set Content-Type for FormData - let browser set it with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    credentials: "include",
  });

  // DEBUG: Log response details for completion requests
  if (url.includes('/complete')) {
    console.log(`📊 RESPONSE STATUS: ${res.status} ${res.statusText}`);
    console.log(`⏱️ RESPONSE TIME: ${Date.now()}`);
  }

  await throwIfResNotOk(res);
  
  // Check if response has content before trying to parse JSON
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  } else {
    const text = await res.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true, message: text };
      }
    }
    return { success: true };
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30 seconds default stale time instead of Infinity
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
      retry: 1, // Retry once on failure
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
      networkMode: 'online', // Only run mutations when online
    },
  },
});
