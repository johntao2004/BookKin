import { CircularProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { SessionUser, UserRole } from "../domain/types";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  setupOwner: (input: { username: string; displayName: string; password: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const storageKey = "bookkin-demo-session";
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): SessionUser | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    return value ? JSON.parse(value) as SessionUser : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser());
  const [ready, setReady] = useState(api.isDemo);

  const persist = useCallback((next: SessionUser | null) => {
    setUser(next);
    if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
    else sessionStorage.removeItem(storageKey);
  }, []);

  useEffect(() => {
    if (api.isDemo) return;
    let active = true;
    api.getSession().then((session) => {
      if (active) persist(session);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    login: async (username, password) => {
      const next = await api.login(username, password);
      persist(next);
      return next;
    },
    setupOwner: async (input) => {
      const next = await api.setupOwner(input);
      persist(next);
      return next;
    },
    logout: async () => {
      await api.logout();
      persist(null);
    },
    changePassword: async (currentPassword, newPassword) => {
      const next = await api.changePassword(currentPassword, newPassword);
      persist(next);
    },
  }), [persist, ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function RequireAuth({ children, roles }: PropsWithChildren<{ roles?: UserRole[] }>) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Stack sx={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack>;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  if (!user) return <AccessDeniedPage reason="AUTHENTICATION_REQUIRED" returnTo={returnTo} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <AccessDeniedPage reason="INSUFFICIENT_ROLE" returnTo={returnTo} />;
  return children;
}
