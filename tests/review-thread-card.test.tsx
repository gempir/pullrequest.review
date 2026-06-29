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
                deleteCommentPending={false}
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
        expect(html).toContain('data-thread-depth="1" style="margin-left:38px"');
        expect(html).toContain('data-thread-depth="2" style="margin-left:38px"');
        expect(html).toContain('class="relative border-y border-r border-comment-border bg-comment"');
    });

    test("collapses resolved threads behind an accessible toggle", () => {
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
                deleteCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html).toContain('aria-label="Expand resolved thread"');
        expect(html).toContain('aria-label="Unresolve thread"');
    });

    test("renders host emoji images at text size", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread({
                    root: {
                        ...buildThread().root,
                        comment: {
                            ...buildThread().root.comment,
                            content: {
                                html: '<p>Looks good <img src="https://bitbucket.example/emojis/thumbsup.png" alt=":thumbsup:"></p>',
                            },
                        },
                    },
                })}
                canResolveThread
                canCommentInline
                createCommentPending={false}
                resolveCommentPending={false}
                deleteCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html).toContain("size-[1.25em]");
        expect(html).toContain("object-contain");
    });

    test("renders share links after comment dates for file threads", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread()}
                canResolveThread
                canCommentInline
                createCommentPending={false}
                resolveCommentPending={false}
                deleteCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html.split('aria-label="Copy comment link"').length - 1).toBe(3);
        expect(html.indexOf("2026-01-01") < html.indexOf('aria-label="Copy comment link"')).toBe(true);
    });

    test("shows a spinner without actions for pending comments", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread({
                    root: {
                        ...buildThread().root,
                        comment: {
                            ...buildThread().root.comment,
                            pending: true,
                        },
                        children: [],
                    },
                })}
                canResolveThread
                canCommentInline
                createCommentPending={false}
                resolveCommentPending={false}
                deleteCommentPending={false}
                currentUserDisplayName="Root User"
                onDeleteComment={() => {}}
                onResolveThread={() => {}}
                onReplyToThread={() => {}}
                onEditComment={() => {}}
                updateCommentPending={false}
            />,
        );

        expect(html).toContain('aria-label="Syncing comment"');
        expect(html.includes("Sending...")).toBe(false);
        expect(html.includes(">Reply<")).toBe(false);
        expect(html.includes(">Edit<")).toBe(false);
        expect(html.includes(">Delete<")).toBe(false);
    });
});
