import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { BitbucketRepo } from "@/lib/bitbucket-api";
import { getSessionAuth, logoutSession } from "@/lib/bitbucket-oauth";

interface PrContextType {
  isAuthenticated: boolean;
  authHydrated: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
  repos: BitbucketRepo[];
  setRepos: (repos: BitbucketRepo[]) => void;
  clearRepos: () => void;
}

const PrContext = createContext<PrContextType | null>(null);

export function PrProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);

  const refreshAuth = useCallback(async () => {
    try {
      const session = await getSessionAuth();
      setAuthenticated(Boolean(session.authenticated));
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setAuthHydrated(true));
  }, [refreshAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRepos = window.localStorage.getItem("bitbucket_repos");
    if (storedRepos) {
      try {
        const parsed = JSON.parse(storedRepos) as BitbucketRepo[];
        if (Array.isArray(parsed)) setRepos(parsed);
      } catch {
        window.localStorage.removeItem("bitbucket_repos");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (repos.length > 0) {
      window.localStorage.setItem("bitbucket_repos", JSON.stringify(repos));
    } else {
      window.localStorage.removeItem("bitbucket_repos");
    }
  }, [repos]);

  const clearAuth = useCallback(() => {
    setAuthenticated(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const clearRepos = useCallback(() => {
    setRepos([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bitbucket_repos");
    }
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      authHydrated,
      setAuthenticated,
      refreshAuth,
      logout,
      clearAuth,
      repos,
      setRepos,
      clearRepos,
    }),
    [
      authHydrated,
      clearAuth,
      clearRepos,
      isAuthenticated,
      logout,
      refreshAuth,
      repos,
    ],
  );

  return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
  const ctx = useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within PrProvider");
  return ctx;
}
