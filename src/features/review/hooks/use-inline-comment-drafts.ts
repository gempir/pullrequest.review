import { useCallback, useEffect, useState } from "react";
import { sameDraftLocation } from "@/features/review/model/review-page-model";
import {
    clearActiveInlineDraft,
    type InlineDraftLocation,
    listInlineDrafts,
    readActiveInlineDraft,
    readInlineDraftContent,
    writeActiveInlineDraft,
    writeInlineDraftContent,
} from "@/lib/storage";

/** One inline comment draft is open at a time; its text is persisted per pull request so a reload restores it. */
export function useInlineCommentDrafts({
    scopeId,
    onRestore,
}: {
    scopeId: string;
    /** Called when a persisted draft is reopened on load, so its file can be shown. Must be stable. */
    onRestore: (draft: InlineDraftLocation) => void;
}) {
    // `focus` asks the editor to take focus once: when the draft opens, not each time a virtualized diff remounts it.
    const [draft, setDraft] = useState<{ location: InlineDraftLocation; content: string; focus: boolean } | null>(null);

    const open = useCallback(
        (location: InlineDraftLocation) => {
            setDraft((prev) => {
                if (prev && (sameDraftLocation(prev.location, location) || prev.content.trim())) return prev;
                return { location, content: readInlineDraftContent(scopeId, location), focus: true };
            });
        },
        [scopeId],
    );

    const location = draft?.location ?? null;
    const setContent = useCallback(
        (content: string) => {
            if (!location) return;
            writeInlineDraftContent(scopeId, location, content);
            if (content.trim()) writeActiveInlineDraft(scopeId, location);
            else if (sameDraftLocation(readActiveInlineDraft(scopeId), location)) clearActiveInlineDraft(scopeId);
            setDraft((prev) => (prev && sameDraftLocation(prev.location, location) ? { ...prev, content } : prev));
        },
        [location, scopeId],
    );

    /** Closes the draft at `location` and forgets its text, unless another draft has been opened meanwhile. */
    const discard = useCallback(
        (location: InlineDraftLocation) => {
            writeInlineDraftContent(scopeId, location, "");
            if (sameDraftLocation(readActiveInlineDraft(scopeId), location)) clearActiveInlineDraft(scopeId);
            setDraft((prev) => (prev && sameDraftLocation(prev.location, location) ? null : prev));
        },
        [scopeId],
    );

    useEffect(() => {
        const active = readActiveInlineDraft(scopeId);
        const candidates = active ? [active, ...listInlineDrafts(scopeId)] : listInlineDrafts(scopeId);
        for (const candidate of candidates) {
            const location = { path: candidate.path, line: candidate.line, side: candidate.side };
            const content = readInlineDraftContent(scopeId, location);
            if (!content.trim()) continue;
            writeActiveInlineDraft(scopeId, location);
            setDraft({ location, content, focus: true });
            // eslint-disable-next-line react-doctor/no-pass-data-to-parent -- Restoring a persisted draft must show its file.
            onRestore(location);
            return;
        }
    }, [onRestore, scopeId]);

    const markFocused = useCallback(() => setDraft((prev) => (prev?.focus ? { ...prev, focus: false } : prev)), []);

    return { inlineDraft: draft, openInlineDraft: open, setInlineDraftContent: setContent, discardInlineDraft: discard, markInlineDraftFocused: markFocused };
}
