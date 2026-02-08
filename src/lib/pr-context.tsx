import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface BitbucketAuth {
  accessToken: string;
}

export interface BitbucketRepo {
  workspace: string;
  slug: string;
  name: string;
  fullName: string;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bitbucket_access_token");
    const storedRepos = window.localStorage.getItem("bitbucket_repos");
    if (stored) {
      setAuth({ accessToken: stored });
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
      window.localStorage.setItem("bitbucket_access_token", auth.accessToken);
    } else {
      window.localStorage.removeItem("bitbucket_access_token");
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

  const clearAuth = () => {
    setAuth(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bitbucket_access_token");
    }
  };

  const clearRepos = () => {
    setRepos([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bitbucket_repos");
    }
  };

  return (
    <PrContext.Provider
      value={{
        prUrl,
        setPrUrl,
        auth,
        setAuth,
        clearAuth,
        repos,
        setRepos,
        clearRepos,
      }}
    >
      {children}
    </PrContext.Provider>
  );
}

export function usePrContext() {
  const ctx = useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within PrProvider");
  return ctx;
}
