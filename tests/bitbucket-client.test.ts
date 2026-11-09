import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bitbucketClient } from "../src/lib/git-host/providers/bitbucket/client";
import {
    clearBitbucketAuthCredential,
    ensureStorageReady,
    readBitbucketAuthCredential,
    writeBitbucketAuthCredential,
    writeBitbucketOAuthCredential,
} from "../src/lib/storage";
import { mockFetch } from "./support/fetch-mock";

const API = "/2.0";
const prRef = { host: "bitbucket" as const, workspace: "acme", repo: "repo", pullRequestId: "1" };
const PR = `${API}/repositories/acme/repo/pullrequests/1`;

let restore: (() => void) | undefined;
beforeEach(async () => {
    await ensureStorageReady();
    clearBitbucketAuthCredential();
});
afterEach(() => {
    restore?.();
    restore = undefined;
    clearBitbucketAuthCredential();
});

/** Serves Bitbucket pages: the first page links to `?page=2` through `next`. */
function paged(first: unknown[], second?: unknown[]) {
    return ({ url }: { url: URL }) => {
        if (url.searchParams.get("page") === "2") return { values: second ?? [] };
        const next = new URL(url);
        next.searchParams.set("page", "2");
        return { values: first, ...(second ? { next: next.toString() } : {}) };
    };
}

describe("Bitbucket authentication", () => {
    test("treats stored API-token credentials as signed in and sends them as basic auth", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "api-token" });
        const mock = mockFetch({ [`${API}/user/workspaces`]: { values: [] } });
        restore = mock.restore;

        expect(bitbucketClient.isAuthenticated()).toBeTrue();
        await bitbucketClient.listRepositories();
        expect(mock.requests[0]?.headers.get("Authorization")).toBe(`Basic ${btoa("user@example.com:api-token")}`);
    });

    test("uses a valid OAuth access token directly", async () => {
        await writeBitbucketOAuthCredential({ accessToken: "oauth-access", refreshToken: "oauth-refresh", expiresAt: Date.now() + 60_000 });
        const mock = mockFetch({ [`${API}/user/workspaces`]: { values: [] } });
        restore = mock.restore;

        expect(await bitbucketClient.listRepositories()).toEqual([]);
        expect(mock.requests.map((request) => request.headers.get("Authorization"))).toEqual(["Bearer oauth-access"]);
    });

    test("refreshes an expired OAuth token and stores the rotated refresh token", async () => {
        await writeBitbucketOAuthCredential({ accessToken: "expired-access", refreshToken: "old-refresh", expiresAt: Date.now() - 1 });
        const mock = mockFetch({
            "POST /api/auth/bitbucket/refresh": { accessToken: "fresh-access", refreshToken: "rotated-refresh", expiresAt: Date.now() + 3_600_000 },
            [`${API}/user/workspaces`]: { values: [] },
        });
        restore = mock.restore;

        expect(await bitbucketClient.listRepositories()).toEqual([]);
        expect(mock.requests[0]?.url.pathname).toBe("/api/auth/bitbucket/refresh");
        expect(mock.requests[1]?.headers.get("Authorization")).toBe("Bearer fresh-access");
        const stored = readBitbucketAuthCredential();
        expect(stored && "accessToken" in stored ? [stored.accessToken, stored.refreshToken] : []).toEqual(["fresh-access", "rotated-refresh"]);
    });

    test("retries once with a refreshed token when the API rejects the current one", async () => {
        await writeBitbucketOAuthCredential({ accessToken: "revoked", refreshToken: "refresh", expiresAt: Date.now() + 60_000 });
        const mock = mockFetch({
            "POST /api/auth/bitbucket/refresh": { accessToken: "fresh", refreshToken: "refresh-2" },
            [`${API}/user/workspaces`]: ({ init }: { init: RequestInit }) =>
                new Headers(init.headers).get("Authorization") === "Bearer fresh" ? { values: [] } : new Response("expired", { status: 401 }),
        });
        restore = mock.restore;

        expect(await bitbucketClient.listRepositories()).toEqual([]);
        expect(mock.requests.map((request) => request.url.pathname)).toEqual([
            `${API}/user/workspaces`,
            "/api/auth/bitbucket/refresh",
            `${API}/user/workspaces`,
        ]);
    });
});

describe("Bitbucket repositories", () => {
    test("lists repositories across paged workspaces, deduplicated and sorted", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const repo = (workspace: string, slug: string, name: string) => ({ name, full_name: `${workspace}/${slug}`, slug, workspace: { slug: workspace } });
        const mock = mockFetch({
            [`${API}/user/workspaces`]: paged([{ workspace: { slug: "tools" } }], [{ workspace: { slug: "acme" } }]),
            [`${API}/repositories/acme`]: paged([repo("acme", "web", "Web")], [repo("acme", "api", "API"), repo("acme", "web", "Web")]),
            [`${API}/repositories/tools`]: paged([repo("tools", "build", "Build")]),
        });
        restore = mock.restore;

        expect(await bitbucketClient.listRepositories()).toEqual([
            { host: "bitbucket", workspace: "acme", repo: "api", fullName: "acme/api", displayName: "API" },
            { host: "bitbucket", workspace: "acme", repo: "web", fullName: "acme/web", displayName: "Web" },
            { host: "bitbucket", workspace: "tools", repo: "build", fullName: "tools/build", displayName: "Build" },
        ]);
    });
});

describe("Bitbucket pull request data", () => {
    test("maps reviewers from requested reviewers plus participants who decided, and declines from activity", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const user = (id: string, name: string) => ({ account_id: id, display_name: name });
        const mock = mockFetch({
            [PR]: {
                id: 1,
                title: "Reviewers",
                state: "OPEN",
                reviewers: [user("reviewer-1", "Real Reviewer"), user("reviewer-2", "Requested Reviewer")],
                participants: [
                    { approved: true, state: "approved", user: user("reviewer-1", "Real Reviewer") },
                    { approved: false, state: "changes_requested", user: user("author-1", "Author Who Commented") },
                    { approved: false, state: "participated", user: user("bot-1", "Automation Bot") },
                    { approved: true, state: "approved", user: user("me", "Me") },
                ],
            },
            [`${PR}/comments`]: { values: [] },
            [`${PR}/activity`]: { values: [{ update: { state: "DECLINED", date: "2026-01-01T00:00:00Z", author: user("decliner-1", "Decliner") } }] },
            [`${API}/user`]: user("me", "Me"),
            [`${PR}/commits`]: { values: [] },
        });
        restore = mock.restore;

        const deferred = await bitbucketClient.fetchPullRequestDeferred({ prRef });
        expect(deferred.reviewers.map((reviewer) => [reviewer.displayName, reviewer.status, reviewer.requested])).toEqual([
            ["Author Who Commented", "changesRequested", false],
            ["Decliner", "declined", false],
            ["Me", "approved", false],
            ["Real Reviewer", "approved", true],
            ["Requested Reviewer", "pending", true],
        ]);
        expect(deferred.currentUserReviewStatus).toBe("approved");
        expect(deferred.history.map((event) => event.type)).toEqual(["closed"]);
    });

    test("keeps reviewers when optional activity, user and build requests fail, and maps inline comment ranges", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const mock = mockFetch({
            [PR]: { id: 1, title: "PR", state: "OPEN" },
            [`${PR}/comments`]: { values: [{ id: 5, content: { raw: "hello" }, inline: { path: "src/a.ts", to: 3, start_to: 1 } }] },
        });
        restore = mock.restore;

        const deferred = await bitbucketClient.fetchPullRequestDeferred({ prRef });
        const comments = await bitbucketClient.fetchPullRequestComments({ prRef });
        expect(comments.map((comment) => comment.inline)).toEqual([
            { path: "src/a.ts", to: 3, from: undefined, startTo: 1, startFrom: undefined, outdated: undefined },
        ]);
        expect(deferred.buildStatuses).toEqual([]);
        expect(deferred.currentUser).toBeUndefined();
    });

    test("sends ranged inline suggestions in Bitbucket's payload shape", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const mock = mockFetch({ [`POST ${PR}/comments`]: {} });
        restore = mock.restore;

        await bitbucketClient.createPullRequestComment({ prRef, content: "```suggestion\nnext()\n```", inline: { path: "src/a.ts", startTo: 4, to: 7 } });
        expect(mock.requests[0]?.body).toEqual({
            content: { raw: "```suggestion\nnext()\n```\n\n\u200c" },
            inline: { path: "src/a.ts", to: 7, start_to: 4 },
        });
    });

    test("requests a base-to-head commit range with Bitbucket's reversed revspec", async () => {
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const mock = mockFetch({
            [`${API}/repositories/acme/repo/diff/bbb22222..aaa11111`]: new Response("diff --git a/src/a.ts b/src/a.ts\n"),
            [`${API}/repositories/acme/repo/diffstat/bbb22222..aaa11111`]: {
                values: [{ status: "modified", new: { path: "src/a.ts" }, old: { path: "src/a.ts" }, lines_added: 3, lines_removed: 1 }],
            },
        });
        restore = mock.restore;

        const result = await bitbucketClient.fetchCommitRangeDiff({ prRef, baseCommitHash: "aaa11111", headCommitHash: "bbb22222" });
        expect(result.diff).toContain("diff --git");
        expect(result.diffstat).toEqual([{ status: "modified", new: { path: "src/a.ts" }, old: { path: "src/a.ts" }, linesAdded: 3, linesRemoved: 1 }]);
    });
});
