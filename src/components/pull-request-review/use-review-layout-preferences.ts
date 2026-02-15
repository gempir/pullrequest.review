import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from "react";
import { makeVersionedStorageKey, readStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

export type ReviewViewMode = "single" | "all";

const TREE_WIDTH_KEY_BASE = "pr_review_tree_width";
const TREE_WIDTH_KEY = makeVersionedStorageKey(TREE_WIDTH_KEY_BASE, 2);
const TREE_COLLAPSED_KEY_BASE = "pr_review_tree_collapsed";
const TREE_COLLAPSED_KEY = makeVersionedStorageKey(TREE_COLLAPSED_KEY_BASE, 2);
const VIEW_MODE_KEY_BASE = "pr_review_diff_view_mode";
const VIEW_MODE_KEY = makeVersionedStorageKey(VIEW_MODE_KEY_BASE, 2);

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

        const storedWidth = Number(readStorageValue(TREE_WIDTH_KEY));
        if (Number.isFinite(storedWidth) && storedWidth >= MIN_TREE_WIDTH && storedWidth <= MAX_TREE_WIDTH) {
            setTreeWidth(storedWidth);
        }

        const storedCollapsed = readStorageValue(TREE_COLLAPSED_KEY);
        if (storedCollapsed === "true") setTreeCollapsed(true);

        const storedMode = readStorageValue(VIEW_MODE_KEY);
        if (storedMode === "single" || storedMode === "all") {
            setViewMode(storedMode);
        }

        setViewModeHydrated(true);
    }, []);

    useEffect(() => {
        writeLocalStorageValue(TREE_WIDTH_KEY, String(treeWidth));
    }, [treeWidth]);

    useEffect(() => {
        writeLocalStorageValue(TREE_COLLAPSED_KEY, String(treeCollapsed));
    }, [treeCollapsed]);

    useEffect(() => {
        if (!viewModeHydrated) return;
        writeLocalStorageValue(VIEW_MODE_KEY, viewMode);
    }, [viewMode, viewModeHydrated]);

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
