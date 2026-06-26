import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PullRequestSummaryPanel } from "../src/components/pr-summary-panel";
import type { PullRequestBundle } from "../src/lib/git-host/types";

const bundle: PullRequestBundle = {
    prRef: {
        host: "bitbucket",
        workspace: "workspace",
        repo: "repo",
        pullRequestId: "1",
    },
    pr: {
        id: 1,
        title: "Test pull request",
        description: "",
        state: "OPEN",
        createdAt: "2026-01-01T00:00:00Z",
    },
    diff: "",
    diffstat: [],
    commits: [],
    comments: [
        {
            id: 42,
            createdAt: "2026-01-01T00:01:00Z",
            content: { raw: "Inline comment" },
            user: { displayName: "Reviewer" },
            inline: { path: "src/example.ts", to: 12 },
        },
    ],
    history: [],
};

describe("pull request summary comment header", () => {
    test("renders the file path as a link separate from the copy button", () => {
        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={bundle} onSelectComment={() => {}} />);

        expect(html).toContain('href="#/src/example.ts?comment=42"');
        expect(html).toContain('aria-label="Open comment on src/example.ts"');
        expect(html).toContain("cursor-pointer");
        expect(html).toContain('aria-label="Copy comment link"');
        expect(html.split('aria-label="Copy comment link"').length - 1).toBe(1);
        expect(html.indexOf("<a") >= 0).toBe(true);
        expect(html.indexOf("</a>") < html.indexOf('aria-label="Copy comment link"')).toBe(true);
        expect(html).toContain('class="relative border border-comment-border bg-comment"');
        expect(html).toContain('class="border-b border-comment-border" data-component="thread-card-header"');
        expect(html).toContain('class="pointer-events-none flex size-4 shrink-0 items-center justify-center"');
        expect(html).toContain("size-3.5");
        expect(html).toContain("size-[15px]");
    });

    test("renders the description above a newest-first timeline with each comment thread once", () => {
        const activityBundle: PullRequestBundle = {
            ...bundle,
            pr: {
                ...bundle.pr,
                description: "Pull request description",
                author: { displayName: "Author", avatarUrl: "https://example.com/author.png" },
            },
            comments: [
                {
                    id: 100,
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-02T00:00:00Z",
                    content: { raw: "Thread moved by reply" },
                    user: { displayName: "Reviewer" },
                    inline: { path: "src/thread.ts", to: 10 },
                },
                {
                    id: 101,
                    createdAt: "2026-01-03T00:00:00Z",
                    updatedAt: "2026-04-01T00:00:00Z",
                    content: { raw: "Fresh reply" },
                    user: { displayName: "Author" },
                    parent: { id: 100 },
                },
                {
                    id: 200,
                    createdAt: "2026-03-01T00:00:00Z",
                    updatedAt: "2026-03-01T00:00:00Z",
                    content: { raw: "Standalone thread" },
                    user: { displayName: "Reviewer" },
                    inline: { path: "src/standalone.ts", to: 20 },
                },
            ],
            history: [
                {
                    id: "approved-older",
                    type: "approved",
                    createdAt: "2026-02-01T00:00:00Z",
                    actor: { displayName: "Older activity" },
                },
                {
                    id: "approved-newer",
                    type: "approved",
                    createdAt: "2026-03-15T00:00:00Z",
                    actor: { displayName: "Newer activity" },
                },
            ],
        };

        const html = renderToStaticMarkup(
            <PullRequestSummaryPanel bundle={activityBundle} headerTitle="Test pull request" footerRight={<div>Comment composer</div>} />,
        );

        expect(html.indexOf('data-component="summary-description"') < html.indexOf('data-component="summary-timeline"')).toBe(true);
        expect(html.indexOf("Comment composer") > html.indexOf('data-component="summary-timeline"')).toBe(true);
        expect(html.indexOf("Thread moved by reply") < html.indexOf("Newer activity")).toBe(true);
        expect(html.indexOf("Newer activity") < html.indexOf("Standalone thread")).toBe(true);
        expect(html.indexOf("Standalone thread") < html.indexOf("Older activity")).toBe(true);
        expect(html.indexOf("Older activity") < html.indexOf("opened the pull request")).toBe(true);
        expect(html.split("Thread moved by reply").length - 1).toBe(1);
        expect(html.split("Fresh reply").length - 1).toBe(1);
        expect(html).toContain(
            'data-component="summary-header"><img src="https://example.com/author.png" alt="Author" class="size-5 rounded-full object-cover shrink-0"/><span class="min-w-0 flex-1 text-foreground truncate">Test pull request</span>',
        );
        expect(html).toContain('class="min-w-0 px-2 py-1" data-component="summary-description"><div class="space-y-2 text-[13px] leading-relaxed">');
        expect(html).toContain('class="mt-4 space-y-0 px-1" data-component="summary-timeline"');
        expect(html).toContain('class="relative grid grid-cols-[16px_minmax(0,1fr)] gap-[14px] pb-3"');
    });

    test("renders fourth- and fifth-level markdown headings in bold", () => {
        const headingBundle: PullRequestBundle = {
            ...bundle,
            pr: {
                ...bundle.pr,
                description: "#### Fourth level\n\n##### Fifth level",
            },
            comments: [],
        };

        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={headingBundle} />);

        expect(html).toContain('<h4 class="text-sm font-bold">Fourth level</h4>');
        expect(html).toContain('<h5 class="text-[13px] font-bold">Fifth level</h5>');
    });
});
