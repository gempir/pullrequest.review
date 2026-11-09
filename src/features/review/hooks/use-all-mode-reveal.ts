import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { fileAnchorId } from "@/features/review/model/file-anchors";

const SCROLL_RETRY_DELAYS = [0, 80, 180, 320, 500, 700, 950, 1200, 1500, 1850, 2200, 2600, 3000, 3400, 3800] as const;

/**
 * Scrolls the multi-file view to a file. Rows are virtualized and measured
 * after they mount, so the anchor moves and the scroll has to be retried until it settles.
 */
export function useAllModeReveal({
    active,
    scrollRef,
    sectionPaths,
}: {
    active: boolean;
    scrollRef: RefObject<HTMLDivElement | null>;
    sectionPaths: string[];
}) {
    const [pendingScrollPath, setPendingScrollPath] = useState<string | null>(null);
    const programmaticTargetRef = useRef<string | null>(null);
    const suppressObserverUntilRef = useRef(0);

    const clearPendingScrollPath = useCallback(() => {
        programmaticTargetRef.current = null;
        suppressObserverUntilRef.current = 0;
        setPendingScrollPath(null);
    }, []);
    const startReveal = useCallback((path: string) => {
        programmaticTargetRef.current = path;
        suppressObserverUntilRef.current = Date.now() + 1200;
        setPendingScrollPath(path);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Leaving the multi-file view cancels the pending retries and their refs.
        if (!active) clearPendingScrollPath();
    }, [active, clearPendingScrollPath]);

    useEffect(() => {
        if (!active || !pendingScrollPath || !sectionPaths.includes(pendingScrollPath)) return;
        const settleIfVisible = () => {
            const root = scrollRef.current;
            const anchor = document.getElementById(fileAnchorId(pendingScrollPath));
            if (!root || !anchor) return false;
            const anchorRect = anchor.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            if (anchorRect.top > rootRect.top + 1 && anchorRect.bottom > rootRect.bottom - 4) return false;
            clearPendingScrollPath();
            return true;
        };
        if (settleIfVisible()) return;

        const timeoutIds = SCROLL_RETRY_DELAYS.map((delay, attempt) =>
            window.setTimeout(() => {
                if (settleIfVisible()) return;
                document.getElementById(fileAnchorId(pendingScrollPath))?.scrollIntoView({ behavior: attempt === 0 ? "smooth" : "auto", block: "start" });
                window.requestAnimationFrame(settleIfVisible);
                if (attempt === SCROLL_RETRY_DELAYS.length - 1) clearPendingScrollPath();
            }, delay),
        );
        return () => {
            for (const id of timeoutIds) window.clearTimeout(id);
        };
    }, [active, clearPendingScrollPath, pendingScrollPath, scrollRef, sectionPaths]);

    return { pendingScrollPath, clearPendingScrollPath, startReveal, programmaticTargetRef, suppressObserverUntilRef };
}
