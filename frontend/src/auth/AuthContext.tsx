import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi } from "../api/auth";
import { ApiError, onUnauthorized, setAuthToken } from "../api/client";
import type { User } from "../api/types";

const TOKEN_KEY = "launchlens.token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): the session simply won't survive a reload.
  }
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** UI hint only — the backend enforces permissions independently. */
  canEdit: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (readStoredToken() ? "loading" : "anonymous"));
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback((expired: boolean) => {
    setAuthToken(null);
    storeToken(null);
    setUser(null);
    setStatus("anonymous");
    setSessionExpired(expired);
  }, []);

  useEffect(() => {
    onUnauthorized(() => clearSession(true));
    return () => onUnauthorized(null);
  }, [clearSession]);

  // Restore a stored session on first load.
  useEffect(() => {
    const token = readStoredToken();
    if (!token) return;
    setAuthToken(token);
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        // 401s are already handled by the unauthorized hook (shows "session expired").
        if (!cancelled && !(error instanceof ApiError && error.status === 401)) clearSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    setAuthToken(access_token);
    try {
      const me = await authApi.me();
      storeToken(access_token);
      setUser(me);
      setStatus("authenticated");
      setSessionExpired(false);
    } catch (error) {
      setAuthToken(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => clearSession(false), [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, canEdit: user?.role === "FORECASTER", sessionExpired, login, logout }),
    [status, user, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export const ROLE_LABEL: Record<User["role"], string> = {
  FORECASTER: "Forecaster",
  BRAND_LEAD: "Brand Lead",
};
