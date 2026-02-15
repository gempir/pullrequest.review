import type { FileDiffOptions, OnDiffLineClickProps } from "@pierre/diffs";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
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
    useAutoMarkActiveFileViewed,
    useCopyTimeoutCleanup,
    useDirectoryStateStorage,
    useEnsureSummarySelection,
    useInlineDraftFocus,
    usePendingBuildStatusesRefresh,
    useReviewActiveFileSync,
    useReviewDocumentTitle,
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
import type { GitHost } from "@/lib/git-host/types";
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
    const diffTypographyStyle = useMemo(
        () =>
            ({
                "--diff-font-family": fontFamilyToCss(options.diffUseCustomTypography ? options.diffFontFamily : monospaceFontFamily),
                "--diff-font-size": `${options.diffUseCustomTypography ? options.diffFontSize : monospaceFontSize}px`,
                "--diff-line-height": String(options.diffUseCustomTypography ? options.diffLineHeight : monospaceLineHeight),
            }) as CSSProperties,
        [
            monospaceFontFamily,
            monospaceFontSize,
            monospaceLineHeight,
            options.diffFontFamily,
            options.diffFontSize,
            options.diffLineHeight,
            options.diffUseCustomTypography,
        ],
    );
    const { root, dirState, setTree, setKinds, allFiles, activeFile, setActiveFile, setDirectoryExpandedMap } = useFileTree();
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
    const [dirStateHydrated, setDirStateHydrated] = useState(false);
    const autoMarkedViewedFilesRef = useRef<Set<string>>(new Set());
    const copyResetTimeoutRef = useRef<number | null>(null);
    const copySourceBranchResetTimeoutRef = useRef<number | null>(null);
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

    const {
        diffHighlighterReady,
        toRenderableFileDiff,
        settingsPathSet,
        visiblePathSet,
        allowedPathSet,
        directoryPaths,
        treeOrderedVisiblePaths,
        allModeDiffEntries,
        selectedFilePath,
        selectedFileDiff,
        isSummarySelected,
        unresolvedThreads,
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
    });

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

    const isApproved = Boolean(pullRequest?.participants?.some((participant) => participant.approved));
    const actionPolicy = useMemo(
        () =>
            buildReviewActionPolicy({
                host,
                capabilities: hostCapabilities,
                isAuthenticatedForWrite: auth.canWrite,
                isApprovedByCurrentUser: isApproved,
                prState: pullRequest?.state,
            }),
        [auth.canWrite, host, hostCapabilities, isApproved, pullRequest?.state],
    );

    const {
        approveMutation,
        requestChangesMutation,
        mergeMutation,
        createCommentMutation,
        resolveCommentMutation,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        submitInlineComment,
        handleCopyPath,
        handleCopySourceBranch,
    } = useReviewPageActions({
        authCanWrite: auth.canWrite,
        requestAuth,
        actionPolicy,
        prData,
        pullRequest,
        queryClient,
        prQueryKey,
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
        onApprovePullRequest: handleApprovePullRequest,
        onRequestChangesPullRequest: handleRequestChangesPullRequest,
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
        navbarState,
        navbarStatusDate,
        buildStatuses: prData?.buildStatuses,
        unresolvedThreadCount: unresolvedThreads.length,
        actionPolicy,
        isApproved,
        approvePending: approveMutation.isPending,
        requestChangesPending: requestChangesMutation.isPending,
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
                    onWorkspaceModeChange={setViewMode}
                    onActiveFileChange={setActiveFile}
                    onShowSettingsPanelChange={setShowSettingsPanel}
                    onCopyPath={(path) => {
                        void handleCopyPath(path);
                    }}
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
