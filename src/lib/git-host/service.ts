import { Effect } from "effect";
import { getHostCapabilities, getHostClient } from "@/lib/git-host/registry";
import type { Commit, GitHost, PullRequestRef, RepoRef } from "@/lib/git-host/types";

export function fetchRepoPullRequestsForHostEffect(data: { host: GitHost; repos: RepoRef[] }) {
    if (data.repos.length === 0) {
        return Effect.succeed(
            [] as Array<{
                repo: RepoRef;
                pullRequests: {
                    id: number;
                    title: string;
                    state: string;
                    links?: { html?: { href?: string } };
                    author?: { displayName?: string };
                }[];
            }>,
        );
    }
    return getHostClient(data.host).listPullRequestsForRepos({ repos: data.repos });
}

export function listRepositoriesForHostEffect(data: { host: GitHost }) {
    return getHostClient(data.host).listRepositories();
}

export function fetchPullRequestBundleByRefEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).fetchPullRequestBundleByRef(data);
}

export function fetchPullRequestCriticalByRefEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).fetchPullRequestCriticalByRef(data);
}

export function fetchPullRequestDeferredByRefEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).fetchPullRequestDeferredByRef(data);
}

export function approvePullRequestEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).approvePullRequest(data);
}

export function removePullRequestApprovalEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).removePullRequestApproval(data);
}

export function requestChangesOnPullRequestEffect(data: { prRef: PullRequestRef; body?: string }) {
    return getHostClient(data.prRef.host).requestChanges(data);
}

export function declinePullRequestEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).declinePullRequest(data);
}

export function markPullRequestAsDraftEffect(data: { prRef: PullRequestRef }) {
    return getHostClient(data.prRef.host).markPullRequestAsDraft(data);
}

export function mergePullRequestEffect(data: { prRef: PullRequestRef; closeSourceBranch?: boolean; message?: string; mergeStrategy?: string }) {
    return getHostClient(data.prRef.host).mergePullRequest(data);
}

export function createPullRequestCommentEffect(data: {
    prRef: PullRequestRef;
    content: string;
    inline?: { path: string; to?: number; from?: number };
    parentId?: number;
}) {
    return getHostClient(data.prRef.host).createPullRequestComment(data);
}

export function updatePullRequestCommentEffect(data: { prRef: PullRequestRef; commentId: number; content: string; hasInlineContext: boolean }) {
    return getHostClient(data.prRef.host).updatePullRequestComment(data);
}

export function resolvePullRequestCommentEffect(data: { prRef: PullRequestRef; commentId: number; resolve: boolean }) {
    return getHostClient(data.prRef.host).resolvePullRequestComment(data);
}

export function deletePullRequestCommentEffect(data: { prRef: PullRequestRef; commentId: number; hasInlineContext: boolean }) {
    return getHostClient(data.prRef.host).deletePullRequestComment(data);
}

export function fetchPullRequestCommitRangeDiffEffect(data: {
    prRef: PullRequestRef;
    baseCommitHash: string;
    headCommitHash: string;
    selectedCommitHashes: string[];
}) {
    return getHostClient(data.prRef.host).fetchPullRequestCommitRangeDiff(data);
}

export function fetchPullRequestFileContentsEffect(data: { prRef: PullRequestRef; commit: string; path: string }) {
    return getHostClient(data.prRef.host).fetchPullRequestFileContents(data);
}

export function fetchPullRequestFileHistoryEffect(data: { prRef: PullRequestRef; path: string; commits: Commit[]; limit?: number }) {
    return getHostClient(data.prRef.host).fetchPullRequestFileHistory(data);
}

export function getCapabilitiesForHost(host: GitHost) {
    return getHostCapabilities(host);
}

export function getAuthStateForHostEffect(host: GitHost) {
    return getHostClient(host).getAuthState();
}

export function loginToHostEffect(data: { host: "bitbucket"; email: string; apiToken: string } | { host: "github"; token: string }) {
    return getHostClient(data.host).login(data);
}

export function logoutHostEffect(data: { host: GitHost }) {
    return getHostClient(data.host).logout();
}

export function getHostLabel(host: GitHost) {
    return host === "bitbucket" ? "Bitbucket" : "GitHub";
}
