import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { repositoriesQuery } from "@/lib/git-host/queries";
import type { GitHost, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { useSelectedRepoPullRequests } from "@/lib/selected-pull-requests";

export function useLandingPageView({ initialHost }: { initialHost?: GitHost }) {
    const navigate = useNavigate();
    const { authByHost, activeHost: savedActiveHost, setActiveHost, reposByHost, setReposForHost, logout } = usePrContext();
    const activeHost = initialHost ?? savedActiveHost;
    const {
        sortedRootPullRequests,
        selectedRepoCount,
        repoPullRequestError,
        isRepoPullRequestLoading,
        openPullRequest,
        refetch: refetchPullRequests,
    } = useSelectedRepoPullRequests();

    const showRepositoryPanel = Boolean(initialHost);
    const queryClient = useQueryClient();
    const isFetching = useIsFetching() > 0;

    const onRefresh = async () => {
        if (showRepositoryPanel) await queryClient.refetchQueries({ queryKey: repositoriesQuery(activeHost).queryKey });
        else await refetchPullRequests();
    };

    const openRepositorySelection = useCallback(
        (host: GitHost) => {
            setActiveHost(host);
            navigate({
                to: "/$host",
                params: { host },
            });
        },
        [navigate, setActiveHost],
    );

    return {
        activeHost,
        authByHost,
        reposByHost,
        repoPullRequestError,
        selectedRepoCount,
        showRepositoryPanel,
        sortedRootPullRequests,
        isRefreshing: isFetching,
        isRepoPullRequestLoading,
        onClearRepos: (host: GitHost) => setReposForHost(host, []),
        onOpenPullRequest: openPullRequest,
        onOpenRepositorySelection: openRepositorySelection,
        onRefresh,
        onHome: () => navigate({ to: "/" }),
        onOpenSettings: () => {
            navigate({ to: "/settings" });
        },
        onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => {
            setReposForHost(host, repos);
            navigate({ to: "/" });
        },
        onDisconnectHost: logout,
    };
}
