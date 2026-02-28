import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreadCard } from "../src/components/pull-request-review/review-thread-card";
import type { CommentThread } from "../src/components/pull-request-review/review-threads";

function buildThread(overrides?: Partial<CommentThread>): CommentThread {
    return {
        id: 100,
        root: {
            comment: {
                id: 100,
                createdAt: "2026-01-01T00:00:00Z",
                content: { raw: "root" },
                user: { displayName: "Root User" },
                inline: { path: "src/file.ts", to: 10 },
            },
            children: [
                {
                    comment: {
                        id: 200,
                        createdAt: "2026-01-01T00:01:00Z",
                        content: { raw: "reply L2" },
                        user: { displayName: "Reply User" },
                        parent: { id: 100 },
                    },
                    children: [
                        {
                            comment: {
                                id: 300,
                                createdAt: "2026-01-01T00:02:00Z",
                                content: { raw: "reply L3" },
                                user: { displayName: "Reply User" },
                                parent: { id: 200 },
                            },
                            children: [],
                        },
                    ],
                },
            ],
        },
        ...overrides,
    };
}

describe("thread card", () => {
    test("renders nested replies recursively", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread()}
                canResolveThread
                canCommentInline
                createCommentPending={false}
                resolveCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html).toContain("reply L2");
        expect(html).toContain("reply L3");
    });

    test("includes descendant count when collapsed", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread({
                    root: {
                        ...buildThread().root,
                        comment: {
                            ...buildThread().root.comment,
                            resolution: {
                                user: { displayName: "Resolver" },
                            },
                        },
                    },
                })}
                canResolveThread
                canCommentInline
                createCommentPending={false}
                resolveCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html).toContain("Show resolved thread");
        expect(html).toContain("(3 comments)");
    });
});
