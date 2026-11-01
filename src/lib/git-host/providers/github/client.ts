import { mapWithConcurrency } from "@/lib/git-host/shared/concurrency";
import { parseFailureBody } from "@/lib/git-host/shared/http";
import { collectPaginated, REPO_PULL_REQUEST_LIST_LIMIT } from "@/lib/git-host/shared/pagination";
import {
    type AuthState,
    type Comment,
    type DiffStatEntry,
    type GitHostClient,
    HostApiError,
    type LoginCredentials,
    type PullRequestCommitRangeDiff,
    type PullRequestCriticalBundle,
    type PullRequestDeferredBundle,
} from "@/lib/git-host/types";
import { API_BASE, authHeader, clearAuth, listPaginated, readAuth, request, writeAuth } from "./api";
import {
    buildGithubReviewThreadMetadata,
    mapBuildStatuses,
    mapCommit,
    mapFileStatus,
    mapGithubInlineComment,
    mapHistory,
    mapPullRequestDetails,
    mapPullRequestSummary,
    mapReviewers,
    mergeIssueAndReviewComments,
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

async function fetchGithubPullRequestCritical(prRef: { workspace: string; repo: string; pullRequestId: string }): Promise<PullRequestCriticalBundle> {
    const basePath = `/repos/${prRef.workspace}/${prRef.repo}/pulls/${prRef.pullRequestId}`;
    const [prRes, diffRes, files, commits] = await Promise.all([
        request(basePath),
        request(basePath, {
            headers: { Accept: "application/vnd.github.v3.diff" },
        }),
        listPaginated<GithubFile>(`${basePath}/files`),
        listPaginated<GithubCommit>(`${basePath}/commits`),
    ]);
    const pr = (await prRes.json()) as GithubPull;
    const diffstat: DiffStatEntry[] = files.map((file) => ({
        status: mapFileStatus(file.status),
        new: { path: file.filename },
        old: { path: file.previous_filename ?? file.filename },
        linesAdded: file.additions,
        linesRemoved: file.deletions,
    }));
    return {
        prRef: {
            host: "github",
            workspace: prRef.workspace,
            repo: prRef.repo,
            pullRequestId: prRef.pullRequestId,
        },
        pr: mapPullRequestDetails(pr, "none"),
        diff: await diffRes.text(),
        diffstat,
        commits: commits.map(mapCommit),
    };
}

async function fetchGithubReviewThreadMetadata(
    prRef: { workspace: string; repo: string; pullRequestId: string },
    normalizedReviewComments: GithubReviewComment[],
) {
    if (!authHeader()) {
        return {
            resolvedRootCommentIds: new Set<number>(),
            threadIdByRootCommentId: new Map<number, string>(),
        };
    }

    return (async () => {
        const reviewThreads: GithubReviewThreadNode[] = [];
        let after: string | null = null;
        const pullRequestNumber = Number(prRef.pullRequestId);
        if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
            return {
                resolvedRootCommentIds: new Set<number>(),
                threadIdByRootCommentId: new Map<number, string>(),
            };
        }

        do {
            const response = await request(
                "/graphql",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `
                            query ReviewThreadsByPullRequest($owner: String!, $repo: String!, $pullRequestNumber: Int!, $after: String) {
                                repository(owner: $owner, name: $repo) {
                                    pullRequest(number: $pullRequestNumber) {
                                        reviewThreads(first: 100, after: $after) {
                                            nodes {
                                                id
                                                isResolved
                                                comments(first: 100) {
                                                    nodes {
                                                        databaseId
                                                    }
                                                }
                                            }
                                            pageInfo {
                                                hasNextPage
                                                endCursor
                                            }
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            owner: prRef.workspace,
                            repo: prRef.repo,
                            pullRequestNumber,
                            after,
                        },
                    }),
                },
                { requireAuth: true },
            );
            const payload = (await response.json()) as {
                errors?: Array<{ message?: string }>;
                data?: {
                    repository?: {
                        pullRequest?: {
                            reviewThreads?: {
                                nodes?: GithubReviewThreadNode[];
                                pageInfo?: {
                                    hasNextPage?: boolean;
                                    endCursor?: string | null;
                                };
                            };
                        };
                    };
                };
            };
            const firstError = payload.errors?.[0]?.message;
            if (firstError) {
                throw new Error(firstError);
            }

            const reviewThreadsConnection = payload.data?.repository?.pullRequest?.reviewThreads;
            reviewThreads.push(...(reviewThreadsConnection?.nodes ?? []));
            const pageInfo = reviewThreadsConnection?.pageInfo;
            after = pageInfo?.hasNextPage ? (pageInfo.endCursor?.trim() ?? null) : null;
        } while (after);

        return buildGithubReviewThreadMetadata(normalizedReviewComments, reviewThreads);
    })().catch(() => ({
        resolvedRootCommentIds: new Set<number>(),
        threadIdByRootCommentId: new Map<number, string>(),
    }));
}

async function fetchGithubPullRequestComments(prRef: { workspace: string; repo: string; pullRequestId: string }) {
    const basePath = `/repos/${prRef.workspace}/${prRef.repo}/pulls/${prRef.pullRequestId}`;
    const [issueComments, reviewComments] = await Promise.all([
        listPaginated<GithubIssueComment>(`/repos/${prRef.workspace}/${prRef.repo}/issues/${prRef.pullRequestId}/comments`),
        listPaginated<GithubReviewComment>(`${basePath}/comments`),
    ]);
    const normalizedReviewComments = normalizeGithubReviewCommentParents(reviewComments);
    const reviewThreadMetadata = await fetchGithubReviewThreadMetadata(prRef, normalizedReviewComments);
    return mergeIssueAndReviewComments(issueComments, normalizedReviewComments, reviewThreadMetadata);
}

async function fetchGithubPullRequestDeferred(prRef: { workspace: string; repo: string; pullRequestId: string }): Promise<PullRequestDeferredBundle> {
    const basePath = `/repos/${prRef.workspace}/${prRef.repo}/pulls/${prRef.pullRequestId}`;
    const isAuthenticated = Boolean(authHeader());
    const [prRes, issueComments, reviewComments, reviews, issueEvents] = await Promise.all([
        request(basePath),
        listPaginated<GithubIssueComment>(`/repos/${prRef.workspace}/${prRef.repo}/issues/${prRef.pullRequestId}/comments`),
        listPaginated<GithubReviewComment>(`${basePath}/comments`),
        listPaginated<GithubReview>(`${basePath}/reviews`),
        listPaginated<GithubIssueEvent>(`/repos/${prRef.workspace}/${prRef.repo}/issues/${prRef.pullRequestId}/events`).catch(() => []),
    ]);
    const normalizedReviewComments = normalizeGithubReviewCommentParents(reviewComments);
    const reviewThreadMetadata = await fetchGithubReviewThreadMetadata(prRef, normalizedReviewComments);

    let currentLogin: string | undefined;
    let currentAvatarUrl: string | undefined;
    if (isAuthenticated) {
        const currentUserRes = await request("/user");
        const currentUser = (await currentUserRes.json()) as GithubUser;
        currentLogin = currentUser.login;
        currentAvatarUrl = currentUser.avatar_url;
    }

    const pr = (await prRes.json()) as GithubPull;
    const headSha = pr.head?.sha;
    const [checks, combinedStatus] = await Promise.all([
        headSha
            ? request(`/repos/${prRef.workspace}/${prRef.repo}/commits/${headSha}/check-runs`)
                  .then((res) => res.json() as Promise<GithubCheckRunsResponse>)
                  .catch(() => null)
            : Promise.resolve(null),
        headSha
            ? request(`/repos/${prRef.workspace}/${prRef.repo}/commits/${headSha}/status`)
                  .then((res) => res.json() as Promise<GithubCombinedStatusResponse>)
                  .catch(() => null)
            : Promise.resolve(null),
    ]);

    const currentUserReviewStatus = resolveCurrentUserReviewStatus(reviews, currentLogin);

    return {
        prRef: {
            host: "github",
            workspace: prRef.workspace,
            repo: prRef.repo,
            pullRequestId: prRef.pullRequestId,
        },
        comments: mergeIssueAndReviewComments(issueComments, normalizedReviewComments, reviewThreadMetadata),
        history: mapHistory(pr, issueComments, reviews, issueEvents),
        reviewers: mapReviewers(pr, reviews),
        buildStatuses: mapBuildStatuses(checks, combinedStatus),
        prPatch: {
            currentUserReviewStatus,
            currentUser: currentLogin
                ? {
                      displayName: currentLogin,
                      avatarUrl: currentAvatarUrl,
                  }
                : undefined,
        },
    };
}

export const githubClient: GitHostClient = {
    host: "github",
    capabilities: {
        publicReadSupported: true,
        supportsThreadResolution: true,
        requestChangesAvailable: true,
        removeApprovalAvailable: false,
        mergeStrategies: ["merge", "squash", "rebase"],
        declineAvailable: true,
        markDraftAvailable: true,
    },
    async getAuthState(): Promise<AuthState> {
        const auth = readAuth();
        return { authenticated: Boolean(auth?.token) };
    },
    async login(credentials: LoginCredentials): Promise<AuthState> {
        if (credentials.host !== "github") {
            throw new Error("GitHub credentials expected");
        }
        const token = credentials.token.trim();
        if (!token) throw new Error("Token is required");

        const response = await fetch(`${API_BASE}/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!response.ok) {
            const details = await parseFailureBody(response);
            const status = `${response.status} ${response.statusText}`;
            throw new Error(details ? `GitHub authentication failed (${status}): ${details}` : `GitHub authentication failed (${status})`);
        }

        await writeAuth({ token });
        return { authenticated: true };
    },
    async logout(): Promise<AuthState> {
        clearAuth();
        return { authenticated: false };
    },
    async listRepositories() {
        if (!authHeader()) {
            throw new Error("GitHub token required to list repositories. You can still open public PR URLs directly.");
        }
        const repos = await listPaginated<GithubRepo>("/user/repos?affiliation=owner,collaborator,organization_member");
        const mapped = repos.map((repo) => {
            const workspace = repo.owner?.login;
            if (!workspace) return null;
            return {
                host: "github" as const,
                workspace,
                repo: repo.name,
                fullName: repo.full_name,
                displayName: repo.name,
            };
        });
        return mapped.filter((repo): repo is NonNullable<typeof repo> => Boolean(repo));
    },
    async listPullRequestsForRepos(data) {
        if (!data.repos.length) return [];
        return mapWithConcurrency(data.repos, 4, async (repo) => {
            const pulls = await collectPaginated(
                async (page) => {
                    const path = `/repos/${repo.workspace}/${repo.repo}/pulls?state=all&sort=updated&direction=desc`;
                    const res = await request(`${path}&per_page=100&page=${page}`);
                    return (await res.json()) as GithubPull[];
                },
                100,
                REPO_PULL_REQUEST_LIST_LIMIT,
            );
            return {
                repo,
                pullRequests: pulls.map(mapPullRequestSummary),
            };
        });
    },
    async fetchPullRequestCriticalByRef(data): Promise<PullRequestCriticalBundle> {
        return fetchGithubPullRequestCritical({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async fetchPullRequestDeferredByRef(data): Promise<PullRequestDeferredBundle> {
        return fetchGithubPullRequestDeferred({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async fetchPullRequestCommentsByRef(data): Promise<Comment[]> {
        return fetchGithubPullRequestComments({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async approvePullRequest(data) {
        const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/reviews`;
        await request(
            path,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: "APPROVE" }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async removePullRequestApproval() {
        throw new Error("Removing approval is not supported for GitHub in this app.");
    },
    async requestChanges(data) {
        const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/reviews`;
        await request(
            path,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event: "REQUEST_CHANGES",
                    body: data.body ?? "Requesting changes",
                }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async declinePullRequest(data) {
        const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`;
        await request(
            path,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: "closed" }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async markPullRequestAsDraft(data) {
        const pullPath = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`;
        const pullResponse = await request(pullPath, {}, { requireAuth: true });
        const pull = (await pullResponse.json()) as GithubPull;
        if (!pull.node_id) {
            throw new Error("GitHub pull request node id is unavailable");
        }

        const mutation = `
            mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
                convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
                    pullRequest {
                        id
                    }
                }
            }
        `;

        const response = await request(
            "/graphql",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: mutation,
                    variables: { pullRequestId: pull.node_id },
                }),
            },
            { requireAuth: true },
        );
        const payload = (await response.json()) as {
            errors?: Array<{ message?: string }>;
            data?: { convertPullRequestToDraft?: { pullRequest?: { id?: string } } };
        };
        const firstError = payload.errors?.[0]?.message;
        if (firstError) {
            throw new Error(firstError);
        }
        if (!payload.data?.convertPullRequestToDraft?.pullRequest?.id) {
            throw new Error("GitHub did not confirm draft conversion");
        }
        return { ok: true as const };
    },
    async markPullRequestReady(data) {
        const pullPath = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`;
        const pullResponse = await request(pullPath, {}, { requireAuth: true });
        const pull = (await pullResponse.json()) as GithubPull;
        if (!pull.node_id) {
            throw new Error("GitHub pull request node id is unavailable");
        }

        const mutation = `
            mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
                markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
                    pullRequest {
                        id
                    }
                }
            }
        `;

        const response = await request(
            "/graphql",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: mutation,
                    variables: { pullRequestId: pull.node_id },
                }),
            },
            { requireAuth: true },
        );
        const payload = (await response.json()) as {
            errors?: Array<{ message?: string }>;
            data?: { markPullRequestReadyForReview?: { pullRequest?: { id?: string } } };
        };
        const firstError = payload.errors?.[0]?.message;
        if (firstError) {
            throw new Error(firstError);
        }
        if (!payload.data?.markPullRequestReadyForReview?.pullRequest?.id) {
            throw new Error("GitHub did not confirm ready-for-review conversion");
        }
        return { ok: true as const };
    },
    async mergePullRequest(data) {
        const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/merge`;
        const mergeMethod = data.mergeStrategy?.trim() || "merge";
        await request(
            path,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    commit_message: data.message?.trim() || undefined,
                    merge_method: mergeMethod,
                }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async updatePullRequestDescription(data) {
        await request(
            `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: data.description }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async createPullRequestComment(data) {
        const prBase = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`;

        if (data.parentId) {
            await request(
                `${prBase}/comments`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        body: data.content,
                        in_reply_to: data.parentId,
                    }),
                },
                { requireAuth: true },
            );
            return { ok: true as const };
        }

        const inline = mapGithubInlineComment(data.inline);
        if (inline) {
            const prRes = await request(prBase);
            const pr = (await prRes.json()) as GithubPull;

            await request(
                `${prBase}/comments`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        body: data.content,
                        commit_id: pr.head?.sha,
                        ...inline,
                    }),
                },
                { requireAuth: true },
            );
            return { ok: true as const };
        }

        await request(
            `/repos/${data.prRef.workspace}/${data.prRef.repo}/issues/${data.prRef.pullRequestId}/comments`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: data.content }),
            },
            { requireAuth: true },
        );

        return { ok: true as const };
    },
    async updatePullRequestComment(data) {
        const repoBase = `/repos/${data.prRef.workspace}/${data.prRef.repo}`;
        const path = data.hasInlineContext ? `${repoBase}/pulls/comments/${data.commentId}` : `${repoBase}/issues/comments/${data.commentId}`;
        await request(
            path,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: data.content }),
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async resolvePullRequestComment(data) {
        const repoBase = `/repos/${data.prRef.workspace}/${data.prRef.repo}`;
        const commentResponse = await request(`${repoBase}/pulls/comments/${data.commentId}`, {}, { requireAuth: true });
        const comment = (await commentResponse.json()) as GithubReviewComment;
        const commentNodeId = comment.node_id?.trim();
        if (!commentNodeId) {
            throw new Error("GitHub comment node id is unavailable");
        }
        const pullRequestNumber = Number(data.prRef.pullRequestId);
        if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
            throw new Error("GitHub pull request number is invalid");
        }

        let thread:
            | {
                  id?: string;
                  isResolved?: boolean;
              }
            | undefined;
        let after: string | null = null;

        do {
            const threadLookupResponse = await request(
                "/graphql",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `
                            query ReviewThreadsByPullRequest($owner: String!, $repo: String!, $pullRequestNumber: Int!, $after: String) {
                                repository(owner: $owner, name: $repo) {
                                    pullRequest(number: $pullRequestNumber) {
                                        reviewThreads(first: 100, after: $after) {
                                            nodes {
                                                id
                                                isResolved
                                                comments(first: 100) {
                                                    nodes {
                                                        id
                                                    }
                                                }
                                            }
                                            pageInfo {
                                                hasNextPage
                                                endCursor
                                            }
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            owner: data.prRef.workspace,
                            repo: data.prRef.repo,
                            pullRequestNumber,
                            after,
                        },
                    }),
                },
                { requireAuth: true },
            );
            const threadLookupPayload = (await threadLookupResponse.json()) as {
                errors?: Array<{ message?: string }>;
                data?: {
                    repository?: {
                        pullRequest?: {
                            reviewThreads?: {
                                nodes?: Array<{
                                    id?: string;
                                    isResolved?: boolean;
                                    comments?: {
                                        nodes?: Array<{ id?: string }>;
                                    };
                                }>;
                                pageInfo?: {
                                    hasNextPage?: boolean;
                                    endCursor?: string | null;
                                };
                            };
                        };
                    };
                };
            };
            const threadLookupError = threadLookupPayload.errors?.[0]?.message;
            if (threadLookupError) {
                throw new Error(threadLookupError);
            }

            const reviewThreads = threadLookupPayload.data?.repository?.pullRequest?.reviewThreads;
            for (const candidate of reviewThreads?.nodes ?? []) {
                if (!candidate.comments?.nodes?.some((threadComment) => threadComment.id?.trim() === commentNodeId)) continue;
                thread = candidate;
                break;
            }
            if (thread) {
                break;
            }

            const pageInfo = reviewThreads?.pageInfo;
            after = pageInfo?.hasNextPage ? (pageInfo.endCursor?.trim() ?? null) : null;
        } while (after);

        const threadId = thread?.id?.trim();
        if (!threadId) {
            throw new Error("GitHub review thread id is unavailable for this comment");
        }

        const threadResolved = thread?.isResolved;
        if (typeof threadResolved === "boolean" && threadResolved === data.resolve) {
            return { ok: true as const };
        }

        const mutation = data.resolve
            ? `
                mutation ResolveReviewThread($threadId: ID!) {
                    resolveReviewThread(input: { threadId: $threadId }) {
                        thread {
                            id
                            isResolved
                        }
                    }
                }
            `
            : `
                mutation UnresolveReviewThread($threadId: ID!) {
                    unresolveReviewThread(input: { threadId: $threadId }) {
                        thread {
                            id
                            isResolved
                        }
                    }
                }
            `;
        const mutationResponse = await request(
            "/graphql",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: mutation,
                    variables: { threadId },
                }),
            },
            { requireAuth: true },
        );
        const mutationPayload = (await mutationResponse.json()) as {
            errors?: Array<{ message?: string }>;
        };
        const mutationError = mutationPayload.errors?.[0]?.message;
        if (mutationError) {
            throw new Error(mutationError);
        }
        return { ok: true as const };
    },
    async deletePullRequestComment(data) {
        const prBase = `/repos/${data.prRef.workspace}/${data.prRef.repo}`;
        const path = data.hasInlineContext ? `${prBase}/pulls/comments/${data.commentId}` : `${prBase}/issues/comments/${data.commentId}`;
        await request(
            path,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
            },
            { requireAuth: true },
        );
        return { ok: true as const };
    },
    async fetchPullRequestFileContents({ prRef, commit, path }) {
        const encodedPath = encodeGitHubPath(path);
        if (!encodedPath) return "";
        try {
            const res = await request(`/repos/${prRef.workspace}/${prRef.repo}/contents/${encodedPath}?ref=${commit}`, {
                headers: { Accept: "application/vnd.github.raw" },
            });
            return await res.text();
        } catch (error) {
            if (error instanceof HostApiError && error.status === 404) {
                return "";
            }
            throw error;
        }
    },
    async fetchPullRequestCommitRangeDiff({ prRef, baseCommitHash, headCommitHash, selectedCommitHashes }): Promise<PullRequestCommitRangeDiff> {
        const normalizedBase = baseCommitHash.trim();
        const normalizedHead = headCommitHash.trim();
        if (!normalizedBase || !normalizedHead) {
            throw new Error("Both base and head commit hashes are required.");
        }
        const compareSpec = `${encodeURIComponent(normalizedBase)}...${encodeURIComponent(normalizedHead)}`;
        const comparePath = `/repos/${prRef.workspace}/${prRef.repo}/compare/${compareSpec}`;
        const [compareRes, diffRes] = await Promise.all([
            request(comparePath),
            request(comparePath, {
                headers: { Accept: "application/vnd.github.v3.diff" },
            }),
        ]);
        const compare = (await compareRes.json()) as GithubCompareResponse;
        const diffstat: DiffStatEntry[] = (compare.files ?? []).flatMap((file) => {
            const path = file.filename?.trim();
            if (!path) return [];
            return [
                {
                    status: mapFileStatus((file.status ?? "modified").toLowerCase()),
                    new: { path },
                    old: { path: file.previous_filename ?? path },
                    linesAdded: Number(file.additions ?? 0),
                    linesRemoved: Number(file.deletions ?? 0),
                },
            ];
        });
        const compareCommitHashes = (compare.commits ?? []).map((commit) => commit.sha?.trim()).filter((hash): hash is string => Boolean(hash));

        return {
            prRef,
            baseCommitHash: normalizedBase,
            headCommitHash: normalizedHead,
            selectedCommitHashes: compareCommitHashes.length > 0 ? compareCommitHashes : selectedCommitHashes,
            diff: await diffRes.text(),
            diffstat,
        };
    },
};

function encodeGitHubPath(path: string) {
    const trimmed = path.replace(/^\/+/, "");
    if (!trimmed) return "";
    return trimmed
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}
