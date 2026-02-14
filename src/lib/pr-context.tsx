import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAuthStateForHost,
  loginToHost,
  logoutHost,
} from "@/lib/git-host/service";
import { GIT_HOSTS } from "@/lib/git-host/host";
import type { GitHost, RepoRef } from "@/lib/git-host/types";

const HOSTS: readonly GitHost[] = GIT_HOSTS;

const REPO_STORAGE_KEYS: Record<GitHost, string> = {
  bitbucket: "pr_review_repos_bitbucket",
  github: "pr_review_repos_github",
};

const ACTIVE_HOST_KEY = "pr_review_active_host";
const LEGACY_BITBUCKET_REPOS_KEY = "bitbucket_repos";

type AuthByHost = Record<GitHost, boolean>;
type ReposByHost = Record<GitHost, RepoRef[]>;

interface PrContextType {
  isAuthenticated: boolean;
  authHydrated: boolean;
  authByHost: AuthByHost;
  reposByHost: ReposByHost;
  activeHost: GitHost;
  setActiveHost: (host: GitHost) => void;
  setReposForHost: (host: GitHost, repos: RepoRef[]) => void;
  clearReposForHost: (host: GitHost) => void;
  clearAllRepos: () => void;
  refreshAuth: () => Promise<void>;
  login: (
    data:
      | { host: "bitbucket"; email: string; apiToken: string }
      | { host: "github"; token: string },
  ) => Promise<void>;
  logout: (host?: GitHost) => Promise<void>;
}

const PrContext = createContext<PrContextType | null>(null);

function emptyReposByHost(): ReposByHost {
  return {
    bitbucket: [],
    github: [],
  };
}

function emptyAuthByHost(): AuthByHost {
  return {
    bitbucket: false,
    github: false,
  };
}

function parseRepos(host: GitHost): RepoRef[] {
  if (typeof window === "undefined") return [];

  const parse = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as RepoRef[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (repo) =>
          repo &&
          repo.host === host &&
          typeof repo.workspace === "string" &&
          typeof repo.repo === "string",
      );
    } catch {
      return [];
    }
  };

  const current = parse(window.localStorage.getItem(REPO_STORAGE_KEYS[host]));
  if (current.length > 0 || host !== "bitbucket") return current;

  const legacy = parse(window.localStorage.getItem(LEGACY_BITBUCKET_REPOS_KEY));
  if (legacy.length > 0) {
    window.localStorage.setItem(
      REPO_STORAGE_KEYS.bitbucket,
      JSON.stringify(legacy),
    );
    window.localStorage.removeItem(LEGACY_BITBUCKET_REPOS_KEY);
  }
  return legacy;
}

function parseActiveHost(): GitHost {
  if (typeof window === "undefined") return "bitbucket";
  const value = window.localStorage.getItem(ACTIVE_HOST_KEY);
  return value === "github" ? "github" : "bitbucket";
}

export function PrProvider({ children }: { children: ReactNode }) {
  const [authHydrated, setAuthHydrated] = useState(false);
  const [authByHost, setAuthByHost] = useState<AuthByHost>(emptyAuthByHost());
  const [reposByHost, setReposByHost] = useState<ReposByHost>(
    emptyReposByHost(),
  );
  const [activeHost, setActiveHostState] = useState<GitHost>("bitbucket");

  const refreshAuth = useCallback(async () => {
    const states = await Promise.all(
      HOSTS.map(async (host) => ({
        host,
        state: await getAuthStateForHost(host),
      })),
    );

    setAuthByHost((prev) => {
      const next = { ...prev };
      for (const item of states) {
        next[item.host] = Boolean(item.state.authenticated);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReposByHost({
      bitbucket: parseRepos("bitbucket"),
      github: parseRepos("github"),
    });
    setActiveHostState(parseActiveHost());

    refreshAuth().finally(() => setAuthHydrated(true));
  }, [refreshAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      REPO_STORAGE_KEYS.bitbucket,
      JSON.stringify(reposByHost.bitbucket),
    );
    window.localStorage.setItem(
      REPO_STORAGE_KEYS.github,
      JSON.stringify(reposByHost.github),
    );
  }, [reposByHost]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_HOST_KEY, activeHost);
  }, [activeHost]);

  const setActiveHost = useCallback((host: GitHost) => {
    setActiveHostState(host);
  }, []);

  const setReposForHost = useCallback((host: GitHost, repos: RepoRef[]) => {
    setReposByHost((prev) => ({
      ...prev,
      [host]: repos.filter((repo) => repo.host === host),
    }));
  }, []);

  const clearReposForHost = useCallback((host: GitHost) => {
    setReposByHost((prev) => ({ ...prev, [host]: [] }));
  }, []);

  const clearAllRepos = useCallback(() => {
    setReposByHost(emptyReposByHost());
  }, []);

  const login = useCallback<PrContextType["login"]>(
    async (data) => {
      await loginToHost(data);
      setActiveHostState(data.host);
      await refreshAuth();
    },
    [refreshAuth],
  );

  const logout = useCallback<PrContextType["logout"]>(async (host) => {
    if (host) {
      await logoutHost({ host });
      setAuthByHost((prev) => ({ ...prev, [host]: false }));
      setReposByHost((prev) => ({ ...prev, [host]: [] }));
      return;
    }

    await Promise.all(HOSTS.map((entry) => logoutHost({ host: entry })));
    setAuthByHost(emptyAuthByHost());
    setReposByHost(emptyReposByHost());
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: HOSTS.some((host) => authByHost[host]),
      authHydrated,
      authByHost,
      reposByHost,
      activeHost,
      setActiveHost,
      setReposForHost,
      clearReposForHost,
      clearAllRepos,
      refreshAuth,
      login,
      logout,
    }),
    [
      authHydrated,
      authByHost,
      reposByHost,
      activeHost,
      setActiveHost,
      setReposForHost,
      clearReposForHost,
      clearAllRepos,
      refreshAuth,
      login,
      logout,
    ],
  );

  return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
  const ctx = useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within PrProvider");
  return ctx;
}
