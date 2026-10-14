import { describe, expect, test } from "bun:test";
import { buildGroupedPullRequests, buildSortedRootPullRequests } from "../src/features/landing/model/landing-model.ts";

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

    test("excludes pull requests from repositories that are not selected", () => {
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
        const grouped = buildGroupedPullRequests(
            [
                {
                    host: "github",
                    repo: reposByHost.github[0],
                    pullRequest: { id: 12, title: "Improve review UX", author: { displayName: "Ada" } },
                },
                {
                    host: "github",
                    repo: { host: "github", workspace: "elsewhere", repo: "other", fullName: "elsewhere/other", displayName: "other" },
                    pullRequest: { id: 13, title: "Unselected" },
                },
            ],
            reposByHost,
        );
        expect(grouped).toHaveLength(1);
        expect(grouped[0].pullRequests.map((pullRequest) => pullRequest.id)).toEqual([12]);
        expect(buildGroupedPullRequests([], reposByHost)).toEqual([]);
    });
});
