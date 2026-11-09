import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getHostClient } from "@/lib/git-host/registry";
import { type GitHost, HOSTS, isGitHost, type LoginCredentials, type RepoRef } from "@/lib/git-host/types";
import { appQueryClient } from "@/lib/query-client";
import { ensureStorageReady, readHostPreferences, writeHostPreferences } from "@/lib/storage";

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
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: (host: GitHost) => void;
}

const PrContext = createContext<PrContextType | null>(null);

function byHost<T>(value: (host: GitHost) => T) {
    return Object.fromEntries(HOSTS.map((host) => [host, value(host)])) as Record<GitHost, T>;
}

function readAuthByHost(): AuthByHost {
    return byHost((host) => getHostClient(host).isAuthenticated());
}

function readRepos(host: GitHost): RepoRef[] {
    const stored = readHostPreferences()?.reposByHost?.[host];
    if (!Array.isArray(stored)) return [];
    return stored.filter((repo) => repo?.host === host);
}

function storedActiveHost(): GitHost {
    const stored = readHostPreferences()?.activeHost;
    return isGitHost(stored) ? stored : HOSTS[0];
}

interface PrState {
    authHydrated: boolean;
    authByHost: AuthByHost;
    reposByHost: ReposByHost;
    activeHost: GitHost;
}

export function PrProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PrState>({
        authHydrated: false,
        authByHost: byHost(() => false),
        reposByHost: byHost(() => []),
        activeHost: HOSTS[0],
    });

    useEffect(() => {
        let cancelled = false;
        void ensureStorageReady().then(() => {
            if (cancelled) return;
            setState({
                authHydrated: true,
                authByHost: readAuthByHost(),
                reposByHost: byHost(readRepos),
                activeHost: storedActiveHost(),
            });
        });
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
            reposByHost: { ...prev.reposByHost, [host]: repos.filter((repo) => repo.host === host) },
        }));
    }, []);

    const login = useCallback(async (credentials: LoginCredentials) => {
        await getHostClient(credentials.host).login(credentials);
        setState((prev) => ({ ...prev, activeHost: credentials.host, authByHost: readAuthByHost() }));
        void appQueryClient.invalidateQueries();
    }, []);

    const logout = useCallback((host: GitHost) => {
        getHostClient(host).logout();
        appQueryClient.clear();
        setState((prev) => ({
            ...prev,
            authByHost: { ...prev.authByHost, [host]: false },
            reposByHost: { ...prev.reposByHost, [host]: [] },
        }));
    }, []);

    const value = useMemo(
        () => ({
            ...state,
            isAuthenticated: HOSTS.some((host) => state.authByHost[host]),
            setActiveHost,
            setReposForHost,
            login,
            logout,
        }),
        [state, setActiveHost, setReposForHost, login, logout],
    );

    return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext() {
    const ctx = useContext(PrContext);
    if (!ctx) throw new Error("usePrContext must be used within PrProvider");
    return ctx;
}
