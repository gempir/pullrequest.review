import { type FileDiffMetadata, preloadHighlighter } from "@pierre/diffs";
import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { readReviewDirectoryState, writeReviewDirectoryState } from "@/lib/data/query-collections";
import { fileAnchorId } from "@/lib/file-anchors";
import { buildKindMapForTree, buildTreeFromPaths, type ChangeKind, type FileNode } from "@/lib/file-tree-context";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { clearableHashFromPath, parsePrFileHash } from "@/lib/pr-file-hash";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";

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
        const stored = readReviewDirectoryState(directoryStateStorageKey);
        if (!stored) {
            setDirectoryExpandedMap({});
            setDirStateHydrated(true);
            return;
        }

        const next: Record<string, boolean> = {};
        for (const [path, expanded] of Object.entries(stored)) {
            if (!path) continue;
            next[path] = expanded === true;
        }
        setDirectoryExpandedMap(next);
        setDirStateHydrated(true);
    }, [directoryStateStorageKey, setDirectoryExpandedMap, setDirStateHydrated]);

    useEffect(() => {
        if (!dirStateHydrated || typeof window === "undefined") return;
        const toStore: Record<string, boolean> = {};
        for (const [path, state] of Object.entries(dirState)) {
            if (!path) continue;
            toStore[path] = state.expanded;
        }
        writeReviewDirectoryState(directoryStateStorageKey, toStore);
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
    const preloadLanguagesKey = useMemo(() => [...new Set(preloadLanguages)].sort().join(","), [preloadLanguages]);
    const languagesForPreload = useMemo(() => {
        if (!preloadLanguagesKey) return [];
        return preloadLanguagesKey.split(",");
    }, [preloadLanguagesKey]);

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
            langs: languagesForPreload as Parameters<typeof preloadHighlighter>[0]["langs"],
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
    }, [fileDiffs.length, languagesForPreload, theme]);

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

export function useReviewFileHashSelection({
    selectableFilePaths,
    onHashPathResolved,
}: {
    selectableFilePaths: Set<string>;
    onHashPathResolved: (path: string) => void;
}) {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const applyHashSelection = () => {
            const pathFromHash = parsePrFileHash(window.location.hash);
            if (!pathFromHash) return;
            if (!selectableFilePaths.has(pathFromHash)) return;
            onHashPathResolved(pathFromHash);
        };

        applyHashSelection();
        window.addEventListener("hashchange", applyHashSelection);
        return () => {
            window.removeEventListener("hashchange", applyHashSelection);
        };
    }, [onHashPathResolved, selectableFilePaths]);
}

export function useReviewFileHashSync({
    activeFile,
    showSettingsPanel,
    settingsPathSet,
    suppressHashSyncRef,
}: {
    activeFile: string | undefined;
    showSettingsPanel: boolean;
    settingsPathSet: Set<string>;
    suppressHashSyncRef?: MutableRefObject<boolean>;
}) {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (suppressHashSyncRef?.current) {
            suppressHashSyncRef.current = false;
            return;
        }
        if (!showSettingsPanel && !activeFile) return;

        const nextHash = showSettingsPanel
            ? undefined
            : clearableHashFromPath(activeFile, {
                  isSettingsPath: Boolean(activeFile && settingsPathSet.has(activeFile)),
              });
        const currentHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
        if (!nextHash && !currentHash) return;
        if (nextHash && currentHash === nextHash) return;

        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ""}`;
        window.history.replaceState(window.history.state, "", nextUrl);
    }, [activeFile, settingsPathSet, showSettingsPanel, suppressHashSyncRef]);
}

export function useAllModeScrollSelection({
    enabled,
    diffScrollRef,
    sectionPaths,
    stickyTopOffset,
    programmaticTargetRef,
    suppressObserverUntilRef,
    onObservedActivePath,
}: {
    enabled: boolean;
    diffScrollRef: MutableRefObject<HTMLDivElement | null>;
    sectionPaths: string[];
    stickyTopOffset: number;
    programmaticTargetRef: MutableRefObject<string | null>;
    suppressObserverUntilRef: MutableRefObject<number>;
    onObservedActivePath: (path: string, metadata: { isSticky: boolean }) => void;
}) {
    const lastObservedPathRef = useRef<string | null>(null);
    const lastObservedStickyRef = useRef<boolean | null>(null);
    const onObservedActivePathRef = useRef(onObservedActivePath);

    useEffect(() => {
        onObservedActivePathRef.current = onObservedActivePath;
    }, [onObservedActivePath]);

    useEffect(() => {
        if (!enabled) return;
        if (typeof window === "undefined") return;
        if (sectionPaths.length === 0) return;

        const root = diffScrollRef.current;
        if (!root) return;

        const sectionAnchors = new Map<string, HTMLElement>();
        for (const path of sectionPaths) {
            const anchor = document.getElementById(fileAnchorId(path));
            if (!anchor) continue;
            sectionAnchors.set(path, anchor);
        }
        if (sectionAnchors.size === 0) return;

        let animationFrameId = 0;

        const resolveCandidate = () => {
            const rootTop = root.getBoundingClientRect().top;
            const stickyLine = rootTop + stickyTopOffset;
            let stickyCandidatePath: string | null = null;
            let stickyCandidateTop = Number.NEGATIVE_INFINITY;
            let nonStickyCandidatePath: string | null = null;
            let nonStickyCandidateTop = Number.POSITIVE_INFINITY;

            for (const path of sectionPaths) {
                const anchor = sectionAnchors.get(path);
                if (!anchor) continue;
                const rect = anchor.getBoundingClientRect();
                if (rect.bottom <= stickyLine) continue;
                if (rect.top <= stickyLine) {
                    if (rect.top > stickyCandidateTop) {
                        stickyCandidateTop = rect.top;
                        stickyCandidatePath = path;
                    }
                    continue;
                }
                if (rect.top < nonStickyCandidateTop) {
                    nonStickyCandidateTop = rect.top;
                    nonStickyCandidatePath = path;
                }
            }

            const bestPath = stickyCandidatePath ?? nonStickyCandidatePath;
            if (!bestPath) return;

            const now = Date.now();
            const suppressed = now < suppressObserverUntilRef.current;
            const programmaticTarget = programmaticTargetRef.current;
            if (suppressed && programmaticTarget && bestPath !== programmaticTarget) return;

            const isSticky = stickyCandidatePath === bestPath;
            if (lastObservedPathRef.current === bestPath && lastObservedStickyRef.current === isSticky) return;
            lastObservedPathRef.current = bestPath;
            lastObservedStickyRef.current = isSticky;
            onObservedActivePathRef.current(bestPath, { isSticky });
        };

        const queueResolveCandidate = () => {
            if (animationFrameId !== 0) return;
            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = 0;
                resolveCandidate();
            });
        };

        const observer = new IntersectionObserver(
            () => {
                queueResolveCandidate();
            },
            {
                root,
                threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
                rootMargin: `-${stickyTopOffset}px 0px -55% 0px`,
            },
        );

        for (const path of sectionPaths) {
            const anchor = sectionAnchors.get(path);
            if (!anchor) continue;
            observer.observe(anchor);
        }

        root.addEventListener("scroll", queueResolveCandidate, { passive: true });
        window.addEventListener("resize", queueResolveCandidate);
        queueResolveCandidate();

        return () => {
            root.removeEventListener("scroll", queueResolveCandidate);
            window.removeEventListener("resize", queueResolveCandidate);
            observer.disconnect();
            if (animationFrameId !== 0) {
                window.cancelAnimationFrame(animationFrameId);
            }
            lastObservedPathRef.current = null;
            lastObservedStickyRef.current = null;
        };
    }, [diffScrollRef, enabled, programmaticTargetRef, sectionPaths, stickyTopOffset, suppressObserverUntilRef]);
}

export function useAutoMarkActiveFileViewed({
    viewMode,
    autoMarkViewedFiles,
    showSettingsPanel,
    activeFile,
    visiblePathSet,
    autoMarkedViewedVersionIdsRef,
    getSelectedVersionIdForPath,
    markPathViewed,
}: {
    viewMode: "single" | "all";
    autoMarkViewedFiles: boolean;
    showSettingsPanel: boolean;
    activeFile: string | undefined;
    visiblePathSet: Set<string>;
    autoMarkedViewedVersionIdsRef: MutableRefObject<Set<string>>;
    getSelectedVersionIdForPath: (path: string) => string | undefined;
    markPathViewed: (path: string) => void;
}) {
    useEffect(() => {
        if (!autoMarkViewedFiles) return;
        if (viewMode !== "single") return;
        if (showSettingsPanel) return;
        if (!activeFile || !visiblePathSet.has(activeFile)) return;
        if (activeFile === PR_SUMMARY_PATH) return;
        const selectedVersionId = getSelectedVersionIdForPath(activeFile);
        if (!selectedVersionId) return;
        if (autoMarkedViewedVersionIdsRef.current.has(selectedVersionId)) return;

        autoMarkedViewedVersionIdsRef.current.add(selectedVersionId);
        markPathViewed(activeFile);
    }, [
        activeFile,
        autoMarkViewedFiles,
        autoMarkedViewedVersionIdsRef,
        getSelectedVersionIdForPath,
        markPathViewed,
        showSettingsPanel,
        viewMode,
        visiblePathSet,
    ]);
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
