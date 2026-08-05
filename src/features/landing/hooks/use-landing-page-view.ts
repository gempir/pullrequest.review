import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSelectedRepoPullRequests } from "@/features/landing/hooks/use-selected-repo-pull-requests";
import type { DiffPanel } from "@/features/landing/model/landing-model";
import { getGitHostFetchActivitySnapshot, getRepositoryCollection, subscribeGitHostFetchActivity } from "@/lib/git-host/query-collections";
import type { GitHost, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

export function useLandingPageView({ initialHost, initialDiffPanel = "pull-requests" }: { initialHost?: GitHost; initialDiffPanel?: DiffPanel } = {}) {
    const navigate = useNavigate();
    const { authByHost, activeHost, setActiveHost, reposByHost, setReposForHost, clearReposForHost, logout } = usePrContext();
    const {
        sortedRootPullRequests,
        selectedRepoCount,
        repoPullRequestError,
        isRepoPullRequestLoading,
        openPullRequest,
        refetch: refetchPullRequests,
    } = useSelectedRepoPullRequests({ autoRefetch: true });

    const [diffPanel, setDiffPanel] = useState<DiffPanel>(initialDiffPanel);
    const showRepositoryPanel = diffPanel === "repositories";
    const showPullRequestPanel = diffPanel === "pull-requests";
    const fetchActivity = useSyncExternalStore(subscribeGitHostFetchActivity, getGitHostFetchActivitySnapshot, getGitHostFetchActivitySnapshot);
    const activeHostRepositoryCollection = useMemo(() => getRepositoryCollection(activeHost), [activeHost]);

    useEffect(() => {
        if (!initialHost) return;
        setActiveHost(initialHost);
        setDiffPanel("repositories");
    }, [initialHost, setActiveHost]);

    const refreshCurrentView = useCallback(async () => {
        if (showRepositoryPanel) {
            await activeHostRepositoryCollection.utils.refetch({ throwOnError: false });
            return;
        }
        if (!showPullRequestPanel) return;
        await refetchPullRequests();
    }, [activeHostRepositoryCollection, refetchPullRequests, showPullRequestPanel, showRepositoryPanel]);

    const openRepositorySelection = useCallback(
        (host: GitHost) => {
            navigate({
                to: "/$host",
                params: { host },
            });
        },
        [navigate],
    );

    return {
        activeHost,
        authByHost,
        reposByHost,
        repoPullRequestError,
        selectedRepoCount,
        showRepositoryPanel,
        sortedRootPullRequests,
        isRefreshing: fetchActivity.activeFetchCount > 0,
        isRepoPullRequestLoading,
        clearReposForHost,
        openPullRequest,
        openRepositorySelection,
        refreshCurrentView,
        onHome: () => {
            setDiffPanel("pull-requests");
            navigate({ to: "/" });
        },
        onToggleSettings: () => {
            navigate({ to: "/settings" });
        },
        onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => {
            setReposForHost(host, repos);
            setDiffPanel("pull-requests");
            navigate({ to: "/" });
        },
        onDisconnectHost: (host: GitHost) => {
            void logout(host);
        },
    };
}
