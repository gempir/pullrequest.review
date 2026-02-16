import type { FileDiffOptions, OnDiffLineClickProps } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import type { DiffContextState } from "@/components/pull-request-review/diff-context-button";
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
    usePendingBuildStatusesRefresh,
    useReviewActiveFileSync,
    useReviewDocumentTitle,
    useReviewFileHashSelection,
    useReviewFileHashSync,
    useReviewTreeModelSync,
    useReviewTreeReset,
    useSyncMergeStrategy,
    useViewedFilesStorage,
} from "@/components/pull-request-review/use-review-page-effects";
import { useReviewPageNavigation } from "@/components/pull-request-review/use-review-page-navigation";
import { useReviewPageViewProps } from "@/components/pull-request-review/use-review-page-view-props";
import { isRateLimitedError as isRateLimitedQueryError, useReviewQuery } from "@/components/pull-request-review/use-review-query";
import { useViewedStorageKey } from "@/components/pull-request-review/use-review-storage";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions, useDiffOptions } from "@/lib/diff-options-context";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
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
    | { status: "ready"; oldLines: string[]; newLines: string[] };

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
    const queryClient = useQueryClient();
    const { treeWidth, treeCollapsed, setTreeCollapsed, viewMode, setViewMode, startTreeResize } = useReviewLayoutPreferences();

    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const diffScrollRef = useRef<HTMLDivElement | null>(null);
    const inlineDraftFocusRef = useRef<(() => void) | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showUnviewedOnly, setShowUnviewedOnly] = useState(false);
    const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeMessage, setMergeMessage] = useState("");
    const [mergeStrategy, setMergeStrategy] = useState("merge_commit");
    const [closeSourceBranch, setCloseSourceBranch] = useState(true);
    const [copiedPath, setCopiedPath] = useState<string | null>(null);
    const [copiedSourceBranch, setCopiedSourceBranch] = useState(false);
    const [fileContexts, setFileContexts] = useState<Record<string, FullFileContextEntry>>({});
    const [dirStateHydrated, setDirStateHydrated] = useState(false);
    const autoMarkedViewedFilesRef = useRef<Set<string>>(new Set());
    const copyResetTimeoutRef = useRef<number | null>(null);
    const copySourceBranchResetTimeoutRef = useRef<number | null>(null);
    const allModeProgrammaticTargetRef = useRef<string | null>(null);
    const allModeSuppressObserverUntilRef = useRef<number>(0);
    const allModeLastStickyPathRef = useRef<string | null>(null);
    const suppressHashSyncRef = useRef(false);
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
        queryKey: prQueryKey,
        query: prQuery,
        hasPendingBuildStatuses,
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

    const prData = prQuery.data;
    const pullRequest = prData?.pr;
    const pullRequestTitle = pullRequest?.title?.trim();
    const isPrQueryFetching = prQuery.isFetching;
    const refetchPrQuery = prQuery.refetch;
    const isRateLimitedError = useMemo(() => isRateLimitedQueryError(prQuery.error), [prQuery.error]);
    useReviewDocumentTitle({ isLoading: prQuery.isLoading, pullRequestTitle });
    usePendingBuildStatusesRefresh({
        hasPendingBuildStatuses,
        isFetching: isPrQueryFetching,
        refetch: refetchPrQuery,
    });

    // Build viewed-file storage key from stable primitives to avoid object identity churn.
    const viewedStorageKey = useViewedStorageKey(prData?.prRef);

    const directoryStateStorageKey = useMemo(() => makeDirectoryStateStorageKey(workspace, repo, pullRequestId), [pullRequestId, repo, workspace]);
    const prRef = useMemo(() => ({ host, workspace, repo, pullRequestId }), [host, workspace, repo, pullRequestId]);

    const readyFileContexts = useMemo(() => {
        const entries: Record<string, { oldLines: string[]; newLines: string[] }> = {};
        for (const [path, entry] of Object.entries(fileContexts)) {
            if (entry.status === "ready") {
                entries[path] = { oldLines: entry.oldLines, newLines: entry.newLines };
            }
        }
        return entries;
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

    useCopyTimeoutCleanup({
        copyResetTimeoutRef,
        copySourceBranchResetTimeoutRef,
    });
    useViewedFilesStorage({
        viewedStorageKey,
        viewedFiles,
        setViewedFiles,
        autoMarkedViewedFilesRef,
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
            if (current?.status === "loading" || current?.status === "ready") return;
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
                setFileContexts((prev) => ({
                    ...prev,
                    [filePath]: {
                        status: "ready",
                        oldLines: needsBase ? splitFileIntoLines(oldContent) : [],
                        newLines: needsHead ? splitFileIntoLines(newContent) : [],
                    },
                }));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unable to load file context.";
                setFileContexts((prev) => ({ ...prev, [filePath]: { status: "error", error: message } }));
            }
        },
        [fileContexts, prData?.pr.destination?.commit?.hash, prData?.pr.source?.commit?.hash, prRef],
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
    const allModeSectionPaths = useMemo(
        () => (prData ? [PR_SUMMARY_PATH, ...allModeDiffEntries.map((entry) => entry.filePath)] : allModeDiffEntries.map((entry) => entry.filePath)),
        [allModeDiffEntries, prData],
    );
    const allDiffFilePaths = useMemo(() => Array.from(selectableDiffPathSet), [selectableDiffPathSet]);
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
        showUnviewedOnly,
        activeFile,
        visiblePathSet,
        autoMarkedViewedFilesRef,
        setViewedFiles,
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
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        submitInlineComment,
        handleCopyPath,
        handleCopySourceBranch,
    } = useReviewPageActions({
        authCanWrite: auth.canWrite,
        requestAuth,
        actionPolicy,
        prData,
        pullRequest,
        isApprovedByCurrentUser: isApproved,
        queryClient,
        prQueryKey,
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
        allModeSuppressObserverUntilRef.current = Date.now() + 1200;
    }, []);

    const { handleToggleSettingsPanel, selectAndRevealFile, toggleViewed, collapseAllDirectories, expandAllDirectories } = useReviewPageNavigation({
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
        onProgrammaticAllModeRevealStart: handleProgrammaticAllModeRevealStart,
        onApprovePullRequest: handleApprovePullRequest,
        onRequestChangesPullRequest: handleRequestChangesPullRequest,
    });
    const handleHashPathResolved = useCallback(
        (path: string) => {
            setShowSettingsPanel(false);
            if (viewMode === "all") {
                selectAndRevealFile(path);
                return;
            }
            setActiveFile(path);
        },
        [selectAndRevealFile, setActiveFile, viewMode],
    );

    const revealTreePath = useCallback((path: string) => {
        const escapedPath = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(path) : path.replace(/["\\]/g, "\\$&");
        const pathElement = document.querySelector<HTMLElement>(`[data-tree-path="${escapedPath}"]`);
        pathElement?.scrollIntoView({ block: "nearest" });
    }, []);

    const handleObservedAllModePath = useCallback(
        (path: string, metadata: { isSticky: boolean }) => {
            const isSameActiveFile = activeFile === path;
            if (path !== PR_SUMMARY_PATH) {
                for (const directory of parentDirectories(path)) {
                    expand(directory);
                }
                if (options.autoMarkViewedFiles && metadata.isSticky && allModeLastStickyPathRef.current !== path) {
                    setViewedFiles((prev) => {
                        if (prev.has(path)) return prev;
                        const next = new Set(prev);
                        next.add(path);
                        return next;
                    });
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
        [activeFile, expand, options.autoMarkViewedFiles, revealTreePath, setActiveFile],
    );

    useReviewFileHashSelection({
        selectableFilePaths: selectableDiffPathSet,
        onHashPathResolved: handleHashPathResolved,
    });
    useAllModeScrollSelection({
        enabled: viewMode === "all" && !showSettingsPanel,
        diffScrollRef,
        sectionPaths: allModeSectionPaths,
        stickyTopOffset: 0,
        programmaticTargetRef: allModeProgrammaticTargetRef,
        suppressObserverUntilRef: allModeSuppressObserverUntilRef,
        onObservedActivePath: handleObservedAllModePath,
    });
    useReviewFileHashSync({
        activeFile,
        showSettingsPanel,
        settingsPathSet,
        suppressHashSyncRef,
    });

    const { sidebarProps, navbarProps, mergeDialogProps } = useReviewPageViewProps({
        treeWidth,
        treeCollapsed,
        showSettingsPanel,
        searchQuery,
        showUnviewedOnly,
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
        return null;
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
                    lineStats={lineStats}
                    isSummarySelected={isSummarySelected}
                    selectedFilePath={selectedFilePath}
                    selectedFileDiff={selectedFileDiff}
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
                    onResolveThread={(commentId, resolve) => {
                        resolveCommentMutation.mutate({ commentId, resolve });
                    }}
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
