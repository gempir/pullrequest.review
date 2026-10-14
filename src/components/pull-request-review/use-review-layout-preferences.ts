import { type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction, useCallback, useEffect, useState } from "react";
import { readReviewLayoutState, writeReviewLayoutState } from "@/lib/data/query-collections";

type ReviewViewMode = "single" | "all";

const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 320;
const MIN_RIGHT_SIDEBAR_WIDTH = 240;
const MAX_RIGHT_SIDEBAR_WIDTH = 520;

type UseReviewLayoutPreferencesReturn = {
    treeWidth: number;
    setTreeWidth: (next: number) => void;
    treeCollapsed: boolean;
    setTreeCollapsed: Dispatch<SetStateAction<boolean>>;
    rightSidebarWidth: number;
    setRightSidebarWidth: (next: number) => void;
    rightSidebarCollapsed: boolean;
    setRightSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
    viewMode: ReviewViewMode;
    setViewMode: (next: ReviewViewMode) => void;
    viewModeHydrated: boolean;
    startTreeResize: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    startRightSidebarResize: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

type InitialReviewLayout = {
    treeWidth: number;
    treeCollapsed: boolean;
    rightSidebarWidth: number;
    rightSidebarCollapsed: boolean;
    viewMode: ReviewViewMode;
    viewModeHydrated: boolean;
};

function readInitialReviewLayout(): InitialReviewLayout {
    const fallback: InitialReviewLayout = {
        treeWidth: DEFAULT_TREE_WIDTH,
        treeCollapsed: false,
        rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
        rightSidebarCollapsed: false,
        viewMode: "single",
        viewModeHydrated: false,
    };
    if (typeof window === "undefined") return fallback;
    const stored = readReviewLayoutState();
    if (!stored) return { ...fallback, viewModeHydrated: true };
    const storedRightSidebarWidth = stored.rightSidebarWidth;
    return {
        treeWidth: Number.isFinite(stored.treeWidth) && stored.treeWidth >= MIN_TREE_WIDTH ? stored.treeWidth : fallback.treeWidth,
        treeCollapsed: stored.treeCollapsed,
        rightSidebarWidth:
            typeof storedRightSidebarWidth === "number" &&
            Number.isFinite(storedRightSidebarWidth) &&
            storedRightSidebarWidth >= MIN_RIGHT_SIDEBAR_WIDTH &&
            storedRightSidebarWidth <= MAX_RIGHT_SIDEBAR_WIDTH
                ? storedRightSidebarWidth
                : fallback.rightSidebarWidth,
        rightSidebarCollapsed: typeof stored.rightSidebarCollapsed === "boolean" ? stored.rightSidebarCollapsed : fallback.rightSidebarCollapsed,
        viewMode: stored.viewMode === "single" || stored.viewMode === "all" ? stored.viewMode : fallback.viewMode,
        viewModeHydrated: true,
    };
}

export function useReviewLayoutPreferences(): UseReviewLayoutPreferencesReturn {
    const [initialLayout] = useState(readInitialReviewLayout);
    const [treeWidth, setTreeWidth] = useState(initialLayout.treeWidth);
    const [treeCollapsed, setTreeCollapsed] = useState(initialLayout.treeCollapsed);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(initialLayout.rightSidebarWidth);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(initialLayout.rightSidebarCollapsed);
    const [viewMode, setViewMode] = useState<ReviewViewMode>(initialLayout.viewMode);
    const viewModeHydrated = initialLayout.viewModeHydrated;

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
                const next = Math.max(MIN_TREE_WIDTH, initialWidth + delta);
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
