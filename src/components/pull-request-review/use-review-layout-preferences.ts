import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from "react";
import { readReviewLayoutState, writeReviewLayoutState } from "@/lib/data/query-collections";

type ReviewViewMode = "single" | "all";

const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 520;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 320;
const MIN_RIGHT_SIDEBAR_WIDTH = 240;
const MAX_RIGHT_SIDEBAR_WIDTH = 520;

type UseReviewLayoutPreferencesReturn = {
    treeWidth: number;
    setTreeWidth: (next: number) => void;
    treeCollapsed: boolean;
    setTreeCollapsed: (next: boolean) => void;
    rightSidebarWidth: number;
    setRightSidebarWidth: (next: number) => void;
    rightSidebarCollapsed: boolean;
    setRightSidebarCollapsed: (next: boolean) => void;
    viewMode: ReviewViewMode;
    setViewMode: (next: ReviewViewMode) => void;
    viewModeHydrated: boolean;
    startTreeResize: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    startRightSidebarResize: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function useReviewLayoutPreferences(): UseReviewLayoutPreferencesReturn {
    const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
    const [treeCollapsed, setTreeCollapsed] = useState(false);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(DEFAULT_RIGHT_SIDEBAR_WIDTH);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
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
            const storedRightSidebarWidth = stored.rightSidebarWidth;
            if (
                typeof storedRightSidebarWidth === "number" &&
                Number.isFinite(storedRightSidebarWidth) &&
                storedRightSidebarWidth >= MIN_RIGHT_SIDEBAR_WIDTH &&
                storedRightSidebarWidth <= MAX_RIGHT_SIDEBAR_WIDTH
            ) {
                setRightSidebarWidth(storedRightSidebarWidth);
            }
            if (typeof stored.rightSidebarCollapsed === "boolean") {
                setRightSidebarCollapsed(stored.rightSidebarCollapsed);
            }
            if (stored.viewMode === "single" || stored.viewMode === "all") {
                setViewMode(stored.viewMode);
            }
        }

        setViewModeHydrated(true);
    }, []);

    useEffect(() => {
        if (!viewModeHydrated) return;
        writeReviewLayoutState({
            treeWidth,
            treeCollapsed,
            rightSidebarWidth,
            rightSidebarCollapsed,
            viewMode,
        });
    }, [rightSidebarCollapsed, rightSidebarWidth, treeCollapsed, treeWidth, viewMode, viewModeHydrated]);

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

    const startRightSidebarResize = useCallback(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();

            const initialWidth = rightSidebarWidth;
            const startX = event.clientX;
            document.body.style.userSelect = "none";

            const onMouseMove = (moveEvent: MouseEvent) => {
                const delta = startX - moveEvent.clientX;
                const next = Math.min(MAX_RIGHT_SIDEBAR_WIDTH, Math.max(MIN_RIGHT_SIDEBAR_WIDTH, initialWidth + delta));
                setRightSidebarWidth(next);
            };

            const onMouseUp = () => {
                document.body.style.userSelect = "";
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        },
        [rightSidebarWidth],
    );

    return {
        treeWidth,
        setTreeWidth,
        treeCollapsed,
        setTreeCollapsed,
        rightSidebarWidth,
        setRightSidebarWidth,
        rightSidebarCollapsed,
        setRightSidebarCollapsed,
        viewMode,
        setViewMode,
        viewModeHydrated,
        startTreeResize,
        startRightSidebarResize,
    };
}
