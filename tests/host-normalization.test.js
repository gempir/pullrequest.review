import { describe, expect, test } from "bun:test";
import { bitbucketNormalization } from "../src/lib/git-host/providers/bitbucket";
import { githubNormalization } from "../src/lib/git-host/providers/github";

describe("Git host payload normalization", () => {
    test("normalizes GitHub summary payload into camelCase app model", () => {
        const summary = githubNormalization.mapPullRequestSummary({
            number: 42,
            title: "Refactor mappings",
            state: "open",
            html_url: "https://github.com/acme/repo/pull/42",
            user: {
                login: "octocat",
                avatar_url: "https://avatars.example/octocat.png",
            },
        });

        expect(summary).toEqual({
            id: 42,
            title: "Refactor mappings",
            state: "OPEN",
            links: { html: { href: "https://github.com/acme/repo/pull/42" } },
            author: {
                displayName: "octocat",
                avatarUrl: "https://avatars.example/octocat.png",
            },
        });
    });

    test("normalizes GitHub review request event to camelCase union", () => {
        const historyEvent = githubNormalization.mapIssueEventToHistory({
            id: 10,
            event: "review_requested",
            created_at: "2026-01-01T00:00:00Z",
            actor: { login: "author", avatar_url: "https://avatars.example/a.png" },
            requested_reviewer: {
                login: "reviewer",
                avatar_url: "https://avatars.example/r.png",
            },
        });

        expect(historyEvent?.type).toBe("reviewRequested");
        expect(historyEvent?.actor?.displayName).toBe("author");
        expect(historyEvent?.details).toBe("reviewer");
    });

    test("normalizes Bitbucket pull request payload into camelCase app model", () => {
        const details = bitbucketNormalization.mapPullRequest({
            id: 7,
            title: "Cleanup",
            state: "OPEN",
            comment_count: 5,
            task_count: 2,
            created_on: "2026-01-01T10:00:00Z",
            updated_on: "2026-01-01T11:00:00Z",
            closed_on: "2026-01-01T12:00:00Z",
            author: {
                display_name: "Bitbucket User",
                links: { avatar: { href: "https://avatars.example/bb.png" } },
            },
        });

        expect(details.commentCount).toBe(5);
        expect(details.taskCount).toBe(2);
        expect(details.createdAt).toBe("2026-01-01T10:00:00Z");
        expect(details.updatedAt).toBe("2026-01-01T11:00:00Z");
        expect(details.closedAt).toBe("2026-01-01T12:00:00Z");
        expect(details.author).toEqual({
            displayName: "Bitbucket User",
            avatarUrl: "https://avatars.example/bb.png",
        });
    });
});
