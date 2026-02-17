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
    onProgrammaticAllModeRevealStart?: (path: string) => void;
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
    onProgrammaticAllModeRevealStart,
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
                    onProgrammaticAllModeRevealStart?.(path);
                    const anchor = document.getElementById(fileAnchorId(path));
                    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
                return;
            }

            diffScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        },
        [
            diffScrollRef,
            onProgrammaticAllModeRevealStart,
            setActiveFile,
            setCollapsedAllModeFiles,
            setIsSummaryCollapsedInAllMode,
            setShowSettingsPanel,
            settingsPathSet,
            viewMode,
        ],
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

    const getScrollTarget = useCallback(() => {
        if (viewMode === "single") {
            const scrollContainer = diffScrollRef.current?.querySelector<HTMLElement>(".diff-content-scroll");
            if (scrollContainer) return scrollContainer;
        }
        return diffScrollRef.current;
    }, [diffScrollRef, viewMode]);

    const selectAdjacentUnviewedFile = useCallback(
        (direction: "next" | "previous") => {
            const step = direction === "next" ? 1 : -1;
            const hasUnviewedCandidate = treeOrderedVisiblePaths.some((path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path));
            if (!hasUnviewedCandidate) return;

            if (!activeFile) {
                const fallbackPath =
                    direction === "next"
                        ? treeOrderedVisiblePaths.find((path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path))
                        : [...treeOrderedVisiblePaths].reverse().find((path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path));
                if (fallbackPath) {
                    selectAndRevealFile(fallbackPath);
                }
                return;
            }

            const currentIndex = treeOrderedVisiblePaths.indexOf(activeFile);
            if (currentIndex < 0) return;

            for (let index = currentIndex + step; index >= 0 && index < treeOrderedVisiblePaths.length; index += step) {
                const candidate = treeOrderedVisiblePaths[index];
                if (!candidate) continue;
                if (candidate === PR_SUMMARY_PATH) continue;
                if (viewedFiles.has(candidate)) continue;
                selectAndRevealFile(candidate);
                return;
            }
        },
        [activeFile, selectAndRevealFile, treeOrderedVisiblePaths, viewedFiles],
    );

    useKeyboardNavigation({
        onNextUnviewedFile: () => selectAdjacentUnviewedFile("next"),
        onPreviousUnviewedFile: () => selectAdjacentUnviewedFile("previous"),
        onNextFile: () => selectFromPaths(treeOrderedVisiblePaths, "next"),
        onPreviousFile: () => selectFromPaths(treeOrderedVisiblePaths, "previous"),
        onMarkFileViewed: () => {
            if (!activeFile) return;
            if (activeFile === PR_SUMMARY_PATH) return;
            if (settingsPathSet.has(activeFile)) return;
            setViewedFiles((prev) => {
                const next = new Set(prev);
                if (next.has(activeFile)) {
                    next.delete(activeFile);
                } else {
                    next.add(activeFile);
                }
                return next;
            });
        },
        onMarkFileViewedAndFold: () => {
            if (!activeFile) return;
            if (activeFile === PR_SUMMARY_PATH) return;
            if (settingsPathSet.has(activeFile)) return;
            setViewedFiles((prev) => {
                if (prev.has(activeFile)) return prev;
                const next = new Set(prev);
                next.add(activeFile);
                return next;
            });
            setCollapsedAllModeFiles((collapsed) => ({
                ...collapsed,
                [activeFile]: true,
            }));
            selectFromPaths(treeOrderedVisiblePaths, "next");
        },
        onApprovePullRequest,
        onRequestChangesPullRequest,
        onScrollDown: () => getScrollTarget()?.scrollBy({ top: 120, behavior: "smooth" }),
        onScrollUp: () => getScrollTarget()?.scrollBy({ top: -120, behavior: "smooth" }),
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
