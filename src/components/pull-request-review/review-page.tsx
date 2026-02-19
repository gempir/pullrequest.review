import { type FileDiffOptions, type OnDiffLineClickProps, parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useLiveQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import {
    type CSSProperties,
    type ReactNode,
    type SetStateAction,
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type { DiffContextState } from "@/components/pull-request-review/diff-context-button";
import type { FileVersionSelectOption } from "@/components/pull-request-review/file-version-select";
import { ReviewCommitScopeControl } from "@/components/pull-request-review/review-commit-scope-control";
import { createReviewPageUiStore, useReviewPageUiValue } from "@/components/pull-request-review/review-page.store";
import { ReviewPageDiffContent } from "@/components/pull-request-review/review-page-diff-content";
import { ReviewPageAuthRequiredState, ReviewPageErrorState } from "@/components/pull-request-review/review-page-guards";
import { ReviewPageLoadingView } from "@/components/pull-request-review/review-page-loading-view";
import { ReviewPageMainView } from "@/components/pull-request-review/review-page-main-view";
import { hashString, type SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
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
import { readViewedVersionIds, useViewedStorageKey, writeViewedVersionIds } from "@/components/pull-request-review/use-review-storage";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions, useDiffOptions } from "@/lib/diff-options-context";
import { commentAnchorId, fileAnchorId } from "@/lib/file-anchors";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
import {
    getHostDataCollectionsVersionSnapshot,
    getPullRequestCommitRangeDiffCollection,
    getPullRequestCommitRangeDiffDataCollection,
    getPullRequestFileContextCollection,
    getPullRequestFileHistoryCollection,
    getPullRequestFileHistoryDataCollection,
    type PullRequestCommitRangeDiffRecord,
    savePullRequestFileContextRecord,
    subscribeHostDataCollectionsVersion,
} from "@/lib/git-host/query-collections";
import { buildReviewActionPolicy } from "@/lib/git-host/review-policy";
import { fetchPullRequestFileContents } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { diffScopeStorageSegment, type ReviewDiffScopeSearch, resolveReviewDiffScope } from "@/lib/review-diff-scope";
import { markReviewPerf } from "@/lib/review-performance/metrics";
import { makeDirectoryStateStorageKey } from "@/lib/review-storage";

interface PullRequestReviewPageProps {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    auth: { canWrite: boolean; canRead: boolean };
    reviewDiffScopeSearch?: ReviewDiffScopeSearch;
    onReviewDiffScopeSearchChange?: (next: ReviewDiffScopeSearch) => void;
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

function latestVersionIdFromFingerprint(path: string, fingerprint: string) {
    return `${path}::${fingerprint}`;
}

function commitVersionId(path: string, commitHash: string) {
    return `${path}:${commitHash}`;
}

const singlePatchParseCache = new Map<string, FileDiffMetadata | undefined>();

function parseSingleFilePatch(patch: string) {
    if (!patch) return undefined;
    const cacheKey = hashString(patch);
    if (singlePatchParseCache.has(cacheKey)) {
        return singlePatchParseCache.get(cacheKey);
    }
    const parsed = parsePatchFiles(patch);
    const firstPatch = parsed[0];
    const firstFile = firstPatch?.files?.[0];
    if (singlePatchParseCache.size > 300) {
        const firstKey = singlePatchParseCache.keys().next().value;
        if (firstKey) {
            singlePatchParseCache.delete(firstKey);
        }
    }
    singlePatchParseCache.set(cacheKey, firstFile);
    return firstFile;
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

function sameScopeSearch(a: ReviewDiffScopeSearch, b: ReviewDiffScopeSearch) {
    return a.scope === b.scope && a.from === b.from && a.to === b.to;
}

function formatCommitScopeTimestamp(value?: string) {
    if (!value) return "unknown";
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return "unknown";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(timestamp);
}

function usePullRequestReviewPageView({
    host,
    workspace,
    repo,
    pullRequestId,
    auth,
    reviewDiffScopeSearch,
    onReviewDiffScopeSearchChange,
    onRequireAuth,
    authPromptSlot,
}: PullRequestReviewPageProps) {
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
            startTransition(() => {
                uiStore.setState((prev) => ({
                    ...prev,
                    searchQuery: typeof next === "function" ? (next as (current: string) => string)(prev.searchQuery) : next,
                }));
            });
        },
        [uiStore],
    );
    const setShowUnviewedOnly = useCallback(
        (next: SetStateAction<boolean>) => {
            startTransition(() => {
                uiStore.setState((prev) => ({
                    ...prev,
                    showUnviewedOnly: typeof next === "function" ? (next as (current: boolean) => boolean)(prev.showUnviewedOnly) : next,
                }));
            });
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
    const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
    const [selectedVersionIdByPath, setSelectedVersionIdByPath] = useState<Record<string, string>>({});
    const [historyRequestedPaths, setHistoryRequestedPaths] = useState<Set<string>>(new Set());
    const [historyLoadingByPath, setHistoryLoadingByPath] = useState<Record<string, boolean>>({});
    const [historyErrorByPath, setHistoryErrorByPath] = useState<Record<string, string | null>>({});
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [scopeNotice, setScopeNotice] = useState<string | null>(null);
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
    const loadedHistoryRevisionRef = useRef<string>("");
    const firstDiffRenderedKeyRef = useRef<string>("");
    const { inlineComment, setInlineComment, getInlineDraftContent, setInlineDraftContent, clearInlineDraftContent, openInlineCommentDraft } =
        useInlineCommentDrafts({
            workspace,
            repo,
            pullRequestId,
            setActiveFile,
            setViewMode,
        });
    const {
        hostCapabilities,
        isCriticalLoading,
        isDeferredLoading,
        isRefreshing,
        query: prQuery,
    } = useReviewQuery({
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

    const basePrData = prQuery.data;
    const diffScopeSearch: ReviewDiffScopeSearch = reviewDiffScopeSearch ?? { scope: "full" };
    const pullRequest = basePrData?.pr;
    const pullRequestUrl = pullRequest?.links?.html?.href;
    const pullRequestTitle = pullRequest?.title?.trim();
    const isPrQueryFetching = isRefreshing || isDeferredLoading;
    const refetchPrQuery = prQuery.refetch;
    const isRateLimitedError = isRateLimitedQueryError(prQuery.error);
    useReviewDocumentTitle({ isLoading: isCriticalLoading, pullRequestTitle });

    const directoryStateStorageKey = useMemo(() => makeDirectoryStateStorageKey(workspace, repo, pullRequestId), [pullRequestId, repo, workspace]);
    const prRef = useMemo(() => ({ host, workspace, repo, pullRequestId }), [host, workspace, repo, pullRequestId]);
    const prContextKey = `${host}:${workspace}/${repo}/${pullRequestId}`;
    const resolvedScope = useMemo(
        () =>
            resolveReviewDiffScope({
                search: diffScopeSearch,
                commits: basePrData?.commits ?? [],
                destinationCommitHash: basePrData?.pr.destination?.commit?.hash,
            }),
        [basePrData?.commits, basePrData?.pr.destination?.commit?.hash, diffScopeSearch],
    );
    const diffScopeSegment = useMemo(() => diffScopeStorageSegment(resolvedScope), [resolvedScope]);
    // Build viewed-file storage key from stable primitives to avoid object identity churn.
    const viewedStorageKey = useViewedStorageKey(basePrData?.prRef, diffScopeSegment);

    const commitRangeDiffCollectionData = useMemo(() => {
        void hostDataCollectionsVersion;
        return getPullRequestCommitRangeDiffDataCollection();
    }, [hostDataCollectionsVersion]);
    const fileContextCollection = useMemo(() => {
        // Recreate the scoped collection when host-data storage falls back.
        void hostDataCollectionsVersion;
        return getPullRequestFileContextCollection();
    }, [hostDataCollectionsVersion]);
    const fileHistoryCollection = useMemo(() => {
        void hostDataCollectionsVersion;
        return getPullRequestFileHistoryDataCollection();
    }, [hostDataCollectionsVersion]);
    const commitRangeDiffQuery = useLiveQuery(
        (q) => q.from({ range: commitRangeDiffCollectionData }).select(({ range }) => ({ ...range })),
        [commitRangeDiffCollectionData],
    );
    const fileContextQuery = useLiveQuery((q) => q.from({ context: fileContextCollection }).select(({ context }) => ({ ...context })), [fileContextCollection]);
    const fileHistoryQuery = useLiveQuery((q) => q.from({ history: fileHistoryCollection }).select(({ history }) => ({ ...history })), [fileHistoryCollection]);
    const persistedFileContexts = useMemo(() => {
        if (resolvedScope.mode !== "full") return {};
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
    }, [fileContextQuery.data, prContextKey, resolvedScope.mode]);
    const persistedFileHistoryByPath = useMemo(() => {
        const entries: Record<
            string,
            {
                entries: Array<{
                    versionId: string;
                    commitHash: string;
                    commitDate?: string;
                    commitMessage?: string;
                    authorDisplayName?: string;
                    filePathAtCommit: string;
                    status: "added" | "modified" | "removed" | "renamed";
                    patch: string;
                }>;
                fetchedAt: number;
            }
        > = {};
        for (const record of fileHistoryQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[record.path] = {
                entries: record.entries,
                fetchedAt: record.fetchedAt,
            };
        }
        return entries;
    }, [fileHistoryQuery.data, prContextKey]);
    const persistedCommitRangeDiffs = useMemo(() => {
        const entries: Record<string, PullRequestCommitRangeDiffRecord> = {};
        for (const record of commitRangeDiffQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[`${record.baseCommitHash}..${record.headCommitHash}`] = record;
        }
        return entries;
    }, [commitRangeDiffQuery.data, prContextKey]);
    const scopedRangeDiffRecord = useMemo(() => {
        if (resolvedScope.mode === "full") return undefined;
        if (!resolvedScope.baseCommitHash || !resolvedScope.headCommitHash) return undefined;
        return persistedCommitRangeDiffs[`${resolvedScope.baseCommitHash}..${resolvedScope.headCommitHash}`];
    }, [persistedCommitRangeDiffs, resolvedScope]);
    const commitRangeScopedCollection = useMemo(() => {
        if (!basePrData || resolvedScope.mode === "full") return null;
        if (!resolvedScope.baseCommitHash || !resolvedScope.headCommitHash) return null;
        if (resolvedScope.selectedCommitHashes.length === 0) return null;
        return getPullRequestCommitRangeDiffCollection({
            prRef,
            baseCommitHash: resolvedScope.baseCommitHash,
            headCommitHash: resolvedScope.headCommitHash,
            selectedCommitHashes: resolvedScope.selectedCommitHashes,
        });
    }, [basePrData, prRef, resolvedScope]);
    const effectivePrData = useMemo(() => {
        if (!basePrData) return undefined;
        if (resolvedScope.mode === "full") return basePrData;
        if (resolvedScope.selectedCommitHashes.length === 0) {
            return {
                ...basePrData,
                diff: "",
                diffstat: [],
                commits: resolvedScope.selectedCommits,
            };
        }
        if (!scopedRangeDiffRecord) {
            return {
                ...basePrData,
                diff: "",
                diffstat: [],
                commits: resolvedScope.selectedCommits,
            };
        }
        return {
            ...basePrData,
            diff: scopedRangeDiffRecord.diff,
            diffstat: scopedRangeDiffRecord.diffstat,
            commits: resolvedScope.selectedCommits,
        };
    }, [basePrData, resolvedScope, scopedRangeDiffRecord]);
    const prData = effectivePrData;

    useEffect(() => {
        if (!onReviewDiffScopeSearchChange) return;
        if (sameScopeSearch(diffScopeSearch, resolvedScope.normalizedSearch)) return;
        onReviewDiffScopeSearchChange(resolvedScope.normalizedSearch);
    }, [diffScopeSearch, onReviewDiffScopeSearchChange, resolvedScope.normalizedSearch]);

    useEffect(() => {
        if (!onReviewDiffScopeSearchChange) return;
        if (resolvedScope.mode !== "full" || !resolvedScope.fallbackReason || diffScopeSearch.scope === "full") return;
        const notice =
            resolvedScope.fallbackReason === "invalid_range"
                ? "Selected commit range is unavailable. Switched to full diff."
                : "Commit range base/head could not be resolved. Switched to full diff.";
        setScopeNotice(notice);
        onReviewDiffScopeSearchChange({ scope: "full" });
    }, [diffScopeSearch.scope, onReviewDiffScopeSearchChange, resolvedScope]);

    useEffect(() => {
        if (!commitRangeScopedCollection) return;
        let cancelled = false;
        setScopeNotice(null);
        void (async () => {
            await commitRangeScopedCollection.utils.refetch({ throwOnError: false });
            if (cancelled) return;
            const maybeError = commitRangeScopedCollection.utils.lastError;
            if (!maybeError) return;
            const message = maybeError instanceof Error ? maybeError.message : "Failed to load commit range diff.";
            setScopeNotice(message);
            onReviewDiffScopeSearchChange?.({ scope: "full" });
        })();
        return () => {
            cancelled = true;
        };
    }, [commitRangeScopedCollection, onReviewDiffScopeSearchChange]);

    useEffect(() => {
        if (resolvedScope.mode === "full") return;
        if (resolvedScope.selectedCommitHashes.length > 0) return;
        setScopeNotice("No changes in selected range.");
    }, [resolvedScope.mode, resolvedScope.selectedCommitHashes.length]);

    useEffect(() => {
        if (resolvedScope.mode === "full") return;
        setInlineComment(null);
    }, [resolvedScope.mode, setInlineComment]);

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
            if (resolvedScope.mode !== "full") return;
            markReviewPerf("inline_comment_open");
            openInlineCommentDraft({
                path,
                line: props.lineNumber,
                side: props.annotationSide ?? "additions",
            });
        },
        [openInlineCommentDraft, resolvedScope.mode],
    );
    const effectiveBaseCommitHash = resolvedScope.mode === "full" ? prData?.pr.destination?.commit?.hash : resolvedScope.baseCommitHash;
    const effectiveHeadCommitHash = resolvedScope.mode === "full" ? prData?.pr.source?.commit?.hash : resolvedScope.headCommitHash;

    const handleLoadFullFileContext = useCallback(
        async (filePath: string, fileDiff: FileDiffMetadata) => {
            const current = fileContexts[filePath];
            if (current?.status === "loading") return;
            if (current?.status === "ready" || persistedFileContexts[filePath]) return;
            setFileContexts((prev) => ({ ...prev, [filePath]: { status: "loading" } }));
            try {
                const baseCommit = effectiveBaseCommitHash;
                const headCommit = effectiveHeadCommitHash;
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
                if (resolvedScope.mode === "full") {
                    await savePullRequestFileContextRecord({
                        prRef,
                        path: filePath,
                        oldLines: readyOldLines,
                        newLines: readyNewLines,
                        fetchedAt,
                    });
                }
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
        [effectiveBaseCommitHash, effectiveHeadCommitHash, fileContexts, persistedFileContexts, prRef, resolvedScope.mode],
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
    const latestVersionIdByPath = useMemo(() => {
        const map = new Map<string, string>();
        for (const [path, fingerprint] of fileDiffFingerprints.entries()) {
            map.set(path, latestVersionIdFromFingerprint(path, fingerprint));
        }
        return map;
    }, [fileDiffFingerprints]);
    const historyRevision = `${effectiveBaseCommitHash ?? ""}:${effectiveHeadCommitHash ?? ""}`;

    const resetHistoryTracking = useCallback(() => {
        setHistoryRequestedPaths(new Set());
        setHistoryLoadingByPath({});
        setHistoryErrorByPath({});
    }, []);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        if (loadedViewedStorageKeyRef.current === viewedStorageKey) return;
        loadedViewedStorageKeyRef.current = viewedStorageKey;
        autoMarkedViewedVersionIdsRef.current = new Set();
        const knownVersionIds = new Set(latestVersionIdByPath.values());
        const viewedIds = readViewedVersionIds(viewedStorageKey, {
            fileDiffFingerprints,
            knownVersionIds,
        });
        const nextViewedFiles = new Set<string>();
        for (const [path, versionId] of latestVersionIdByPath.entries()) {
            if (viewedIds.has(versionId)) {
                nextViewedFiles.add(path);
            }
        }
        setViewedFiles(nextViewedFiles);
        resetHistoryTracking();
    }, [fileDiffFingerprints, latestVersionIdByPath, resetHistoryTracking, viewedStorageKey]);

    useEffect(() => {
        if (loadedHistoryRevisionRef.current === historyRevision) return;
        loadedHistoryRevisionRef.current = historyRevision;
        resetHistoryTracking();
        setFileContexts({});
    }, [historyRevision, resetHistoryTracking]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        const viewedVersionIds = new Set<string>();
        for (const viewedPath of viewedFiles) {
            const latestVersionId = latestVersionIdByPath.get(viewedPath);
            if (!latestVersionId) continue;
            viewedVersionIds.add(latestVersionId);
        }
        writeViewedVersionIds(viewedStorageKey, viewedVersionIds);
    }, [latestVersionIdByPath, viewedFiles, viewedStorageKey]);

    useEffect(() => {
        setSelectedVersionIdByPath((prev) => {
            const next: Record<string, string> = {};
            let changed = false;
            for (const [path, latestVersionId] of latestVersionIdByPath.entries()) {
                next[path] = latestVersionId;
                if (prev[path] !== latestVersionId) {
                    changed = true;
                }
            }
            if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
            return next;
        });
    }, [latestVersionIdByPath]);

    const fetchRemoteFileHistory = useCallback(
        async (path: string) => {
            if (!prData) return;
            const normalizedPath = path.trim();
            if (!normalizedPath) return;
            setHistoryRequestedPaths((prev) => {
                if (prev.has(normalizedPath)) return prev;
                const next = new Set(prev);
                next.add(normalizedPath);
                return next;
            });
            setHistoryLoadingByPath((prev) => ({ ...prev, [normalizedPath]: true }));
            setHistoryErrorByPath((prev) => ({ ...prev, [normalizedPath]: null }));
            try {
                const scopedHistory = getPullRequestFileHistoryCollection({
                    prRef,
                    path: normalizedPath,
                    commits: prData.commits ?? [],
                    limit: 20,
                });
                await scopedHistory.utils.refetch({ throwOnError: false });
                const maybeError = scopedHistory.utils.lastError;
                if (maybeError instanceof Error) {
                    setHistoryErrorByPath((prev) => ({ ...prev, [normalizedPath]: maybeError.message }));
                } else {
                    setHistoryErrorByPath((prev) => ({ ...prev, [normalizedPath]: null }));
                }
            } finally {
                setHistoryLoadingByPath((prev) => ({ ...prev, [normalizedPath]: false }));
            }
        },
        [prData, prRef],
    );

    const getSelectedVersionIdForPath = useCallback(
        (path: string) => {
            const selected = selectedVersionIdByPath[path];
            if (selected) return selected;
            return latestVersionIdByPath.get(path);
        },
        [latestVersionIdByPath, selectedVersionIdByPath],
    );

    const markVersionViewed = useCallback((versionId: string) => {
        const path = versionId.split("::")[0];
        if (!path) return;
        setViewedFiles((prev) => {
            if (prev.has(path)) return prev;
            const next = new Set(prev);
            next.add(path);
            return next;
        });
    }, []);

    const markPathViewed = useCallback(
        (path: string) => {
            const latestVersionId = latestVersionIdByPath.get(path);
            if (!latestVersionId) return;
            markVersionViewed(latestVersionId);
        },
        [latestVersionIdByPath, markVersionViewed],
    );

    const markLatestPathViewed = markPathViewed;

    const toggleViewedForPath = useCallback(
        (path: string) => {
            if (!latestVersionIdByPath.has(path)) return;
            setViewedFiles((prev) => {
                const next = new Set(prev);
                if (next.has(path)) {
                    next.delete(path);
                } else {
                    next.add(path);
                }
                return next;
            });
        },
        [latestVersionIdByPath],
    );

    const isPathViewed = useCallback((path: string) => viewedFiles.has(path), [viewedFiles]);
    const isVersionViewed = useCallback(
        (versionId: string) => {
            if (!versionId.includes("::")) return true;
            const path = versionId.split("::")[0];
            return path ? viewedFiles.has(path) : true;
        },
        [viewedFiles],
    );
    const setSelectedVersionForPath = useCallback((path: string, versionId: string) => {
        setSelectedVersionIdByPath((prev) => {
            if (prev[path] === versionId) return prev;
            return {
                ...prev,
                [path]: versionId,
            };
        });
    }, []);
    const handleOpenVersionMenuForPath = useCallback(
        (path: string) => {
            if (historyRequestedPaths.has(path)) return;
            void fetchRemoteFileHistory(path);
        },
        [fetchRemoteFileHistory, historyRequestedPaths],
    );

    const getVersionOptionsForPath = useCallback(
        (path: string) => {
            const options: FileVersionSelectOption[] = [];
            const latestVersionId = latestVersionIdByPath.get(path);
            const remote = persistedFileHistoryByPath[path];
            if (latestVersionId) {
                options.push({
                    id: latestVersionId,
                    label: "Latest",
                    unread: !viewedFiles.has(path),
                    latest: true,
                });
            }
            if (!remote) return options;
            const historicalEntries = [...remote.entries].sort((a, b) => {
                const timeA = a.commitDate ? Date.parse(a.commitDate) : Number.NaN;
                const timeB = b.commitDate ? Date.parse(b.commitDate) : Number.NaN;
                if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
                if (Number.isNaN(timeA)) return 1;
                if (Number.isNaN(timeB)) return -1;
                return timeB - timeA;
            });
            for (let index = 0; index < historicalEntries.length; index += 1) {
                const entry = historicalEntries[index];
                const label = entry.commitHash.slice(0, 8);
                const commitMessage = entry.commitMessage?.split("\n")[0]?.trim();
                options.push({
                    id: commitVersionId(path, entry.commitHash),
                    label,
                    unread: false,
                    latest: false,
                    commitMessage: commitMessage || undefined,
                    commitDate: entry.commitDate,
                });
            }
            if (historyLoadingByPath[path]) {
                options.push({
                    id: `${path}:loading`,
                    label: "Loading history...",
                    unread: false,
                    latest: false,
                    state: "loading",
                });
            }
            if (historyErrorByPath[path]) {
                options.push({
                    id: `${path}:error`,
                    label: "Failed to load",
                    unread: false,
                    latest: false,
                    state: "error",
                });
            }
            return options;
        },
        [historyErrorByPath, historyLoadingByPath, latestVersionIdByPath, persistedFileHistoryByPath, viewedFiles],
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
            if (selectedVersionId.endsWith(":loading") || selectedVersionId.endsWith(":error")) {
                return {
                    fileDiff: latestFileDiff,
                    readOnlyHistorical: false,
                    selectedVersionId: latestVersionId,
                };
            }
            const commitHash = selectedVersionId.slice(path.length + 1);
            const remote = persistedFileHistoryByPath[path];
            const entry = remote?.entries.find((item) => item.commitHash === commitHash);
            const parsed = entry ? parseSingleFilePatch(entry.patch) : undefined;
            if (!parsed) {
                return {
                    fileDiff: latestFileDiff,
                    readOnlyHistorical: false,
                    selectedVersionId: latestVersionId,
                };
            }
            return {
                fileDiff: parsed,
                readOnlyHistorical: true,
                selectedVersionId,
            };
        },
        [getSelectedVersionIdForPath, latestVersionIdByPath, persistedFileHistoryByPath],
    );

    const selectedFileDisplayState = useMemo(
        () =>
            selectedFilePath
                ? resolveDisplayedDiffForPath(selectedFilePath, selectedFileDiff)
                : { fileDiff: selectedFileDiff, readOnlyHistorical: false, selectedVersionId: undefined },
        [resolveDisplayedDiffForPath, selectedFileDiff, selectedFilePath],
    );
    const hasRenderableSingleDiff = Boolean(selectedFileDisplayState.fileDiff) && !isSummarySelected;
    const hasRenderableAllDiffs = allModeDiffEntries.length > 0;
    useEffect(() => {
        const renderKey = `${prContextKey}:${resolvedScope.mode}:${viewMode}`;
        if (firstDiffRenderedKeyRef.current === renderKey) return;
        if (!diffHighlighterReady) return;
        if (showSettingsPanel) return;
        const canMark =
            viewMode === "single" ? hasRenderableSingleDiff : (prData ? !isSummaryCollapsedInAllMode || hasRenderableAllDiffs : false) || hasRenderableAllDiffs;
        if (!canMark) return;
        firstDiffRenderedKeyRef.current = renderKey;
        markReviewPerf("first_diff_rendered");
    }, [
        diffHighlighterReady,
        hasRenderableAllDiffs,
        hasRenderableSingleDiff,
        isSummaryCollapsedInAllMode,
        prContextKey,
        prData,
        resolvedScope.mode,
        showSettingsPanel,
        viewMode,
    ]);

    const allDiffFilePaths = useMemo(() => Array.from(selectableDiffPathSet), [selectableDiffPathSet]);
    const unviewedFileCount = useMemo(
        () => allDiffFilePaths.reduce((count, path) => (viewedFiles.has(path) ? count : count + 1), 0),
        [allDiffFilePaths, viewedFiles],
    );
    const areAllFilesViewed = useMemo(
        () => allDiffFilePaths.length > 0 && allDiffFilePaths.every((path) => viewedFiles.has(path)),
        [allDiffFilePaths, viewedFiles],
    );
    const toggleAllFilesViewed = useCallback(() => {
        setViewedFiles((prev) => {
            const next = new Set(prev);
            if (areAllFilesViewed) {
                for (const path of allDiffFilePaths) {
                    next.delete(path);
                }
                return next;
            }
            for (const path of allDiffFilePaths) {
                next.add(path);
            }
            return next;
        });
    }, [allDiffFilePaths, areAllFilesViewed]);

    const allModeSectionPaths = useMemo(
        () => (prData ? [PR_SUMMARY_PATH, ...allModeDiffEntries.map((entry) => entry.filePath)] : allModeDiffEntries.map((entry) => entry.filePath)),
        [allModeDiffEntries, prData],
    );
    const lastAllModeSectionPath = useMemo(
        () => (allModeSectionPaths.length > 0 ? allModeSectionPaths[allModeSectionPaths.length - 1] : null),
        [allModeSectionPaths],
    );

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
    const clearAllModePendingScrollPath = useCallback(() => {
        setAllModePendingScrollPath(null);
    }, []);
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
                clearAllModePendingScrollPath();
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
            markReviewPerf("all_mode_scroll_update");
            revealTreePath(path);
            suppressHashSyncRef.current = true;
            setActiveFile(path);
        },
        [
            activeFile,
            allModePendingScrollPath,
            clearAllModePendingScrollPath,
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
                clearAllModePendingScrollPath();
            } else {
                allModeProgrammaticTargetRef.current = null;
                allModeSuppressObserverUntilRef.current = 0;
            }
        }
    }, [allModePendingScrollPath, clearAllModePendingScrollPath, showSettingsPanel, viewMode]);
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
            clearAllModePendingScrollPath();
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
                clearAllModePendingScrollPath();
                return true;
            }
            return false;
        };

        const runAttempt = (attemptIndex: number) => {
            if (cancelled) return;
            if (viewMode !== "all" || showSettingsPanel) return;
            if (allModeProgrammaticTargetRef.current !== pendingPath) {
                clearAllModePendingScrollPath();
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
                clearAllModePendingScrollPath();
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
    }, [allModePendingScrollPath, allModeSectionPaths, clearAllModePendingScrollPath, showSettingsPanel, viewMode]);
    useReviewFileHashSync({
        activeFile,
        showSettingsPanel,
        settingsPathSet,
        suppressHashSyncRef,
    });

    const commitScopeOptions = useMemo(
        () =>
            [...resolvedScope.visibleCommits].reverse().map((commit) => ({
                hash: commit.hash,
                label: commit.hash.slice(0, 8),
                timestamp: formatCommitScopeTimestamp(commit.date),
                message: commit.summary?.raw?.trim() || commit.message?.trim() || "(no message)",
            })),
        [resolvedScope.visibleCommits],
    );
    const visibleCommitIndexByHash = useMemo(
        () => new Map(resolvedScope.visibleCommits.map((commit, index) => [commit.hash, index] as const)),
        [resolvedScope.visibleCommits],
    );
    const selectedRangeCommitHashes = useMemo(
        () => (resolvedScope.mode === "range" ? resolvedScope.selectedCommitHashes : []),
        [resolvedScope.mode, resolvedScope.selectedCommitHashes],
    );
    const commitScopeLoading = resolvedScope.mode === "range" && resolvedScope.selectedCommitHashes.length > 0 && !scopedRangeDiffRecord;
    const handleSetFullScope = useCallback(() => {
        if (!onReviewDiffScopeSearchChange) return;
        setScopeNotice(null);
        onReviewDiffScopeSearchChange({ scope: "full" });
    }, [onReviewDiffScopeSearchChange]);
    const applyRangeFromSelectedHashes = useCallback(
        (selectedHashes: Set<string>) => {
            if (!onReviewDiffScopeSearchChange) return;
            if (selectedHashes.size === 0) {
                setScopeNotice(null);
                onReviewDiffScopeSearchChange({ scope: "full" });
                return;
            }
            const indexes = Array.from(selectedHashes)
                .map((hash) => visibleCommitIndexByHash.get(hash))
                .filter((index): index is number => index !== undefined)
                .sort((a, b) => a - b);
            if (indexes.length === 0) {
                setScopeNotice("Selected commits are unavailable. Switched to full diff.");
                onReviewDiffScopeSearchChange({ scope: "full" });
                return;
            }
            const startIndex = indexes[0];
            const endIndex = indexes[indexes.length - 1];
            const from = resolvedScope.visibleCommits[startIndex]?.hash;
            const to = resolvedScope.visibleCommits[endIndex]?.hash;
            if (!from || !to) {
                onReviewDiffScopeSearchChange({ scope: "full" });
                return;
            }
            const contiguousSize = endIndex - startIndex + 1;
            if (contiguousSize !== indexes.length) {
                setScopeNotice("Expanded to a contiguous commit range.");
            } else {
                setScopeNotice(null);
            }
            onReviewDiffScopeSearchChange({
                scope: "range",
                from,
                to,
            });
        },
        [onReviewDiffScopeSearchChange, resolvedScope.visibleCommits, visibleCommitIndexByHash],
    );
    const handleToggleCommitSelection = useCallback(
        (hash: string) => {
            const nextSelected = new Set(selectedRangeCommitHashes);
            if (nextSelected.has(hash)) {
                nextSelected.delete(hash);
            } else {
                nextSelected.add(hash);
            }
            applyRangeFromSelectedHashes(nextSelected);
        },
        [applyRangeFromSelectedHashes, selectedRangeCommitHashes],
    );
    const commitScopeSlot = useMemo(
        () => (
            <ReviewCommitScopeControl
                mode={resolvedScope.mode}
                commitOptions={commitScopeOptions}
                selectedCommitHashes={selectedRangeCommitHashes}
                isFetching={commitScopeLoading}
                notice={scopeNotice}
                onSetFullScope={handleSetFullScope}
                onToggleCommitSelection={handleToggleCommitSelection}
            />
        ),
        [commitScopeLoading, commitScopeOptions, handleSetFullScope, handleToggleCommitSelection, resolvedScope.mode, selectedRangeCommitHashes, scopeNotice],
    );

    const { sidebarProps, navbarProps, mergeDialogProps } = useReviewPageViewProps({
        treeWidth,
        treeCollapsed,
        host,
        pullRequestUrl,
        showSettingsPanel,
        activeFile,
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
        commitScopeSlot,
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

    if (isCriticalLoading) {
        return <ReviewPageLoadingView workspaceRef={workspaceRef} sidebarProps={sidebarProps} navbarProps={navbarProps} />;
    }

    if (prQuery.error && !prData) {
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
                    canCommentInline={actionPolicy.canCommentInline && resolvedScope.mode === "full"}
                    canResolveThread={actionPolicy.canResolveThread}
                    resolveCommentPending={resolveCommentMutation.isPending}
                    toRenderableFileDiff={toRenderableFileDiff}
                    allModeDiffEntries={allModeDiffEntries}
                    getSelectedVersionIdForPath={getSelectedVersionIdForPath}
                    getVersionOptionsForPath={getVersionOptionsForPath}
                    onSelectVersionForPath={setSelectedVersionForPath}
                    onOpenVersionMenuForPath={handleOpenVersionMenuForPath}
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
                    onToggleSummaryCollapsed={() =>
                        startTransition(() => {
                            setIsSummaryCollapsedInAllMode((prev) => !prev);
                        })
                    }
                    onToggleCollapsedFile={(path, next) =>
                        startTransition(() => {
                            setCollapsedAllModeFiles((prev) => ({
                                ...prev,
                                [path]: next,
                            }));
                        })
                    }
                    onOpenInlineDraftForPath={openInlineCommentDraftForPath}
                    onDiffLineEnter={handleDiffLineEnter}
                    onDiffLineLeave={handleDiffLineLeave}
                    scrollElementRef={diffScrollRef}
                    pendingScrollPath={allModePendingScrollPath}
                />
            }
            mergeDialogProps={mergeDialogProps}
        />
    );
}

export function PullRequestReviewPage(props: PullRequestReviewPageProps) {
    return usePullRequestReviewPageView(props);
}
