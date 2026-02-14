import { describe, expect, test } from "bun:test";
import { buildCommentThreads, sortThreadsByCreatedAt } from "../src/components/pull-request-review/review-threads";

describe("review thread ordering", () => {
    test("sorts thread lists immutably", () => {
        const original = [
            { id: 2, root: { createdAt: "2026-01-02T00:00:00Z" }, replies: [] },
            { id: 1, root: { createdAt: "2026-01-01T00:00:00Z" }, replies: [] },
        ];

        const sorted = sortThreadsByCreatedAt(original);

        expect(sorted.map((thread) => thread.id)).toEqual([1, 2]);
        expect(original.map((thread) => thread.id)).toEqual([2, 1]);
        expect(sorted).not.toBe(original);
    });

    test("builds roots and replies in chronological order", () => {
        const comments = [
            { id: 100, createdAt: "2026-01-02T00:00:00Z" },
            { id: 200, createdAt: "2026-01-01T00:00:00Z" },
            {
                id: 301,
                createdAt: "2026-01-01T01:00:00Z",
                parent: { id: 200 },
            },
            {
                id: 302,
                createdAt: "2026-01-01T00:30:00Z",
                parent: { id: 200 },
            },
        ];

        const threads = buildCommentThreads(comments);

        expect(threads.map((thread) => thread.id)).toEqual([200, 100]);
        expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([302, 301]);
    });
});
