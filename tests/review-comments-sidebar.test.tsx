import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewCommentsSidebar } from "../src/components/pull-request-review/review-comments-sidebar";
import { ReviewCommentsSidebarItem } from "../src/components/pull-request-review/review-comments-sidebar-item";
import { ReviewCommentsSidebarPanel } from "../src/components/pull-request-review/review-comments-sidebar-panel";
import type { CommentThread } from "../src/components/pull-request-review/review-threads";
import type { ReviewSidebarThreadItem } from "../src/components/pull-request-review/use-review-page-derived";

function buildThread(): CommentThread {
    return {
        id: 100,
        root: {
            comment: {
                id: 100,
                createdAt: "2026-01-01T00:00:00Z",
                content: { raw: "Review the [docs](https://example.com/docs)." },
                user: { displayName: "Review User", avatarUrl: "https://example.com/avatar.png" },
                inline: { path: "src/file.ts", to: 10 },
            },
            children: [],
        },
    };
}

function buildItem(overrides?: Partial<ReviewSidebarThreadItem>): ReviewSidebarThreadItem {
    return {
        commentId: 100,
        isResolved: false,
        path: "src/file.ts",
        line: 10,
        replyCount: 0,
        thread: buildThread(),
        ...overrides,
    };
}

describe("review comments sidebar", () => {
    test("renders a labeled sidebar with leading header order and accessible filters", () => {
        const html = renderToStaticMarkup(
            <ReviewCommentsSidebar
                width={320}
                collapsed={false}
                unresolvedCount={1}
                threads={[buildItem()]}
                canResolveThread
                resolveCommentPending={false}
                onToggleCollapsed={() => {}}
                onStartResize={() => {}}
                onSelectThread={() => {}}
                onResolveThread={() => {}}
            />,
        );

        expect(html).toContain('aria-label="Review comments"');
        expect(html).toContain('aria-label="Collapse comments sidebar"');
        expect(html).toContain("<h2");
        expect(html).toContain(">Comments</h2>");
        expect(html).toContain("1 unresolved comment");
        expect(html.indexOf('aria-label="Collapse comments sidebar"')).toBeLessThan(html.indexOf(">Comments</h2>"));
        expect(html).toContain('aria-label="Show resolved comments"');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain('aria-label="Search review comments"');
        expect(html).toContain('placeholder="Search comments..."');
    });

    test("keeps thread content noninteractive while exposing separate open and resolve actions", () => {
        const html = renderToStaticMarkup(
            <ul>
                <ReviewCommentsSidebarItem item={buildItem()} canResolveThread resolveCommentPending={false} onOpen={() => {}} onResolveThread={() => {}} />
            </ul>,
        );

        expect(html).toContain("<li");
        expect(html).toContain('<article aria-label="Comment thread at src/file.ts:10"');
        expect(html).not.toContain('role="button"');
        expect(html).not.toContain('tabindex="0"');
        expect(html).toContain('aria-label="Open thread at src/file.ts:10"');
        expect(html).toContain('aria-label="Resolve thread"');
        expect(html).toContain('alt=""');
        expect(html).toContain('href="https://example.com/docs"');

        const openButtonStart = html.indexOf('aria-label="Open thread at src/file.ts:10"');
        const openButtonEnd = html.indexOf("</button>", openButtonStart);
        expect(html.indexOf('href="https://example.com/docs"')).toBeGreaterThan(openButtonEnd);
    });

    test("offers recovery actions for search and resolved-only empty states", () => {
        const searchHtml = renderToStaticMarkup(
            <ReviewCommentsSidebarPanel
                threads={[]}
                includeResolved={false}
                searchQuery="needle"
                hasResolvedThreads={false}
                canResolveThread
                resolveCommentPending={false}
                onClearSearch={() => {}}
                onShowResolved={() => {}}
                onSelectThread={() => {}}
                onResolveThread={() => {}}
            />,
        );
        expect(searchHtml).toContain("No matching comments");
        expect(searchHtml).toContain("No comments match &quot;needle&quot;.");
        expect(searchHtml).toContain("Clear search");

        const resolvedHtml = renderToStaticMarkup(
            <ReviewCommentsSidebarPanel
                threads={[]}
                includeResolved={false}
                searchQuery=""
                hasResolvedThreads
                canResolveThread
                resolveCommentPending={false}
                onClearSearch={() => {}}
                onShowResolved={() => {}}
                onSelectThread={() => {}}
                onResolveThread={() => {}}
            />,
        );
        expect(resolvedHtml).toContain("No unresolved comments");
        expect(resolvedHtml).toContain("Resolved threads are hidden.");
        expect(resolvedHtml).toContain("Show resolved comments");
    });
});
