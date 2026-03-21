import { type MutableRefObject, useCallback } from "react";

type UseReviewClipboardActionsParams = {
    copyResetTimeoutRef: MutableRefObject<number | null>;
    copySourceBranchResetTimeoutRef: MutableRefObject<number | null>;
    setActionError: (message: string | null) => void;
    setCopiedPath: (path: string | null | ((current: string | null) => string | null)) => void;
    setCopiedSourceBranch: (next: boolean) => void;
};

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
                setActionError("Clipboard is not available");
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
            } catch {
                setActionError("Failed to copy file path");
            }
        },
        [copyResetTimeoutRef, setActionError, setCopiedPath],
    );
    const handleCopySourceBranch = useCallback(
        async (branchName: string) => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                setActionError("Clipboard is not available");
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
            } catch {
                setActionError("Failed to copy source branch");
            }
        },
        [copySourceBranchResetTimeoutRef, setActionError, setCopiedSourceBranch],
    );

    return {
        handleCopyPath,
        handleCopySourceBranch,
    };
}
