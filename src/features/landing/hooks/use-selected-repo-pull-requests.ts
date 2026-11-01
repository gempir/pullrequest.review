import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { buildGroupedPullRequests, buildSortedRootPullRequests, DEFAULT_REVIEW_SCOPE_SEARCH, HOSTS } from "@/features/landing/model/landing-model";
import { repoPullRequestsQuery } from "@/lib/git-host/queries";
import { normalizeRepoRef } from "@/lib/git-host/shared/repo-ref";
import type { RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

function combineResults<T>(results: T) {
    return results;
}

export function useSelectedRepoPullRequests({ enabled = true }: { enabled?: boolean } = {}) {
    const navigate = useNavigate();
    const { reposByHost } = usePrContext();
    const hostsWithSelectedRepos = useMemo(() => HOSTS.filter((host) => reposByHost[host].length > 0), [reposByHost]);
    const queries = useQueries({
        queries: hostsWithSelectedRepos.map((host) => ({ ...repoPullRequestsQuery(host, reposByHost[host]), enabled })),
        combine: combineResults,
    });

    const sortedRootPullRequests = useMemo(() => {
        const records = queries.flatMap((query) =>
            (query.data ?? []).flatMap(({ repo, pullRequests }) => {
                const normalizedRepo = normalizeRepoRef(repo);
                return pullRequests.map((pullRequest) => ({
                    host: normalizedRepo.host,
                    repo: normalizedRepo,
                    repoKey: `${normalizedRepo.host}:${normalizedRepo.fullName}`,
                    pullRequest,
                }));
            }),
        );
        return buildSortedRootPullRequests(buildGroupedPullRequests(records, reposByHost));
    }, [queries, reposByHost]);

    const openPullRequest = useCallback(
        (repo: RepoRef, pullRequestId: string) => {
            const params = { workspace: repo.workspace, repo: repo.repo, pullRequestId };
            const to = repo.host === "github" ? "/$workspace/$repo/pull/$pullRequestId" : "/$workspace/$repo/pull-requests/$pullRequestId";
            navigate({ to, params, search: DEFAULT_REVIEW_SCOPE_SEARCH, hash: "" });
        },
        [navigate],
    );

    const hasData = queries.some((query) => query.data);
    return {
        sortedRootPullRequests,
        selectedRepoCount: reposByHost.bitbucket.length + reposByHost.github.length,
        // A failed host is only surfaced when no other host could answer.
        repoPullRequestError: hasData ? undefined : queries.find((query) => query.error)?.error,
        isRepoPullRequestLoading: !hasData && queries.some((query) => query.isLoading),
        openPullRequest,
        refetch: async () => {
            await Promise.all(queries.map((query) => query.refetch()));
        },
    };
}
