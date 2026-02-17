import type { FileDiffOptions, OnDiffLineClickProps } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useLiveQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { createReviewPageUiStore, useReviewPageUiValue } from "@/components/pull-request-review/review-page.store";
import { ReviewPageDiffContent } from "@/components/pull-request-review/review-page-diff-content";
import { ReviewPageAuthRequiredState, ReviewPageErrorState } from "@/components/pull-request-review/review-page-guards";
import { ReviewPageLoadingView } from "@/components/pull-request-review/review-page-loading-view";
import { ReviewPageMainView } from "@/components/pull-request-review/review-page-main-view";
import type { SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
import { useInlineCommentDrafts } from "@/components/pull-request-review/use-inline-comment-drafts";
import { useReviewLayoutPreferences } from "@/components/pull-request-review/use-review-layout-preferences";
import { useReviewPageActions } from "@/components/pull-request-review/use-review-page-actions";
import { useReviewPageDerived } from "@/components/pull-request-review/use-review-page-derived";
import {
    useAllModeScrollSelection,
    useAutoMarkActiveFileViewed,
    useCopyTimeoutCleanup,
    useDirectoryStateStorage,
    useEnsureSummarySelection,
    useInlineDraftFocus,
    useReviewActiveFileSync,
    useReviewDocumentTitle,
    useReviewFileHashSelection,
    useReviewFileHashSync,
    useReviewTreeModelSync,
    useReviewTreeReset,
    useSyncMergeStrategy,
} from "@/components/pull-request-review/use-review-page-effects";
import { useReviewPageNavigation } from "@/components/pull-request-review/use-review-page-navigation";
import { useReviewPageViewProps } from "@/components/pull-request-review/use-review-page-view-props";
import { isRateLimitedError as isRateLimitedQueryError, useReviewQuery } from "@/components/pull-request-review/use-review-query";
import {
    buildLatestVersionIdByPath,
    cleanupViewedVersionIds,
    collectKnownVersionIds,
    getVersionLabel,
    mergeCurrentFileVersionsIntoHistory,
    readFileVersionHistory,
    readViewedVersionIds,
    type StoredFileHistory,
    type StoredFileVersion,
    useViewedStorageKey,
    writeFileVersionHistory,
    writeViewedVersionIds,
} from "@/components/pull-request-review/use-review-storage";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions, useDiffOptions } from "@/lib/diff-options-context";
import { commentAnchorId, fileAnchorId } from "@/lib/file-anchors";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
import {
    getHostDataCollectionsVersionSnapshot,
    getPullRequestFileContextCollection,
    savePullRequestFileContextRecord,
    subscribeHostDataCollectionsVersion,
} from "@/lib/git-host/query-collections";
import { buildReviewActionPolicy } from "@/lib/git-host/review-policy";
import { fetchPullRequestFileContents } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { makeDirectoryStateStorageKey } from "@/lib/review-storage";

export interface PullRequestReviewPageProps {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    auth: { canWrite: boolean; canRead: boolean };
    onRequireAuth?: (reason: "write" | "rate_limit") => void;
    authPromptSlot?: ReactNode;
}

function splitFileIntoLines(contents: string) {
    if (!contents) return [];
    const normalized = contents.replace(/\r\n/g, "\n");
    const lines: string[] = [];
    let start = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        if (normalized[i] === "\n") {
            lines.push(normalized.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < normalized.length) {
        lines.push(normalized.slice(start));
    }
    return lines;
}

type FullFileContextEntry =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; oldLines: string[]; newLines: string[]; fetchedAt: number };

const ALL_MODE_SCROLL_RETRY_DELAYS = [0, 80, 180, 320, 500, 700, 950, 1200, 1500, 1850, 2200, 2600, 3000, 3400, 3800] as const;
const ALL_MODE_STICKY_OFFSET = 0;

function parentDirectories(path: string): string[] {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return [];
    parts.pop();
    const directories: string[] = [];
    let current = "";
    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        directories.push(current);
    }
    return directories;
}

export function PullRequestReviewPage({ host, workspace, repo, pullRequestId, auth, onRequireAuth, authPromptSlot }: PullRequestReviewPageProps) {
    const navigate = useNavigate();
    const requestAuth = useCallback(
        (reason: "write" | "rate_limit") => {
            onRequireAuth?.(reason);
        },
        [onRequireAuth],
    );
    const { options } = useDiffOptions();
    const { monospaceFontFamily, monospaceFontSize, monospaceLineHeight } = useAppearance();
    const diffTypographyStyle = useMemo(() => {
        const fontFamily = fontFamilyToCss(options.diffUseCustomTypography ? options.diffFontFamily : monospaceFontFamily);
        const fontSize = `${options.diffUseCustomTypography ? options.diffFontSize : monospaceFontSize}px`;
        const lineHeight = String(options.diffUseCustomTypography ? options.diffLineHeight : monospaceLineHeight);
        return {
            "--diff-font-family": fontFamily,
            "--diff-font-size": fontSize,
            "--diff-line-height": lineHeight,
            "--diffs-font-family": fontFamily,
            "--diffs-font-size": fontSize,
            "--diffs-line-height": lineHeight,
        } as CSSProperties;
    }, [
        monospaceFontFamily,
        monospaceFontSize,
        monospaceLineHeight,
        options.diffFontFamily,
        options.diffFontSize,
        options.diffLineHeight,
        options.diffUseCustomTypography,
    ]);
    const { root, dirState, setTree, setKinds, allFiles, activeFile, setActiveFile, setDirectoryExpandedMap, expand } = useFileTree();
    const { treeWidth, treeCollapsed, setTreeCollapsed, viewMode, setViewMode, startTreeResize } = useReviewLayoutPreferences();
    const hostDataCollectionsVersion = useSyncExternalStore(
        subscribeHostDataCollectionsVersion,
        getHostDataCollectionsVersionSnapshot,
        getHostDataCollectionsVersionSnapshot,
    );

    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const diffScrollRef = useRef<HTMLDivElement | null>(null);
    const inlineDraftFocusRef = useRef<(() => void) | null>(null);
    const uiStoreRef = useRef(createReviewPageUiStore());
    const uiStore = uiStoreRef.current;
    const searchQuery = useReviewPageUiValue(uiStore, (state) => state.searchQuery);
    const showUnviewedOnly = useReviewPageUiValue(uiStore, (state) => state.showUnviewedOnly);
    const showSettingsPanel = useReviewPageUiValue(uiStore, (state) => state.showSettingsPanel);
    const mergeOpen = useReviewPageUiValue(uiStore, (state) => state.mergeOpen);
    const mergeMessage = useReviewPageUiValue(uiStore, (state) => state.mergeMessage);
    const mergeStrategy = useReviewPageUiValue(uiStore, (state) => state.mergeStrategy);
    const closeSourceBranch = useReviewPageUiValue(uiStore, (state) => state.closeSourceBranch);
    const copiedPath = useReviewPageUiValue(uiStore, (state) => state.copiedPath);
    const copiedSourceBranch = useReviewPageUiValue(uiStore, (state) => state.copiedSourceBranch);
    const setSearchQuery = useCallback(
        (next: SetStateAction<string>) => {
            uiStore.setState((prev) => ({
                ...prev,
                searchQuery: typeof next === "function" ? (next as (current: string) => string)(prev.searchQuery) : next,
            }));
        },
        [uiStore],
    );
    const setShowUnviewedOnly = useCallback(
        (next: SetStateAction<boolean>) => {
            uiStore.setState((prev) => ({
                ...prev,
                showUnviewedOnly: typeof next === "function" ? (next as (current: boolean) => boolean)(prev.showUnviewedOnly) : next,
            }));
        },
        [uiStore],
    );
    const setShowSettingsPanel = useCallback(
        (next: SetStateAction<boolean>) => {
            uiStore.setState((prev) => ({
                ...prev,
                showSettingsPanel: typeof next === "function" ? (next as (current: boolean) => boolean)(prev.showSettingsPanel) : next,
            }));
        },
        [uiStore],
    );
    const setMergeOpen = useCallback(
        (next: SetStateAction<boolean>) => {
            uiStore.setState((prev) => ({
                ...prev,
                mergeOpen: typeof next === "function" ? (next as (current: boolean) => boolean)(prev.mergeOpen) : next,
            }));
        },
        [uiStore],
    );
    const setMergeMessage = useCallback(
        (next: SetStateAction<string>) => {
            uiStore.setState((prev) => ({
                ...prev,
                mergeMessage: typeof next === "function" ? (next as (current: string) => string)(prev.mergeMessage) : next,
            }));
        },
        [uiStore],
    );
    const setMergeStrategy = useCallback(
        (next: SetStateAction<string>) => {
            uiStore.setState((prev) => ({
                ...prev,
                mergeStrategy: typeof next === "function" ? (next as (current: string) => string)(prev.mergeStrategy) : next,
            }));
        },
        [uiStore],
    );
    const setCloseSourceBranch = useCallback(
        (next: SetStateAction<boolean>) => {
            uiStore.setState((prev) => ({
                ...prev,
                closeSourceBranch: typeof next === "function" ? (next as (current: boolean) => boolean)(prev.closeSourceBranch) : next,
            }));
        },
        [uiStore],
    );
    const setCopiedPath = useCallback(
        (next: SetStateAction<string | null>) => {
            uiStore.setState((prev) => ({
                ...prev,
                copiedPath: typeof next === "function" ? (next as (current: string | null) => string | null)(prev.copiedPath) : next,
            }));
        },
        [uiStore],
    );
    const setCopiedSourceBranch = useCallback(
        (next: boolean) => {
            uiStore.setState((prev) => ({
                ...prev,
                copiedSourceBranch: next,
            }));
        },
        [uiStore],
    );
    const [viewedVersionIds, setViewedVersionIds] = useState<Set<string>>(new Set());
    const [fileVersionHistoryByPath, setFileVersionHistoryByPath] = useState<Record<string, StoredFileHistory>>({});
    const [selectedVersionIdByPath, setSelectedVersionIdByPath] = useState<Record<string, string>>({});
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [fileContexts, setFileContexts] = useState<Record<string, FullFileContextEntry>>({});
    const [dirStateHydrated, setDirStateHydrated] = useState(false);
    const [pendingCommentTick, setPendingCommentTick] = useState(0);
    const autoMarkedViewedVersionIdsRef = useRef<Set<string>>(new Set());
    const copyResetTimeoutRef = useRef<number | null>(null);
    const copySourceBranchResetTimeoutRef = useRef<number | null>(null);
    const allModeProgrammaticTargetRef = useRef<string | null>(null);
    const [allModePendingScrollPath, setAllModePendingScrollPath] = useState<string | null>(null);
    const allModeSuppressObserverUntilRef = useRef<number>(0);
    const allModeLastStickyPathRef = useRef<string | null>(null);
    const suppressHashSyncRef = useRef(false);
    const pendingCommentScrollRef = useRef<number | null>(null);
    const loadedViewedStorageKeyRef = useRef<string>("");
    const { inlineComment, setInlineComment, getInlineDraftContent, setInlineDraftContent, clearInlineDraftContent, openInlineCommentDraft } =
        useInlineCommentDrafts({
            workspace,
            repo,
            pullRequestId,
            setActiveFile,
            setViewMode,
        });
    const { hostCapabilities, query: prQuery } = useReviewQuery({
        host,
        workspace,
        repo,
        pullRequestId,
        canRead: auth.canRead,
        canWrite: auth.canWrite,
        onRequireAuth: (reason) => {
            requestAuth(reason);
        },
    });

    const prData = prQuery.data;
    const pullRequest = prData?.pr;
    const pullRequestUrl = pullRequest?.links?.html?.href;
    const pullRequestTitle = pullRequest?.title?.trim();
    const isPrQueryFetching = prQuery.isFetching;
    const refetchPrQuery = prQuery.refetch;
    const isRateLimitedError = useMemo(() => isRateLimitedQueryError(prQuery.error), [prQuery.error]);
    useReviewDocumentTitle({ isLoading: prQuery.isLoading, pullRequestTitle });

    // Build viewed-file storage key from stable primitives to avoid object identity churn.
    const viewedStorageKey = useViewedStorageKey(prData?.prRef);
    const latestVersionIdByPath = useMemo(() => buildLatestVersionIdByPath(fileVersionHistoryByPath), [fileVersionHistoryByPath]);
    const viewedFiles = useMemo(() => {
        const next = new Set<string>();
        for (const [path, latestVersionId] of latestVersionIdByPath.entries()) {
            if (viewedVersionIds.has(latestVersionId)) {
                next.add(path);
            }
        }
        return next;
    }, [latestVersionIdByPath, viewedVersionIds]);

    const directoryStateStorageKey = useMemo(() => makeDirectoryStateStorageKey(workspace, repo, pullRequestId), [pullRequestId, repo, workspace]);
    const prRef = useMemo(() => ({ host, workspace, repo, pullRequestId }), [host, workspace, repo, pullRequestId]);
    const prContextKey = useMemo(() => `${host}:${workspace}/${repo}/${pullRequestId}`, [host, workspace, repo, pullRequestId]);
    const fileContextCollection = useMemo(() => {
        // Recreate the scoped collection when host-data storage falls back.
        void hostDataCollectionsVersion;
        return getPullRequestFileContextCollection();
    }, [hostDataCollectionsVersion]);
    const fileContextQuery = useLiveQuery((q) => q.from({ context: fileContextCollection }).select(({ context }) => ({ ...context })), [fileContextCollection]);
    const persistedFileContexts = useMemo(() => {
        const entries: Record<string, { oldLines: string[]; newLines: string[]; fetchedAt: number }> = {};
        for (const record of fileContextQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[record.path] = {
                oldLines: record.oldLines,
                newLines: record.newLines,
                fetchedAt: record.fetchedAt,
            };
        }
        return entries;
    }, [fileContextQuery.data, prContextKey]);

    const readyFileContextsRef = useRef<Record<string, { oldLines: string[]; newLines: string[] }>>({});

    const readyFileContexts = useMemo(() => {
        const prevEntries = readyFileContextsRef.current;
        const nextEntries: Record<string, { oldLines: string[]; newLines: string[] }> = {};
        let changed = false;

        for (const [path, entry] of Object.entries(fileContexts)) {
            if (entry.status !== "ready") continue;
            const prev = prevEntries[path];
            if (prev && prev.oldLines === entry.oldLines && prev.newLines === entry.newLines) {
                nextEntries[path] = prev;
                continue;
            }
            nextEntries[path] = { oldLines: entry.oldLines, newLines: entry.newLines };
            changed = true;
        }

        const prevKeys = Object.keys(prevEntries);
        const nextKeys = Object.keys(nextEntries);
        const hasKeyChange = prevKeys.length !== nextKeys.length || prevKeys.some((key) => nextEntries[key] !== prevEntries[key]);

        if (!changed && !hasKeyChange) {
            return prevEntries;
        }

        readyFileContextsRef.current = nextEntries;
        return nextEntries;
    }, [fileContexts]);

    const fileContextStatus = useMemo(() => {
        const entries: Record<string, DiffContextState> = {};
        for (const [path, entry] of Object.entries(fileContexts)) {
            if (entry.status === "loading" || entry.status === "idle") {
                entries[path] = entry;
            } else if (entry.status === "ready") {
                entries[path] = { status: "ready" };
            } else {
                entries[path] = { status: "error", error: entry.error };
            }
        }
        return entries;
    }, [fileContexts]);

    useEffect(() => {
        setFileContexts((prev) => {
            let changed = false;
            const next: Record<string, FullFileContextEntry> = { ...prev };

            for (const [path, context] of Object.entries(persistedFileContexts)) {
                const existing = next[path];
                if (existing?.status === "ready" && existing.fetchedAt === context.fetchedAt) {
                    continue;
                }
                next[path] = {
                    status: "ready",
                    oldLines: context.oldLines,
                    newLines: context.newLines,
                    fetchedAt: context.fetchedAt,
                };
                changed = true;
            }

            for (const [path, entry] of Object.entries(next)) {
                if (entry.status === "ready" && !persistedFileContexts[path]) {
                    delete next[path];
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [persistedFileContexts]);

    useCopyTimeoutCleanup({
        copyResetTimeoutRef,
        copySourceBranchResetTimeoutRef,
    });
    useDirectoryStateStorage({
        directoryStateStorageKey,
        dirState,
        dirStateHydrated,
        setDirStateHydrated,
        setDirectoryExpandedMap,
    });
    const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
    const libOptions = toLibraryOptions(options);
    const compactDiffOptions = useMemo<FileDiffOptions<undefined>>(
        () => ({
            ...libOptions,
            hunkSeparators: options.hunkSeparators,
            disableFileHeader: true,
        }),
        [libOptions, options.hunkSeparators],
    );

    const openInlineCommentDraftForPath = useCallback(
        (path: string, props: OnDiffLineClickProps) => {
            openInlineCommentDraft({
                path,
                line: props.lineNumber,
                side: props.annotationSide ?? "additions",
            });
        },
        [openInlineCommentDraft],
    );

    const handleLoadFullFileContext = useCallback(
        async (filePath: string, fileDiff: FileDiffMetadata) => {
            const current = fileContexts[filePath];
            if (current?.status === "loading") return;
            if (current?.status === "ready" || persistedFileContexts[filePath]) return;
            setFileContexts((prev) => ({ ...prev, [filePath]: { status: "loading" } }));
            try {
                const baseCommit = prData?.pr.destination?.commit?.hash;
                const headCommit = prData?.pr.source?.commit?.hash;
                const needsBase = fileDiff.type !== "new";
                const needsHead = fileDiff.type !== "deleted";
                if (needsBase && !baseCommit) {
                    throw new Error("Base commit is unavailable for this pull request.");
                }
                if (needsHead && !headCommit) {
                    throw new Error("Head commit is unavailable for this pull request.");
                }
                const effectiveBaseCommit = baseCommit ?? "";
                const effectiveHeadCommit = headCommit ?? "";
                const oldPath = (fileDiff.prevName ?? fileDiff.name ?? filePath).trim();
                const newPath = (fileDiff.name ?? fileDiff.prevName ?? filePath).trim();
                const [oldContent, newContent] = await Promise.all([
                    needsBase ? fetchPullRequestFileContents({ prRef, commit: effectiveBaseCommit, path: oldPath }) : Promise.resolve(""),
                    needsHead ? fetchPullRequestFileContents({ prRef, commit: effectiveHeadCommit, path: newPath }) : Promise.resolve(""),
                ]);
                const readyOldLines = needsBase ? splitFileIntoLines(oldContent) : [];
                const readyNewLines = needsHead ? splitFileIntoLines(newContent) : [];
                const fetchedAt = Date.now();
                await savePullRequestFileContextRecord({
                    prRef,
                    path: filePath,
                    oldLines: readyOldLines,
                    newLines: readyNewLines,
                    fetchedAt,
                });
                setFileContexts((prev) => ({
                    ...prev,
                    [filePath]: {
                        status: "ready",
                        oldLines: readyOldLines,
                        newLines: readyNewLines,
                        fetchedAt,
                    },
                }));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unable to load file context.";
                setFileContexts((prev) => ({ ...prev, [filePath]: { status: "error", error: message } }));
            }
        },
        [fileContexts, persistedFileContexts, prData?.pr.destination?.commit?.hash, prData?.pr.source?.commit?.hash, prRef],
    );

    const {
        diffHighlighterReady,
        toRenderableFileDiff,
        settingsPathSet,
        selectableDiffPathSet,
        visiblePathSet,
        allowedPathSet,
        directoryPaths,
        treeOrderedVisiblePaths,
        allModeDiffEntries,
        selectedFilePath,
        selectedFileDiff,
        isSummarySelected,
        threadsByPath,
        selectedFileLevelThreads,
        lineStats,
        navbarStatusDate,
        navbarState,
        fileLineStats,
        handleDiffLineEnter,
        handleDiffLineLeave,
        buildFileAnnotations,
        singleFileAnnotations,
        singleFileDiffOptions,
        fileDiffFingerprints,
        fileDiffSnapshots,
    } = useReviewPageDerived({
        prData,
        pullRequest,
        activeFile,
        showUnviewedOnly,
        searchQuery,
        showSettingsPanel,
        viewedFiles,
        root,
        allFiles,
        settingsTreeItems,
        inlineComment,
        theme: options.theme,
        compactDiffOptions,
        onOpenInlineCommentDraft: openInlineCommentDraftForPath,
        fullFileContexts: readyFileContexts,
    });
    const sourceCommitHash = prData?.pr.source?.commit?.hash;
    const destinationCommitHash = prData?.pr.destination?.commit?.hash;

    const currentFileVersionsByPath = useMemo(() => {
        const next = new Map<
            string,
            {
                fingerprint: string;
                snapshot: { type: string; name: string; prevName?: string; hunks: unknown[] };
                sourceCommitHash?: string;
                destinationCommitHash?: string;
            }
        >();
        for (const [path, fingerprint] of fileDiffFingerprints.entries()) {
            const snapshot = fileDiffSnapshots.get(path);
            if (!snapshot) continue;
            next.set(path, {
                fingerprint,
                snapshot,
                sourceCommitHash,
                destinationCommitHash,
            });
        }
        return next;
    }, [destinationCommitHash, fileDiffFingerprints, fileDiffSnapshots, sourceCommitHash]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        if (loadedViewedStorageKeyRef.current === viewedStorageKey) return;
        loadedViewedStorageKeyRef.current = viewedStorageKey;
        autoMarkedViewedVersionIdsRef.current = new Set();
        const history = readFileVersionHistory(viewedStorageKey);
        const knownVersionIds = collectKnownVersionIds(history);
        const fingerprintFallback = new Map<string, string>();
        for (const [path, current] of currentFileVersionsByPath.entries()) {
            fingerprintFallback.set(path, current.fingerprint);
        }
        const viewedIds = readViewedVersionIds(viewedStorageKey, {
            fileDiffFingerprints: fingerprintFallback,
            knownVersionIds,
        });
        setFileVersionHistoryByPath(history);
        setViewedVersionIds(viewedIds);
        setSelectedVersionIdByPath({});
    }, [currentFileVersionsByPath, viewedStorageKey]);

    useEffect(() => {
        setFileVersionHistoryByPath((prev) => mergeCurrentFileVersionsIntoHistory(prev, currentFileVersionsByPath));
    }, [currentFileVersionsByPath]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        writeFileVersionHistory(viewedStorageKey, fileVersionHistoryByPath);
    }, [fileVersionHistoryByPath, viewedStorageKey]);

    const knownVersionIds = useMemo(() => collectKnownVersionIds(fileVersionHistoryByPath), [fileVersionHistoryByPath]);

    useEffect(() => {
        setViewedVersionIds((prev) => cleanupViewedVersionIds(prev, knownVersionIds));
    }, [knownVersionIds]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        writeViewedVersionIds(viewedStorageKey, viewedVersionIds);
    }, [viewedStorageKey, viewedVersionIds]);

    useEffect(() => {
        setSelectedVersionIdByPath((prev) => {
            let changed = false;
            const next: Record<string, string> = {};
            for (const [path, pathHistory] of Object.entries(fileVersionHistoryByPath)) {
                const latestVersionId = pathHistory.order[0];
                if (!latestVersionId) continue;
                next[path] = latestVersionId;
                if (prev[path] !== latestVersionId) {
                    changed = true;
                }
            }
            if (!changed && Object.keys(prev).length === Object.keys(next).length) {
                return prev;
            }
            return next;
        });
    }, [fileVersionHistoryByPath]);

    const getSelectedVersionIdForPath = useCallback(
        (path: string) => {
            const selectedVersionId = selectedVersionIdByPath[path];
            if (selectedVersionId && fileVersionHistoryByPath[path]?.versions[selectedVersionId]) {
                return selectedVersionId;
            }
            return latestVersionIdByPath.get(path);
        },
        [fileVersionHistoryByPath, latestVersionIdByPath, selectedVersionIdByPath],
    );

    const markVersionViewed = useCallback((versionId: string) => {
        setViewedVersionIds((prev) => {
            if (prev.has(versionId)) return prev;
            const next = new Set(prev);
            next.add(versionId);
            return next;
        });
    }, []);

    const markPathViewed = useCallback(
        (path: string) => {
            const selectedVersionId = getSelectedVersionIdForPath(path);
            if (!selectedVersionId) return;
            markVersionViewed(selectedVersionId);
        },
        [getSelectedVersionIdForPath, markVersionViewed],
    );

    const markLatestPathViewed = useCallback(
        (path: string) => {
            const latestVersionId = latestVersionIdByPath.get(path);
            if (!latestVersionId) return;
            markVersionViewed(latestVersionId);
        },
        [latestVersionIdByPath, markVersionViewed],
    );

    const toggleViewedForPath = useCallback(
        (path: string) => {
            const selectedVersionId = getSelectedVersionIdForPath(path);
            if (!selectedVersionId) return;
            setViewedVersionIds((prev) => {
                const next = new Set(prev);
                if (next.has(selectedVersionId)) {
                    next.delete(selectedVersionId);
                } else {
                    next.add(selectedVersionId);
                }
                return next;
            });
        },
        [getSelectedVersionIdForPath],
    );

    const isPathViewed = useCallback((path: string) => viewedFiles.has(path), [viewedFiles]);
    const isVersionViewed = useCallback((versionId: string) => viewedVersionIds.has(versionId), [viewedVersionIds]);
    const setSelectedVersionForPath = useCallback((path: string, versionId: string) => {
        setSelectedVersionIdByPath((prev) => {
            if (prev[path] === versionId) return prev;
            return {
                ...prev,
                [path]: versionId,
            };
        });
    }, []);
    const getVersionOptionsForPath = useCallback(
        (path: string) => {
            const pathHistory = fileVersionHistoryByPath[path];
            if (!pathHistory || pathHistory.order.length === 0)
                return [] as Array<{ id: string; label: string; unread: boolean; latest: boolean; version: StoredFileVersion }>;
            const latestVersionId = pathHistory.order[0];
            return pathHistory.order
                .map((versionId, index) => {
                    const version = pathHistory.versions[versionId];
                    if (!version) return null;
                    const latest = versionId === latestVersionId;
                    return {
                        id: versionId,
                        label: getVersionLabel(version, latest, index),
                        unread: !viewedVersionIds.has(versionId),
                        latest,
                        version,
                    };
                })
                .filter((option): option is { id: string; label: string; unread: boolean; latest: boolean; version: StoredFileVersion } => Boolean(option));
        },
        [fileVersionHistoryByPath, viewedVersionIds],
    );
    const resolveDisplayedDiffForPath = useCallback(
        (path: string, latestFileDiff: FileDiffMetadata | undefined) => {
            if (!latestFileDiff) {
                return {
                    fileDiff: undefined,
                    readOnlyHistorical: false,
                    selectedVersionId: undefined,
                };
            }
            const selectedVersionId = getSelectedVersionIdForPath(path);
            const latestVersionId = latestVersionIdByPath.get(path);
            if (!selectedVersionId || !latestVersionId || selectedVersionId === latestVersionId) {
                return {
                    fileDiff: latestFileDiff,
                    readOnlyHistorical: false,
                    selectedVersionId: latestVersionId ?? selectedVersionId,
                };
            }
            const selectedVersion = fileVersionHistoryByPath[path]?.versions[selectedVersionId];
            if (!selectedVersion) {
                return {
                    fileDiff: latestFileDiff,
                    readOnlyHistorical: false,
                    selectedVersionId: latestVersionId,
                };
            }
            return {
                fileDiff: selectedVersion.snapshot as unknown as FileDiffMetadata,
                readOnlyHistorical: true,
                selectedVersionId,
            };
        },
        [fileVersionHistoryByPath, getSelectedVersionIdForPath, latestVersionIdByPath],
    );
    const selectedFileDisplayState = useMemo(
        () =>
            selectedFilePath
                ? resolveDisplayedDiffForPath(selectedFilePath, selectedFileDiff)
                : { fileDiff: selectedFileDiff, readOnlyHistorical: false, selectedVersionId: undefined },
        [resolveDisplayedDiffForPath, selectedFileDiff, selectedFilePath],
    );

    const allModeSectionPaths = useMemo(
        () => (prData ? [PR_SUMMARY_PATH, ...allModeDiffEntries.map((entry) => entry.filePath)] : allModeDiffEntries.map((entry) => entry.filePath)),
        [allModeDiffEntries, prData],
    );
    const lastAllModeSectionPath = useMemo(
        () => (allModeSectionPaths.length > 0 ? allModeSectionPaths[allModeSectionPaths.length - 1] : null),
        [allModeSectionPaths],
    );
    const allDiffFilePaths = useMemo(() => Array.from(selectableDiffPathSet), [selectableDiffPathSet]);
    const unviewedFileCount = useMemo(
        () => allDiffFilePaths.reduce((count, path) => (viewedFiles.has(path) ? count : count + 1), 0),
        [allDiffFilePaths, viewedFiles],
    );
    const allVersionIdsForVisibleFiles = useMemo(() => {
        const ids = new Set<string>();
        for (const path of allDiffFilePaths) {
            const pathHistory = fileVersionHistoryByPath[path];
            if (!pathHistory) continue;
            for (const versionId of pathHistory.order) {
                ids.add(versionId);
            }
        }
        return ids;
    }, [allDiffFilePaths, fileVersionHistoryByPath]);
    const areAllFilesViewed = useMemo(
        () => allVersionIdsForVisibleFiles.size > 0 && Array.from(allVersionIdsForVisibleFiles).every((versionId) => viewedVersionIds.has(versionId)),
        [allVersionIdsForVisibleFiles, viewedVersionIds],
    );
    const toggleAllFilesViewed = useCallback(() => {
        setViewedVersionIds((prev) => {
            const next = new Set(prev);
            if (areAllFilesViewed) {
                for (const versionId of allVersionIdsForVisibleFiles) {
                    next.delete(versionId);
                }
                return next;
            }
            for (const versionId of allVersionIdsForVisibleFiles) {
                next.add(versionId);
            }
            return next;
        });
    }, [allVersionIdsForVisibleFiles, areAllFilesViewed]);

    useReviewTreeModelSync({
        showSettingsPanel,
        settingsTreeItems,
        prData,
        setTree,
        setKinds,
    });
    useReviewTreeReset({
        setTree,
        setKinds,
        setActiveFile,
        setSearchQuery,
    });
    useReviewActiveFileSync({
        showSettingsPanel,
        settingsTreeItems,
        settingsPathSet,
        activeFile,
        treeOrderedVisiblePaths,
        visiblePathSet,
        viewedFiles,
        setActiveFile,
    });
    useAutoMarkActiveFileViewed({
        viewMode,
        autoMarkViewedFiles: options.autoMarkViewedFiles,
        showSettingsPanel,
        activeFile,
        visiblePathSet,
        autoMarkedViewedVersionIdsRef,
        getSelectedVersionIdForPath,
        markPathViewed,
    });

    useEnsureSummarySelection({
        showSettingsPanel,
        viewMode,
        prData,
        isSummarySelected,
        selectedFileDiff,
        setActiveFile,
    });

    useSyncMergeStrategy({
        prData,
        mergeStrategies: hostCapabilities.mergeStrategies,
        mergeStrategy,
        setMergeStrategy,
    });

    const currentUserReviewStatus = pullRequest?.currentUserReviewStatus ?? "none";
    const isApproved = currentUserReviewStatus === "approved";
    const actionPolicy = useMemo(
        () =>
            buildReviewActionPolicy({
                capabilities: hostCapabilities,
                isAuthenticatedForWrite: auth.canWrite,
                isApprovedByCurrentUser: isApproved,
                prState: pullRequest?.state,
                isDraft: pullRequest?.draft,
            }),
        [auth.canWrite, hostCapabilities, isApproved, pullRequest?.draft, pullRequest?.state],
    );

    const {
        approveMutation,
        removeApprovalMutation,
        requestChangesMutation,
        declineMutation,
        markDraftMutation,
        mergeMutation,
        createCommentMutation,
        resolveCommentMutation,
        deleteCommentMutation,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        submitInlineComment,
        submitThreadReply,
        handleCopyPath,
        handleCopySourceBranch,
    } = useReviewPageActions({
        authCanWrite: auth.canWrite,
        requestAuth,
        actionPolicy,
        prData,
        pullRequest,
        isApprovedByCurrentUser: isApproved,
        refetchPullRequest: refetchPrQuery,
        mergeMessage,
        mergeStrategy,
        closeSourceBranch,
        setMergeOpen,
        setActionError,
        inlineComment,
        getInlineDraftContent,
        clearInlineDraftContent,
        setInlineComment,
        copyResetTimeoutRef,
        copySourceBranchResetTimeoutRef,
        setCopiedPath,
        setCopiedSourceBranch,
    });
    const handleProgrammaticAllModeRevealStart = useCallback((path: string) => {
        allModeProgrammaticTargetRef.current = path;
        setAllModePendingScrollPath(path);
        allModeSuppressObserverUntilRef.current = Date.now() + 1200;
    }, []);
    const handleDeleteComment = useCallback(
        (commentId: number, hasInlineContext: boolean) => {
            deleteCommentMutation.mutate({ commentId, hasInlineContext });
        },
        [deleteCommentMutation],
    );

    const { handleToggleSettingsPanel, selectAndRevealFile, toggleViewed, collapseAllDirectories, expandAllDirectories } = useReviewPageNavigation({
        activeFile,
        settingsPathSet,
        viewMode,
        treeOrderedVisiblePaths,
        isPathViewed,
        directoryPaths,
        diffScrollRef,
        setActiveFile,
        showSettingsPanel,
        setShowSettingsPanel,
        setCollapsedAllModeFiles,
        setIsSummaryCollapsedInAllMode,
        toggleViewedForPath,
        markViewedForPath: markPathViewed,
        setDirectoryExpandedMap,
        onProgrammaticAllModeRevealStart: handleProgrammaticAllModeRevealStart,
        onApprovePullRequest: handleApprovePullRequest,
        onRequestChangesPullRequest: handleRequestChangesPullRequest,
    });
    const handleHistoryCommentNavigate = useCallback(
        ({ path, commentId }: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => {
            if (!path) return;
            setShowSettingsPanel(false);
            selectAndRevealFile(path);
            if (typeof commentId === "number") {
                pendingCommentScrollRef.current = commentId;
                setPendingCommentTick((tick) => tick + 1);
            }
        },
        [selectAndRevealFile, setShowSettingsPanel],
    );
    const handleHashPathResolved = useCallback(
        (path: string) => {
            setShowSettingsPanel(false);
            if (viewMode === "all") {
                selectAndRevealFile(path);
                return;
            }
            setActiveFile(path);
        },
        [selectAndRevealFile, setActiveFile, setShowSettingsPanel, viewMode],
    );

    const revealTreePath = useCallback((path: string) => {
        const escapedPath = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(path) : path.replace(/["\\]/g, "\\$&");
        const pathElement = document.querySelector<HTMLElement>(`[data-tree-path="${escapedPath}"]`);
        pathElement?.scrollIntoView({ block: "nearest" });
    }, []);

    const handleObservedAllModePath = useCallback(
        (path: string, metadata: { isSticky: boolean }) => {
            const pendingScrollPath = allModePendingScrollPath;
            if (pendingScrollPath) {
                if (path !== pendingScrollPath) return;
                setAllModePendingScrollPath(null);
            }
            const isProgrammaticReveal = pendingScrollPath === path;
            const isSameActiveFile = activeFile === path;
            if (path !== PR_SUMMARY_PATH) {
                for (const directory of parentDirectories(path)) {
                    expand(directory);
                }
                const shouldMarkViewed =
                    options.autoMarkViewedFiles &&
                    (metadata.isSticky || isProgrammaticReveal || (pendingScrollPath === null && path === lastAllModeSectionPath));
                if (shouldMarkViewed && allModeLastStickyPathRef.current !== path) {
                    markLatestPathViewed(path);
                }
            }
            if (metadata.isSticky) {
                allModeLastStickyPathRef.current = path === PR_SUMMARY_PATH ? null : path;
            } else if (allModeLastStickyPathRef.current === path) {
                allModeLastStickyPathRef.current = null;
            }
            if (isSameActiveFile) return;
            revealTreePath(path);
            suppressHashSyncRef.current = true;
            setActiveFile(path);
        },
        [
            activeFile,
            allModePendingScrollPath,
            expand,
            lastAllModeSectionPath,
            markLatestPathViewed,
            options.autoMarkViewedFiles,
            revealTreePath,
            setActiveFile,
        ],
    );

    useReviewFileHashSelection({
        selectableFilePaths: selectableDiffPathSet,
        onHashPathResolved: handleHashPathResolved,
    });
    useAllModeScrollSelection({
        enabled: viewMode === "all" && !showSettingsPanel,
        diffScrollRef,
        sectionPaths: allModeSectionPaths,
        stickyTopOffset: ALL_MODE_STICKY_OFFSET,
        programmaticTargetRef: allModeProgrammaticTargetRef,
        suppressObserverUntilRef: allModeSuppressObserverUntilRef,
        onObservedActivePath: handleObservedAllModePath,
    });
    useEffect(() => {
        if (!allModePendingScrollPath) {
            allModeProgrammaticTargetRef.current = null;
            allModeSuppressObserverUntilRef.current = 0;
        }
    }, [allModePendingScrollPath]);
    useEffect(() => {
        if (viewMode !== "all" || showSettingsPanel) {
            if (allModePendingScrollPath) {
                setAllModePendingScrollPath(null);
            } else {
                allModeProgrammaticTargetRef.current = null;
                allModeSuppressObserverUntilRef.current = 0;
            }
        }
    }, [allModePendingScrollPath, showSettingsPanel, viewMode]);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (pendingCommentTick === 0) return;
        if (pendingCommentScrollRef.current === null) return;
        let cancelled = false;
        let attempts = 0;
        const attemptScroll = () => {
            if (cancelled) return;
            const targetId = pendingCommentScrollRef.current;
            if (targetId === null) return;
            const anchor = document.getElementById(commentAnchorId(targetId));
            if (anchor) {
                anchor.scrollIntoView({ behavior: "smooth", block: "center" });
                pendingCommentScrollRef.current = null;
                return;
            }
            attempts += 1;
            if (attempts < 20) {
                window.setTimeout(attemptScroll, 150);
            } else {
                pendingCommentScrollRef.current = null;
            }
        };
        const timeoutId = window.setTimeout(attemptScroll, 80);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [pendingCommentTick]);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (viewMode !== "all") return;
        if (showSettingsPanel) return;
        const pendingPath = allModePendingScrollPath;
        if (!pendingPath) return;
        if (allModeProgrammaticTargetRef.current !== pendingPath) {
            setAllModePendingScrollPath(null);
            return;
        }
        if (!allModeSectionPaths.includes(pendingPath)) return;

        let cancelled = false;
        const timeoutIds: number[] = [];
        const settleIfAnchorVisible = () => {
            if (cancelled) return false;
            const rootElement = diffScrollRef.current;
            const anchor = document.getElementById(fileAnchorId(pendingPath));
            if (!rootElement || !anchor) return false;
            const anchorRect = anchor.getBoundingClientRect();
            const rootRect = rootElement.getBoundingClientRect();
            const stickyLine = rootRect.top + ALL_MODE_STICKY_OFFSET + 1;
            const bottomLine = rootRect.bottom - 4;
            if (anchorRect.top <= stickyLine || anchorRect.bottom <= bottomLine) {
                setAllModePendingScrollPath(null);
                return true;
            }
            return false;
        };

        const runAttempt = (attemptIndex: number) => {
            if (cancelled) return;
            if (viewMode !== "all" || showSettingsPanel) return;
            if (allModeProgrammaticTargetRef.current !== pendingPath) {
                setAllModePendingScrollPath(null);
                return;
            }
            if (settleIfAnchorVisible()) return;
            const anchor = document.getElementById(fileAnchorId(pendingPath));
            if (!anchor) return;
            anchor.scrollIntoView({ behavior: attemptIndex === 0 ? "smooth" : "auto", block: "start" });
            window.requestAnimationFrame(() => {
                void settleIfAnchorVisible();
            });
            if (attemptIndex === ALL_MODE_SCROLL_RETRY_DELAYS.length - 1) {
                setAllModePendingScrollPath(null);
            }
        };

        if (settleIfAnchorVisible()) return;

        ALL_MODE_SCROLL_RETRY_DELAYS.forEach((delay, index) => {
            const timeoutId = window.setTimeout(() => runAttempt(index), delay);
            timeoutIds.push(timeoutId);
        });

        return () => {
            cancelled = true;
            for (const id of timeoutIds) {
                window.clearTimeout(id);
            }
        };
    }, [allModePendingScrollPath, allModeSectionPaths, showSettingsPanel, viewMode]);
    useReviewFileHashSync({
        activeFile,
        showSettingsPanel,
        settingsPathSet,
        suppressHashSyncRef,
    });

    const { sidebarProps, navbarProps, mergeDialogProps } = useReviewPageViewProps({
        treeWidth,
        treeCollapsed,
        host,
        pullRequestUrl,
        showSettingsPanel,
        searchQuery,
        showUnviewedOnly,
        unviewedFileCount,
        allowedPathSet,
        viewedFiles,
        pullRequest: pullRequest ?? {},
        isRefreshing: isPrQueryFetching,
        navbarState,
        navbarStatusDate,
        buildStatuses: prData?.buildStatuses,
        actionPolicy,
        currentUserReviewStatus,
        approvePending: approveMutation.isPending || removeApprovalMutation.isPending,
        requestChangesPending: requestChangesMutation.isPending,
        declinePending: declineMutation.isPending,
        markDraftPending: markDraftMutation.isPending,
        copiedSourceBranch,
        onHome: () => navigate({ to: "/" }),
        onToggleSettings: handleToggleSettingsPanel,
        onCollapseTree: () => setTreeCollapsed(true),
        onExpandTree: () => setTreeCollapsed(false),
        onSearchQueryChange: setSearchQuery,
        onToggleUnviewedOnly: () => setShowUnviewedOnly((prev) => !prev),
        onCollapseAllDirectories: collapseAllDirectories,
        onExpandAllDirectories: expandAllDirectories,
        onToggleViewed: toggleViewed,
        onFileClick: selectAndRevealFile,
        onStartTreeResize: startTreeResize,
        onCopySourceBranch: (branchName) => void handleCopySourceBranch(branchName),
        onApprove: handleApprovePullRequest,
        onRequestChanges: handleRequestChangesPullRequest,
        onDecline: handleDeclinePullRequest,
        onMarkDraft: handleMarkPullRequestAsDraft,
        onOpenMerge: () => setMergeOpen(true),
        mergeOpen,
        onMergeDialogOpenChange: setMergeOpen,
        mergeStrategies: hostCapabilities.mergeStrategies,
        mergeStrategy,
        onMergeStrategyChange: setMergeStrategy,
        mergeMessage,
        onMergeMessageChange: setMergeMessage,
        closeSourceBranch,
        onCloseSourceBranchChange: setCloseSourceBranch,
        canMerge: actionPolicy.canMerge,
        isMerging: mergeMutation.isPending,
        onMerge: () => mergeMutation.mutate(),
    });

    useInlineDraftFocus({
        inlineComment,
        inlineDraftFocusRef,
    });

    if (prQuery.isLoading) {
        return <ReviewPageLoadingView workspaceRef={workspaceRef} sidebarProps={sidebarProps} navbarProps={navbarProps} />;
    }

    if (prQuery.error) {
        const errorMessage = prQuery.error instanceof Error ? prQuery.error.message : "Failed to load pull request";
        const showAuthPrompt = isRateLimitedError && !auth.canWrite;

        return (
            <ReviewPageErrorState
                message={errorMessage}
                showRateLimitHelp={isRateLimitedError && host === "github"}
                authPromptSlot={showAuthPrompt ? authPromptSlot : undefined}
            />
        );
    }

    if (prData && !pullRequest) {
        return <ReviewPageErrorState message="Pull request payload is incomplete. Retry loading this pull request." showRateLimitHelp={false} />;
    }

    if (!prData) {
        if (!auth.canRead && !hostCapabilities.publicReadSupported) {
            return <ReviewPageAuthRequiredState hostLabel={host === "github" ? "GitHub" : "Bitbucket"} authPromptSlot={authPromptSlot} />;
        }
        return <ReviewPageLoadingView workspaceRef={workspaceRef} sidebarProps={sidebarProps} navbarProps={navbarProps} />;
    }

    return (
        <ReviewPageMainView
            workspaceRef={workspaceRef}
            diffScrollRef={diffScrollRef}
            sidebarProps={sidebarProps}
            navbarProps={navbarProps}
            actionError={actionError}
            diffContent={
                <ReviewPageDiffContent
                    showSettingsPanel={showSettingsPanel}
                    viewMode={viewMode}
                    activeFile={activeFile}
                    prData={prData}
                    pullRequestTitle={pullRequestTitle}
                    currentUserDisplayName={pullRequest?.currentUser?.displayName}
                    lineStats={lineStats}
                    isSummarySelected={isSummarySelected}
                    selectedFilePath={selectedFilePath}
                    selectedFileDiff={selectedFileDisplayState.fileDiff}
                    selectedFileReadOnlyHistorical={selectedFileDisplayState.readOnlyHistorical}
                    selectedFileVersionId={selectedFileDisplayState.selectedVersionId}
                    copiedPath={copiedPath}
                    fileLineStats={fileLineStats}
                    viewedFiles={viewedFiles}
                    areAllFilesViewed={areAllFilesViewed}
                    diffHighlighterReady={diffHighlighterReady}
                    diffTypographyStyle={diffTypographyStyle}
                    singleFileDiffOptions={singleFileDiffOptions}
                    singleFileAnnotations={singleFileAnnotations as SingleFileAnnotation[]}
                    selectedFileLevelThreads={selectedFileLevelThreads}
                    workspace={workspace}
                    repo={repo}
                    pullRequestId={pullRequestId}
                    createCommentPending={createCommentMutation.isPending}
                    canCommentInline={actionPolicy.canCommentInline}
                    canResolveThread={actionPolicy.canResolveThread}
                    resolveCommentPending={resolveCommentMutation.isPending}
                    toRenderableFileDiff={toRenderableFileDiff}
                    allModeDiffEntries={allModeDiffEntries}
                    getSelectedVersionIdForPath={getSelectedVersionIdForPath}
                    getVersionOptionsForPath={getVersionOptionsForPath}
                    onSelectVersionForPath={setSelectedVersionForPath}
                    resolveDisplayedDiffForPath={resolveDisplayedDiffForPath}
                    isVersionViewed={isVersionViewed}
                    threadsByPath={threadsByPath}
                    collapsedAllModeFiles={collapsedAllModeFiles}
                    collapseViewedFilesByDefault={options.collapseViewedFilesByDefault}
                    isSummaryCollapsedInAllMode={isSummaryCollapsedInAllMode}
                    buildFileAnnotations={buildFileAnnotations}
                    fileContextState={fileContextStatus}
                    onLoadFullFileContext={handleLoadFullFileContext}
                    onWorkspaceModeChange={setViewMode}
                    onActiveFileChange={setActiveFile}
                    onShowSettingsPanelChange={setShowSettingsPanel}
                    onCopyPath={(path) => {
                        void handleCopyPath(path);
                    }}
                    onToggleAllFilesViewed={toggleAllFilesViewed}
                    onToggleViewed={toggleViewed}
                    getInlineDraftContent={getInlineDraftContent}
                    setInlineDraftContent={setInlineDraftContent}
                    onSubmitInlineComment={submitInlineComment}
                    onInlineDraftReady={(focus) => {
                        inlineDraftFocusRef.current = focus;
                    }}
                    onCancelInlineDraft={(draft) => {
                        clearInlineDraftContent(draft);
                        setInlineComment(null);
                    }}
                    onDeleteComment={handleDeleteComment}
                    onResolveThread={(commentId, resolve) => {
                        resolveCommentMutation.mutate({ commentId, resolve });
                    }}
                    onReplyToThread={(commentId, content) => {
                        submitThreadReply(commentId, content);
                    }}
                    onHistoryCommentNavigate={handleHistoryCommentNavigate}
                    onToggleSummaryCollapsed={() => setIsSummaryCollapsedInAllMode((prev) => !prev)}
                    onToggleCollapsedFile={(path, next) =>
                        setCollapsedAllModeFiles((prev) => ({
                            ...prev,
                            [path]: next,
                        }))
                    }
                    onOpenInlineDraftForPath={openInlineCommentDraftForPath}
                    onDiffLineEnter={handleDiffLineEnter}
                    onDiffLineLeave={handleDiffLineLeave}
                />
            }
            mergeDialogProps={mergeDialogProps}
        />
    );
}
