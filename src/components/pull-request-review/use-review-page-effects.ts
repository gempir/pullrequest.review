import { type FileDiffMetadata, preloadHighlighter } from "@pierre/diffs";
import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useState } from "react";
import { buildKindMapForTree, buildTreeFromPaths, type ChangeKind, type FileNode } from "@/lib/file-tree-context";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { readStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";
import { readViewedFiles, writeViewedFiles } from "./use-review-storage";

export function useReviewDocumentTitle({ isLoading, pullRequestTitle }: { isLoading: boolean; pullRequestTitle?: string }) {
    useEffect(() => {
        if (typeof document === "undefined") return;
        if (isLoading) {
            document.title = "pullrequest.review";
            return;
        }
        const nextTitle = pullRequestTitle?.trim();
        document.title = nextTitle && nextTitle.length > 0 ? nextTitle : "pullrequest.review";
        return () => {
            document.title = "pullrequest.review";
        };
    }, [isLoading, pullRequestTitle]);
}

export function usePendingBuildStatusesRefresh({
    hasPendingBuildStatuses,
    isFetching,
    refetch,
}: {
    hasPendingBuildStatuses: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
}) {
    useEffect(() => {
        if (!hasPendingBuildStatuses) return;
        const intervalId = window.setInterval(() => {
            if (isFetching) return;
            void refetch();
        }, 10_000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [hasPendingBuildStatuses, isFetching, refetch]);
}

export function useCopyTimeoutCleanup({
    copyResetTimeoutRef,
    copySourceBranchResetTimeoutRef,
}: {
    copyResetTimeoutRef: MutableRefObject<number | null>;
    copySourceBranchResetTimeoutRef: MutableRefObject<number | null>;
}) {
    useEffect(() => {
        return () => {
            if (copyResetTimeoutRef.current !== null) {
                window.clearTimeout(copyResetTimeoutRef.current);
            }
            if (copySourceBranchResetTimeoutRef.current !== null) {
                window.clearTimeout(copySourceBranchResetTimeoutRef.current);
            }
        };
    }, [copyResetTimeoutRef, copySourceBranchResetTimeoutRef]);
}

export function useViewedFilesStorage({
    viewedStorageKey,
    viewedFiles,
    setViewedFiles,
    autoMarkedViewedFilesRef,
}: {
    viewedStorageKey: string | null;
    viewedFiles: Set<string>;
    setViewedFiles: Dispatch<SetStateAction<Set<string>>>;
    autoMarkedViewedFilesRef: MutableRefObject<Set<string>>;
}) {
    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        autoMarkedViewedFilesRef.current = new Set();
        setViewedFiles(readViewedFiles(viewedStorageKey));
    }, [viewedStorageKey, setViewedFiles, autoMarkedViewedFilesRef]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        writeViewedFiles(viewedStorageKey, viewedFiles);
    }, [viewedStorageKey, viewedFiles]);
}

export function useDirectoryStateStorage({
    directoryStateStorageKey,
    dirState,
    dirStateHydrated,
    setDirStateHydrated,
    setDirectoryExpandedMap,
}: {
    directoryStateStorageKey: string;
    dirState: Record<string, { expanded: boolean }>;
    dirStateHydrated: boolean;
    setDirStateHydrated: Dispatch<SetStateAction<boolean>>;
    setDirectoryExpandedMap: (next: Record<string, boolean>) => void;
}) {
    useEffect(() => {
        if (typeof window === "undefined") return;
        setDirStateHydrated(false);
        try {
            const raw = readStorageValue(directoryStateStorageKey);
            if (!raw) {
                setDirectoryExpandedMap({});
                setDirStateHydrated(true);
                return;
            }
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const next: Record<string, boolean> = {};
            for (const [path, expanded] of Object.entries(parsed)) {
                if (!path) continue;
                next[path] = expanded === true;
            }
            setDirectoryExpandedMap(next);
        } catch {
            setDirectoryExpandedMap({});
        } finally {
            setDirStateHydrated(true);
        }
    }, [directoryStateStorageKey, setDirectoryExpandedMap, setDirStateHydrated]);

    useEffect(() => {
        if (!dirStateHydrated || typeof window === "undefined") return;
        const toStore: Record<string, boolean> = {};
        for (const [path, state] of Object.entries(dirState)) {
            if (!path) continue;
            toStore[path] = state.expanded;
        }
        writeLocalStorageValue(directoryStateStorageKey, JSON.stringify(toStore));
    }, [dirState, dirStateHydrated, directoryStateStorageKey]);
}

export function useDiffHighlighterState({
    fileDiffs,
    theme,
    preloadLanguages,
}: {
    fileDiffs: FileDiffMetadata[];
    theme: Parameters<typeof preloadHighlighter>[0]["themes"][number];
    preloadLanguages: string[];
}) {
    const [diffHighlighterReady, setDiffHighlighterReady] = useState(false);
    const [diffPlainTextFallback, setDiffPlainTextFallback] = useState(false);

    useEffect(() => {
        if (fileDiffs.length === 0) {
            setDiffHighlighterReady(true);
            setDiffPlainTextFallback(false);
            return;
        }
        let cancelled = false;
        setDiffHighlighterReady(false);
        setDiffPlainTextFallback(false);
        void preloadHighlighter({
            themes: [theme],
            langs: preloadLanguages as Parameters<typeof preloadHighlighter>[0]["langs"],
        })
            .then(() => {
                if (cancelled) return;
                setDiffHighlighterReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                setDiffPlainTextFallback(true);
                setDiffHighlighterReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [fileDiffs.length, preloadLanguages, theme]);

    return { diffHighlighterReady, diffPlainTextFallback };
}

export function useReviewTreeModelSync({
    showSettingsPanel,
    settingsTreeItems,
    prData,
    setTree,
    setKinds,
}: {
    showSettingsPanel: boolean;
    settingsTreeItems: Array<{ name: string; path: string }>;
    prData: PullRequestBundle | undefined;
    setTree: (nodes: FileNode[]) => void;
    setKinds: (next: ReadonlyMap<string, ChangeKind>) => void;
}) {
    useEffect(() => {
        if (showSettingsPanel) {
            const settingsNodes: FileNode[] = settingsTreeItems.map((item) => ({
                name: item.name,
                path: item.path,
                type: "file",
            }));
            setTree(settingsNodes);
            setKinds(new Map());
            return;
        }
        if (!prData) return;

        const paths = prData.diffstat.map((entry) => entry.new?.path ?? entry.old?.path).filter((path): path is string => Boolean(path));
        const tree = buildTreeFromPaths(paths);
        const summaryNode: FileNode = {
            name: PR_SUMMARY_NAME,
            path: PR_SUMMARY_PATH,
            type: "summary",
        };
        const treeWithSummary = [summaryNode, ...tree];
        const fileKinds = new Map<string, ChangeKind>();

        for (const entry of prData.diffstat) {
            const path = entry.new?.path ?? entry.old?.path;
            if (!path) continue;
            switch (entry.status) {
                case "added":
                    fileKinds.set(path, "add");
                    break;
                case "removed":
                    fileKinds.set(path, "del");
                    break;
                case "modified":
                case "renamed":
                    fileKinds.set(path, "mix");
                    break;
            }
        }

        setTree(treeWithSummary);
        setKinds(buildKindMapForTree(treeWithSummary, fileKinds));
    }, [prData, setKinds, setTree, settingsTreeItems, showSettingsPanel]);
}

export function useReviewTreeReset({
    setTree,
    setKinds,
    setActiveFile,
    setSearchQuery,
}: {
    setTree: (nodes: FileNode[]) => void;
    setKinds: (next: ReadonlyMap<string, ChangeKind>) => void;
    setActiveFile: (next: string | undefined) => void;
    setSearchQuery: Dispatch<SetStateAction<string>>;
}) {
    useEffect(() => {
        setTree([]);
        setKinds(new Map());
        setActiveFile(undefined);
        setSearchQuery("");
    }, [setActiveFile, setKinds, setSearchQuery, setTree]);
}

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
                setActiveFile(firstSettingsPath);
            }
            return;
        }
        if (treeOrderedVisiblePaths.length === 0) return;

        if (!activeFile) {
            setActiveFile(PR_SUMMARY_PATH);
            return;
        }

        if (!visiblePathSet.has(activeFile)) {
            const firstUnviewed = treeOrderedVisiblePaths.find((path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path)) ?? treeOrderedVisiblePaths[0];
            setActiveFile(firstUnviewed);
        }
    }, [activeFile, settingsPathSet, settingsTreeItems, setActiveFile, showSettingsPanel, treeOrderedVisiblePaths, viewedFiles, visiblePathSet]);
}

export function useAutoMarkActiveFileViewed({
    showSettingsPanel,
    showUnviewedOnly,
    activeFile,
    visiblePathSet,
    autoMarkedViewedFilesRef,
    setViewedFiles,
}: {
    showSettingsPanel: boolean;
    showUnviewedOnly: boolean;
    activeFile: string | undefined;
    visiblePathSet: Set<string>;
    autoMarkedViewedFilesRef: MutableRefObject<Set<string>>;
    setViewedFiles: Dispatch<SetStateAction<Set<string>>>;
}) {
    useEffect(() => {
        if (showSettingsPanel) return;
        if (showUnviewedOnly) return;
        if (!activeFile || !visiblePathSet.has(activeFile)) return;
        if (activeFile === PR_SUMMARY_PATH) return;
        if (autoMarkedViewedFilesRef.current.has(activeFile)) return;

        autoMarkedViewedFilesRef.current.add(activeFile);
        setViewedFiles((prev) => {
            if (prev.has(activeFile)) return prev;
            const next = new Set(prev);
            next.add(activeFile);
            return next;
        });
    }, [activeFile, autoMarkedViewedFilesRef, setViewedFiles, showSettingsPanel, showUnviewedOnly, visiblePathSet]);
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
        setActiveFile(PR_SUMMARY_PATH);
    }, [isSummarySelected, prData, selectedFileDiff, setActiveFile, showSettingsPanel, viewMode]);
}

export function useSyncMergeStrategy({
    prData,
    mergeStrategies,
    mergeStrategy,
    setMergeStrategy,
}: {
    prData: PullRequestBundle | undefined;
    mergeStrategies: string[] | undefined;
    mergeStrategy: string;
    setMergeStrategy: Dispatch<SetStateAction<string>>;
}) {
    useEffect(() => {
        if (!prData) return;
        if (!mergeStrategies?.length) return;
        if (!mergeStrategies.includes(mergeStrategy)) {
            setMergeStrategy(mergeStrategies[0] ?? "merge");
        }
    }, [mergeStrategies, mergeStrategy, prData, setMergeStrategy]);
}

export function useInlineDraftFocus({
    inlineComment,
    inlineDraftFocusRef,
}: {
    inlineComment: { path: string; line: number; side: "additions" | "deletions" } | null;
    inlineDraftFocusRef: MutableRefObject<(() => void) | null>;
}) {
    useEffect(() => {
        if (!inlineComment) return;
        const timeoutId = window.setTimeout(() => {
            inlineDraftFocusRef.current?.();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [inlineComment?.line, inlineComment?.path, inlineComment?.side, inlineComment, inlineDraftFocusRef]);
}
