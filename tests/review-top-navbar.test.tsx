import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeNavbarState } from "../src/components/pull-request-review/review-formatters";
import { ReviewTopNavbar } from "../src/components/pull-request-review/review-top-navbar";
import type { PullRequestReviewer } from "../src/lib/git-host/types";
import { ShortcutsProvider } from "../src/lib/shortcuts-context";

function renderNavbar(navbarState: string, isDraft = false, reviewers?: PullRequestReviewer[]) {
    return renderToStaticMarkup(
        <ShortcutsProvider>
            <ReviewTopNavbar
                loading={false}
                isRefreshing={false}
                treeCollapsed={false}
                unviewedFileCount={0}
                rightSidebarCollapsed
                unresolvedCommentCount={0}
                host="bitbucket"
                pullRequestUrl="https://bitbucket.example/pull-requests/1"
                sourceBranch="feature"
                destinationBranch="main"
                navbarState={navbarState}
                reviewers={reviewers}
                canApprove
                canRequestChanges
                canMerge
                canDecline
                canMarkDraft
                isDraft={isDraft}
                currentUserReviewStatus="none"
                isApprovePending={false}
                isRequestChangesPending={false}
                isDeclinePending={false}
                isMarkDraftPending={false}
                copiedSourceBranch={false}
                onExpandTree={() => {}}
                onExpandRightSidebar={() => {}}
                onCopySourceBranch={() => {}}
                onApprove={() => {}}
                onRequestChanges={() => {}}
                onDecline={() => {}}
                onMarkDraft={() => {}}
                onOpenMerge={() => {}}
                onOpenOmnibar={() => {}}
            />
        </ShortcutsProvider>,
    );
}

describe("review top navbar actions", () => {
    test("renders primary actions in the navbar with a labeled merge button", () => {
        const html = renderNavbar("OPEN", true);

        expect(html).toContain("Mark ready");
        expect(html).toContain("Approve");
        expect(html).toContain("Request changes");
        expect(html).toContain('aria-label="Merge pull request"');
        expect(html).toContain(">Merge</span>");
        expect(html).toContain('aria-label="Pull request actions"');
        expect(html.includes("[&amp;&gt;*+*]:border-l")).toBe(false);
        expect(html).toContain('aria-label="Mark pull request as ready"');
        expect(html).toContain("text-status-added");
        expect(html).toContain("text-status-modified");
        expect(html).toContain("text-status-merged");
        expect(html).toContain("h-full w-12 rounded-none pl-0 pr-0");
        expect(html.includes(">OPEN<")).toBe(false);
        expect(html.includes(">DRAFT<")).toBe(false);
    });

    test("shows reviewer decision avatars before pull request action buttons", () => {
        const html = renderNavbar("OPEN", false, [
            {
                id: "reviewer-approved",
                displayName: "Ada Lovelace",
                avatarUrl: "https://example.test/ada.png",
                status: "approved",
                approved: true,
            },
            {
                id: "reviewer-changes",
                displayName: "Grace Hopper",
                status: "changesRequested",
                approved: false,
            },
            {
                id: "reviewer-pending",
                displayName: "Linus Torvalds",
                status: "pending",
                approved: false,
            },
            {
                id: "reviewer-commented",
                displayName: "Margaret Hamilton",
                status: "commented",
                approved: false,
            },
            {
                id: "reviewer-extra-1",
                displayName: "Katherine Johnson",
                status: "pending",
                approved: false,
            },
            {
                id: "reviewer-extra-2",
                displayName: "Barbara Liskov",
                status: "pending",
                approved: false,
            },
            {
                id: "reviewer-declined",
                displayName: "Donald Knuth",
                status: "declined",
                approved: false,
            },
        ]);

        expect(html).toContain('aria-label="Ada Lovelace approved"');
        expect(html).toContain('aria-label="Grace Hopper requested changes"');
        expect(html).toContain('aria-label="Linus Torvalds pending review"');
        expect(html).toContain('aria-label="Margaret Hamilton commented"');
        expect(html).toContain('aria-label="Barbara Liskov pending review"');
        expect(html).toContain('aria-label="Donald Knuth declined"');
        expect(html).toContain("https://example.test/ada.png");
        expect(html).toContain(">GH</span>");
        expect(html).toContain(">LT</span>");
        expect(html).toContain("max-w-[142px]");
        expect(html).toContain("overflow-x-auto");
        expect(html).toContain("[scrollbar-width:none]");
        expect(html).toContain("[&amp;::-webkit-scrollbar]:hidden");
        expect(html).toContain("[mask-image:linear-gradient(to_right,black_calc(100%-18px),transparent)]");
        expect(html.includes(">+1</span>")).toBe(false);
        expect(html).toContain("bg-status-added/15");
        expect(html).toContain("bg-status-removed/15");
        expect(html.indexOf('aria-label="Ada Lovelace approved"') < html.indexOf('aria-label="Approve pull request"')).toBe(true);
    });

    test("does not scroll or fade the reviewer strip when it is not overflowing", () => {
        const html = renderNavbar("OPEN", false, [
            {
                id: "reviewer-approved",
                displayName: "Ada Lovelace",
                status: "approved",
                approved: true,
            },
        ]);

        expect(html).toContain('aria-label="Ada Lovelace approved"');
        expect(html).toContain("overflow-visible");
        expect(html.includes("overflow-x-auto")).toBe(false);
        expect(html.includes("[scrollbar-width:none]")).toBe(false);
        expect(html.includes("[mask-image:linear-gradient(to_right,black_calc(100%-18px),transparent)]")).toBe(false);
    });

    test("shows a subdued labeled merge indicator for merged pull requests", () => {
        const html = renderNavbar("MERGED");

        expect(html.includes("Approve")).toBe(false);
        expect(html.includes("Request changes")).toBe(false);
        expect(html.includes("Mark ready")).toBe(false);
        expect(html).toContain("border-status-merged/40 bg-status-merged/12 text-status-merged");
        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain(">MERGED</span>");
    });

    for (const state of ["CLOSED", "DECLINED"]) {
        test(`shows a subdued labeled close indicator for ${state.toLowerCase()} pull requests`, () => {
            const html = renderNavbar(state);

            expect(html.includes("Approve")).toBe(false);
            expect(html.includes("Request changes")).toBe(false);
            expect(html.includes("Mark ready")).toBe(false);
            expect(html.includes('aria-label="Merge pull request"')).toBe(false);
            expect(html).toContain('aria-label="Pull request closed"');
            expect(html).toContain("border-status-removed/40 bg-status-removed/12 text-status-removed");
            expect(html).toContain('aria-disabled="true"');
            expect(html).toContain('aria-label="Pull request actions"');
            expect(html).toContain(`>${state}</span>`);
        });
    }

    test("preserves Bitbucket declined state when a pull request has closed", () => {
        expect(normalizeNavbarState({ state: "DECLINED", closedAt: "2026-06-25T10:00:00Z" })).toBe("declined");
        expect(normalizeNavbarState({ state: "CLOSED", closedAt: "2026-06-25T10:00:00Z" })).toBe("closed");
    });
});
