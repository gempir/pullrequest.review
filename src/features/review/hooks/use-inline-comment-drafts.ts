import { useCallback, useEffect, useState } from "react";
import {
    clearActiveInlineDraft,
    clearInlineDraftContent as clearStoredDraftContent,
    type InlineDraftLocation,
    listInlineDrafts,
    readActiveInlineDraft,
    readInlineDraftContent,
    writeActiveInlineDraft,
    writeInlineDraftContent,
} from "@/lib/storage";

type InlineCommentDraft = InlineDraftLocation;

type UseInlineCommentDraftsProps = {
    workspace: string;
    repo: string;
    pullRequestId: string;
    setActiveFile: (path: string | undefined) => void;
    setViewMode: (mode: "single" | "all") => void;
};

export function useInlineCommentDrafts({ workspace, repo, pullRequestId, setActiveFile, setViewMode }: UseInlineCommentDraftsProps) {
    const [inlineComment, setInlineComment] = useState<InlineCommentDraft | null>(null);
    const scopeId = `${workspace}/${repo}/${pullRequestId}`;

    const getInlineDraftContent = useCallback((draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => readInlineDraftContent(scopeId, draft), [scopeId]);

    const setInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => {
            if (content.length > 0) {
                writeInlineDraftContent(scopeId, draft, content);
                writeActiveInlineDraft(scopeId, draft);
                return;
            }

            clearStoredDraftContent(scopeId, draft);
            const activeDraft = readActiveInlineDraft(scopeId);
            if (!activeDraft) return;

            if (activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                clearActiveInlineDraft(scopeId);
            }
        },
        [scopeId],
    );

    const clearInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
            const activeDraft = readActiveInlineDraft(scopeId);
            if (activeDraft && activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                clearActiveInlineDraft(scopeId);
            }
            clearStoredDraftContent(scopeId, draft);
        },
        [scopeId],
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
        const restoreDraft = (draft: InlineCommentDraft) => {
            const content = getInlineDraftContent(draft);
            if (!content.trim()) return false;
            setInlineComment(draft);
            setActiveFile(draft.path);
            setViewMode("single");
            return true;
        };

        const activeDraft = readActiveInlineDraft(scopeId);
        // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- Restoring a persisted draft must select its file and single-file view.
        if (activeDraft && restoreDraft(activeDraft)) {
            return;
        }

        const drafts = listInlineDrafts(scopeId);
        for (const draft of drafts) {
            const parsed: InlineCommentDraft = {
                path: draft.path,
                line: draft.line,
                side: draft.side,
            };
            // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- A fallback persisted draft needs the same file and view restoration.
            if (restoreDraft(parsed)) {
                writeActiveInlineDraft(scopeId, parsed);
                return;
            }
        }
    }, [getInlineDraftContent, scopeId, setActiveFile, setViewMode]);

    return {
        inlineComment,
        setInlineComment,
        getInlineDraftContent,
        setInlineDraftContent,
        clearInlineDraftContent,
        openInlineCommentDraft,
    };
}
