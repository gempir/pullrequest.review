import { describe, expect, spyOn, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { REVIEW_CLIPBOARD_ERROR_MESSAGES, useReviewClipboardActions } from "../src/components/pull-request-review/use-review-clipboard-actions";
import {
    getCreateCommentErrorMessage,
    getThreadResolutionErrorMessage,
    REVIEW_COMMENT_ERROR_MESSAGES,
} from "../src/components/pull-request-review/use-review-comment-actions";
import { getDraftStatusErrorMessage, REVIEW_DECISION_ERROR_MESSAGES } from "../src/components/pull-request-review/use-review-decision-actions";

describe("review action error copy", () => {
    test("uses action-specific recovery copy for comment failures", () => {
        expect(REVIEW_COMMENT_ERROR_MESSAGES).toEqual({
            postComment: "Unable to post comment. Try again.",
            postInlineComment: "Unable to post inline comment. Try again.",
            postReply: "Unable to post reply. Try again.",
            postSuggestions: "Unable to post suggestions. Try again.",
            resolveThread: "Unable to resolve thread. Try again.",
            unresolveThread: "Unable to unresolve thread. Try again.",
            saveComment: "Unable to save comment changes. Try again.",
            deleteComment: "Unable to delete comment. Try again.",
        });
        expect(getCreateCommentErrorMessage({ content: "Comment" })).toBe(REVIEW_COMMENT_ERROR_MESSAGES.postComment);
        expect(getCreateCommentErrorMessage({ path: "src/app.ts", content: "Comment" })).toBe(REVIEW_COMMENT_ERROR_MESSAGES.postInlineComment);
        expect(getCreateCommentErrorMessage({ parentId: 42, content: "Reply" })).toBe(REVIEW_COMMENT_ERROR_MESSAGES.postReply);
        expect(getThreadResolutionErrorMessage(true)).toBe(REVIEW_COMMENT_ERROR_MESSAGES.resolveThread);
        expect(getThreadResolutionErrorMessage(false)).toBe(REVIEW_COMMENT_ERROR_MESSAGES.unresolveThread);
    });

    test("uses action-specific recovery copy for review decisions", () => {
        expect(REVIEW_DECISION_ERROR_MESSAGES).toEqual({
            approve: "Unable to approve pull request. Try again.",
            removeApproval: "Unable to remove approval. Try again.",
            requestChanges: "Unable to request changes. Try again.",
            merge: "Unable to merge pull request. Try again.",
            decline: "Unable to decline pull request. Try again.",
            markReady: "Unable to mark pull request as ready. Try again.",
            markDraft: "Unable to mark pull request as draft. Try again.",
        });
        expect(getDraftStatusErrorMessage(true)).toBe(REVIEW_DECISION_ERROR_MESSAGES.markReady);
        expect(getDraftStatusErrorMessage(false)).toBe(REVIEW_DECISION_ERROR_MESSAGES.markDraft);
    });

    test("offers a recovery path for clipboard failures", () => {
        expect(REVIEW_CLIPBOARD_ERROR_MESSAGES).toEqual({
            copyPathUnavailable: "Unable to copy file path. Copy it manually.",
            copyPathFailed: "Unable to copy file path. Try again.",
            copyBranchUnavailable: "Unable to copy source branch. Copy it manually.",
            copyBranchFailed: "Unable to copy source branch. Try again.",
        });
    });

    test("keeps clipboard API details out of interface text", async () => {
        const surfacedErrors: Array<string | null> = [];
        let actions: ReturnType<typeof useReviewClipboardActions> | undefined;
        const consoleError = spyOn(console, "error").mockImplementation(() => {});

        function Harness() {
            actions = useReviewClipboardActions({
                copyResetTimeoutRef: { current: null },
                copySourceBranchResetTimeoutRef: { current: null },
                setActionError: (message) => surfacedErrors.push(message),
                setCopiedPath: () => {},
                setCopiedSourceBranch: () => {},
            });
            return null;
        }

        try {
            renderToStaticMarkup(createElement(Harness));
            await actions?.handleCopyPath("src/app.ts");
            await actions?.handleCopySourceBranch("feature/review-copy");

            expect(surfacedErrors).toEqual([REVIEW_CLIPBOARD_ERROR_MESSAGES.copyPathUnavailable, REVIEW_CLIPBOARD_ERROR_MESSAGES.copyBranchUnavailable]);
            expect(consoleError).toHaveBeenCalledTimes(2);
        } finally {
            consoleError.mockRestore();
        }
    });

    test("logs rejected clipboard details while surfacing recovery copy", async () => {
        const surfacedErrors: Array<string | null> = [];
        const technicalError = new Error("Clipboard permission denied by browser");
        const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
        const consoleError = spyOn(console, "error").mockImplementation(() => {});
        let actions: ReturnType<typeof useReviewClipboardActions> | undefined;

        function Harness() {
            actions = useReviewClipboardActions({
                copyResetTimeoutRef: { current: null },
                copySourceBranchResetTimeoutRef: { current: null },
                setActionError: (message) => surfacedErrors.push(message),
                setCopiedPath: () => {},
                setCopiedSourceBranch: () => {},
            });
            return null;
        }

        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async () => {
                    throw technicalError;
                },
            },
        });

        try {
            renderToStaticMarkup(createElement(Harness));
            await actions?.handleCopyPath("src/app.ts");

            expect(surfacedErrors).toEqual([REVIEW_CLIPBOARD_ERROR_MESSAGES.copyPathFailed]);
            expect(surfacedErrors).not.toContain(technicalError.message);
            expect(consoleError).toHaveBeenCalledWith("Failed to copy file path.", technicalError);
        } finally {
            consoleError.mockRestore();
            if (originalClipboardDescriptor) {
                Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
            } else {
                Reflect.deleteProperty(navigator, "clipboard");
            }
        }
    });
});
