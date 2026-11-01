import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getHostClient } from "@/lib/git-host/registry";
import { normalizeRepoRef } from "@/lib/git-host/shared/repo-ref";
import type { BitbucketOAuthTokens, GitHost, RepoRef } from "@/lib/git-host/types";
import { appQueryClient } from "@/lib/query-client";
import { ensureStorageReady, readHostPreferences, writeHostPreferences } from "@/lib/storage";

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
    login: (
        data:
            | { host: "bitbucket"; email: string; apiToken: string }
            | ({ host: "bitbucket"; method: "oauth" } & BitbucketOAuthTokens)
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
    const stored = readHostPreferences()?.reposByHost?.[host];
    if (!Array.isArray(stored)) return [];
    return stored.filter((repo) => repo?.host === host && repo.workspace?.trim() && repo.repo?.trim()).map(normalizeRepoRef);
}

async function readAuthByHost() {
    const authByHost = emptyAuthByHost();
    await Promise.all(
        HOSTS.map(async (host) => {
            authByHost[host] = Boolean((await getHostClient(host).getAuthState()).authenticated);
        }),
    );
    return authByHost;
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
        await ensureStorageReady();
        const nextAuthByHost = await readAuthByHost();
        setState((prev) => {
            if (prev.authByHost.bitbucket === nextAuthByHost.bitbucket && prev.authByHost.github === nextAuthByHost.github) return prev;
            return { ...prev, authByHost: nextAuthByHost };
        });
    }, []);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            await ensureStorageReady();
            if (cancelled) return;

            const authByHost = await readAuthByHost();
            if (cancelled) return;

            setState({
                authHydrated: true,
                authByHost,
                reposByHost: { bitbucket: parseRepos("bitbucket"), github: parseRepos("github") },
                activeHost: readHostPreferences()?.activeHost === "github" ? "github" : "bitbucket",
            });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!state.authHydrated) return;
        writeHostPreferences({ activeHost: state.activeHost, reposByHost: state.reposByHost });
    }, [state.activeHost, state.authHydrated, state.reposByHost]);

    const setActiveHost = useCallback((host: GitHost) => {
        setState((prev) => (prev.activeHost === host ? prev : { ...prev, activeHost: host }));
    }, []);

    const setReposForHost = useCallback((host: GitHost, repos: RepoRef[]) => {
        setState((prev) => ({
            ...prev,
            reposByHost: {
                ...prev.reposByHost,
                [host]: repos.filter((repo) => repo.host === host).map(normalizeRepoRef),
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
            await getHostClient(data.host).login(data);
            setState((prev) => ({ ...prev, activeHost: data.host }));
            await refreshAuth();
            void appQueryClient.invalidateQueries();
        },
        [refreshAuth],
    );

    const logout = useCallback<PrContextType["logout"]>(async (host) => {
        if (host) {
            await getHostClient(host).logout();
            appQueryClient.clear();
            setState((prev) => ({
                ...prev,
                authByHost: { ...prev.authByHost, [host]: false },
                reposByHost: { ...prev.reposByHost, [host]: [] },
            }));
            return;
        }

        await Promise.all(HOSTS.map((entry) => getHostClient(entry).logout()));
        appQueryClient.clear();
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
