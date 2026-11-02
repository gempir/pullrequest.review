import { describe, expect, test } from "bun:test";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewActionDock } from "@/features/review/components/review-action-dock";
import { ReviewTopNavbar } from "@/features/review/components/review-top-navbar";
import { normalizeNavbarState } from "@/features/review/model/review-formatters";
import type { PullRequestReviewer } from "../src/lib/git-host/types";
import { ShortcutsProvider } from "../src/lib/shortcuts-context";

const noop = () => {};

function renderNavbar(navbarState: string, reviewers?: PullRequestReviewer[]) {
    return renderToStaticMarkup(
        <ShortcutsProvider>
            <ReviewTopNavbar
                loading={false}
                isRefreshing={false}
                host="bitbucket"
                pullRequestUrl="https://bitbucket.example/pull-requests/1"
                sourceBranch="feature"
                destinationBranch="main"
                navbarState={navbarState}
                reviewers={reviewers}
                canDecline
                isDeclinePending={false}
                copiedSourceBranch={false}
                onCopySourceBranch={noop}
                onDecline={noop}
                onOpenOmnibar={noop}
            />
        </ShortcutsProvider>,
    );
}

function renderDock(navbarState: string, isDraft = false, overrides: Partial<ComponentProps<typeof ReviewActionDock>> = {}) {
    return renderToStaticMarkup(
        <ReviewActionDock
            navbarState={navbarState}
            canApprove
            canRequestChanges
            canMerge
            canMarkDraft
            isDraft={isDraft}
            currentUserReviewStatus="none"
            isApprovePending={false}
            isRequestChangesPending={false}
            isDeclinePending={false}
            isMarkDraftPending={false}
            onApprove={noop}
            onRequestChanges={noop}
            onMarkDraft={noop}
            onOpenMerge={noop}
            treeCollapsed={false}
            rightSidebarCollapsed
            unviewedFileCount={2}
            unresolvedCommentCount={3}
            totalFileCount={5}
            viewedFileCount={3}
            activeFileIndex={1}
            activeFileViewed={false}
            onToggleTree={noop}
            onToggleComments={noop}
            onPreviousFile={noop}
            onNextFile={noop}
            onToggleActiveFileViewed={noop}
            {...overrides}
        />,
    );
}

describe("review top navbar actions", () => {
    test("renders primary actions in the dock with a labeled merge button", () => {
        const html = renderDock("OPEN", true);

        expect(html).toContain("Mark as Ready");
        expect(html).toContain("Approve");
        expect(html).toContain("Revise");
        expect(html).toContain('aria-label="Merge pull request"');
        expect(html).toContain("Merge</button>");
    });

    test("keeps the pull request menu in the top capsule", () => {
        expect(renderNavbar("OPEN")).toContain('aria-label="Pull request actions"');
    });

    test("shows position, progress, and panel badges in the dock", () => {
        const html = renderDock("OPEN");

        expect(html).toContain("2 of 5");
        expect(html).toContain("Mark viewed");
        expect(html).toContain('title="3 of 5 files viewed"');
        expect(html).toContain('aria-label="Toggle file tree"');
        expect(html).toContain('aria-label="Toggle comments"');
    });

    test("shows overall progress and disables the viewed toggle on the summary", () => {
        const html = renderDock("OPEN", false, { activeFileIndex: null, activeFileViewed: null });

        expect(html).toContain("Summary");
        expect(html).toContain("3 of 5 viewed");
        expect(html).toMatch(/<button[^>]*disabled[^>]*title="3 of 5 files viewed"/);
    });

    test("shows reviewer decision avatars in the top capsule", () => {
        const html = renderNavbar("OPEN", [
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
    });

    test("does not scroll or fade the reviewer strip when it is not overflowing", () => {
        const html = renderNavbar("OPEN", [
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
        const html = renderDock("MERGED");

        expect(html.includes("Approve")).toBe(false);
        expect(html.includes("Revise")).toBe(false);
        expect(html.includes("Mark as Ready")).toBe(false);
        expect(html).toContain("bg-status-merged/14 text-status-merged");
        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain("Merged</button>");
    });

    for (const [state, label] of [
        ["CLOSED", "Closed"],
        ["DECLINED", "Declined"],
    ]) {
        test(`shows a subdued labeled close indicator for ${label.toLowerCase()} pull requests`, () => {
            const html = renderDock(state);

            expect(html.includes("Approve")).toBe(false);
            expect(html.includes("Revise")).toBe(false);
            expect(html.includes("Mark as Ready")).toBe(false);
            expect(html.includes('aria-label="Merge pull request"')).toBe(false);
            expect(html).toContain('aria-label="Pull request closed"');
            expect(html).toContain("bg-status-removed/14 text-status-removed");
            expect(html).toContain('aria-disabled="true"');
            expect(html).toContain(`${label}</button>`);
        });
    }

    test("preserves Bitbucket declined state when a pull request has closed", () => {
        expect(normalizeNavbarState({ state: "DECLINED", closedAt: "2026-06-25T10:00:00Z" })).toBe("declined");
        expect(normalizeNavbarState({ state: "CLOSED", closedAt: "2026-06-25T10:00:00Z" })).toBe("closed");
    });
});
