import { encodeFilePath, mapWithConcurrency, REPO_PULL_REQUEST_LIST_LIMIT } from "@/lib/git-host/shared/http";
import { type Comment, type GitHostClient, HostApiError, type PullRequestRef } from "@/lib/git-host/types";
import { clearGithubAuthCredential, writeGithubAuthCredential } from "@/lib/storage";
import { authedRequest, fetchAllPages, graphql, issuePath, pullPath, readToken, repoPath, request, requestJson, requestWith, sendJson } from "./api";
import {
    buildGithubReviewThreadMetadata,
    mapBuildStatuses,
    mapCommit,
    mapFile,
    mapGithubInlineComment,
    mapHistory,
    mapPullRequestDetails,
    mapPullRequestSummary,
    mapRepo,
    mapReviewers,
    mapUser,
    mergeIssueAndReviewComments,
    NO_THREAD_METADATA,
    normalizeGithubReviewCommentParents,
    resolveCurrentUserReviewStatus,
} from "./mappers";
import type {
    GithubCheckRunsResponse,
    GithubCombinedStatusResponse,
    GithubCommit,
    GithubCompareResponse,
    GithubFile,
    GithubIssueComment,
    GithubIssueEvent,
    GithubPull,
    GithubRepo,
    GithubReview,
    GithubReviewComment,
    GithubReviewThreadNode,
    GithubUser,
} from "./raw-types";

const DIFF_ACCEPT = { Accept: "application/vnd.github.v3.diff" };

const REVIEW_THREADS_QUERY = `
    query ReviewThreads($owner: String!, $repo: String!, $number: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
                reviewThreads(first: 100, after: $after) {
                    nodes { id isResolved comments(first: 100) { nodes { databaseId } } }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }
    }
`;

type ReviewThreadsConnection = { nodes?: GithubReviewThreadNode[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } };
type ReviewThreadsPage = { repository?: { pullRequest?: { reviewThreads?: ReviewThreadsConnection } } };

async function fetchReviewThreads(prRef: PullRequestRef) {
    const threads: GithubReviewThreadNode[] = [];
    let after: string | null = null;
    do {
        const data: ReviewThreadsPage | undefined = await graphql<ReviewThreadsPage>(REVIEW_THREADS_QUERY, {
            owner: prRef.workspace,
            repo: prRef.repo,
            number: Number(prRef.pullRequestId),
            after,
        });
        const connection: ReviewThreadsConnection | undefined = data?.repository?.pullRequest?.reviewThreads;
        threads.push(...(connection?.nodes ?? []));
        after = connection?.pageInfo?.hasNextPage ? (connection.pageInfo.endCursor ?? null) : null;
    } while (after);
    return threads;
}

/** Thread resolution is GraphQL-only, which needs a token; without one comments load unresolved. */
async function fetchComments(prRef: PullRequestRef) {
    const [issueComments, reviewComments] = await Promise.all([
        fetchAllPages<GithubIssueComment>(issuePath(prRef, "/comments")),
        fetchAllPages<GithubReviewComment>(pullPath(prRef, "/comments")),
    ]);
    const normalized = normalizeGithubReviewCommentParents(reviewComments);
    const metadata = readToken()
        ? await fetchReviewThreads(prRef)
              .then((threads) => buildGithubReviewThreadMetadata(normalized, threads))
              .catch(() => NO_THREAD_METADATA)
        : NO_THREAD_METADATA;
    return mergeIssueAndReviewComments(issueComments, normalized, metadata);
}

function fetchOptionalJson<T>(path: string) {
    return requestJson<T>(path).catch(() => null);
}

async function fetchBuildStatuses(prRef: PullRequestRef, headSha: string | undefined) {
    if (!headSha) return [];
    const [checks, combinedStatus] = await Promise.all([
        fetchOptionalJson<GithubCheckRunsResponse>(repoPath(prRef, `/commits/${headSha}/check-runs`)),
        fetchOptionalJson<GithubCombinedStatusResponse>(repoPath(prRef, `/commits/${headSha}/status`)),
    ]);
    return mapBuildStatuses(checks, combinedStatus);
}

async function fetchDiffText(path: string) {
    return (await request(path, { headers: DIFF_ACCEPT })).text();
}

async function runPullRequestMutation(prRef: PullRequestRef, mutation: "convertPullRequestToDraft" | "markPullRequestReadyForReview") {
    const pull = await (await authedRequest(pullPath(prRef))).json();
    const nodeId = (pull as GithubPull).node_id;
    if (!nodeId) throw new Error("GitHub pull request node id is unavailable");
    await graphql(`mutation($id: ID!) { ${mutation}(input: { pullRequestId: $id }) { pullRequest { id } } }`, { id: nodeId });
}

function commentPath(prRef: PullRequestRef, comment: Comment) {
    // Review (inline) comments and issue (conversation) comments live under different endpoints.
    return repoPath(prRef, `/${comment.inline ? "pulls" : "issues"}/comments/${comment.id}`);
}

export const githubClient: GitHostClient = {
    host: "github",
    label: "GitHub",
    capabilities: {
        publicReadSupported: true,
        supportsThreadResolution: true,
        supportsNestedReplies: false,
        requestChangesAvailable: true,
        removeApprovalAvailable: false,
        mergeStrategies: ["merge", "squash", "rebase"],
        declineAvailable: true,
        markDraftAvailable: true,
    },
    isAuthenticated() {
        return Boolean(readToken());
    },
    async login(credentials) {
        if (credentials.host !== "github") throw new Error("GitHub credentials expected");
        const token = credentials.token.trim();
        if (!token) throw new Error("Token is required");
        await requestWith("/user", token, {}, "GitHub authentication");
        await writeGithubAuthCredential({ token });
    },
    logout() {
        clearGithubAuthCredential();
    },
    async listRepositories() {
        if (!readToken()) throw new Error("GitHub token required to list repositories. You can still open public PR URLs directly.");
        const repos = await fetchAllPages<GithubRepo>("/user/repos?affiliation=owner,collaborator,organization_member");
        return repos.flatMap(mapRepo);
    },
    async listPullRequestsForRepos({ repos }) {
        return mapWithConcurrency(repos, 4, async (repo) => {
            const pulls = await fetchAllPages<GithubPull>(repoPath(repo, "/pulls?state=all&sort=updated&direction=desc"), REPO_PULL_REQUEST_LIST_LIMIT);
            return { repo, pullRequests: pulls.map(mapPullRequestSummary) };
        });
    },
    async fetchPullRequestCritical({ prRef }) {
        const [pr, diff, files, commits] = await Promise.all([
            requestJson<GithubPull>(pullPath(prRef)),
            fetchDiffText(pullPath(prRef)),
            fetchAllPages<GithubFile>(pullPath(prRef, "/files")),
            fetchAllPages<GithubCommit>(pullPath(prRef, "/commits")),
        ]);
        return { pr: mapPullRequestDetails(pr), diff, diffstat: files.flatMap(mapFile), commits: commits.map(mapCommit) };
    },
    async fetchPullRequestDeferred({ prRef }) {
        const [pr, reviews, issueEvents, currentUser] = await Promise.all([
            requestJson<GithubPull>(pullPath(prRef)),
            fetchAllPages<GithubReview>(pullPath(prRef, "/reviews")),
            fetchAllPages<GithubIssueEvent>(issuePath(prRef, "/events")).catch(() => []),
            readToken() ? requestJson<GithubUser>("/user") : null,
        ]);
        return {
            history: mapHistory(reviews, issueEvents),
            reviewers: mapReviewers(pr, reviews),
            buildStatuses: await fetchBuildStatuses(prRef, pr.head?.sha),
            currentUser: currentUser ? mapUser(currentUser) : undefined,
            currentUserReviewStatus: resolveCurrentUserReviewStatus(reviews, currentUser?.login),
        };
    },
    fetchPullRequestComments({ prRef }) {
        return fetchComments(prRef);
    },
    async approvePullRequest({ prRef }) {
        await sendJson(pullPath(prRef, "/reviews"), "POST", { event: "APPROVE" });
    },
    async removePullRequestApproval() {
        throw new Error("Removing approval is not supported for GitHub in this app.");
    },
    async requestChanges({ prRef }) {
        // GitHub rejects a REQUEST_CHANGES review without a body.
        await sendJson(pullPath(prRef, "/reviews"), "POST", { event: "REQUEST_CHANGES", body: "Requesting changes" });
    },
    async declinePullRequest({ prRef }) {
        await sendJson(pullPath(prRef), "PATCH", { state: "closed" });
    },
    async markPullRequestAsDraft({ prRef }) {
        await runPullRequestMutation(prRef, "convertPullRequestToDraft");
    },
    async markPullRequestReady({ prRef }) {
        await runPullRequestMutation(prRef, "markPullRequestReadyForReview");
    },
    async mergePullRequest({ prRef, message, mergeStrategy }) {
        await sendJson(pullPath(prRef, "/merge"), "PUT", {
            commit_message: message?.trim() || undefined,
            merge_method: mergeStrategy?.trim() || "merge",
        });
    },
    async updatePullRequestDescription({ prRef, description }) {
        await sendJson(pullPath(prRef), "PATCH", { body: description });
    },
    async createPullRequestComment({ prRef, content, inline, parentId }) {
        if (parentId) {
            await sendJson(pullPath(prRef, "/comments"), "POST", { body: content, in_reply_to: parentId });
            return;
        }
        const githubInline = inline ? mapGithubInlineComment(inline) : undefined;
        if (githubInline) {
            const pr = await requestJson<GithubPull>(pullPath(prRef));
            await sendJson(pullPath(prRef, "/comments"), "POST", { body: content, commit_id: pr.head?.sha, ...githubInline });
            return;
        }
        await sendJson(issuePath(prRef, "/comments"), "POST", { body: content });
    },
    async updatePullRequestComment({ prRef, comment, content }) {
        await sendJson(commentPath(prRef, comment), "PATCH", { body: content });
    },
    async resolvePullRequestComment({ prRef, comment, resolve }) {
        // The thread id comes with the comments, unless that lookup failed; then find it now.
        const threadId =
            comment.hostThreadId ??
            (await fetchReviewThreads(prRef)).find((thread) => thread.comments?.nodes?.some((node) => node.databaseId === comment.id))?.id;
        if (!threadId) throw new Error("GitHub review thread id is unavailable for this comment");
        const mutation = resolve ? "resolveReviewThread" : "unresolveReviewThread";
        await graphql(`mutation($id: ID!) { ${mutation}(input: { threadId: $id }) { thread { id } } }`, { id: threadId });
    },
    async deletePullRequestComment({ prRef, comment }) {
        await authedRequest(commentPath(prRef, comment), { method: "DELETE" });
    },
    async fetchFileContents({ prRef, commit, path }) {
        const encodedPath = encodeFilePath(path);
        if (!encodedPath) return "";
        try {
            const res = await request(repoPath(prRef, `/contents/${encodedPath}?ref=${commit}`), { headers: { Accept: "application/vnd.github.raw" } });
            return await res.text();
        } catch (error) {
            if (error instanceof HostApiError && error.status === 404) return "";
            throw error;
        }
    },
    async fetchCommitRangeDiff({ prRef, baseCommitHash, headCommitHash }) {
        const comparePath = repoPath(prRef, `/compare/${encodeURIComponent(baseCommitHash)}...${encodeURIComponent(headCommitHash)}`);
        const [compare, diff] = await Promise.all([requestJson<GithubCompareResponse>(comparePath), fetchDiffText(comparePath)]);
        return { diff, diffstat: (compare.files ?? []).flatMap(mapFile) };
    },
};
