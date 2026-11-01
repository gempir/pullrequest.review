import { useCallback, useEffect, useRef, useState } from "react";
import { commentAnchorId } from "@/lib/file-anchors";

const MAX_ATTEMPTS = 20;

/** The target thread renders only after its file is selected and laid out, so this polls for its anchor. */
export function useCommentReveal() {
    const pendingCommentRef = useRef<number | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (tick === 0 || pendingCommentRef.current === null) return;
        let attempts = 0;
        let timeoutId: number;
        const attemptScroll = () => {
            const targetId = pendingCommentRef.current;
            if (targetId === null) return;
            const anchor = document.getElementById(commentAnchorId(targetId));
            attempts += 1;
            if (anchor || attempts >= MAX_ATTEMPTS) {
                anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
                pendingCommentRef.current = null;
                return;
            }
            timeoutId = window.setTimeout(attemptScroll, 150);
        };
        timeoutId = window.setTimeout(attemptScroll, 80);
        return () => window.clearTimeout(timeoutId);
    }, [tick]);

    return useCallback((commentId: number) => {
        pendingCommentRef.current = commentId;
        setTick((current) => current + 1);
    }, []);
}
