import { type Dispatch, type RefObject, type SetStateAction, useCallback } from "react";
import { settingsPathForTab } from "@/components/settings-navigation";
import { fileAnchorId } from "@/lib/file-anchors";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { useKeyboardNavigation } from "@/lib/shortcuts-context";

export function useReviewNavigation({
    onOpenOmnibar,
    activeFile,
    settingsPathSet,
    viewMode,
    treeOrderedVisiblePaths,
    viewedFiles,
    diffScrollRef,
    setActiveFile,
    showSettingsPanel,
    setShowSettingsPanel,
    setTreeCollapsed,
    setRightSidebarCollapsed,
    setCollapsedAllModeFiles,
    setIsSummaryCollapsedInAllMode,
    toggleViewedForPath,
    markViewedForPath,
    onAllModeRevealStart,
    onApprovePullRequest,
    onRequestChangesPullRequest,
}: {
    onOpenOmnibar: () => void;
    activeFile: string | undefined;
    settingsPathSet: Set<string>;
    viewMode: "single" | "all";
    treeOrderedVisiblePaths: string[];
    viewedFiles: Set<string>;
    diffScrollRef: RefObject<HTMLDivElement | null>;
    setActiveFile: (next: string | undefined) => void;
    showSettingsPanel: boolean;
    setShowSettingsPanel: (next: boolean) => void;
    setTreeCollapsed: Dispatch<SetStateAction<boolean>>;
    setRightSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
    setCollapsedAllModeFiles: Dispatch<SetStateAction<Record<string, boolean>>>;
    setIsSummaryCollapsedInAllMode: Dispatch<SetStateAction<boolean>>;
    toggleViewedForPath: (path: string) => void;
    markViewedForPath: (path: string) => void;
    onAllModeRevealStart: (path: string) => void;
    onApprovePullRequest: () => void;
    onRequestChangesPullRequest: () => void;
}) {
    const toggleSettingsPanel = () => {
        setShowSettingsPanel(!showSettingsPanel);
        if (showSettingsPanel) setActiveFile(PR_SUMMARY_PATH);
        else if (!activeFile || !settingsPathSet.has(activeFile)) setActiveFile(settingsPathForTab("appearance"));
    };

    const selectAndRevealFile = useCallback(
        (path: string) => {
            const isSettingsPath = settingsPathSet.has(path);
            setShowSettingsPanel(isSettingsPath);
            setActiveFile(path);
            if (isSettingsPath || viewMode !== "all") {
                diffScrollRef.current?.scrollTo({ top: 0 });
                return;
            }
            if (path === PR_SUMMARY_PATH) setIsSummaryCollapsedInAllMode(false);
            else setCollapsedAllModeFiles((prev) => ({ ...prev, [path]: false }));
            requestAnimationFrame(() => {
                onAllModeRevealStart(path);
                document.getElementById(fileAnchorId(path))?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        },
        [
            diffScrollRef,
            onAllModeRevealStart,
            setActiveFile,
            setCollapsedAllModeFiles,
            setIsSummaryCollapsedInAllMode,
            setShowSettingsPanel,
            settingsPathSet,
            viewMode,
        ],
    );

    const selectAdjacentFile = (direction: 1 | -1) => {
        const paths = treeOrderedVisiblePaths;
        if (paths.length === 0) return;
        const currentIndex = activeFile ? paths.indexOf(activeFile) : -1;
        if (currentIndex === -1) {
            selectAndRevealFile(direction === 1 ? paths[0] : paths[paths.length - 1]);
            return;
        }
        const next = paths[currentIndex + direction];
        if (next) selectAndRevealFile(next);
    };

    const selectAdjacentUnviewedFile = (direction: 1 | -1) => {
        const isUnviewed = (path: string) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path);
        const paths = treeOrderedVisiblePaths;
        if (!activeFile) {
            const fallback = direction === 1 ? paths.find(isUnviewed) : paths.findLast(isUnviewed);
            if (fallback) selectAndRevealFile(fallback);
            return;
        }
        const currentIndex = paths.indexOf(activeFile);
        if (currentIndex < 0) return;
        const candidates = direction === 1 ? paths.slice(currentIndex + 1) : paths.slice(0, currentIndex).reverse();
        const next = candidates.find(isUnviewed);
        if (next) selectAndRevealFile(next);
    };

    const scrollByShortcut = (direction: 1 | -1, event: KeyboardEvent) => {
        diffScrollRef.current?.scrollBy({
            top: direction * (event.repeat ? 180 : 120),
            behavior: event.repeat ? "auto" : "smooth",
        });
    };

    const isMarkableFile = (path: string | undefined): path is string => Boolean(path) && path !== PR_SUMMARY_PATH && !settingsPathSet.has(path as string);
    useKeyboardNavigation({
        onOpenOmnibar,
        onNextUnviewedFile: () => selectAdjacentUnviewedFile(1),
        onPreviousUnviewedFile: () => selectAdjacentUnviewedFile(-1),
        onOpenFileTree: () => setTreeCollapsed((collapsed) => !collapsed),
        onOpenCommentsSidebar: () => setRightSidebarCollapsed((collapsed) => !collapsed),
        onGoToSummary: () => selectAndRevealFile(PR_SUMMARY_PATH),
        onNextFile: () => selectAdjacentFile(1),
        onPreviousFile: () => selectAdjacentFile(-1),
        onMarkFileViewed: () => {
            if (isMarkableFile(activeFile)) toggleViewedForPath(activeFile);
        },
        onMarkFileViewedAndFold: () => {
            if (!isMarkableFile(activeFile)) return;
            markViewedForPath(activeFile);
            setCollapsedAllModeFiles((collapsed) => ({ ...collapsed, [activeFile]: true }));
            selectAdjacentFile(1);
        },
        onApprovePullRequest,
        onRequestChangesPullRequest,
        onScrollDown: (event) => scrollByShortcut(1, event),
        onScrollUp: (event) => scrollByShortcut(-1, event),
    });

    return { toggleSettingsPanel, selectAndRevealFile, selectAdjacentFile };
}
