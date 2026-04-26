import { afterEach, describe, expect, test } from "bun:test";
import {
    clearBitbucketAuthCredential,
    clearGithubAuthCredential,
    writeBitbucketAuthCredential,
    writeGithubAuthCredential,
} from "../src/lib/data/query-collections";
import { bitbucketClient } from "../src/lib/git-host/providers/bitbucket";
import { githubClient } from "../src/lib/git-host/providers/github";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    clearGithubAuthCredential();
    clearBitbucketAuthCredential();
});

describe("commit range diff providers", () => {
    test("GitHub compare endpoint maps diff and diffstat", async () => {
        writeGithubAuthCredential({ token: "token" });
        const calls = [];
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const headers = init.headers ?? {};
            calls.push({ url, headers });
            const accept = typeof headers === "object" ? (headers.Accept ?? headers.accept) : undefined;
            if (!url.includes("/compare/aaa11111...bbb22222")) {
                return new Response("Not found", { status: 404 });
            }
            if (accept === "application/vnd.github.v3.diff") {
                return new Response("diff --git a/src/a.ts b/src/a.ts\n", { status: 200 });
            }
            return Response.json({
                files: [
                    {
                        status: "modified",
                        filename: "src/a.ts",
                        previous_filename: "src/a.ts",
                        additions: 5,
                        deletions: 2,
                    },
                ],
                commits: [{ sha: "bbb22222" }],
            });
        };

        const result = await githubClient.fetchPullRequestCommitRangeDiff({
            prRef: { host: "github", workspace: "acme", repo: "repo", pullRequestId: "1" },
            baseCommitHash: "aaa11111",
            headCommitHash: "bbb22222",
            selectedCommitHashes: ["bbb22222"],
        });

        expect(calls.length).toBe(2);
        expect(calls[0]?.url).toContain("https://api.github.com/repos/acme/repo/compare/aaa11111...bbb22222");
        expect(result.diff).toContain("diff --git");
        expect(result.diffstat).toEqual([
            {
                status: "modified",
                new: { path: "src/a.ts" },
                old: { path: "src/a.ts" },
                linesAdded: 5,
                linesRemoved: 2,
            },
        ]);
    });

    test("Bitbucket revspec endpoints map diff and diffstat for selected range", async () => {
        writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const calls = [];
        globalThis.fetch = async (input) => {
            const url = String(input);
            calls.push(url);
            if (url.includes("/diffstat/bbb22222..aaa11111?")) {
                return Response.json({
                    values: [
                        {
                            status: "modified",
                            new: { path: "src/a.ts" },
                            old: { path: "src/a.ts" },
                            lines_added: 3,
                            lines_removed: 1,
                        },
                    ],
                });
            }
            if (url.includes("/diff/bbb22222..aaa11111")) {
                return new Response("diff --git a/src/a.ts b/src/a.ts\n", { status: 200 });
            }
            return new Response("Not found", { status: 404 });
        };

        const result = await bitbucketClient.fetchPullRequestCommitRangeDiff({
            prRef: { host: "bitbucket", workspace: "acme", repo: "repo", pullRequestId: "1" },
            baseCommitHash: "aaa11111",
            headCommitHash: "bbb22222",
            selectedCommitHashes: ["bbb22222"],
        });

        expect(calls.some((url) => url.includes("/diff/bbb22222..aaa11111"))).toBeTrue();
        expect(calls.some((url) => url.includes("/diffstat/bbb22222..aaa11111?pagelen=100"))).toBeTrue();
        expect(result.diffstat).toEqual([
            {
                status: "modified",
                new: { path: "src/a.ts" },
                old: { path: "src/a.ts" },
                linesAdded: 3,
                linesRemoved: 1,
            },
        ]);
    });
});

describe("Bitbucket repository listing", () => {
    test("lists repositories via workspace-scoped endpoints", async () => {
        writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        const calls = [];
        globalThis.fetch = async (input) => {
            const url = String(input);
            calls.push(url);

            if (url === "https://api.bitbucket.org/2.0/user/workspaces?pagelen=100") {
                return Response.json({
                    values: [{ workspace: { slug: "acme" } }],
                    next: "https://api.bitbucket.org/2.0/user/workspaces?page=2&pagelen=100",
                });
            }
            if (url === "https://api.bitbucket.org/2.0/user/workspaces?page=2&pagelen=100") {
                return Response.json({
                    values: [{ workspace: { slug: "tools" } }],
                });
            }
            if (url === "https://api.bitbucket.org/2.0/repositories/acme?role=member&pagelen=100") {
                return Response.json({
                    values: [
                        {
                            name: "API",
                            full_name: "acme/api",
                            slug: "api",
                            workspace: { slug: "acme" },
                        },
                    ],
                    next: "https://api.bitbucket.org/2.0/repositories/acme?page=2&role=member&pagelen=100",
                });
            }
            if (url === "https://api.bitbucket.org/2.0/repositories/acme?page=2&role=member&pagelen=100") {
                return Response.json({
                    values: [
                        {
                            name: "Web",
                            full_name: "acme/web",
                            slug: "web",
                            workspace: { slug: "acme" },
                        },
                    ],
                });
            }
            if (url === "https://api.bitbucket.org/2.0/repositories/tools?role=member&pagelen=100") {
                return Response.json({
                    values: [
                        {
                            name: "Build",
                            full_name: "tools/build",
                            slug: "build",
                            workspace: { slug: "tools" },
                        },
                    ],
                });
            }
            return new Response("Not found", { status: 404 });
        };

        const repositories = await bitbucketClient.listRepositories();

        expect(calls).toContain("https://api.bitbucket.org/2.0/user/workspaces?pagelen=100");
        expect(calls).toContain("https://api.bitbucket.org/2.0/user/workspaces?page=2&pagelen=100");
        expect(calls).toContain("https://api.bitbucket.org/2.0/repositories/acme?role=member&pagelen=100");
        expect(calls).toContain("https://api.bitbucket.org/2.0/repositories/acme?page=2&role=member&pagelen=100");
        expect(calls).toContain("https://api.bitbucket.org/2.0/repositories/tools?role=member&pagelen=100");
        expect(repositories).toEqual([
            {
                host: "bitbucket",
                workspace: "acme",
                repo: "api",
                fullName: "acme/api",
                displayName: "API",
            },
            {
                host: "bitbucket",
                workspace: "acme",
                repo: "web",
                fullName: "acme/web",
                displayName: "Web",
            },
            {
                host: "bitbucket",
                workspace: "tools",
                repo: "build",
                fullName: "tools/build",
                displayName: "Build",
            },
        ]);
    });

    test("deduplicates repositories by host and full name", async () => {
        writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "token" });
        globalThis.fetch = async (input) => {
            const url = String(input);

            if (url === "https://api.bitbucket.org/2.0/user/workspaces?pagelen=100") {
                return Response.json({
                    values: [{ workspace: { slug: "acme" } }],
                });
            }
            if (url === "https://api.bitbucket.org/2.0/repositories/acme?role=member&pagelen=100") {
                return Response.json({
                    values: [
                        {
                            name: "API",
                            full_name: "acme/api",
                            slug: "api",
                            workspace: { slug: "acme" },
                        },
                    ],
                    next: "https://api.bitbucket.org/2.0/repositories/acme?page=2&role=member&pagelen=100",
                });
            }
            if (url === "https://api.bitbucket.org/2.0/repositories/acme?page=2&role=member&pagelen=100") {
                return Response.json({
                    values: [
                        {
                            name: "API",
                            full_name: "acme/api",
                            slug: "api",
                            workspace: { slug: "acme" },
                        },
                    ],
                });
            }
            return new Response("Not found", { status: 404 });
        };

        const repositories = await bitbucketClient.listRepositories();

        expect(repositories).toEqual([
            {
                host: "bitbucket",
                workspace: "acme",
                repo: "api",
                fullName: "acme/api",
                displayName: "API",
            },
        ]);
    });
});
