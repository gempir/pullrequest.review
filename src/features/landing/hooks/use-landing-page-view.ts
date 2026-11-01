import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useSelectedRepoPullRequests } from "@/features/landing/hooks/use-selected-repo-pull-requests";
import type { DiffPanel } from "@/features/landing/model/landing-model";
import { repositoriesQuery } from "@/lib/git-host/queries";
import type { GitHost, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

export function useLandingPageView({ initialHost, initialDiffPanel = "pull-requests" }: { initialHost?: GitHost; initialDiffPanel?: DiffPanel } = {}) {
    const navigate = useNavigate();
    const { authByHost, activeHost: savedActiveHost, setActiveHost, reposByHost, setReposForHost, clearReposForHost, logout } = usePrContext();
    const activeHost = initialHost ?? savedActiveHost;
    const {
        sortedRootPullRequests,
        selectedRepoCount,
        repoPullRequestError,
        isRepoPullRequestLoading,
        openPullRequest,
        refetch: refetchPullRequests,
    } = useSelectedRepoPullRequests();

    const [diffPanel, setDiffPanel] = useState<DiffPanel>(initialDiffPanel);
    const showRepositoryPanel = Boolean(initialHost) || diffPanel === "repositories";
    const queryClient = useQueryClient();
    const isFetching = useIsFetching() > 0;

    useEffect(() => {
        if (!initialHost) return;
        setActiveHost(initialHost);
    }, [initialHost, setActiveHost]);

    const refreshCurrentView = async () => {
        if (showRepositoryPanel) await queryClient.refetchQueries({ queryKey: repositoriesQuery(activeHost).queryKey });
        else await refetchPullRequests();
    };

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
        isRefreshing: isFetching,
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
