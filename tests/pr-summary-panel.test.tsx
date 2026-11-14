import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PullRequestSummaryPanel } from "../src/features/review/components/pr-summary-panel";
import { ReviewSummaryCommentComposer } from "../src/features/review/components/review-summary-comment-composer";
import type { CommentActions } from "../src/features/review/model/comment-actions";
import type { PullRequestBundle } from "../src/lib/git-host/types";

function addCommentButtonTag(html: string) {
    const start = html.lastIndexOf("<button", html.indexOf("Add comment"));
    return html.slice(start, html.indexOf(">", start) + 1);
}

const actions: CommentActions = {
    canReply: false,
    canResolve: false,
    nestedReplies: true,
    pending: { create: false, resolve: false, update: false, remove: false },
    reply: () => undefined,
    edit: () => undefined,
    remove: () => undefined,
    resolve: () => {},
};

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
    reviewers: [],
    buildStatuses: [],
    currentUserReviewStatus: "none",
};

describe("pull request summary comment header", () => {
    test("renders the file path as a link separate from the copy button", () => {
        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={bundle} actions={actions} onSelectComment={() => {}} />);

        expect(html).toContain('href="#/src/example.ts?comment=42"');
        expect(html).toContain('aria-label="Open comment on src/example.ts"');
        expect(html).toContain('aria-label="Copy comment link"');
        expect(html.split('aria-label="Copy comment link"').length - 1).toBe(1);
        expect(html.indexOf("<a") >= 0).toBe(true);
        expect(html.indexOf("</a>") < html.indexOf('aria-label="Copy comment link"')).toBe(true);
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
            <PullRequestSummaryPanel bundle={activityBundle} actions={actions} headerTitle="Test pull request" composer={<div>Comment composer</div>} />,
        );

        expect(html.indexOf('data-component="summary-description"') < html.indexOf('data-component="summary-timeline"')).toBe(true);
        expect(html.indexOf("Comment composer") > html.indexOf('data-component="summary-timeline"')).toBe(true);
        expect(html.indexOf("Comment composer") < html.indexOf("Thread moved by reply")).toBe(true);
        expect(html.indexOf("Thread moved by reply") < html.indexOf("Newer activity")).toBe(true);
        expect(html.indexOf("Newer activity") < html.indexOf("Standalone thread")).toBe(true);
        expect(html.indexOf("Standalone thread") < html.indexOf("Older activity")).toBe(true);
        expect(html.indexOf("Older activity") < html.indexOf("opened the pull request")).toBe(true);
        expect(html.split("Thread moved by reply").length - 1).toBe(1);
        expect(html.split("Fresh reply").length - 1).toBe(1);
        expect(html.indexOf('data-component="summary-header"') < html.indexOf("Test pull request")).toBe(true);
    });

    test("shows review bodies and names the actor of events without a body", () => {
        const historyBundle: PullRequestBundle = {
            ...bundle,
            comments: [],
            history: [
                { id: "review", type: "changesRequested", createdAt: "2026-01-02T00:00:00Z", actor: { displayName: "Critic" }, content: "Please split this" },
                { id: "request", type: "reviewRequested", createdAt: "2026-01-03T00:00:00Z", actor: { displayName: "Requester" }, details: "reviewer" },
            ],
        };

        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={historyBundle} actions={actions} />);

        expect(html).toContain("Please split this");
        expect(html).toContain("Critic");
        expect(html).toContain("Requester");
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

        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={headingBundle} actions={actions} />);

        expect(html).toContain('<h4 class="text-sm font-bold">Fourth level</h4>');
        expect(html).toContain('<h5 class="text-[13px] font-bold">Fifth level</h5>');
    });

    test("renders the composer collapsed to an add comment button at the top of the timeline", () => {
        const composer = (canComment: boolean) => (
            <PullRequestSummaryPanel
                bundle={bundle}
                actions={actions}
                composer={<ReviewSummaryCommentComposer canComment={canComment} isSubmitting={false} onSubmit={() => false} />}
            />
        );

        const html = renderToStaticMarkup(composer(true));
        expect(html).toContain("Add comment");
        expect(html).not.toContain("Add your comment here");
        expect(html.indexOf("Add comment") < html.indexOf("opened the pull request")).toBe(true);
        expect(addCommentButtonTag(html)).not.toContain('disabled=""');
        expect(addCommentButtonTag(renderToStaticMarkup(composer(false)))).toContain('disabled=""');
    });
});
