import { describe, expect, test } from "bun:test";
import { githubNormalization } from "../src/lib/git-host/providers/github/client";

describe("github comment normalization", () => {
    test("marks resolved GitHub review threads as resolved on the root comment", () => {
        const normalizedReviewComments = githubNormalization.normalizeGithubReviewCommentParents([
            {
                id: 10,
                created_at: "2026-01-01T00:00:00Z",
                body: "root",
                path: "src/file.ts",
                line: 12,
                side: "RIGHT",
            },
            {
                id: 11,
                created_at: "2026-01-01T00:01:00Z",
                body: "reply",
                path: "src/file.ts",
                line: 12,
                side: "RIGHT",
                in_reply_to_id: 10,
            },
        ]);

        const metadata = githubNormalization.buildGithubReviewThreadMetadata(normalizedReviewComments, [
            {
                id: "THREAD_1",
                isResolved: true,
                comments: {
                    nodes: [{ databaseId: 11 }],
                },
            },
        ]);

        const comments = githubNormalization.mergeIssueAndReviewComments([], normalizedReviewComments, metadata);
        const rootComment = comments.find((comment) => comment.id === 10);
        const replyComment = comments.find((comment) => comment.id === 11);

        expect(rootComment?.resolution).toEqual({});
        expect(rootComment?.hostThreadId).toBe("THREAD_1");
        expect(replyComment?.resolution).toBeUndefined();
    });

    test("leaves unresolved GitHub review threads unresolved", () => {
        const normalizedReviewComments = githubNormalization.normalizeGithubReviewCommentParents([
            {
                id: 20,
                created_at: "2026-01-01T00:00:00Z",
                body: "root",
                path: "src/file.ts",
                line: 20,
                side: "RIGHT",
            },
        ]);

        const metadata = githubNormalization.buildGithubReviewThreadMetadata(normalizedReviewComments, [
            {
                id: "THREAD_2",
                isResolved: false,
                comments: {
                    nodes: [{ databaseId: 20 }],
                },
            },
        ]);

        const comments = githubNormalization.mergeIssueAndReviewComments([], normalizedReviewComments, metadata);

        expect(comments[0]?.resolution).toBeUndefined();
        expect(comments[0]?.hostThreadId).toBe("THREAD_2");
    });

    test("maps current right-side suggestion ranges and keeps outdated comments out of the live source preview", () => {
        const comments = githubNormalization.mergeIssueAndReviewComments(
            [],
            [
                {
                    id: 30,
                    created_at: "2026-01-01T00:00:00Z",
                    body: "```suggestion\nreplacement\n```",
                    path: "src/file.ts",
                    start_line: 16,
                    start_side: "RIGHT",
                    line: 18,
                    side: "RIGHT",
                    position: 8,
                },
                {
                    id: 31,
                    created_at: "2026-01-01T00:01:00Z",
                    body: "```suggestion\nreplacement\n```",
                    path: "src/file.ts",
                    original_line: 22,
                    side: "RIGHT",
                    position: null,
                },
            ],
        );

        expect(comments[0]?.inline).toEqual({ path: "src/file.ts", to: 18, from: undefined, startTo: 16 });
        expect(comments[1]?.inline).toEqual({ path: "src/file.ts", to: 22, from: undefined, outdated: true });
    });
});
