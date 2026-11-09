import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { repoPullRequestsQuery } from "@/lib/git-host/queries";
import { type GitHost, HOSTS, type PullRequestSummary, type RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { PULL_REQUEST_ROUTE } from "@/lib/pull-request-routes";

export type SortedRootPullRequest = { host: GitHost; repo: RepoRef; pullRequest: PullRequestSummary };

function updatedAt(row: SortedRootPullRequest) {
    const parsed = row.pullRequest.updatedAt ? Date.parse(row.pullRequest.updatedAt) : Number.NaN;
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function buildPullRequestRows(results: Array<{ repo: RepoRef; pullRequests: PullRequestSummary[] }>): SortedRootPullRequest[] {
    const rows = results.flatMap(({ repo, pullRequests }) => pullRequests.map((pullRequest) => ({ host: repo.host, repo, pullRequest })));
    return rows.sort(
        (a, b) =>
            updatedAt(b) - updatedAt(a) ||
            b.pullRequest.id - a.pullRequest.id ||
            a.host.localeCompare(b.host) ||
            a.repo.fullName.localeCompare(b.repo.fullName),
    );
}

// A stable `combine` makes useQueries return the same array until a query changes.
function combineResults<T>(results: T) {
    return results;
}

/** Pull requests of the repositories the user selected, across hosts. */
export function useSelectedRepoPullRequests({ enabled = true }: { enabled?: boolean } = {}) {
    const navigate = useNavigate();
    const { reposByHost } = usePrContext();
    const hostsWithSelectedRepos = useMemo(() => HOSTS.filter((host) => reposByHost[host].length > 0), [reposByHost]);
    const queries = useQueries({
        queries: hostsWithSelectedRepos.map((host) => ({ ...repoPullRequestsQuery(host, reposByHost[host]), enabled })),
        combine: combineResults,
    });

    const sortedRootPullRequests = useMemo(() => buildPullRequestRows(queries.flatMap((query) => query.data ?? [])), [queries]);

    const openPullRequest = useCallback(
        (repo: RepoRef, pullRequestId: string) => {
            const params = { workspace: repo.workspace, repo: repo.repo, pullRequestId };
            navigate({ to: PULL_REQUEST_ROUTE[repo.host], params, search: {}, hash: "" });
        },
        [navigate],
    );

    const hasData = queries.some((query) => query.data);
    return {
        sortedRootPullRequests,
        selectedRepoCount: HOSTS.reduce((count, host) => count + reposByHost[host].length, 0),
        // A failed host is only surfaced when no other host could answer.
        repoPullRequestError: hasData ? undefined : queries.find((query) => query.error)?.error,
        isRepoPullRequestLoading: !hasData && queries.some((query) => query.isLoading),
        openPullRequest,
        refetch: async () => {
            await Promise.all(queries.map((query) => query.refetch()));
        },
    };
}
