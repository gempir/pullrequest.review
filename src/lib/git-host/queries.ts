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
        queryFn: () => getHostClient(prRef.host).fetchPullRequestCritical({ prRef }),
        staleTime: CRITICAL_STALE_MS,
        meta: { activity: "Pull request files and diff" },
    });
}

export function pullRequestDeferredQuery(prRef: PullRequestRef) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "deferred"],
        queryFn: () => getHostClient(prRef.host).fetchPullRequestDeferred({ prRef }),
        staleTime: DEFERRED_STALE_MS,
        meta: { activity: "Reviews and activity" },
    });
}

export function pullRequestCommentsQuery(prRef: PullRequestRef) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "comments"],
        queryFn: () => getHostClient(prRef.host).fetchPullRequestComments({ prRef }),
        staleTime: DEFERRED_STALE_MS,
        meta: { activity: "Comments" },
    });
}

export function commitRangeDiffQuery(prRef: PullRequestRef, range: { baseCommitHash: string; headCommitHash: string }) {
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "range", range.baseCommitHash, range.headCommitHash],
        queryFn: () => getHostClient(prRef.host).fetchCommitRangeDiff({ prRef, ...range }),
        meta: { activity: "Commit range diff" },
    });
}

/** Old and new contents of one changed file; a missing path (added or deleted file) reads as empty. */
export function fileContextQuery(prRef: PullRequestRef, file: { baseCommit: string; headCommit: string; oldPath?: string; newPath?: string }) {
    const client = getHostClient(prRef.host);
    return queryOptions({
        queryKey: [...pullRequestKey(prRef), "file-context", file.baseCommit, file.headCommit, file.oldPath ?? "", file.newPath ?? ""],
        queryFn: async () => {
            const [oldContents, newContents] = await Promise.all([
                file.oldPath ? client.fetchFileContents({ prRef, commit: file.baseCommit, path: file.oldPath }) : "",
                file.newPath ? client.fetchFileContents({ prRef, commit: file.headCommit, path: file.newPath }) : "",
            ]);
            return { oldContents, newContents };
        },
        staleTime: Number.POSITIVE_INFINITY,
        meta: { activity: "File contents" },
    });
}
