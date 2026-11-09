import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from "react";
import { type ReviewLayoutState, readReviewLayoutState, writeReviewLayoutState } from "@/lib/storage";

const TREE_WIDTH = { initial: 280, min: 180, max: Number.POSITIVE_INFINITY };
const RIGHT_SIDEBAR_WIDTH = { initial: 320, min: 240, max: 520 };

function validWidth(value: number | undefined, bounds: typeof TREE_WIDTH) {
    return typeof value === "number" && Number.isFinite(value) && value >= bounds.min && value <= bounds.max ? value : bounds.initial;
}

function readInitialLayout(): ReviewLayoutState {
    const stored = readReviewLayoutState();
    return {
        treeWidth: validWidth(stored?.treeWidth, TREE_WIDTH),
        treeCollapsed: stored?.treeCollapsed ?? false,
        rightSidebarWidth: validWidth(stored?.rightSidebarWidth, RIGHT_SIDEBAR_WIDTH),
        rightSidebarCollapsed: stored?.rightSidebarCollapsed ?? false,
        viewMode: stored?.viewMode === "all" ? "all" : "single",
    };
}

/** Drag handler for a sidebar edge; `direction` is -1 when dragging left widens the sidebar. */
function startResize(event: ReactMouseEvent, initialWidth: number, bounds: typeof TREE_WIDTH, direction: 1 | -1, setWidth: (width: number) => void) {
    event.preventDefault();
    const startX = event.clientX;
    document.body.style.userSelect = "none";
    const onMouseMove = (moveEvent: MouseEvent) => {
        setWidth(Math.min(bounds.max, Math.max(bounds.min, initialWidth + direction * (moveEvent.clientX - startX))));
    };
    const onMouseUp = () => {
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
}

export function useReviewLayoutPreferences() {
    const [layout, setLayout] = useState(readInitialLayout);
    useEffect(() => writeReviewLayoutState(layout), [layout]);

    const update = useCallback(
        <K extends keyof ReviewLayoutState>(key: K, value: ReviewLayoutState[K] | ((prev: ReviewLayoutState[K]) => ReviewLayoutState[K])) => {
            setLayout((prev) => {
                const next = typeof value === "function" ? (value as (prev: ReviewLayoutState[K]) => ReviewLayoutState[K])(prev[key]) : value;
                return prev[key] === next ? prev : { ...prev, [key]: next };
            });
        },
        [],
    );

    return {
        ...layout,
        setTreeCollapsed: useCallback((value: boolean | ((prev: boolean) => boolean)) => update("treeCollapsed", value), [update]),
        setRightSidebarCollapsed: useCallback((value: boolean | ((prev: boolean) => boolean)) => update("rightSidebarCollapsed", value), [update]),
        setViewMode: useCallback((value: ReviewLayoutState["viewMode"]) => update("viewMode", value), [update]),
        startTreeResize: (event: ReactMouseEvent) => startResize(event, layout.treeWidth, TREE_WIDTH, 1, (width) => update("treeWidth", width)),
        startRightSidebarResize: (event: ReactMouseEvent) =>
            startResize(event, layout.rightSidebarWidth, RIGHT_SIDEBAR_WIDTH, -1, (width) => update("rightSidebarWidth", width)),
    };
}
