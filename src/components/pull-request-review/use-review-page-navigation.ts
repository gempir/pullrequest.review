import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import { settingsPathForTab } from "@/components/settings-navigation";
import { fileAnchorId } from "@/lib/file-anchors";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { useKeyboardNavigation } from "@/lib/shortcuts-context";

type UseReviewPageNavigationProps = {
    activeFile: string | undefined;
    settingsPathSet: Set<string>;
    viewMode: "single" | "all";
    treeOrderedVisiblePaths: string[];
    viewedFiles: Set<string>;
    directoryPaths: string[];
    diffScrollRef: MutableRefObject<HTMLDivElement | null>;
    setActiveFile: (next: string | undefined) => void;
    showSettingsPanel: boolean;
    setShowSettingsPanel: (next: boolean) => void;
    setCollapsedAllModeFiles: Dispatch<SetStateAction<Record<string, boolean>>>;
    setIsSummaryCollapsedInAllMode: Dispatch<SetStateAction<boolean>>;
    setViewedFiles: Dispatch<SetStateAction<Set<string>>>;
    setDirectoryExpandedMap: (next: Record<string, boolean>) => void;
    onApprovePullRequest: () => void;
    onRequestChangesPullRequest: () => void;
};

export function useReviewPageNavigation({
    activeFile,
    settingsPathSet,
    viewMode,
    treeOrderedVisiblePaths,
    viewedFiles,
    directoryPaths,
    diffScrollRef,
    setActiveFile,
    showSettingsPanel,
    setShowSettingsPanel,
    setCollapsedAllModeFiles,
    setIsSummaryCollapsedInAllMode,
    setViewedFiles,
    setDirectoryExpandedMap,
    onApprovePullRequest,
    onRequestChangesPullRequest,
}: UseReviewPageNavigationProps) {
    const handleToggleSettingsPanel = useCallback(() => {
        if (showSettingsPanel) {
            setShowSettingsPanel(false);
            setActiveFile(PR_SUMMARY_PATH);
            return;
        }
        setShowSettingsPanel(true);
        if (!activeFile || !settingsPathSet.has(activeFile)) {
            setActiveFile(settingsPathForTab("appearance"));
        }
    }, [activeFile, setActiveFile, setShowSettingsPanel, settingsPathSet, showSettingsPanel]);

    const selectAndRevealFile = useCallback(
        (path: string) => {
            if (settingsPathSet.has(path)) {
                setShowSettingsPanel(true);
                setActiveFile(path);
                diffScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }

            setShowSettingsPanel(false);
            setActiveFile(path);
            if (viewMode === "all") {
                if (path === PR_SUMMARY_PATH) {
                    setIsSummaryCollapsedInAllMode(false);
                } else {
                    setCollapsedAllModeFiles((prev) => ({ ...prev, [path]: false }));
                }
                requestAnimationFrame(() => {
                    const anchor = document.getElementById(fileAnchorId(path));
                    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
                return;
            }

            diffScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        },
        [diffScrollRef, setActiveFile, setCollapsedAllModeFiles, setIsSummaryCollapsedInAllMode, setShowSettingsPanel, settingsPathSet, viewMode],
    );

    const selectFromPaths = useCallback(
        (paths: string[], direction: "next" | "previous") => {
            if (paths.length === 0) return;
            if (!activeFile) {
                selectAndRevealFile(direction === "next" ? paths[0] : paths[paths.length - 1]);
                return;
            }
            const currentIndex = paths.indexOf(activeFile);
            if (currentIndex === -1) {
                selectAndRevealFile(direction === "next" ? paths[0] : paths[paths.length - 1]);
                return;
            }
            const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex < 0 || nextIndex >= paths.length) return;
            selectAndRevealFile(paths[nextIndex]);
        },
        [activeFile, selectAndRevealFile],
    );

    useKeyboardNavigation({
        onNextUnviewedFile: () =>
            selectFromPaths(
                treeOrderedVisiblePaths.filter((path) => !viewedFiles.has(path)),
                "next",
            ),
        onPreviousUnviewedFile: () =>
            selectFromPaths(
                treeOrderedVisiblePaths.filter((path) => !viewedFiles.has(path)),
                "previous",
            ),
        onNextFile: () => selectFromPaths(treeOrderedVisiblePaths, "next"),
        onPreviousFile: () => selectFromPaths(treeOrderedVisiblePaths, "previous"),
        onApprovePullRequest,
        onRequestChangesPullRequest,
        onScrollDown: () => diffScrollRef.current?.scrollBy({ top: 120, behavior: "smooth" }),
        onScrollUp: () => diffScrollRef.current?.scrollBy({ top: -120, behavior: "smooth" }),
    });

    const toggleViewed = useCallback(
        (path: string) => {
            setViewedFiles((prev) => {
                const wasViewed = prev.has(path);
                const next = new Set(prev);
                if (wasViewed) {
                    next.delete(path);
                } else {
                    next.add(path);
                    setCollapsedAllModeFiles((collapsed) => ({
                        ...collapsed,
                        [path]: true,
                    }));
                }
                return next;
            });
        },
        [setCollapsedAllModeFiles, setViewedFiles],
    );

    const collapseAllDirectories = useCallback(() => {
        const next: Record<string, boolean> = {};
        for (const path of directoryPaths) {
            next[path] = false;
        }
        setDirectoryExpandedMap(next);
    }, [directoryPaths, setDirectoryExpandedMap]);

    const expandAllDirectories = useCallback(() => {
        const next: Record<string, boolean> = {};
        for (const path of directoryPaths) {
            next[path] = true;
        }
        setDirectoryExpandedMap(next);
    }, [directoryPaths, setDirectoryExpandedMap]);

    return {
        handleToggleSettingsPanel,
        selectAndRevealFile,
        toggleViewed,
        collapseAllDirectories,
        expandAllDirectories,
    };
}
