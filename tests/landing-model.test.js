import { describe, expect, test } from "bun:test";
import {
    buildGroupedPullRequests,
    buildInboxSections,
    buildSortedRootPullRequests,
    filterInboxRows,
    parsePullRequestUrl,
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

describe("inbox", () => {
    const row = (id, pullRequest = {}) => ({
        host: "github",
        repo: { host: "github", workspace: "acme", repo: "web", fullName: "acme/web", displayName: "web" },
        repoKey: "github:acme/web",
        pullRequest: { id, title: `PR ${id}`, state: "OPEN", ...pullRequest },
        updatedDateLabel: null,
        updatedAtTimestamp: 1_000,
    });
    const filters = { query: "", state: "all", author: "", repository: "", updatedWithinMs: null };

    test("groups pull requests by what they ask of the reader", () => {
        const sections = buildInboxSections([
            row(1, { reviewRequested: true }),
            row(2, { authoredByViewer: true }),
            row(3),
            row(4, { state: "MERGED", reviewRequested: true }),
        ]);

        expect(sections.map((section) => [section.id, section.rows.map((entry) => entry.pullRequest.id)])).toEqual([
            ["review", [1]],
            ["mine", [2]],
            ["open", [3]],
            ["closed", [4]],
        ]);
    });

    test("omits empty sections", () => {
        expect(buildInboxSections([row(3)]).map((section) => section.id)).toEqual(["open"]);
    });

    test("filters by state, author, repository, recency, and text", () => {
        const rows = [row(1, { author: { displayName: "ada" }, source: { branch: { name: "feat/springs" } } }), row(2, { state: "DECLINED" })];
        const ids = (next) => filterInboxRows(rows, { ...filters, ...next }, 2_000).map((entry) => entry.pullRequest.id);

        expect(ids({ state: "open" })).toEqual([1]);
        expect(ids({ state: "closed" })).toEqual([2]);
        expect(ids({ author: "ada" })).toEqual([1]);
        expect(ids({ repository: "other/repo" })).toEqual([]);
        expect(ids({ updatedWithinMs: 500 })).toEqual([]);
        expect(ids({ updatedWithinMs: 5_000 })).toEqual([1, 2]);
        expect(ids({ query: "SPRINGS" })).toEqual([1]);
        expect(ids({ query: "#2" })).toEqual([2]);
    });

    test("recognizes pasted pull request URLs by route shape", () => {
        expect(parsePullRequestUrl(" https://github.com/TanStack/query/pull/9615/files ")).toEqual({
            host: "github",
            workspace: "TanStack",
            repo: "query",
            pullRequestId: "9615",
        });
        expect(parsePullRequestUrl("bitbucket.org/team/app/pull-requests/12")).toEqual({
            host: "bitbucket",
            workspace: "team",
            repo: "app",
            pullRequestId: "12",
        });
        expect(parsePullRequestUrl("github.com/team/app/issues/12")).toBeNull();
        expect(parsePullRequestUrl("fix the bug")).toBeNull();
    });
});
