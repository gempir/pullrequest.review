import { type MutableRefObject, useEffect, useRef } from "react";
import type { useAllModeReveal } from "@/features/review/hooks/use-all-mode-reveal";
import { fileAnchorId } from "@/features/review/model/file-anchors";
import { PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";

/** Reports which section of the multi-file view is at the top of the scroll area, ignoring motion caused by a programmatic reveal. */
function useAllModeScrollSelection({
    enabled,
    diffScrollRef,
    sectionPaths,
    programmaticTargetRef,
    suppressObserverUntilRef,
    onObservedActivePath,
}: {
    enabled: boolean;
    diffScrollRef: MutableRefObject<HTMLDivElement | null>;
    sectionPaths: string[];
    programmaticTargetRef: MutableRefObject<string | null>;
    suppressObserverUntilRef: MutableRefObject<number>;
    onObservedActivePath: (path: string, metadata: { isSticky: boolean }) => void;
}) {
    const lastObservedPathRef = useRef<string | null>(null);
    const lastObservedStickyRef = useRef<boolean | null>(null);
    const onObservedActivePathRef = useRef(onObservedActivePath);

    useEffect(() => {
        onObservedActivePathRef.current = onObservedActivePath;
    }, [onObservedActivePath]);

    useEffect(() => {
        if (!enabled) return;
        if (typeof window === "undefined") return;
        if (sectionPaths.length === 0) return;

        const root = diffScrollRef.current;
        if (!root) return;

        const sectionAnchors = new Map<string, HTMLElement>();
        for (const path of sectionPaths) {
            const anchor = document.getElementById(fileAnchorId(path));
            if (!anchor) continue;
            sectionAnchors.set(path, anchor);
        }
        if (sectionAnchors.size === 0) return;

        let animationFrameId = 0;

        const resolveCandidate = () => {
            const rootTop = root.getBoundingClientRect().top;
            const stickyLine = rootTop;
            let stickyCandidatePath: string | null = null;
            let stickyCandidateTop = Number.NEGATIVE_INFINITY;
            let nonStickyCandidatePath: string | null = null;
            let nonStickyCandidateTop = Number.POSITIVE_INFINITY;

            for (const path of sectionPaths) {
                const anchor = sectionAnchors.get(path);
                if (!anchor) continue;
                const rect = anchor.getBoundingClientRect();
                if (rect.bottom <= stickyLine) continue;
                if (rect.top <= stickyLine) {
                    if (rect.top > stickyCandidateTop) {
                        stickyCandidateTop = rect.top;
                        stickyCandidatePath = path;
                    }
                    continue;
                }
                if (rect.top < nonStickyCandidateTop) {
                    nonStickyCandidateTop = rect.top;
                    nonStickyCandidatePath = path;
                }
            }

            const bestPath = stickyCandidatePath ?? nonStickyCandidatePath;
            if (!bestPath) return;

            const now = Date.now();
            const suppressed = now < suppressObserverUntilRef.current;
            const programmaticTarget = programmaticTargetRef.current;
            if (suppressed && programmaticTarget && bestPath !== programmaticTarget) return;

            const isSticky = stickyCandidatePath === bestPath;
            if (lastObservedPathRef.current === bestPath && lastObservedStickyRef.current === isSticky) return;
            lastObservedPathRef.current = bestPath;
            lastObservedStickyRef.current = isSticky;
            onObservedActivePathRef.current(bestPath, { isSticky });
        };

        const queueResolveCandidate = () => {
            if (animationFrameId !== 0) return;
            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = 0;
                resolveCandidate();
            });
        };

        const observer = new IntersectionObserver(
            () => {
                queueResolveCandidate();
            },
            {
                root,
                threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
                rootMargin: "0px 0px -55% 0px",
            },
        );

        for (const path of sectionPaths) {
            const anchor = sectionAnchors.get(path);
            if (!anchor) continue;
            observer.observe(anchor);
        }

        root.addEventListener("scroll", queueResolveCandidate, { passive: true });
        window.addEventListener("resize", queueResolveCandidate);
        queueResolveCandidate();

        return () => {
            root.removeEventListener("scroll", queueResolveCandidate);
            window.removeEventListener("resize", queueResolveCandidate);
            observer.disconnect();
            if (animationFrameId !== 0) {
                window.cancelAnimationFrame(animationFrameId);
            }
            lastObservedPathRef.current = null;
            lastObservedStickyRef.current = null;
        };
    }, [diffScrollRef, enabled, programmaticTargetRef, sectionPaths, suppressObserverUntilRef]);
}

/**
 * In the multi-file view the visible section becomes the active file (without touching the URL),
 * and with auto-mark on, a file is marked viewed once its header has been stuck at the top.
 */
export function useAllModeActiveFileTracking({
    enabled,
    diffScrollRef,
    sectionPaths,
    reveal,
    activeFile,
    autoMarkViewedFiles,
    markPathViewed,
    selectWithoutHash,
}: {
    enabled: boolean;
    diffScrollRef: MutableRefObject<HTMLDivElement | null>;
    sectionPaths: string[];
    reveal: ReturnType<typeof useAllModeReveal>;
    activeFile: string | undefined;
    autoMarkViewedFiles: boolean;
    markPathViewed: (path: string) => void;
    selectWithoutHash: (path: string) => void;
}) {
    const lastStickyPathRef = useRef<string | null>(null);
    const lastSectionPath = sectionPaths.at(-1) ?? null;
    const { pendingScrollPath, clearPendingScrollPath } = reveal;

    useAllModeScrollSelection({
        enabled,
        diffScrollRef,
        sectionPaths,
        programmaticTargetRef: reveal.programmaticTargetRef,
        suppressObserverUntilRef: reveal.suppressObserverUntilRef,
        onObservedActivePath: (path, { isSticky }) => {
            if (pendingScrollPath && path !== pendingScrollPath) return;
            if (pendingScrollPath) clearPendingScrollPath();
            if (path !== PR_SUMMARY_PATH && autoMarkViewedFiles) {
                const shouldMarkViewed = isSticky || pendingScrollPath === path || (!pendingScrollPath && path === lastSectionPath);
                if (shouldMarkViewed && lastStickyPathRef.current !== path) markPathViewed(path);
            }
            if (isSticky) lastStickyPathRef.current = path === PR_SUMMARY_PATH ? null : path;
            else if (lastStickyPathRef.current === path) lastStickyPathRef.current = null;
            if (activeFile !== path) selectWithoutHash(path);
        },
    });
}
