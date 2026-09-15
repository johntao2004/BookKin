import { Button } from "@/ui/buttons";
import { Typography } from "@/ui/primitives";
import { CircularProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { SessionUser, UserRole } from "../domain/types";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  sessionError: string | null;
  retrySession: () => void;
  login: (username: string, password: string) => Promise<SessionUser>;
  setupOwner: (input: { username: string; displayName: string; password: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  updateProfile: (input: {username: string; displayName: string; currentPassword: string}) => Promise<void>;
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
  const [user, setUser] = useState<SessionUser | null>(() => api.isDemo ? readStoredUser() : null);
  const [ready, setReady] = useState(api.isDemo);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const authRevision = useRef(0);
  const queryClient = useQueryClient();
  const identity = useRef(user?.id ?? null);

  const persist = useCallback((next: SessionUser | null) => {
    if (identity.current !== (next?.id ?? null)) {
      queryClient.clear();
      identity.current = next?.id ?? null;
    }
    setUser(next);
    setSessionError(null);
    if (api.isDemo) {
      try {
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
      } catch { /* Storage restrictions must not turn successful authentication into a failure. */ }
    }
  }, [queryClient]);

  useEffect(() => {
    if (api.isDemo) return;
    let active = true;
    const revision = authRevision.current;
    setReady(false);
    setSessionError(null);
    api.getSession().then((session) => {
      if (active && revision === authRevision.current) persist(session);
    }).catch((reason) => {
      if (active && revision === authRevision.current) {
        setUser(null);
        setSessionError(reason instanceof Error ? reason.message : "暂时无法确认登录状态，请重试。");
      }
    }).finally(() => {
      if (active && revision === authRevision.current) setReady(true);
    });
    return () => { active = false; };
  }, [persist, sessionAttempt]);

  useEffect(() => {
    const expire = () => {
      authRevision.current += 1;
      persist(null);
      setReady(true);
    };
    window.addEventListener("bookkin:session-expired", expire);
    return () => window.removeEventListener("bookkin:session-expired", expire);
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    sessionError,
    retrySession: () => setSessionAttempt((attempt) => attempt + 1),
    login: async (username, password) => {
      const next = await api.login(username, password);
      authRevision.current += 1;
      persist(next);
      setReady(true);
      return next;
    },
    setupOwner: async (input) => {
      const next = await api.setupOwner(input);
      authRevision.current += 1;
      persist(next);
      setReady(true);
      return next;
    },
    logout: async () => {
      await api.logout();
      authRevision.current += 1;
      persist(null);
      setReady(true);
    },
    updateProfile: async (input) => { persist(await api.updateProfile(input)); },
    changePassword: async (currentPassword, newPassword) => {
      const next = await api.changePassword(currentPassword, newPassword);
      persist(next);
    },
  }), [persist, ready, sessionError, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function RequireAuth({ children, roles }: PropsWithChildren<{ roles?: UserRole[] }>) {
  const { user, ready, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (!ready) return <Stack sx={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack>;
  if (sessionError) return <Stack sx={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }} spacing={2}>
    <Typography>{sessionError}</Typography>
    <Button onClick={retrySession}>重试连接</Button>
  </Stack>;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  if (!user) return <AccessDeniedPage reason="AUTHENTICATION_REQUIRED" returnTo={returnTo} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <AccessDeniedPage reason="INSUFFICIENT_ROLE" returnTo={returnTo} />;
  return children;
}
