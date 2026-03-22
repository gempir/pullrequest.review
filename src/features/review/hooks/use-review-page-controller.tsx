import type { FileDiffOptions } from "@pierre/diffs";
import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, type SetStateAction, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReviewCommentsSidebar } from "@/components/pull-request-review/review-comments-sidebar";
import { ReviewCommitScopeControl } from "@/components/pull-request-review/review-commit-scope-control";
import { formatRecentTimestamp } from "@/components/pull-request-review/review-formatters";
import { createReviewPageUiStore, useReviewPageUiValue } from "@/components/pull-request-review/review-page.store";
import { ReviewPageDiffContent } from "@/components/pull-request-review/review-page-diff-content";
import { ReviewPageAuthRequiredState, ReviewPageErrorState } from "@/components/pull-request-review/review-page-guards";
import { ReviewPageLoadingView } from "@/components/pull-request-review/review-page-loading-view";
import { ReviewPageMainView } from "@/components/pull-request-review/review-page-main-view";
import { hashString, type InlineCommentLineTarget, type SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
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
import { isRateLimitedError as isRateLimitedQueryError } from "@/components/pull-request-review/use-review-query";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { useReviewFileContexts } from "@/features/review/data/use-review-file-contexts";
import { useReviewScopedData } from "@/features/review/data/use-review-scoped-data";
import { ALL_MODE_SCROLL_RETRY_DELAYS, ALL_MODE_STICKY_OFFSET, parentDirectories } from "@/features/review/model/review-page-controller-helpers";
import { useReviewFileVersions } from "@/features/review/state/use-review-file-versions";
import { useReviewOptimisticComments } from "@/features/review/state/use-review-optimistic-comments";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions, useDiffOptions } from "@/lib/diff-options-context";
import { commentAnchorId, fileAnchorId } from "@/lib/file-anchors";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
import { getPullRequestFileHistoryCollection } from "@/lib/git-host/query-collections";
import { buildReviewActionPolicy } from "@/lib/git-host/review-policy";
import type { GitHost } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import type { ReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { markReviewPerf } from "@/lib/review-performance/metrics";
import { makeDirectoryStateStorageKey } from "@/lib/review-storage";

export interface PullRequestReviewPageProps {
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

export function useReviewPageController({
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
    const {
        treeWidth,
        treeCollapsed,
        setTreeCollapsed,
        rightSidebarWidth,
        rightSidebarCollapsed,
        setRightSidebarCollapsed,
        viewMode,
        setViewMode,
        startTreeResize,
        startRightSidebarResize,
    } = useReviewLayoutPreferences();
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
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
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
    const firstDiffRenderedKeyRef = useRef<string>("");
    const missingDiffRecoveryRef = useRef<{ contextKey: string; attempts: number; lastRecoverySignature: string }>({
        contextKey: "",
        attempts: 0,
        lastRecoverySignature: "",
    });
    const { inlineComment, setInlineComment, getInlineDraftContent, setInlineDraftContent, clearInlineDraftContent, openInlineCommentDraft } =
        useInlineCommentDrafts({
            workspace,
            repo,
            pullRequestId,
            setActiveFile,
            setViewMode,
        });
    const {
        commitRangeScopedCollection,
        commitScopeLoading,
        effectivePrData,
        hostCapabilities,
        isCriticalLoading,
        isPrQueryFetching,
        persistedFileContexts,
        persistedFileHistoryByPath,
        prContextKey,
        prQuery,
        prRef,
        resolvedScope,
        scopeNotice,
        setScopeNotice,
        viewedStorageKey,
    } = useReviewScopedData({
        host,
        workspace,
        repo,
        pullRequestId,
        auth,
        reviewDiffScopeSearch,
        onReviewDiffScopeSearchChange,
        requestAuth,
    });
    const pullRequest = effectivePrData?.pr;
    const pullRequestUrl = pullRequest?.links?.html?.href;
    const pullRequestTitle = pullRequest?.title?.trim();
    const refetchPrQuery = prQuery.refetch;
    const isRateLimitedError = isRateLimitedQueryError(prQuery.error);
    useReviewDocumentTitle({ isLoading: isCriticalLoading, pullRequestTitle });

    const directoryStateStorageKey = useMemo(() => makeDirectoryStateStorageKey(workspace, repo, pullRequestId), [pullRequestId, repo, workspace]);
    const { createOptimisticComment, prData, removeOptimisticComment, updateOptimisticCommentPending } = useReviewOptimisticComments({
        effectivePrData,
        prContextKey,
        currentUserAvatarUrl: pullRequest?.currentUser?.avatarUrl,
        currentUserDisplayName: pullRequest?.currentUser?.displayName,
    });
    const treeLoading = isCriticalLoading || commitScopeLoading;

    useEffect(() => {
        if (resolvedScope.mode === "full") return;
        setInlineComment(null);
    }, [resolvedScope.mode, setInlineComment]);

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
        (path: string, props: InlineCommentLineTarget) => {
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
    const historyRevision = `${effectiveBaseCommitHash ?? ""}:${effectiveHeadCommitHash ?? ""}`;
    const { fileContextStatus, handleLoadFullFileContext, readyFileContexts } = useReviewFileContexts({
        effectiveBaseCommitHash,
        effectiveHeadCommitHash,
        historyRevision,
        persistedFileContexts,
        prRef,
        resolvedScopeMode: resolvedScope.mode,
    });

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
        sidebarThreads,
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
    const {
        getSelectedVersionIdForPath,
        getVersionOptionsForPath,
        handleOpenVersionMenuForPath,
        historyRequestedPaths,
        isPathViewed,
        isVersionViewed,
        markPathViewed,
        resolveDisplayedDiffForPath,
        setSelectedVersionForPath,
        toggleViewedForPath,
    } = useReviewFileVersions({
        fileDiffFingerprints,
        historyRevision,
        persistedFileHistoryByPath,
        prData,
        prRef,
        setViewedFiles,
        viewedFiles,
        viewedStorageKey,
    });
    const unresolvedSidebarThreadCount = sidebarThreads.filter((thread) => !thread.isResolved).length;

    useEffect(() => {
        if (!prData) return;
        if (resolvedScope.mode !== "full") return;
        if (isPrQueryFetching) return;

        const contextKey = `${prContextKey}:${resolvedScope.mode}`;
        if (missingDiffRecoveryRef.current.contextKey !== contextKey) {
            missingDiffRecoveryRef.current = {
                contextKey,
                attempts: 0,
                lastRecoverySignature: "",
            };
        }

        const diffstatCount = prData.diffstat?.length ?? 0;
        if (diffstatCount === 0) return;

        const hasDiffText = prData.diff.trim().length > 0;
        const hasSelectableDiffPaths = selectableDiffPathSet.size > 0;
        const needsRecovery = !hasDiffText || !hasSelectableDiffPaths;
        if (!needsRecovery) return;

        if (missingDiffRecoveryRef.current.attempts >= 2) return;
        const recoverySignature = `${diffstatCount}:${selectableDiffPathSet.size}:${hasDiffText ? hashString(prData.diff) : "none"}`;
        if (missingDiffRecoveryRef.current.lastRecoverySignature === recoverySignature) return;

        missingDiffRecoveryRef.current = {
            ...missingDiffRecoveryRef.current,
            attempts: missingDiffRecoveryRef.current.attempts + 1,
            lastRecoverySignature: recoverySignature,
        };
        void refetchPrQuery();
    }, [isPrQueryFetching, prContextKey, prData, refetchPrQuery, resolvedScope.mode, selectableDiffPathSet.size]);

    const markLatestPathViewed = markPathViewed;
    const refreshCurrentReviewView = useCallback(async () => {
        if (showSettingsPanel) return;

        await refetchPrQuery();

        if (commitRangeScopedCollection && resolvedScope.mode !== "full") {
            await commitRangeScopedCollection.utils.refetch({ throwOnError: false });
        }

        if (!prData || historyRequestedPaths.size === 0) return;
        const requestedPaths = Array.from(historyRequestedPaths.values());
        await Promise.all(
            requestedPaths.map(async (path) => {
                const scopedHistory = getPullRequestFileHistoryCollection({
                    prRef,
                    path,
                    commits: prData.commits ?? [],
                    limit: 20,
                });
                await scopedHistory.utils.refetch({ throwOnError: false });
            }),
        );
    }, [commitRangeScopedCollection, historyRequestedPaths, prData, prRef, refetchPrQuery, resolvedScope.mode, showSettingsPanel]);

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

    useReviewTreeReset({
        setTree,
        setKinds,
        setActiveFile,
        setSearchQuery,
    });
    useReviewTreeModelSync({
        showSettingsPanel,
        settingsTreeItems,
        prData,
        setTree,
        setKinds,
        isTreePending: treeLoading,
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
        updateCommentMutation,
        deleteCommentMutation,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        submitInlineComment,
        submitThreadReply,
        submitCommentEdit,
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
        onOptimisticCommentCreate: createOptimisticComment,
        onOptimisticCommentUpdate: updateOptimisticCommentPending,
        onOptimisticCommentRemove: removeOptimisticComment,
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
        selectableFilePaths: selectableDiffPathSet,
        isFileSelectionReady: treeOrderedVisiblePaths.length > 0,
        suppressHashSyncRef,
    });

    const commitScopeOptions = useMemo(
        () =>
            [...resolvedScope.visibleCommits].reverse().map((commit) => ({
                hash: commit.hash,
                label: commit.hash.slice(0, 8),
                timestamp: formatRecentTimestamp(commit.date),
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
    const handleSetFullScope = useCallback(() => {
        if (!onReviewDiffScopeSearchChange) return;
        setScopeNotice(null);
        onReviewDiffScopeSearchChange({});
    }, [onReviewDiffScopeSearchChange, setScopeNotice]);
    const applyRangeFromSelectedHashes = useCallback(
        (selectedHashes: Set<string>) => {
            if (!onReviewDiffScopeSearchChange) return;
            if (selectedHashes.size === 0) {
                setScopeNotice(null);
                onReviewDiffScopeSearchChange({});
                return;
            }
            const indexes = Array.from(selectedHashes)
                .map((hash) => visibleCommitIndexByHash.get(hash))
                .filter((index): index is number => index !== undefined)
                .sort((a, b) => a - b);
            if (indexes.length === 0) {
                setScopeNotice("Selected commits are unavailable. Switched to full diff.");
                onReviewDiffScopeSearchChange({});
                return;
            }
            const startIndex = indexes[0];
            const endIndex = indexes[indexes.length - 1];
            const from = resolvedScope.visibleCommits[startIndex]?.hash;
            const to = resolvedScope.visibleCommits[endIndex]?.hash;
            if (!from || !to) {
                onReviewDiffScopeSearchChange({});
                return;
            }
            const contiguousSize = endIndex - startIndex + 1;
            if (contiguousSize !== indexes.length) {
                setScopeNotice("Expanded to a contiguous commit range.");
            } else {
                setScopeNotice(null);
            }
            onReviewDiffScopeSearchChange({ from, to });
        },
        [onReviewDiffScopeSearchChange, resolvedScope.visibleCommits, setScopeNotice, visibleCommitIndexByHash],
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
        rightSidebarCollapsed,
        treeLoading,
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
        onRefresh: refreshCurrentReviewView,
        onToggleSettings: handleToggleSettingsPanel,
        onCollapseTree: () => setTreeCollapsed(true),
        onExpandTree: () => setTreeCollapsed(false),
        onExpandRightSidebar: () => setRightSidebarCollapsed(false),
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
    const rightSidebar = useMemo(
        () => (
            <ReviewCommentsSidebar
                width={rightSidebarWidth}
                collapsed={rightSidebarCollapsed}
                unresolvedCount={unresolvedSidebarThreadCount}
                canResolveThread={actionPolicy.canResolveThread}
                resolveCommentPending={resolveCommentMutation.isPending}
                onToggleCollapsed={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
                onStartResize={startRightSidebarResize}
                threads={sidebarThreads}
                onSelectThread={(item) => {
                    handleHistoryCommentNavigate({
                        path: item.path,
                        line: item.line,
                        side: item.side,
                        commentId: item.commentId,
                    });
                }}
                onResolveThread={(commentId, resolve) => {
                    resolveCommentMutation.mutate({ commentId, resolve });
                }}
            />
        ),
        [
            actionPolicy.canResolveThread,
            handleHistoryCommentNavigate,
            rightSidebarCollapsed,
            rightSidebarWidth,
            resolveCommentMutation,
            setRightSidebarCollapsed,
            sidebarThreads,
            startRightSidebarResize,
            unresolvedSidebarThreadCount,
        ],
    );

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
            rightSidebar={rightSidebar}
            diffContent={
                <ReviewPageDiffContent
                    showSettingsPanel={showSettingsPanel}
                    allowNestedReplies={host === "bitbucket"}
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
                    updateCommentPending={updateCommentMutation.isPending}
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
                    onEditComment={(commentId, content, hasInlineContext) => {
                        submitCommentEdit(commentId, content, hasInlineContext);
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
