import type { FileDiffMetadata } from "@pierre/diffs";
import { useEffect } from "react";
import { PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import type { PullRequestBundle } from "@/lib/git-host/types";

/** Keeps the shared file selection pointing at something visible as filters, settings and data change. */
export function useReviewActiveFileSync({
    showSettingsPanel,
    settingsTreeItems,
    settingsPathSet,
    activeFile,
    treeOrderedVisiblePaths,
    visiblePathSet,
    viewedFiles,
    setActiveFile,
}: {
    showSettingsPanel: boolean;
    settingsTreeItems: Array<{ path: string }>;
    settingsPathSet: Set<string>;
    activeFile: string | undefined;
    treeOrderedVisiblePaths: string[];
    visiblePathSet: Set<string>;
    viewedFiles: Set<string>;
    setActiveFile: (next: string | undefined) => void;
}) {
    useEffect(() => {
        if (showSettingsPanel) {
            const firstSettingsPath = settingsTreeItems[0]?.path;
            if (!firstSettingsPath) return;
            if (!activeFile || !settingsPathSet.has(activeFile)) {
                // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- Entering settings selects a valid settings tree item in the shared store.
                setActiveFile(firstSettingsPath);
            }
            return;
        }
        if (treeOrderedVisiblePaths.length === 0) return;

        if (!activeFile) {
            // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- Initialize the shared file selection once visible review paths load.
            setActiveFile(PR_SUMMARY_PATH);
            return;
        }

        if (!visiblePathSet.has(activeFile)) {
            const firstUnviewed = treeOrderedVisiblePaths.find((path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path)) ?? treeOrderedVisiblePaths[0];
            // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- Keep the shared selection valid when filters hide the selected file.
            setActiveFile(firstUnviewed);
        }
    }, [activeFile, settingsPathSet, settingsTreeItems, setActiveFile, showSettingsPanel, treeOrderedVisiblePaths, viewedFiles, visiblePathSet]);
}

export function useEnsureSummarySelection({
    showSettingsPanel,
    viewMode,
    prData,
    isSummarySelected,
    selectedFileDiff,
    setActiveFile,
}: {
    showSettingsPanel: boolean;
    viewMode: "single" | "all";
    prData: PullRequestBundle | undefined;
    isSummarySelected: boolean;
    selectedFileDiff: FileDiffMetadata | undefined;
    setActiveFile: (next: string | undefined) => void;
}) {
    useEffect(() => {
        if (showSettingsPanel || viewMode !== "single") return;
        if (!prData) return;
        if (isSummarySelected) return;
        if (selectedFileDiff) return;
        if ((prData.diffstat?.length ?? 0) > 0) return;
        // eslint-disable-next-line react-doctor/no-pass-live-state-to-parent -- An empty PR has no file selection, so select its summary in the shared store.
        setActiveFile(PR_SUMMARY_PATH);
    }, [isSummarySelected, prData, selectedFileDiff, setActiveFile, showSettingsPanel, viewMode]);
}
