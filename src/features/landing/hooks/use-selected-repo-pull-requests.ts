import { useLiveQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildGroupedPullRequests, buildSortedRootPullRequests, DEFAULT_REVIEW_SCOPE_SEARCH, HOSTS } from "@/features/landing/model/landing-model";
import { getRepoPullRequestCollection } from "@/lib/git-host/query-collections";
import type { RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

export function useSelectedRepoPullRequests({ autoRefetch = true }: { autoRefetch?: boolean } = {}) {
    const navigate = useNavigate();
    const { reposByHost } = usePrContext();
    const [autoRefetchRepoPrScopeKey, setAutoRefetchRepoPrScopeKey] = useState<string | null>(null);

    const hostsWithSelectedRepos = useMemo(() => HOSTS.filter((host) => reposByHost[host].length > 0), [reposByHost]);
    const repoPullRequestScopeKey = useMemo(
        () =>
            HOSTS.map(
                (host) =>
                    `${host}:${reposByHost[host]
                        .map((repo) => repo.fullName)
                        .sort()
                        .join(",")}`,
            )
                .join("|")
                .trim(),
        [reposByHost],
    );

    const repoPullRequestCollection = useMemo(
        () =>
            getRepoPullRequestCollection({
                hosts: hostsWithSelectedRepos,
                reposByHost,
            }),
        [hostsWithSelectedRepos, reposByHost],
    );
    const repoPullRequestsQuery = useLiveQuery(
        (q) => q.from({ repoPullRequest: repoPullRequestCollection.collection }).select(({ repoPullRequest }) => ({ ...repoPullRequest })),
        [repoPullRequestCollection],
    );

    useEffect(() => {
        if (!autoRefetch) return;
        if (hostsWithSelectedRepos.length === 0 || repoPullRequestCollection.utils.isFetching || repoPullRequestCollection.utils.lastError) return;
        if (autoRefetchRepoPrScopeKey === repoPullRequestScopeKey) return;
        setAutoRefetchRepoPrScopeKey(repoPullRequestScopeKey);
        void repoPullRequestCollection.utils.refetch({ throwOnError: false });
    }, [autoRefetch, autoRefetchRepoPrScopeKey, hostsWithSelectedRepos.length, repoPullRequestCollection, repoPullRequestScopeKey]);

    const groupedPullRequests = useMemo(
        () => buildGroupedPullRequests(repoPullRequestsQuery.data ?? [], reposByHost),
        [repoPullRequestsQuery.data, reposByHost],
    );
    const sortedRootPullRequests = useMemo(() => buildSortedRootPullRequests(groupedPullRequests), [groupedPullRequests]);

    const openPullRequest = useCallback(
        (repo: RepoRef, pullRequestId: string) => {
            if (repo.host === "github") {
                navigate({
                    to: "/$workspace/$repo/pull/$pullRequestId",
                    params: {
                        workspace: repo.workspace,
                        repo: repo.repo,
                        pullRequestId,
                    },
                    search: DEFAULT_REVIEW_SCOPE_SEARCH,
                    hash: "",
                });
                return;
            }
            navigate({
                to: "/$workspace/$repo/pull-requests/$pullRequestId",
                params: {
                    workspace: repo.workspace,
                    repo: repo.repo,
                    pullRequestId,
                },
                search: DEFAULT_REVIEW_SCOPE_SEARCH,
                hash: "",
            });
        },
        [navigate],
    );

    const refetch = useCallback(async () => {
        await repoPullRequestCollection.utils.refetch({ throwOnError: false });
    }, [repoPullRequestCollection]);

    return {
        hostsWithSelectedRepos,
        sortedRootPullRequests,
        selectedRepoCount: reposByHost.bitbucket.length + reposByHost.github.length,
        repoPullRequestError: repoPullRequestCollection.utils.lastError,
        isRepoPullRequestLoading:
            hostsWithSelectedRepos.length > 0 &&
            (repoPullRequestsQuery.isLoading || (repoPullRequestCollection.utils.isFetching && (repoPullRequestsQuery.data?.length ?? 0) === 0)),
        isRepoPullRequestFetching: repoPullRequestCollection.utils.isFetching,
        openPullRequest,
        refetch,
    };
}
