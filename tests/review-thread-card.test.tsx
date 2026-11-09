import { describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import type { CommentActions } from "@/features/review/model/comment-actions";
import type { CommentThread } from "@/features/review/model/review-threads";
import { buttonByText, typeInto, withDom } from "./support/dom";

function actions(overrides: Partial<CommentActions> = {}): CommentActions {
    return {
        currentUserDisplayName: "Root User",
        canReply: true,
        canResolve: true,
        nestedReplies: true,
        pending: { create: false, resolve: false, update: false, remove: false },
        reply: () => undefined,
        edit: () => undefined,
        remove: () => undefined,
        resolve: () => {},
        ...overrides,
    };
}

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
        const html = renderToStaticMarkup(<ThreadCard thread={buildThread()} actions={actions()} />);

        expect(html).toContain("reply L2");
        expect(html).toContain("reply L3");
        expect(html).toContain('data-thread-depth="1" style="margin-left:38px"');
        expect(html).toContain('data-thread-depth="2" style="margin-left:38px"');
    });

    test("keeps replies flat for hosts without nested replies", () => {
        const html = renderToStaticMarkup(<ThreadCard thread={buildThread()} actions={actions({ nestedReplies: false })} />);

        expect(html).toContain('data-thread-depth="2" style="margin-left:0"');
        expect(html.includes("margin-left:38px")).toBe(false);
    });

    test("offers resolve only on the root and edit or delete only on the viewer's own comments", () => {
        const html = renderToStaticMarkup(<ThreadCard thread={buildThread()} actions={actions()} />);

        expect(html.split(">Reply<").length - 1).toBe(3);
        expect(html.split(">Resolve<").length - 1).toBe(1);
        expect(html.split(">Edit<").length - 1).toBe(1);
        expect(html.split(">Delete<").length - 1).toBe(1);
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
                actions={actions()}
            />,
        );

        expect(html).toContain('aria-label="Expand resolved thread"');
        expect(html).not.toContain('aria-label="Unresolve thread"');
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
                actions={actions()}
            />,
        );

        expect(html).toContain("size-[1.25em]");
        expect(html).toContain("object-contain");
    });

    test("renders Bitbucket markdown images with layout attributes as external links", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread({
                    root: {
                        ...buildThread().root,
                        comment: {
                            ...buildThread().root.comment,
                            content: {
                                raw: "![](https://bitbucket.org/repo/z7q79RB/images/3370473039-image.png){: data-layout='center' }",
                            },
                        },
                    },
                })}
                actions={actions()}
            />,
        );

        expect(html).toContain('href="https://bitbucket.org/repo/z7q79RB/images/3370473039-image.png"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain("3370473039-image.png");
        expect(html.includes("data-layout")).toBe(false);
    });

    test("renders host html images as external links", () => {
        const html = renderToStaticMarkup(
            <ThreadCard
                thread={buildThread({
                    root: {
                        ...buildThread().root,
                        comment: {
                            ...buildThread().root.comment,
                            content: {
                                html: '<p><img src="https://example.com/screenshot.png" alt="Screenshot"></p>',
                            },
                        },
                    },
                })}
                actions={actions()}
            />,
        );

        expect(html).toContain('href="https://example.com/screenshot.png"');
        expect(html).toContain(">Screenshot</a>");
    });

    test("renders share links after comment dates for file threads", () => {
        const html = renderToStaticMarkup(<ThreadCard thread={buildThread()} actions={actions()} />);

        expect(html.split('aria-label="Copy comment link"').length - 1).toBe(3);
        expect(html.indexOf("tabular-nums")).toBeGreaterThan(-1);
        expect(html.indexOf("tabular-nums") < html.indexOf('aria-label="Copy comment link"')).toBe(true);
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
                actions={actions()}
            />,
        );

        expect(html).toContain('aria-label="Syncing comment"');
        expect(html.includes("Sending...")).toBe(false);
        expect(html.includes(">Reply<")).toBe(false);
        expect(html.includes(">Edit<")).toBe(false);
        expect(html.includes(">Delete<")).toBe(false);
    });

    test("keeps the parent comment's content and the reply buttons visible while a reply saves", async () => {
        await withDom(async ({ window, container, render }) => {
            let finishReply: () => void = () => {};
            const replies: Array<[number, string]> = [];
            const reply = (parentId: number, content: string) => {
                replies.push([parentId, content]);
                return new Promise<void>((resolve) => {
                    finishReply = resolve;
                });
            };
            await render(<ThreadCard thread={buildThread()} actions={actions({ reply })} />);

            await act(async () => buttonByText(container, "Reply").click());
            const textarea = container.querySelector("textarea");
            if (!textarea) throw new Error("Reply editor did not open");
            await typeInto(window, textarea, "on it");
            await act(async () => buttonByText(container, "Comment").click());

            expect(replies).toEqual([[100, "on it"]]);
            expect(container.querySelector('[aria-label="Syncing comment"]')).toBeNull();
            expect(buttonByText(container, "Comment").disabled).toBe(true);

            await act(async () => finishReply());
            expect(container.querySelector("textarea")).toBeNull();
        });
    });

    test("replies to the root comment when the host has no nested replies", async () => {
        await withDom(async ({ window, container, render }) => {
            const replies: number[] = [];
            await render(
                <ThreadCard
                    thread={buildThread()}
                    actions={actions({
                        nestedReplies: false,
                        reply: (parentId) => {
                            replies.push(parentId);
                            return undefined;
                        },
                    })}
                />,
            );

            const replyButtons = Array.from(container.querySelectorAll("button")).filter((button) => button.textContent === "Reply");
            await act(async () => replyButtons[2]?.click());
            const textarea = container.querySelector("textarea");
            if (!textarea) throw new Error("Reply editor did not open");
            await typeInto(window, textarea, "flat");
            await act(async () => buttonByText(container, "Comment").click());

            expect(replies).toEqual([100]);
        });
    });
});
