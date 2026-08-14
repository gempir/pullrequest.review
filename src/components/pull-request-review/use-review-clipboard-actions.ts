import { type MutableRefObject, useCallback } from "react";

type UseReviewClipboardActionsParams = {
    copyResetTimeoutRef: MutableRefObject<number | null>;
    copySourceBranchResetTimeoutRef: MutableRefObject<number | null>;
    setActionError: (message: string | null) => void;
    setCopiedPath: (path: string | null | ((current: string | null) => string | null)) => void;
    setCopiedSourceBranch: (next: boolean) => void;
};

export const REVIEW_CLIPBOARD_ERROR_MESSAGES = {
    copyPathUnavailable: "Unable to copy file path. Copy it manually.",
    copyPathFailed: "Unable to copy file path. Try again.",
    copyBranchUnavailable: "Unable to copy source branch. Copy it manually.",
    copyBranchFailed: "Unable to copy source branch. Try again.",
} as const;

export function useReviewClipboardActions({
    copyResetTimeoutRef,
    copySourceBranchResetTimeoutRef,
    setActionError,
    setCopiedPath,
    setCopiedSourceBranch,
}: UseReviewClipboardActionsParams) {
    const handleCopyPath = useCallback(
        async (path: string) => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                console.error("Failed to copy file path because the Clipboard API is unavailable.");
                setActionError(REVIEW_CLIPBOARD_ERROR_MESSAGES.copyPathUnavailable);
                return;
            }
            try {
                await navigator.clipboard.writeText(path);
                setActionError(null);
                setCopiedPath(path);
                if (copyResetTimeoutRef.current !== null) {
                    window.clearTimeout(copyResetTimeoutRef.current);
                }
                copyResetTimeoutRef.current = window.setTimeout(() => {
                    setCopiedPath((current) => (current === path ? null : current));
                }, 1400);
            } catch (error) {
                console.error("Failed to copy file path.", error);
                setActionError(REVIEW_CLIPBOARD_ERROR_MESSAGES.copyPathFailed);
            }
        },
        [copyResetTimeoutRef, setActionError, setCopiedPath],
    );
    const handleCopySourceBranch = useCallback(
        async (branchName: string) => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                console.error("Failed to copy source branch because the Clipboard API is unavailable.");
                setActionError(REVIEW_CLIPBOARD_ERROR_MESSAGES.copyBranchUnavailable);
                return;
            }
            try {
                await navigator.clipboard.writeText(branchName);
                setActionError(null);
                setCopiedSourceBranch(true);
                if (copySourceBranchResetTimeoutRef.current !== null) {
                    window.clearTimeout(copySourceBranchResetTimeoutRef.current);
                }
                copySourceBranchResetTimeoutRef.current = window.setTimeout(() => {
                    setCopiedSourceBranch(false);
                }, 1400);
            } catch (error) {
                console.error("Failed to copy source branch.", error);
                setActionError(REVIEW_CLIPBOARD_ERROR_MESSAGES.copyBranchFailed);
            }
        },
        [copySourceBranchResetTimeoutRef, setActionError, setCopiedSourceBranch],
    );

    return {
        handleCopyPath,
        handleCopySourceBranch,
    };
}
