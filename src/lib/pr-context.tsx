import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readHostPreferencesRecord, writeHostPreferencesRecord } from "@/lib/data/query-collections";
import { getAuthStateForHost, loginToHost, logoutHost } from "@/lib/git-host/service";
import type { GitHost, RepoRef } from "@/lib/git-host/types";

const HOSTS: GitHost[] = ["bitbucket", "github"];

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
    login: (data: { host: "bitbucket"; email: string; apiToken: string } | { host: "github"; token: string }) => Promise<void>;
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
    const stored = readHostPreferencesRecord();
    const parsed = stored?.reposByHost?.[host];
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((repo) => {
        if (!repo || repo.host !== host || typeof repo.workspace !== "string" || typeof repo.repo !== "string") {
            return [];
        }

        const workspace = repo.workspace.trim();
        const repositorySlug = repo.repo.trim();
        if (!workspace || !repositorySlug) return [];

        const fullName = typeof repo.fullName === "string" && repo.fullName.trim().length > 0 ? repo.fullName.trim() : `${workspace}/${repositorySlug}`;
        const displayName = typeof repo.displayName === "string" && repo.displayName.trim().length > 0 ? repo.displayName.trim() : repositorySlug;

        return [
            {
                host,
                workspace,
                repo: repositorySlug,
                fullName,
                displayName,
            } satisfies RepoRef,
        ];
    });
}

function parseActiveHost(): GitHost {
    const value = readHostPreferencesRecord()?.activeHost;
    return value === "github" ? "github" : "bitbucket";
}

export function PrProvider({ children }: { children: ReactNode }) {
    const [authHydrated, setAuthHydrated] = useState(false);
    const [authByHost, setAuthByHost] = useState<AuthByHost>(() => emptyAuthByHost());
    const [reposByHost, setReposByHost] = useState<ReposByHost>(() => ({
        bitbucket: parseRepos("bitbucket"),
        github: parseRepos("github"),
    }));
    const [activeHost, setActiveHostState] = useState<GitHost>(() => parseActiveHost());

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
        refreshAuth().finally(() => setAuthHydrated(true));
    }, [refreshAuth]);

    useEffect(() => {
        writeHostPreferencesRecord({ activeHost, reposByHost });
    }, [activeHost, reposByHost]);

    const setActiveHost = useCallback((host: GitHost) => {
        setActiveHostState(host);
    }, []);

    const setReposForHost = useCallback((host: GitHost, repos: RepoRef[]) => {
        setReposByHost((prev) => ({
            ...prev,
            [host]: repos
                .filter((repo) => repo.host === host)
                .map((repo) => {
                    const workspace = repo.workspace.trim();
                    const repositorySlug = repo.repo.trim();
                    return {
                        host,
                        workspace,
                        repo: repositorySlug,
                        fullName: typeof repo.fullName === "string" && repo.fullName.trim().length ? repo.fullName.trim() : `${workspace}/${repositorySlug}`,
                        displayName: typeof repo.displayName === "string" && repo.displayName.trim().length ? repo.displayName.trim() : repositorySlug,
                    } satisfies RepoRef;
                }),
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
        [authHydrated, authByHost, reposByHost, activeHost, setActiveHost, setReposForHost, clearReposForHost, clearAllRepos, refreshAuth, login, logout],
    );

    return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
    const ctx = useContext(PrContext);
    if (!ctx) throw new Error("usePrContext must be used within PrProvider");
    return ctx;
}
