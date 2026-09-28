import {
    type Dispatch,
    type ReactEventHandler,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type SetStateAction,
    useCallback,
    useEffect,
    useState,
} from "react";
import { readReviewLayoutState, writeReviewLayoutState } from "@/lib/data/query-collections";

type ReviewViewMode = "single" | "all";

const DEFAULT_TREE_WIDTH = 280;
export const MIN_TREE_WIDTH = 180;
export const MAX_TREE_WIDTH = 720;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 320;
export const MIN_RIGHT_SIDEBAR_WIDTH = 240;
export const MAX_RIGHT_SIDEBAR_WIDTH = 520;
const KEYBOARD_RESIZE_STEP = 16;

export function getPaneWidthForResizeKey(key: string, width: number, minWidth: number, maxWidth: number, arrowLeftDirection: -1 | 1): number | null {
    if (key === "Home") return minWidth;
    if (key === "End") return maxWidth;
    if (key !== "ArrowLeft" && key !== "ArrowRight") return null;

    const direction = key === "ArrowLeft" ? arrowLeftDirection : -arrowLeftDirection;
    return Math.min(maxWidth, Math.max(minWidth, width + direction * KEYBOARD_RESIZE_STEP));
}

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
    startTreeResize: ReactEventHandler<HTMLElement>;
    startRightSidebarResize: ReactEventHandler<HTMLElement>;
};

export function useReviewLayoutPreferences(): UseReviewLayoutPreferencesReturn {
    const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
    const [treeCollapsed, setTreeCollapsed] = useState(false);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(DEFAULT_RIGHT_SIDEBAR_WIDTH);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
    const [viewMode, setViewMode] = useState<ReviewViewMode>("single");
    const [viewModeHydrated, setViewModeHydrated] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = readReviewLayoutState();
        if (stored) {
            if (Number.isFinite(stored.treeWidth) && stored.treeWidth >= MIN_TREE_WIDTH) {
                setTreeWidth(Math.min(stored.treeWidth, MAX_TREE_WIDTH));
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

    const startTreeResize = useCallback<ReactEventHandler<HTMLElement>>(
        (event) => {
            if (event.type === "keydown") {
                const keyboardEvent = event as ReactKeyboardEvent<HTMLElement>;
                const next = getPaneWidthForResizeKey(keyboardEvent.key, treeWidth, MIN_TREE_WIDTH, MAX_TREE_WIDTH, -1);
                if (next === null) return;

                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                setTreeWidth((currentWidth) => getPaneWidthForResizeKey(keyboardEvent.key, currentWidth, MIN_TREE_WIDTH, MAX_TREE_WIDTH, -1) ?? currentWidth);
                return;
            }

            const mouseEvent = event as ReactMouseEvent<HTMLElement>;
            mouseEvent.preventDefault();

            const initialWidth = treeWidth;
            const startX = mouseEvent.clientX;
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

    const startRightSidebarResize = useCallback<ReactEventHandler<HTMLElement>>(
        (event) => {
            if (event.type === "keydown") {
                const keyboardEvent = event as ReactKeyboardEvent<HTMLElement>;
                const next = getPaneWidthForResizeKey(keyboardEvent.key, rightSidebarWidth, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH, 1);
                if (next === null) return;

                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                setRightSidebarWidth(
                    (currentWidth) =>
                        getPaneWidthForResizeKey(keyboardEvent.key, currentWidth, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH, 1) ?? currentWidth,
                );
                return;
            }

            const mouseEvent = event as ReactMouseEvent<HTMLElement>;
            mouseEvent.preventDefault();

            const initialWidth = rightSidebarWidth;
            const startX = mouseEvent.clientX;
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
