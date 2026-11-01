import { queryOptions } from "@tanstack/react-query";
import { getHostClient } from "@/lib/git-host/registry";
import type { GitHost, PullRequestRef, RepoRef } from "@/lib/git-host/types";

const CRITICAL_STALE_MS = 30_000;
const DEFERRED_STALE_MS = 2 * 60_000;

function pullRequestKey(prRef: PullRequestRef) {
    return ["pull-request", prRef.host, prRef.workspace, prRef.repo, prRef.pullRequestId] as const;
}

export function repositoriesQuery(host: GitHost) {
    return queryOptions({
        queryKey: ["repositories", host],
        queryFn: () => getHostClient(host).listRepositories(),
        meta: { activity: "Repositories" },
    });
}

export function repoPullRequestsQuery(host: GitHost, repos: RepoRef[]) {
    return queryOptions({
        queryKey: ["repo-pull-requests", host, repos.map((repo) => repo.fullName).toSorted()],
        queryFn: () => getHostClient(host).listPullRequestsForRepos({ repos }),
        meta: { activity: "Repository pull requests" },
    });
}

export function pullRequestCriticalQuery(prRef: PullRequestRef) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "critical"],
        queryFn: () => getHostClient(prRef.host).fetchPullRequestCriticalByRef({ prRef }),
        staleTime: CRITICAL_STALE_MS,
        meta: { activity: "Pull request files and diff" },
    });
}

export function pullRequestDeferredQuery(prRef: PullRequestRef) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "deferred"],
        queryFn: () => getHostClient(prRef.host).fetchPullRequestDeferredByRef({ prRef }),
        staleTime: DEFERRED_STALE_MS,
        meta: { activity: "Comments and review activity" },
    });
}

export function commitRangeDiffQuery(prRef: PullRequestRef, range: { baseCommitHash: string; headCommitHash: string; selectedCommitHashes: string[] }) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "range", range.baseCommitHash, range.headCommitHash],
        queryFn: () => getHostClient(prRef.host).fetchPullRequestCommitRangeDiff({ prRef, ...range }),
        meta: { activity: "Commit range diff" },
    });
}
