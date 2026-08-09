/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  apiRequest,
  setAccessToken,
  healthCheck,
} from "./api-client";
import type { User } from "@badge/shared";

type AuthState = {
  user: User | null;
  loading: boolean;
  backendAvailable: boolean;
};

type OAuthResult =
  | { success: true; user: User }
  | { needsEmail: true; pendingToken: string };

type AuthContextType = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  loginWithOAuth: (
    provider: "google" | "microsoft" | "facebook",
    code: string,
    redirectUri: string,
    codeVerifier: string | null,
  ) => Promise<OAuthResult>;
  completeOAuth: (token: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("badge_refresh_token");
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    sessionStorage.setItem("badge_refresh_token", token);
  } else {
    sessionStorage.removeItem("badge_refresh_token");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    backendAvailable: true,
  });

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const rt = getRefreshToken();
    if (!rt) return false;

    try {
      const data = await apiRequest<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/refresh", {
        method: "POST",
        body: { refreshToken: rt },
      });

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      return true;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      return false;
    }
  }, []);

  // Check backend and try to restore session on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const available = await healthCheck();
      if (cancelled) return;

      if (!available) {
        setState({ user: null, loading: false, backendAvailable: false });
        return;
      }

      const refreshed = await refreshAuth();
      if (cancelled) return;

      if (refreshed) {
        try {
          const data = await apiRequest<{ user: User }>("/auth/me");
          if (!cancelled) {
            setState({
              user: data.user,
              loading: false,
              backendAvailable: true,
            });
          }
        } catch {
          if (!cancelled) {
            setState({ user: null, loading: false, backendAvailable: true });
          }
        }
      } else {
        setState({ user: null, loading: false, backendAvailable: true });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [refreshAuth]);

  // Poll health when backend is down
  useEffect(() => {
    if (state.backendAvailable) return;

    const interval = setInterval(async () => {
      const available = await healthCheck();
      if (available) {
        setState((prev) => ({ ...prev, backendAvailable: true }));
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [state.backendAvailable]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User }>("/auth/me");
      setState((prev) => ({ ...prev, user: data.user }));
    } catch {
      // silently fail
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setState((prev) => ({
      ...prev,
      user: data.user,
      backendAvailable: true,
    }));
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const res = await apiRequest<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/register", {
        method: "POST",
        body: data,
      });

      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setState((prev) => ({
        ...prev,
        user: res.user,
        backendAvailable: true,
      }));
    },
    [],
  );

  const loginWithOAuth = useCallback(
    async (
      provider: "google" | "microsoft" | "facebook",
      code: string,
      redirectUri: string,
      codeVerifier: string | null,
    ): Promise<OAuthResult> => {
      const body: Record<string, string> = { code, redirectUri };
      if (codeVerifier) body.codeVerifier = codeVerifier;

      const data = await apiRequest<{
        user?: User;
        accessToken?: string;
        refreshToken?: string;
        needsEmail?: boolean;
        pendingToken?: string;
      }>(`/auth/${provider}`, {
        method: "POST",
        body,
      });

      if (data.needsEmail && data.pendingToken) {
        return { needsEmail: true, pendingToken: data.pendingToken };
      }

      setAccessToken(data.accessToken!);
      setRefreshToken(data.refreshToken!);
      setState((prev) => ({
        ...prev,
        user: data.user!,
        backendAvailable: true,
      }));
      return { success: true, user: data.user! };
    },
    [],
  );

  const completeOAuth = useCallback(async (token: string, email: string) => {
    const data = await apiRequest<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>("/auth/oauth-complete", {
      method: "POST",
      body: { token, email },
    });

    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setState((prev) => ({
      ...prev,
      user: data.user,
      backendAvailable: true,
    }));
  }, []);

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: { refreshToken: rt },
      });
    } catch { /* best-effort */ }

    setAccessToken(null);
    setRefreshToken(null);
    try { localStorage.removeItem("badge_cart_v2"); } catch { /* ignore */ }
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, loginWithOAuth, completeOAuth, logout, refreshAuth, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
