import { type CSSProperties, type ReactNode, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAllModeReveal } from "@/features/review/hooks/use-all-mode-reveal";
import { useAllModeActiveFileTracking } from "@/features/review/hooks/use-all-mode-scroll-selection";
import { useCommentReveal } from "@/features/review/hooks/use-comment-reveal";
import { useInlineCommentDrafts } from "@/features/review/hooks/use-inline-comment-drafts";
import { useMergeDialog } from "@/features/review/hooks/use-merge-dialog";
import { useMissingDiffRecovery } from "@/features/review/hooks/use-missing-diff-recovery";
import { useReviewActions } from "@/features/review/hooks/use-review-actions";
import { useParsedDiff, useReviewDiffModel } from "@/features/review/hooks/use-review-diff-model";
import { useReviewDocumentTitle } from "@/features/review/hooks/use-review-document-title";
import { useReviewFileContexts } from "@/features/review/hooks/use-review-file-contexts";
import { useReviewLayoutPreferences } from "@/features/review/hooks/use-review-layout-preferences";
import { useReviewNavigation } from "@/features/review/hooks/use-review-navigation";
import { useReviewScope } from "@/features/review/hooks/use-review-scope";
import { useEnsureSummarySelection, useReviewActiveFileSync } from "@/features/review/hooks/use-review-selection";
import { useReviewUrlHash } from "@/features/review/hooks/use-review-url-hash";
import { useAutoMarkActiveFileViewed, useReviewViewedFiles, viewedStorageKey } from "@/features/review/hooks/use-review-viewed-files";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { parsePrFileHashTarget } from "@/features/review/model/pr-file-hash";
import { PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import { diffScopeStorageSegment, type ReviewDiffScopeSearch } from "@/features/review/model/review-diff-scope";
import { pullRequestHeader } from "@/features/review/model/review-formatters";
import type { InlineCommentLineTarget } from "@/features/review/model/review-page-model";
import type { CommentTarget } from "@/features/review/model/summary-timeline";
import { getSettingsTreeItems, settingsPathForTab } from "@/features/settings/model/settings-navigation";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions } from "@/lib/diff-options";
import { useDiffOptions } from "@/lib/diff-options-context";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
import { buildReviewActionPolicy } from "@/lib/git-host/review-policy";
import type { GitHost } from "@/lib/git-host/types";
import { useSelectedRepoPullRequests } from "@/lib/selected-pull-requests";
import type { InlineDraftLocation } from "@/lib/storage";

export interface PullRequestReviewPageProps {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    auth: { canWrite: boolean; canRead: boolean };
    reviewDiffScopeSearch: ReviewDiffScopeSearch;
    onReviewDiffScopeSearchChange: (next: ReviewDiffScopeSearch) => void;
    onRequireAuth: (reason: "write" | "rate_limit") => void;
    authPromptSlot?: ReactNode;
}

function useDiffTypographyStyle() {
    const { monospaceFontFamily, monospaceFontSize, monospaceLineHeight } = useAppearance();
    return useMemo(() => {
        const fontFamily = fontFamilyToCss(monospaceFontFamily);
        const fontSize = `${monospaceFontSize}px`;
        const lineHeight = String(monospaceLineHeight);
        return {
            "--diff-font-family": fontFamily,
            "--diff-font-size": fontSize,
            "--diff-line-height": lineHeight,
            "--diffs-font-family": fontFamily,
            "--diffs-font-size": fontSize,
            "--diffs-line-height": lineHeight,
        } as CSSProperties;
    }, [monospaceFontFamily, monospaceFontSize, monospaceLineHeight]);
}

/** Collapses the comments sidebar once per pull request when it has nothing unresolved to show. */
function useAutoCollapseCommentsSidebar(contextKey: string, ready: boolean, unresolvedCount: number, collapse: () => void) {
    const handledContextRef = useRef("");
    useEffect(() => {
        if (!ready || handledContextRef.current === contextKey) return;
        handledContextRef.current = contextKey;
        if (unresolvedCount === 0) collapse();
    }, [collapse, contextKey, ready, unresolvedCount]);
}

export function useReviewController({
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
    const prRef = useMemo(() => ({ host, workspace, repo, pullRequestId }), [host, pullRequestId, repo, workspace]);
    const prContextKey = `${host}:${workspace}/${repo}/${pullRequestId}`;
    const { options } = useDiffOptions();
    const diffTypographyStyle = useDiffTypographyStyle();
    const { activeFile, setActiveFile } = useFileTree();
    const layout = useReviewLayoutPreferences();
    const { viewMode, setViewMode, setTreeCollapsed, setRightSidebarCollapsed } = layout;
    const diffScrollRef = useRef<HTMLDivElement | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [showUnviewedOnly, setShowUnviewedOnly] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [omnibarOpen, setOmnibarOpen] = useState(false);
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);

    const restoreDraftFile = useCallback(
        (draft: InlineDraftLocation) => {
            setActiveFile(draft.path);
            setViewMode("single");
        },
        [setActiveFile, setViewMode],
    );
    const drafts = useInlineCommentDrafts({ scopeId: `${workspace}/${repo}/${pullRequestId}`, onRestore: restoreDraftFile });
    const {
        pr: prQuery,
        scopedData: prData,
        resolvedScope,
        commitScopeLoading,
        scopeNotice,
        setScopeNotice,
        refetch: refetchScope,
    } = useReviewScope({ prRef, auth, search: reviewDiffScopeSearch, onSearchChange: onReviewDiffScopeSearchChange, requestAuth: onRequireAuth });
    const capabilities = prQuery.hostCapabilities;
    const pullRequest = prData?.pr;
    const pullRequestTitle = pullRequest?.title?.trim();
    const isFullScope = resolvedScope.mode === "full";
    // Inline comments anchor to lines of the full diff, so drafts only show there.
    const inlineDraft = isFullScope ? drafts.inlineDraft : null;
    const merge = useMergeDialog(capabilities.mergeStrategies);
    const header = pullRequestHeader(pullRequest);
    useReviewDocumentTitle({ isLoading: prQuery.isLoading, pullRequestTitle });

    const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
    const diffOptions = useMemo(() => ({ ...toLibraryOptions(options), disableFileHeader: true }), [options]);
    const { openInlineDraft: openDraft } = drafts;
    const openInlineDraft = useCallback(
        (path: string, target: InlineCommentLineTarget) => {
            if (isFullScope) openDraft({ path, line: target.lineNumber, side: target.annotationSide });
        },
        [isFullScope, openDraft],
    );
    const { fileContextStatus, loadFullFileContext, readyFileContexts } = useReviewFileContexts({
        prRef,
        baseCommitHash: isFullScope ? pullRequest?.destination?.commit?.hash : resolvedScope.baseCommitHash,
        headCommitHash: isFullScope ? pullRequest?.source?.commit?.hash : resolvedScope.headCommitHash,
    });

    const parsedDiff = useParsedDiff(prData?.diff ?? "");
    const { viewedFiles, setViewed, versionIdByPath, markPathViewed, toggleViewedForPath } = useReviewViewedFiles({
        fileDiffFingerprints: parsedDiff.fileDiffFingerprints,
        storageKey: viewedStorageKey(prRef, diffScopeStorageSegment(resolvedScope)),
    });
    const model = useReviewDiffModel({
        parsedDiff,
        prData,
        activeFile,
        showUnviewedOnly,
        searchQuery: deferredSearchQuery,
        showSettingsPanel,
        viewedFiles,
        settingsTreeItems,
        inlineDraft: inlineDraft?.location ?? null,
        fullFileContexts: readyFileContexts,
    });
    const { selectableDiffPathSet, allModeDiffEntries, treeOrderedVisiblePaths, settingsPathSet, visiblePathSet, sidebarThreads } = model;

    const unresolvedCommentCount = sidebarThreads.filter((thread) => !thread.isResolved).length;
    const collapseCommentsSidebar = useCallback(() => setRightSidebarCollapsed(true), [setRightSidebarCollapsed]);
    useAutoCollapseCommentsSidebar(prContextKey, Boolean(prData) && !prQuery.isFetching, unresolvedCommentCount, collapseCommentsSidebar);
    useMissingDiffRecovery({
        contextKey: prContextKey,
        diff: prData?.diff,
        diffstatCount: prData?.diffstat.length ?? 0,
        selectablePathCount: selectableDiffPathSet.size,
        enabled: isFullScope && !prQuery.isFetching,
        refetch: prQuery.refetch,
    });

    const allDiffFilePaths = useMemo(() => Array.from(selectableDiffPathSet), [selectableDiffPathSet]);
    const unviewedFileCount = allDiffFilePaths.filter((path) => !viewedFiles.has(path)).length;
    const areAllFilesViewed = allDiffFilePaths.length > 0 && unviewedFileCount === 0;

    const allModeSectionPaths = useMemo(() => {
        const paths = allModeDiffEntries.map((entry) => entry.filePath);
        return prData ? [PR_SUMMARY_PATH, ...paths] : paths;
    }, [allModeDiffEntries, prData]);
    const allModeActive = viewMode === "all" && !showSettingsPanel;
    const allModeReveal = useAllModeReveal({ active: allModeActive, scrollRef: diffScrollRef, sectionPaths: allModeSectionPaths });

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
        versionIdByPath,
        markPathViewed,
    });
    useEnsureSummarySelection({
        showSettingsPanel,
        viewMode,
        prData,
        isSummarySelected: model.isSummarySelected,
        selectedFileDiff: model.selectedFileDiff,
        setActiveFile,
    });

    const currentUserReviewStatus = prData?.currentUserReviewStatus ?? "none";
    const isApproved = currentUserReviewStatus === "approved";
    const actionPolicy = useMemo(
        () =>
            buildReviewActionPolicy({
                capabilities,
                isAuthenticatedForWrite: auth.canWrite,
                isApprovedByCurrentUser: isApproved,
                prState: pullRequest?.state,
                isDraft: pullRequest?.draft,
            }),
        [auth.canWrite, capabilities, isApproved, pullRequest?.draft, pullRequest?.state],
    );

    const actions = useReviewActions({
        prRef,
        pullRequest,
        canWrite: auth.canWrite,
        requestAuth: onRequireAuth,
        actionPolicy,
        isApprovedByCurrentUser: isApproved,
        refetchPullRequest: prQuery.refetch,
        refetchComments: prQuery.refetchComments,
        merge: { message: merge.message, mergeStrategy: merge.mergeStrategy, closeSourceBranch: merge.closeSourceBranch },
        onMerged: () => merge.setOpen(false),
        inlineDraft,
        discardInlineDraft: drafts.discardInlineDraft,
    });
    const revealComment = useCommentReveal();

    const handleOpenOmnibar = () => {
        if (!merge.open) setOmnibarOpen(true);
    };
    const { toggleSettingsPanel, selectAndRevealFile } = useReviewNavigation({
        onOpenOmnibar: handleOpenOmnibar,
        activeFile,
        settingsPathSet,
        viewMode,
        treeOrderedVisiblePaths,
        viewedFiles,
        diffScrollRef,
        setActiveFile,
        showSettingsPanel,
        setShowSettingsPanel,
        setTreeCollapsed,
        setRightSidebarCollapsed,
        setCollapsedAllModeFiles,
        setIsSummaryCollapsedInAllMode,
        toggleViewedForPath,
        markViewedForPath: markPathViewed,
        onAllModeRevealStart: allModeReveal.startReveal,
        onApprovePullRequest: actions.handleApprovePullRequest,
        onRequestChangesPullRequest: actions.handleRequestChangesPullRequest,
    });
    const navigateToComment = ({ path, commentId }: CommentTarget) => {
        if (!path) return;
        selectAndRevealFile(path);
        if (typeof commentId === "number") revealComment(commentId);
    };
    const handleHashTarget = useCallback(
        ({ path, commentId }: CommentTarget) => {
            setShowSettingsPanel(false);
            if (typeof commentId === "number") revealComment(commentId);
            if (viewMode === "all") selectAndRevealFile(path);
            else setActiveFile(path);
        },
        [revealComment, selectAndRevealFile, setActiveFile, viewMode],
    );
    const { selectWithoutHash } = useReviewUrlHash({
        activeFile,
        setActiveFile,
        showSettingsPanel,
        settingsPathSet,
        selectableFilePaths: selectableDiffPathSet,
        isFileSelectionReady: selectableDiffPathSet.size > 0 || prData?.diffstat.length === 0,
        comments: prData?.comments ?? [],
        commentsLoading: prQuery.isCommentsLoading,
        onHashTarget: handleHashTarget,
    });
    useAllModeActiveFileTracking({
        enabled: allModeActive,
        diffScrollRef,
        sectionPaths: allModeSectionPaths,
        reveal: allModeReveal,
        activeFile,
        autoMarkViewedFiles: options.autoMarkViewedFiles,
        markPathViewed,
        selectWithoutHash,
    });

    const { sortedRootPullRequests, openPullRequest } = useSelectedRepoPullRequests();
    // The pull request actions offered by both the navbar and the omnibar.
    const pullRequestActions = {
        currentUserReviewStatus,
        isDraft: header.isDraft,
        canApprove: actionPolicy.canApprove,
        canRequestChanges: actionPolicy.canRequestChanges,
        canMerge: actionPolicy.canMerge,
        canDecline: actionPolicy.canDecline,
        canMarkDraft: actionPolicy.canMarkDraft,
        onApprove: actions.handleApprovePullRequest,
        onRequestChanges: actions.handleRequestChangesPullRequest,
        onDecline: actions.handleDeclinePullRequest,
        onMarkDraft: actions.handleMarkPullRequestAsDraft,
        onOpenMerge: () => merge.setOpen(true),
    };
    const canCommentInline = actionPolicy.canCommentInline && isFullScope;
    const commentActions: CommentActions = {
        ...actions.commentActions,
        currentUserDisplayName: prData?.currentUser?.displayName,
        canReply: canCommentInline,
        nestedReplies: capabilities.supportsNestedReplies,
    };
    const toggleViewed = (path: string) => {
        if (!viewedFiles.has(path)) setCollapsedAllModeFiles((collapsed) => ({ ...collapsed, [path]: true }));
        toggleViewedForPath(path);
    };

    return {
        host,
        pullRequestId,
        auth,
        authPromptSlot,
        prData,
        pullRequestTitle,
        prQuery,
        diffScrollRef,
        viewMode,
        setViewMode,
        showSettingsPanel,
        activeFile,
        closeSettings: () => {
            setShowSettingsPanel(false);
            setActiveFile(PR_SUMMARY_PATH);
        },
        openDiffSettings: () => {
            setActiveFile(settingsPathForTab("diff"));
            setShowSettingsPanel(true);
        },
        model,
        diffOptions,
        diffTypographyStyle,
        viewedFiles,
        areAllFilesViewed,
        toggleAllFilesViewed: () => setViewed(allDiffFilePaths, () => !areAllFilesViewed),
        toggleViewed,
        copiedPath: actions.copiedPath,
        onCopyPath: actions.handleCopyPath,
        fileContextState: fileContextStatus,
        onLoadFullFileContext: loadFullFileContext,
        collapsedAllModeFiles,
        collapseViewedFilesByDefault: options.collapseViewedFilesByDefault,
        isSummaryCollapsedInAllMode,
        toggleSummaryCollapsed: () => startTransition(() => setIsSummaryCollapsedInAllMode((prev) => !prev)),
        setFileCollapsed: (path: string, next: boolean) => startTransition(() => setCollapsedAllModeFiles((prev) => ({ ...prev, [path]: next }))),
        pendingScrollPath: allModeReveal.pendingScrollPath,
        openInlineDraft,
        canCommentInline,
        commentActions,
        annotationProps: {
            actions: commentActions,
            linkedCommentId: typeof window === "undefined" ? undefined : parsePrFileHashTarget(window.location.hash)?.commentId,
            draftContent: inlineDraft?.content ?? "",
            draftAutoFocus: Boolean(inlineDraft?.focus),
            onDraftFocused: drafts.markInlineDraftFocused,
            onDraftChange: drafts.setInlineDraftContent,
            onSubmitDraft: actions.submitInlineComment,
            onCancelDraft: drafts.discardInlineDraft,
        },
        summaryProps: {
            actions: commentActions,
            updateDescriptionPending: actions.updateDescriptionMutation.isPending,
            onEditDescription: auth.canWrite ? (description: string) => actions.updateDescriptionMutation.mutateAsync(description) : undefined,
            onSelectComment: navigateToComment,
        },
        summaryComposer: {
            currentUserDisplayName: prData?.currentUser?.displayName,
            currentUserAvatarUrl: prData?.currentUser?.avatarUrl,
            canComment: canCommentInline,
            isSubmitting: actions.createCommentMutation.isPending,
            onSubmit: actions.submitPullRequestComment,
        },
        actionError: actions.actionError,
        commitScope: { resolvedScope, commitScopeLoading, scopeNotice, setScopeNotice, onSearchChange: onReviewDiffScopeSearchChange },
        comments: {
            width: layout.rightSidebarWidth,
            collapsed: layout.rightSidebarCollapsed,
            unresolvedCount: unresolvedCommentCount,
            threads: sidebarThreads,
            actions: commentActions,
            onToggleCollapsed: () => setRightSidebarCollapsed((collapsed) => !collapsed),
            onStartResize: layout.startRightSidebarResize,
            onSelectThread: navigateToComment,
        },
        sidebarProps: {
            treeWidth: layout.treeWidth,
            treeCollapsed: layout.treeCollapsed,
            loading: prQuery.isLoading || commitScopeLoading,
            loadProgress: prQuery.loadProgress,
            showSettingsPanel,
            activeFile,
            treeEntries: model.treeEntries,
            fileLineStats: model.fileLineStats,
            searchQuery,
            showUnviewedOnly,
            unviewedFileCount,
            viewedFiles,
            onRefresh: async () => {
                if (!showSettingsPanel) await refetchScope();
            },
            onToggleSettings: toggleSettingsPanel,
            onCollapseTree: () => setTreeCollapsed(true),
            onSearchQueryChange: setSearchQuery,
            onToggleUnviewedOnly: () => startTransition(() => setShowUnviewedOnly((prev) => !prev)),
            onFileClick: selectAndRevealFile,
            onStartTreeResize: layout.startTreeResize,
        },
        navbarProps: {
            isRefreshing: prQuery.isFetching,
            treeCollapsed: layout.treeCollapsed,
            unviewedFileCount,
            rightSidebarCollapsed: layout.rightSidebarCollapsed,
            unresolvedCommentCount,
            host,
            ...header,
            buildStatuses: prData?.buildStatuses,
            reviewers: prData?.reviewers,
            ...pullRequestActions,
            isApprovePending: actions.approveMutation.isPending || actions.removeApprovalMutation.isPending,
            isRequestChangesPending: actions.requestChangesMutation.isPending,
            isDeclinePending: actions.declineMutation.isPending,
            isMarkDraftPending: actions.markDraftMutation.isPending,
            copiedSourceBranch: actions.copiedSourceBranch,
            onExpandTree: () => setTreeCollapsed(false),
            onExpandRightSidebar: () => setRightSidebarCollapsed(false),
            onCopySourceBranch: actions.handleCopySourceBranch,
            onOpenOmnibar: handleOpenOmnibar,
        },
        omnibarProps: {
            open: omnibarOpen,
            onOpenChange: setOmnibarOpen,
            filePaths: model.omnibarFilePaths,
            pullRequests: sortedRootPullRequests,
            ...pullRequestActions,
            actionBusy: actions.pullRequestActionPending,
            onSelectFile: (path: string) => {
                setSearchQuery("");
                selectAndRevealFile(path);
            },
            onSelectPullRequest: openPullRequest,
        },
        mergeDialogProps: {
            open: merge.open,
            onOpenChange: merge.setOpen,
            mergeStrategies: capabilities.mergeStrategies,
            mergeStrategy: merge.mergeStrategy,
            onMergeStrategyChange: merge.setMergeStrategy,
            mergeMessage: merge.message,
            onMergeMessageChange: merge.setMessage,
            closeSourceBranch: merge.closeSourceBranch,
            onCloseSourceBranchChange: merge.setCloseSourceBranch,
            canMerge: actionPolicy.canMerge,
            isMerging: actions.mergeMutation.isPending,
            onMerge: () => actions.mergeMutation.mutate(),
        },
    };
}

export type ReviewController = ReturnType<typeof useReviewController>;
