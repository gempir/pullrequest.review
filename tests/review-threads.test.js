import { describe, expect, test } from "bun:test";
import {
    buildCommentThreads,
    flattenThread,
    normalizeCommentThread,
    normalizeCommentThreads,
    sortThreadsByCreatedAt,
    threadCommentCount,
} from "../src/components/pull-request-review/review-threads";

describe("review thread ordering", () => {
    test("sorts thread lists immutably", () => {
        const original = [
            { id: 2, root: { comment: { createdAt: "2026-01-02T00:00:00Z" }, children: [] } },
            { id: 1, root: { comment: { createdAt: "2026-01-01T00:00:00Z" }, children: [] } },
        ];

        const sorted = sortThreadsByCreatedAt(original);

        expect(sorted.map((thread) => thread.id)).toEqual([1, 2]);
        expect(original.map((thread) => thread.id)).toEqual([2, 1]);
        expect(sorted).not.toBe(original);
    });

    test("builds nested replies in chronological order", () => {
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
            {
                id: 303,
                createdAt: "2026-01-01T02:00:00Z",
                parent: { id: 301 },
            },
        ];

        const threads = buildCommentThreads(comments);

        expect(threads.map((thread) => thread.id)).toEqual([200, 100]);
        expect(threads[0]?.root.children.map((reply) => reply.comment.id)).toEqual([302, 301]);
        expect(threads[0]?.root.children[1]?.children.map((reply) => reply.comment.id)).toEqual([303]);
        expect(flattenThread(threads[0] ?? { root: { comment: { id: 0 }, children: [] } })).toEqual([comments[1], comments[3], comments[2], comments[4]]);
        expect(threadCommentCount(threads[0])).toBe(4);
    });

    test("treats missing parents as roots", () => {
        const comments = [
            { id: 10, createdAt: "2026-01-01T00:00:00Z", parent: { id: 999 } },
            { id: 20, createdAt: "2026-01-02T00:00:00Z" },
        ];

        const threads = buildCommentThreads(comments);

        expect(threads.map((thread) => thread.id)).toEqual([10, 20]);
    });

    test("guards against parent cycles", () => {
        const comments = [
            { id: 1, createdAt: "2026-01-01T00:00:00Z", parent: { id: 2 } },
            { id: 2, createdAt: "2026-01-01T00:01:00Z", parent: { id: 1 } },
            { id: 3, createdAt: "2026-01-01T00:02:00Z" },
        ];

        const threads = buildCommentThreads(comments);

        expect(threads.map((thread) => thread.id)).toEqual([3]);
        expect(flattenThread(threads[0]).map((comment) => comment.id)).toEqual([3]);
    });

    test("normalizes legacy root+replies thread shape", () => {
        const normalized = normalizeCommentThread({
            id: 10,
            root: { id: 10, createdAt: "2026-01-01T00:00:00Z" },
            replies: [{ id: 11, createdAt: "2026-01-01T00:01:00Z" }],
        });

        expect(normalized?.root.comment.id).toBe(10);
        expect(normalized?.root.children.map((child) => child.comment.id)).toEqual([11]);
    });

    test("normalizes mixed thread arrays and drops invalid entries", () => {
        const normalized = normalizeCommentThreads([
            {
                id: 20,
                root: {
                    comment: { id: 20, createdAt: "2026-01-01T00:00:00Z" },
                    children: [],
                },
            },
            {
                id: 30,
                root: { id: 30, createdAt: "2026-01-01T00:00:00Z" },
                replies: [{ id: 31, createdAt: "2026-01-01T00:02:00Z" }],
            },
            null,
            { id: 40 },
        ]);

        expect(normalized.map((thread) => thread.id)).toEqual([20, 30]);
        expect(normalized[1]?.root.children[0]?.comment.id).toBe(31);
    });
});
