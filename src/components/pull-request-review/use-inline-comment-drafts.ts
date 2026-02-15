import { useCallback, useEffect, useState } from "react";
import {
    type InlineDraftLocation,
    inlineActiveDraftStorageKey,
    inlineDraftStorageKey,
    parseInlineDraftStorageKey,
} from "@/components/pull-request-review/use-inline-drafts";
import { listStorageKeys, readStorageValue, removeStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

export type InlineCommentDraft = InlineDraftLocation;

type UseInlineCommentDraftsProps = {
    workspace: string;
    repo: string;
    pullRequestId: string;
    setActiveFile: (path: string | undefined) => void;
    setViewMode: (mode: "single" | "all") => void;
};

type UseInlineCommentDraftsReturn = {
    inlineComment: InlineCommentDraft | null;
    setInlineComment: (next: InlineCommentDraft | null | ((prev: InlineCommentDraft | null) => InlineCommentDraft | null)) => void;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    clearInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    openInlineCommentDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
};

export function useInlineCommentDrafts({
    workspace,
    repo,
    pullRequestId,
    setActiveFile,
    setViewMode,
}: UseInlineCommentDraftsProps): UseInlineCommentDraftsReturn {
    const [inlineComment, setInlineComment] = useState<InlineCommentDraft | null>(null);

    const getInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
            const key = inlineDraftStorageKey(workspace, repo, pullRequestId, draft);
            return readStorageValue(key) ?? "";
        },
        [pullRequestId, repo, workspace],
    );

    const setInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => {
            const key = inlineDraftStorageKey(workspace, repo, pullRequestId, draft);
            const activeKey = inlineActiveDraftStorageKey(workspace, repo, pullRequestId);
            if (content.length > 0) {
                writeLocalStorageValue(key, content);
                writeLocalStorageValue(activeKey, JSON.stringify(draft));
                return;
            }

            removeStorageValue(key);
            const activeRaw = readStorageValue(activeKey);
            if (!activeRaw) return;

            try {
                const activeDraft = JSON.parse(activeRaw) as InlineCommentDraft;
                if (activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                    removeStorageValue(activeKey);
                }
            } catch {
                removeStorageValue(activeKey);
            }
        },
        [pullRequestId, repo, workspace],
    );

    const clearInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
            const activeKey = inlineActiveDraftStorageKey(workspace, repo, pullRequestId);
            const activeRaw = readStorageValue(activeKey);
            if (activeRaw) {
                try {
                    const activeDraft = JSON.parse(activeRaw) as InlineCommentDraft;
                    if (activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                        removeStorageValue(activeKey);
                    }
                } catch {
                    removeStorageValue(activeKey);
                }
            }
            removeStorageValue(inlineDraftStorageKey(workspace, repo, pullRequestId, draft));
        },
        [pullRequestId, repo, workspace],
    );

    const openInlineCommentDraft = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
            setInlineComment((prev) => {
                if (prev && prev.path === draft.path && prev.line === draft.line && prev.side === draft.side) {
                    return prev;
                }
                if (prev && getInlineDraftContent(prev).trim().length > 0) {
                    return prev;
                }
                return {
                    path: draft.path,
                    line: draft.line,
                    side: draft.side,
                };
            });
        },
        [getInlineDraftContent],
    );

    useEffect(() => {
        const activeKey = inlineActiveDraftStorageKey(workspace, repo, pullRequestId);
        const raw = readStorageValue(activeKey);

        const restoreDraft = (draft: InlineCommentDraft) => {
            const content = getInlineDraftContent(draft);
            if (!content.trim()) return false;
            setInlineComment(draft);
            setActiveFile(draft.path);
            setViewMode("single");
            return true;
        };

        if (raw) {
            try {
                const parsed = JSON.parse(raw) as InlineCommentDraft;
                if (parsed.path && parsed.line && parsed.side && restoreDraft(parsed)) {
                    return;
                }
            } catch {
                removeStorageValue(activeKey);
            }
        }

        const storageKeys = listStorageKeys();
        for (let i = storageKeys.length - 1; i >= 0; i -= 1) {
            const key = storageKeys[i];
            if (!key) continue;
            const parsed = parseInlineDraftStorageKey(key, workspace, repo, pullRequestId);
            if (!parsed) continue;
            if (restoreDraft(parsed)) {
                writeLocalStorageValue(activeKey, JSON.stringify(parsed));
                return;
            }
        }
    }, [getInlineDraftContent, pullRequestId, repo, setActiveFile, setViewMode, workspace]);

    return {
        inlineComment,
        setInlineComment,
        getInlineDraftContent,
        setInlineDraftContent,
        clearInlineDraftContent,
        openInlineCommentDraft,
    };
}
