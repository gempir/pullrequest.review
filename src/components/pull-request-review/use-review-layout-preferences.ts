import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from "react";
import { readReviewLayoutState, writeReviewLayoutState } from "@/lib/data/query-collections";

type ReviewViewMode = "single" | "all";

const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 520;

type UseReviewLayoutPreferencesReturn = {
    treeWidth: number;
    setTreeWidth: (next: number) => void;
    treeCollapsed: boolean;
    setTreeCollapsed: (next: boolean) => void;
    viewMode: ReviewViewMode;
    setViewMode: (next: ReviewViewMode) => void;
    viewModeHydrated: boolean;
    startTreeResize: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function useReviewLayoutPreferences(): UseReviewLayoutPreferencesReturn {
    const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
    const [treeCollapsed, setTreeCollapsed] = useState(false);
    const [viewMode, setViewMode] = useState<ReviewViewMode>("single");
    const [viewModeHydrated, setViewModeHydrated] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = readReviewLayoutState();
        if (stored) {
            if (Number.isFinite(stored.treeWidth) && stored.treeWidth >= MIN_TREE_WIDTH && stored.treeWidth <= MAX_TREE_WIDTH) {
                setTreeWidth(stored.treeWidth);
            }
            setTreeCollapsed(stored.treeCollapsed);
            if (stored.viewMode === "single" || stored.viewMode === "all") {
                setViewMode(stored.viewMode);
            }
        }

        setViewModeHydrated(true);
    }, []);

    useEffect(() => {
        if (!viewModeHydrated) return;
        writeReviewLayoutState({ treeWidth, treeCollapsed, viewMode });
    }, [treeCollapsed, treeWidth, viewMode, viewModeHydrated]);

    const startTreeResize = useCallback(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();

            const initialWidth = treeWidth;
            const startX = event.clientX;
            document.body.style.userSelect = "none";

            const onMouseMove = (moveEvent: MouseEvent) => {
                const delta = moveEvent.clientX - startX;
                const next = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, initialWidth + delta));
                setTreeWidth(next);
            };

            const onMouseUp = () => {
                document.body.style.userSelect = "";
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        },
        [treeWidth],
    );

    return {
        treeWidth,
        setTreeWidth,
        treeCollapsed,
        setTreeCollapsed,
        viewMode,
        setViewMode,
        viewModeHydrated,
        startTreeResize,
    };
}
