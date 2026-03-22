import { describe, expect, test } from "bun:test";
import {
    buildGroupedPullRequests,
    buildPullRequestsByRepo,
    buildPullRequestTree,
    buildSortedRootPullRequests,
    hostFromLandingTreePath,
} from "../src/features/landing/model/landing-model.ts";

describe("landing model", () => {
    test("groups and sorts pull requests by selected repositories", () => {
        const reposByHost = {
            bitbucket: [
                {
                    host: "bitbucket",
                    workspace: "acme",
                    repo: "ui",
                    fullName: "acme/ui",
                    displayName: "ui",
                },
            ],
            github: [],
        };
        const grouped = buildGroupedPullRequests(
            [
                {
                    host: "bitbucket",
                    repo: reposByHost.bitbucket[0],
                    repoKey: "bitbucket:acme/ui",
                    pullRequest: {
                        id: 2,
                        title: "Older",
                        updatedAt: "2024-01-01T00:00:00.000Z",
                    },
                },
                {
                    host: "bitbucket",
                    repo: reposByHost.bitbucket[0],
                    repoKey: "bitbucket:acme/ui",
                    pullRequest: {
                        id: 5,
                        title: "Newer",
                        updatedAt: "2024-02-01T00:00:00.000Z",
                    },
                },
            ],
            reposByHost,
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0].pullRequests.map((pullRequest) => pullRequest.id)).toEqual([5, 2]);

        const sorted = buildSortedRootPullRequests(grouped);
        expect(sorted.map((row) => row.pullRequest.id)).toEqual([5, 2]);
    });

    test("builds tree metadata and filters by query", () => {
        const reposByHost = {
            bitbucket: [],
            github: [
                {
                    host: "github",
                    workspace: "openai",
                    repo: "codex",
                    fullName: "openai/codex",
                    displayName: "codex",
                },
            ],
        };
        const pullRequestsByRepo = buildPullRequestsByRepo([
            {
                host: "github",
                repo: reposByHost.github[0],
                pullRequests: [
                    {
                        id: 12,
                        title: "Improve review UX",
                        author: { displayName: "Ada" },
                    },
                ],
            },
        ]);

        const tree = buildPullRequestTree(reposByHost, pullRequestsByRepo, "review");
        expect(tree.root).toHaveLength(2);
        expect(tree.pullRequestMeta.get("pr:github:openai:codex:12")).toEqual({
            host: "github",
            workspace: "openai",
            repo: "codex",
            pullRequestId: "12",
        });
    });

    test("detects host path prefixes", () => {
        expect(hostFromLandingTreePath("host:github")).toBe("github");
        expect(hostFromLandingTreePath("workspace:bitbucket:acme")).toBe("bitbucket");
        expect(hostFromLandingTreePath("repo:github:acme:ui")).toBeNull();
    });
});
