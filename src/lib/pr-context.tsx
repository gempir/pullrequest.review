import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { refreshOAuthToken } from "@/lib/bitbucket-oauth";
import type { BitbucketRepo } from "@/lib/bitbucket-api";

interface BitbucketAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface PrContextType {
  prUrl: string;
  setPrUrl: (url: string) => void;
  auth: BitbucketAuth | null;
  setAuth: (auth: BitbucketAuth | null) => void;
  clearAuth: () => void;
  repos: BitbucketRepo[];
  setRepos: (repos: BitbucketRepo[]) => void;
  clearRepos: () => void;
}

const PrContext = createContext<PrContextType | null>(null);

export function PrProvider({ children }: { children: ReactNode }) {
  const [prUrl, setPrUrl] = useState("");
  const [auth, setAuth] = useState<BitbucketAuth | null>(null);
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bitbucket_oauth");
    const storedRepos = window.localStorage.getItem("bitbucket_repos");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as BitbucketAuth;
        if (parsed?.accessToken) {
          setAuth(parsed);
        }
      } catch {
        window.localStorage.removeItem("bitbucket_oauth");
      }
    }
    if (storedRepos) {
      try {
        const parsed = JSON.parse(storedRepos) as BitbucketRepo[];
        if (Array.isArray(parsed)) setRepos(parsed);
      } catch {
        window.localStorage.removeItem("bitbucket_repos");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    if (auth?.accessToken) {
      window.localStorage.setItem("bitbucket_oauth", JSON.stringify(auth));
    } else {
      window.localStorage.removeItem("bitbucket_oauth");
    }
  }, [auth, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    if (repos.length > 0) {
      window.localStorage.setItem("bitbucket_repos", JSON.stringify(repos));
    } else {
      window.localStorage.removeItem("bitbucket_repos");
    }
  }, [repos, hydrated]);

  const clearAuth = useCallback(() => {
    setAuth(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bitbucket_oauth");
    }
  }, []);

  const clearRepos = useCallback(() => {
    setRepos([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bitbucket_repos");
    }
  }, []);

  useEffect(() => {
    if (!hydrated || refreshing) return;
    if (!auth?.refreshToken || !auth.expiresAt) return;
    const now = Date.now();
    if (now < auth.expiresAt - 60_000) return;

    setRefreshing(true);
    refreshOAuthToken({ data: { refreshToken: auth.refreshToken } })
      .then((next) => {
        setAuth({
          accessToken: next.accessToken,
          refreshToken: next.refreshToken ?? auth.refreshToken,
          expiresAt: next.expiresAt,
        });
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setRefreshing(false));
  }, [auth, clearAuth, hydrated, refreshing]);

  const value = useMemo(
    () => ({
      prUrl,
      setPrUrl,
      auth,
      setAuth,
      clearAuth,
      repos,
      setRepos,
      clearRepos,
    }),
    [auth, clearAuth, clearRepos, prUrl, repos],
  );

  return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
  const ctx = useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within PrProvider");
  return ctx;
}
