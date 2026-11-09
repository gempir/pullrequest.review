import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { githubClient } from "../src/lib/git-host/providers/github/client";
import type { Comment } from "../src/lib/git-host/types";
import { clearGithubAuthCredential, ensureStorageReady, writeGithubAuthCredential } from "../src/lib/storage";
import { mockFetch } from "./support/fetch-mock";

const prRef = { host: "github" as const, workspace: "acme", repo: "repo", pullRequestId: "7" };
const PULL = "/repos/acme/repo/pulls/7";
const ISSUE = "/repos/acme/repo/issues/7";

let restore: (() => void) | undefined;
beforeEach(async () => {
    await ensureStorageReady();
    clearGithubAuthCredential();
});
afterEach(() => {
    restore?.();
    restore = undefined;
    clearGithubAuthCredential();
});

function pullRequestRoutes(overrides: Record<string, unknown> = {}) {
    return {
        [PULL]: { number: 7, title: "PR", state: "open", head: { sha: "head-sha" }, user: { login: "author" }, created_at: "2026-01-01T00:00:00Z" },
        [`${ISSUE}/comments`]: [],
        [`${PULL}/comments`]: [],
        [`${PULL}/reviews`]: [],
        [`${ISSUE}/events`]: [],
        "/repos/acme/repo/commits/head-sha/check-runs": { check_runs: [] },
        "/repos/acme/repo/commits/head-sha/status": { statuses: [] },
        "/user": { login: "me", avatar_url: "https://avatars.example/me.png" },
        ...overrides,
    };
}

function reviewThreads(nodes: unknown[]) {
    return { data: { repository: { pullRequest: { reviewThreads: { nodes, pageInfo: { hasNextPage: false } } } } } };
}

describe("GitHub pull request comments", () => {
    test("marks a resolved review thread on its root comment and threads replies of replies under the root", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mock = mockFetch(
            pullRequestRoutes({
                [`${PULL}/comments`]: [
                    { id: 10, created_at: "2026-01-01T00:00:00Z", body: "root", path: "src/a.ts", line: 12, side: "RIGHT" },
                    { id: 11, created_at: "2026-01-01T00:01:00Z", body: "reply", path: "src/a.ts", line: 12, side: "RIGHT", in_reply_to_id: 10 },
                    { id: 12, created_at: "2026-01-01T00:02:00Z", body: "nested", path: "src/a.ts", line: 12, side: "RIGHT", in_reply_to_id: 11 },
                ],
                "POST /graphql": reviewThreads([{ id: "THREAD_1", isResolved: true, comments: { nodes: [{ databaseId: 11 }] } }]),
            }),
        );
        restore = mock.restore;

        const comments = await githubClient.fetchPullRequestComments({ prRef });
        const byId = new Map(comments.map((comment) => [comment.id, comment]));
        expect(byId.get(10)?.resolution).toEqual({});
        expect(byId.get(10)?.hostThreadId).toBe("THREAD_1");
        expect(byId.get(11)?.resolution).toBeUndefined();
        expect(byId.get(12)?.parent).toEqual({ id: 10 });
    });

    test("reads public pull requests without a token or thread lookup", async () => {
        const mock = mockFetch(pullRequestRoutes({ [`${PULL}/comments`]: [{ id: 20, body: "root", path: "src/a.ts", line: 3, side: "RIGHT" }] }));
        restore = mock.restore;

        const comments = await githubClient.fetchPullRequestComments({ prRef });
        const { currentUser } = await githubClient.fetchPullRequestDeferred({ prRef });
        expect(comments[0]?.resolution).toBeUndefined();
        expect(currentUser).toBeUndefined();
        expect(mock.requests.some((request) => request.url.pathname === "/graphql" || request.url.pathname === "/user")).toBeFalse();
        expect(mock.requests.every((request) => !request.headers.has("Authorization"))).toBeTrue();
    });

    test("maps suggestion ranges and marks comments on lines that left the diff as outdated", async () => {
        const mock = mockFetch(
            pullRequestRoutes({
                [`${PULL}/comments`]: [
                    { id: 30, body: "s", path: "src/a.ts", start_line: 16, start_side: "RIGHT", line: 18, side: "RIGHT", position: 8 },
                    { id: 31, body: "s", path: "src/a.ts", original_line: 22, line: null, side: "RIGHT", position: null },
                    { id: 32, body: "s", path: "src/a.ts", line: 5, side: "LEFT", position: 2 },
                ],
            }),
        );
        restore = mock.restore;

        const comments = await githubClient.fetchPullRequestComments({ prRef });
        const byId = new Map(comments.map((comment) => [comment.id, comment.inline]));
        expect(byId.get(30)).toEqual({ path: "src/a.ts", to: 18, from: undefined, startTo: 16 });
        expect(byId.get(31)).toEqual({ path: "src/a.ts", to: 22, from: undefined, outdated: true });
        expect(byId.get(32)).toEqual({ path: "src/a.ts", to: undefined, from: 5 });
    });

    test("sends a ranged inline comment against the head commit", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mock = mockFetch({ ...pullRequestRoutes(), [`POST ${PULL}/comments`]: {} });
        restore = mock.restore;

        await githubClient.createPullRequestComment({ prRef, content: "fix", inline: { path: "src/a.ts", startTo: 16, to: 18 } });
        const post = mock.requests.find((request) => request.method === "POST");
        expect(post?.body).toEqual({ body: "fix", commit_id: "head-sha", path: "src/a.ts", side: "RIGHT", line: 18, start_line: 16, start_side: "RIGHT" });
    });

    test("edits and deletes inline comments as review comments and others as issue comments", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mock = mockFetch({
            "PATCH /repos/acme/repo/pulls/comments/1": {},
            "PATCH /repos/acme/repo/issues/comments/2": {},
            "DELETE /repos/acme/repo/pulls/comments/1": new Response(null, { status: 204 }),
            "DELETE /repos/acme/repo/issues/comments/2": new Response(null, { status: 204 }),
        });
        restore = mock.restore;
        const inlineComment: Comment = { id: 1, inline: { path: "src/a.ts", to: 3 } };
        const issueComment: Comment = { id: 2 };

        await githubClient.updatePullRequestComment({ prRef, comment: inlineComment, content: "a" });
        await githubClient.updatePullRequestComment({ prRef, comment: issueComment, content: "b" });
        await githubClient.deletePullRequestComment({ prRef, comment: inlineComment });
        await githubClient.deletePullRequestComment({ prRef, comment: issueComment });
        expect(mock.requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
            "PATCH /repos/acme/repo/pulls/comments/1",
            "PATCH /repos/acme/repo/issues/comments/2",
            "DELETE /repos/acme/repo/pulls/comments/1",
            "DELETE /repos/acme/repo/issues/comments/2",
        ]);
    });

    test("resolves a thread with one mutation on the comment's thread id", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mock = mockFetch({ "POST /graphql": { data: {} } });
        restore = mock.restore;

        await githubClient.resolvePullRequestComment({ prRef, comment: { id: 1, hostThreadId: "THREAD_9" }, resolve: true });
        expect(mock.requests).toHaveLength(1);
        const body = mock.requests[0]?.body as { query: string; variables: unknown };
        expect(body.query).toContain("resolveReviewThread");
        expect(body.variables).toEqual({ id: "THREAD_9" });
    });

    test("looks the thread up when the comment arrived without its thread id", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mutations: unknown[] = [];
        const mock = mockFetch({
            "POST /graphql": ({ body }: { body: unknown }) => {
                const { query, variables } = body as { query: string; variables: unknown };
                if (query.includes("reviewThreads")) return reviewThreads([{ id: "THREAD_7", isResolved: false, comments: { nodes: [{ databaseId: 5 }] } }]);
                mutations.push(variables);
                return { data: {} };
            },
        });
        restore = mock.restore;

        await githubClient.resolvePullRequestComment({ prRef, comment: { id: 5, inline: { path: "src/a.ts", to: 1 } }, resolve: false });
        expect(mutations).toEqual([{ id: "THREAD_7" }]);
    });

    test("rejects writes without a token before any request", async () => {
        const mock = mockFetch({});
        restore = mock.restore;
        await expect(githubClient.approvePullRequest({ prRef })).rejects.toThrow("Not authenticated");
        expect(mock.requests).toHaveLength(0);
    });
});

describe("GitHub pull request data", () => {
    test("maps summaries for repository pull request lists", async () => {
        const mock = mockFetch({
            "/repos/acme/repo/pulls": [
                {
                    number: 42,
                    title: "Refactor",
                    state: "closed",
                    merged_at: "2026-01-02T00:00:00Z",
                    html_url: "https://github.com/acme/repo/pull/42",
                    head: { ref: "feature" },
                    user: { login: "octocat", avatar_url: "https://avatars.example/o.png" },
                },
            ],
        });
        restore = mock.restore;
        const repo = { host: "github" as const, workspace: "acme", repo: "repo", fullName: "acme/repo", displayName: "repo" };

        const [result] = await githubClient.listPullRequestsForRepos({ repos: [repo] });
        expect(result?.pullRequests).toEqual([
            {
                id: 42,
                title: "Refactor",
                state: "MERGED",
                createdAt: undefined,
                updatedAt: undefined,
                source: { branch: { name: "feature" } },
                destination: undefined,
                links: { html: { href: "https://github.com/acme/repo/pull/42" } },
                author: { displayName: "octocat", avatarUrl: "https://avatars.example/o.png" },
            },
        ]);
    });

    test("builds history from issue events, keeping one event for a merge", async () => {
        const actor = { login: "author" };
        const mock = mockFetch(
            pullRequestRoutes({
                [`${ISSUE}/events`]: [
                    { id: 1, event: "review_requested", created_at: "2026-01-01T01:00:00Z", actor, requested_reviewer: { login: "reviewer" } },
                    { id: 2, event: "merged", created_at: "2026-01-01T02:00:00Z", actor },
                    { id: 3, event: "closed", created_at: "2026-01-01T02:00:00Z", actor },
                    { id: 4, event: "subscribed", created_at: "2026-01-01T03:00:00Z", actor },
                ],
            }),
        );
        restore = mock.restore;

        const { history } = await githubClient.fetchPullRequestDeferred({ prRef });
        expect(history.map((event) => [event.type, event.details])).toEqual([
            ["reviewRequested", "reviewer"],
            ["merged", undefined],
        ]);
    });

    test("takes the current user's review status from their latest decisive review", async () => {
        await writeGithubAuthCredential({ token: "token" });
        const mock = mockFetch(
            pullRequestRoutes({
                "POST /graphql": reviewThreads([]),
                [`${PULL}/reviews`]: [
                    { id: 1, state: "APPROVED", user: { login: "me" } },
                    { id: 2, state: "CHANGES_REQUESTED", user: { login: "other" } },
                    { id: 3, state: "COMMENTED", user: { login: "me" } },
                ],
            }),
        );
        restore = mock.restore;

        const deferred = await githubClient.fetchPullRequestDeferred({ prRef });
        expect(deferred.currentUserReviewStatus).toBe("approved");
        expect(deferred.currentUser).toEqual({ displayName: "me", avatarUrl: "https://avatars.example/me.png" });
    });

    test("maps a commit range comparison to diff and diffstat", async () => {
        const mock = mockFetch({
            "/repos/acme/repo/compare/aaa11111...bbb22222": ({ init }: { init: RequestInit }) =>
                new Headers(init.headers).get("Accept") === "application/vnd.github.v3.diff"
                    ? new Response("diff --git a/src/a.ts b/src/a.ts\n")
                    : { files: [{ status: "renamed", filename: "src/b.ts", previous_filename: "src/a.ts", additions: 5, deletions: 2 }] },
        });
        restore = mock.restore;

        const result = await githubClient.fetchCommitRangeDiff({ prRef, baseCommitHash: "aaa11111", headCommitHash: "bbb22222" });
        expect(result.diff).toContain("diff --git");
        expect(result.diffstat).toEqual([{ status: "renamed", new: { path: "src/b.ts" }, old: { path: "src/a.ts" }, linesAdded: 5, linesRemoved: 2 }]);
    });
});
