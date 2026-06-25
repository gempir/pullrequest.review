import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeNavbarState } from "../src/components/pull-request-review/review-formatters";
import { ReviewTopNavbar } from "../src/components/pull-request-review/review-top-navbar";

function renderNavbar(navbarState: string, isDraft = false) {
    return renderToStaticMarkup(
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
        />,
    );
}

describe("review top navbar actions", () => {
    test("renders primary actions in the navbar with a labeled merge button", () => {
        const html = renderNavbar("OPEN", true);

        expect(html).toContain("Mark as Ready");
        expect(html).toContain("Approve");
        expect(html).toContain("Revise");
        expect(html).toContain('aria-label="Merge pull request"');
        expect(html).toContain("Merge</button>");
        expect(html).toContain('aria-label="Pull request actions"');
        expect(html.includes("[&amp;&gt;*+*]:border-l")).toBe(false);
        expect(html).toContain("border-status-renamed/45");
        expect(html).toContain("border-status-added/45");
        expect(html).toContain("border-status-modified/45");
        expect(html).toContain("border-status-merged/45");
        expect(html).toContain("h-full w-12 rounded-none pl-0 pr-0");
        expect(html.includes(">OPEN<")).toBe(false);
        expect(html.includes(">DRAFT<")).toBe(false);
    });

    test("shows a subdued labeled merge indicator for merged pull requests", () => {
        const html = renderNavbar("MERGED");

        expect(html.includes("Approve")).toBe(false);
        expect(html.includes("Revise")).toBe(false);
        expect(html.includes("Mark as Ready")).toBe(false);
        expect(html).toContain("border-status-merged/40 bg-status-merged/10 text-status-merged");
        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain("MERGED</button>");
    });

    for (const state of ["CLOSED", "DECLINED"]) {
        test(`shows a subdued labeled close indicator for ${state.toLowerCase()} pull requests`, () => {
            const html = renderNavbar(state);

            expect(html.includes("Approve")).toBe(false);
            expect(html.includes("Revise")).toBe(false);
            expect(html.includes("Mark as Ready")).toBe(false);
            expect(html.includes('aria-label="Merge pull request"')).toBe(false);
            expect(html).toContain('aria-label="Pull request closed"');
            expect(html).toContain("border-status-removed/40 bg-status-removed/10 text-status-removed");
            expect(html).toContain('aria-disabled="true"');
            expect(html).toContain('aria-label="Pull request actions"');
            expect(html).toContain(`${state}</button>`);
        });
    }

    test("preserves Bitbucket declined state when a pull request has closed", () => {
        expect(normalizeNavbarState({ state: "DECLINED", closedAt: "2026-06-25T10:00:00Z" })).toBe("declined");
        expect(normalizeNavbarState({ state: "CLOSED", closedAt: "2026-06-25T10:00:00Z" })).toBe("closed");
    });
});
