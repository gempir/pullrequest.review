import { useCallback, useEffect, useMemo, useState } from "react";
import type { InlineDraftLocation } from "@/components/pull-request-review/use-inline-drafts";
import {
    clearInlineCommentActiveDraft,
    clearInlineCommentDraftContent as clearInlineCommentDraftContentRecord,
    listInlineCommentDrafts,
    readInlineCommentActiveDraft,
    readInlineCommentDraftContent as readInlineCommentDraftContentRecord,
    writeInlineCommentActiveDraft,
    writeInlineCommentDraftContent as writeInlineCommentDraftContentRecord,
} from "@/lib/data/query-collections";

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
    const scopeId = useMemo(() => `${workspace}/${repo}/${pullRequestId}`, [pullRequestId, repo, workspace]);

    const getInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => readInlineCommentDraftContentRecord(scopeId, draft),
        [scopeId],
    );

    const setInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => {
            if (content.length > 0) {
                writeInlineCommentDraftContentRecord(scopeId, draft, content);
                writeInlineCommentActiveDraft(scopeId, draft);
                return;
            }

            clearInlineCommentDraftContentRecord(scopeId, draft);
            const activeDraft = readInlineCommentActiveDraft(scopeId);
            if (!activeDraft) return;

            if (activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                clearInlineCommentActiveDraft(scopeId);
            }
        },
        [scopeId],
    );

    const clearInlineDraftContent = useCallback(
        (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
            const activeDraft = readInlineCommentActiveDraft(scopeId);
            if (activeDraft && activeDraft.path === draft.path && activeDraft.line === draft.line && activeDraft.side === draft.side) {
                clearInlineCommentActiveDraft(scopeId);
            }
            clearInlineCommentDraftContentRecord(scopeId, draft);
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

        const activeDraft = readInlineCommentActiveDraft(scopeId);
        if (activeDraft && restoreDraft(activeDraft)) {
            return;
        }

        const drafts = listInlineCommentDrafts(scopeId);
        for (const draft of drafts) {
            const parsed: InlineCommentDraft = {
                path: draft.path,
                line: draft.line,
                side: draft.side,
            };
            if (restoreDraft(parsed)) {
                writeInlineCommentActiveDraft(scopeId, parsed);
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
