import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureDataCollectionsReady, readHostPreferencesRecord, writeHostPreferencesRecord } from "@/lib/data/query-collections";
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
    const [state, setState] = useState<{
        authHydrated: boolean;
        authByHost: AuthByHost;
        reposByHost: ReposByHost;
        activeHost: GitHost;
    }>({
        authHydrated: false,
        authByHost: emptyAuthByHost(),
        reposByHost: emptyReposByHost(),
        activeHost: "bitbucket",
    });

    const refreshAuth = useCallback(async () => {
        await ensureDataCollectionsReady();
        const authStates = await Promise.all(
            HOSTS.map(async (host) => ({
                host,
                state: await getAuthStateForHost(host),
            })),
        );
        const nextAuthByHost = emptyAuthByHost();
        for (const item of authStates) {
            nextAuthByHost[item.host] = Boolean(item.state.authenticated);
        }
        setState((prev) => {
            if (prev.authByHost.bitbucket === nextAuthByHost.bitbucket && prev.authByHost.github === nextAuthByHost.github) {
                return prev;
            }
            return {
                ...prev,
                authByHost: nextAuthByHost,
            };
        });
    }, []);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            await ensureDataCollectionsReady();
            if (cancelled) return;

            const nextReposByHost = {
                bitbucket: parseRepos("bitbucket"),
                github: parseRepos("github"),
            };
            const nextActiveHost = parseActiveHost();
            const authStates = await Promise.all(
                HOSTS.map(async (host) => ({
                    host,
                    state: await getAuthStateForHost(host),
                })),
            );
            if (cancelled) return;

            const nextAuthByHost = emptyAuthByHost();
            for (const item of authStates) {
                nextAuthByHost[item.host] = Boolean(item.state.authenticated);
            }

            setState({
                authHydrated: true,
                authByHost: nextAuthByHost,
                reposByHost: nextReposByHost,
                activeHost: nextActiveHost,
            });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!state.authHydrated) return;
        writeHostPreferencesRecord({ activeHost: state.activeHost, reposByHost: state.reposByHost });
    }, [state.activeHost, state.authHydrated, state.reposByHost]);

    const setActiveHost = useCallback((host: GitHost) => {
        setState((prev) => (prev.activeHost === host ? prev : { ...prev, activeHost: host }));
    }, []);

    const setReposForHost = useCallback((host: GitHost, repos: RepoRef[]) => {
        setState((prev) => ({
            ...prev,
            reposByHost: {
                ...prev.reposByHost,
                [host]: repos
                    .filter((repo) => repo.host === host)
                    .map((repo) => {
                        const workspace = repo.workspace.trim();
                        const repositorySlug = repo.repo.trim();
                        return {
                            host,
                            workspace,
                            repo: repositorySlug,
                            fullName:
                                typeof repo.fullName === "string" && repo.fullName.trim().length ? repo.fullName.trim() : `${workspace}/${repositorySlug}`,
                            displayName: typeof repo.displayName === "string" && repo.displayName.trim().length ? repo.displayName.trim() : repositorySlug,
                        } satisfies RepoRef;
                    }),
            },
        }));
    }, []);

    const clearReposForHost = useCallback((host: GitHost) => {
        setState((prev) => ({ ...prev, reposByHost: { ...prev.reposByHost, [host]: [] } }));
    }, []);

    const clearAllRepos = useCallback(() => {
        setState((prev) => ({ ...prev, reposByHost: emptyReposByHost() }));
    }, []);

    const login = useCallback<PrContextType["login"]>(
        async (data) => {
            await loginToHost(data);
            setState((prev) => ({ ...prev, activeHost: data.host }));
            await refreshAuth();
        },
        [refreshAuth],
    );

    const logout = useCallback<PrContextType["logout"]>(async (host) => {
        if (host) {
            await logoutHost({ host });
            setState((prev) => ({
                ...prev,
                authByHost: { ...prev.authByHost, [host]: false },
                reposByHost: { ...prev.reposByHost, [host]: [] },
            }));
            return;
        }

        await Promise.all(HOSTS.map((entry) => logoutHost({ host: entry })));
        setState((prev) => ({
            ...prev,
            authByHost: emptyAuthByHost(),
            reposByHost: emptyReposByHost(),
        }));
    }, []);

    const value = useMemo(
        () => ({
            isAuthenticated: HOSTS.some((host) => state.authByHost[host]),
            authHydrated: state.authHydrated,
            authByHost: state.authByHost,
            reposByHost: state.reposByHost,
            activeHost: state.activeHost,
            setActiveHost,
            setReposForHost,
            clearReposForHost,
            clearAllRepos,
            refreshAuth,
            login,
            logout,
        }),
        [state, setActiveHost, setReposForHost, clearReposForHost, clearAllRepos, refreshAuth, login, logout],
    );

    return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
    const ctx = useContext(PrContext);
    if (!ctx) throw new Error("usePrContext must be used within PrProvider");
    return ctx;
}
