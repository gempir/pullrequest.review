import { type CSSProperties, type ReactNode, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { getSettingsTreeItems, settingsPathForTab } from "@/components/settings-navigation";
import { useSelectedRepoPullRequests } from "@/features/landing/hooks/use-selected-repo-pull-requests";
import { ALL_MODE_STICKY_OFFSET, useAllModeReveal } from "@/features/review/hooks/use-all-mode-reveal";
import { useCommentReveal } from "@/features/review/hooks/use-comment-reveal";
import { useInlineCommentDrafts } from "@/features/review/hooks/use-inline-comment-drafts";
import { useReviewActions } from "@/features/review/hooks/use-review-actions";
import { useParsedDiff, useReviewDiffModel } from "@/features/review/hooks/use-review-diff-model";
import { useReviewFileContexts } from "@/features/review/hooks/use-review-file-contexts";
import { useReviewLayoutPreferences } from "@/features/review/hooks/use-review-layout-preferences";
import { useReviewNavigation } from "@/features/review/hooks/use-review-navigation";
import {
    useAllModeScrollSelection,
    useAutoMarkActiveFileViewed,
    useEnsureSummarySelection,
    useInlineDraftFocus,
    useReviewActiveFileSync,
    useReviewDocumentTitle,
    useReviewFileHashSelection,
    useReviewFileHashSync,
    useSyncMergeStrategy,
} from "@/features/review/hooks/use-review-page-effects";
import { useReviewScope } from "@/features/review/hooks/use-review-scope";
import { useReviewViewedFiles, viewedStorageKey } from "@/features/review/hooks/use-review-viewed-files";
import type { InlineCommentLineTarget } from "@/features/review/model/review-page-model";
import { useAppearance } from "@/lib/appearance-context";
import { toLibraryOptions } from "@/lib/diff-options";
import { useDiffOptions } from "@/lib/diff-options-context";
import { useFileTree } from "@/lib/file-tree-context";
import { fontFamilyToCss } from "@/lib/font-options";
import { buildReviewActionPolicy } from "@/lib/git-host/review-policy";
import type { GitHost } from "@/lib/git-host/types";
import { parsePrFileHashTarget } from "@/lib/pr-file-hash";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { diffScopeStorageSegment, type ReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { hashString } from "@/lib/review-file-fingerprint";

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

const MAX_MISSING_DIFF_RECOVERIES = 2;

/** Hosts occasionally answer with a diffstat but an empty diff; refetching usually fills it in. */
function useMissingDiffRecovery({
    contextKey,
    diff,
    diffstatCount,
    selectablePathCount,
    enabled,
    refetch,
}: {
    contextKey: string;
    diff: string | undefined;
    diffstatCount: number;
    selectablePathCount: number;
    enabled: boolean;
    refetch: () => Promise<unknown>;
}) {
    const recoveryRef = useRef({ contextKey: "", attempts: 0, signature: "" });
    useEffect(() => {
        if (!enabled || diff === undefined || diffstatCount === 0) return;
        if (recoveryRef.current.contextKey !== contextKey) recoveryRef.current = { contextKey, attempts: 0, signature: "" };
        const hasDiffText = diff.trim().length > 0;
        if (hasDiffText && selectablePathCount > 0) return;
        const signature = `${diffstatCount}:${selectablePathCount}:${hasDiffText ? hashString(diff) : "none"}`;
        if (recoveryRef.current.attempts >= MAX_MISSING_DIFF_RECOVERIES || recoveryRef.current.signature === signature) return;
        recoveryRef.current = { contextKey, attempts: recoveryRef.current.attempts + 1, signature };
        void refetch();
    }, [contextKey, diff, diffstatCount, enabled, refetch, selectablePathCount]);
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
    const requestAuth = useCallback((reason: "write" | "rate_limit") => onRequireAuth?.(reason), [onRequireAuth]);
    const { options } = useDiffOptions();
    const { monospaceFontFamily, monospaceFontSize, monospaceLineHeight } = useAppearance();
    const diffTypographyStyle = useMemo(() => {
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
    const { activeFile, setActiveFile } = useFileTree();
    const layout = useReviewLayoutPreferences();
    const { viewMode, setViewMode, setTreeCollapsed, setRightSidebarCollapsed } = layout;
    const diffScrollRef = useRef<HTMLDivElement | null>(null);
    const inlineDraftFocusRef = useRef<(() => void) | null>(null);
    const suppressHashSyncRef = useRef(false);
    const allModeLastStickyPathRef = useRef<string | null>(null);
    const autoCollapsedSidebarContextRef = useRef("");

    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [showUnviewedOnly, setShowUnviewedOnly] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [omnibarOpen, setOmnibarOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeMessage, setMergeMessage] = useState("");
    const [mergeStrategy, setMergeStrategy] = useState("merge_commit");
    const [closeSourceBranch, setCloseSourceBranch] = useState(true);
    const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<Record<string, boolean>>({});
    const [isSummaryCollapsedInAllMode, setIsSummaryCollapsedInAllMode] = useState(false);

    const drafts = useInlineCommentDrafts({ workspace, repo, pullRequestId, setActiveFile, setViewMode });
    const { inlineComment, setInlineComment, openInlineCommentDraft } = drafts;
    const {
        pr: prQuery,
        scopedData: prData,
        resolvedScope,
        commitScopeLoading,
        scopeNotice,
        setScopeNotice,
        refetch: refetchScope,
    } = useReviewScope({ prRef, auth, search: reviewDiffScopeSearch, onSearchChange: onReviewDiffScopeSearchChange, requestAuth });
    const pullRequest = prData?.pr;
    const pullRequestTitle = pullRequest?.title?.trim();
    const isFullScope = resolvedScope.mode === "full";
    useReviewDocumentTitle({ isLoading: prQuery.isLoading, pullRequestTitle });

    useEffect(() => {
        if (!isFullScope) setInlineComment(null);
    }, [isFullScope, setInlineComment]);

    const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
    const diffOptions = useMemo(() => ({ ...toLibraryOptions(options), disableFileHeader: true }), [options]);
    const openInlineDraft = useCallback(
        (path: string, target: InlineCommentLineTarget) => {
            if (isFullScope) openInlineCommentDraft({ path, line: target.lineNumber, side: target.annotationSide ?? "additions" });
        },
        [isFullScope, openInlineCommentDraft],
    );
    const { fileContextStatus, loadFullFileContext, readyFileContexts } = useReviewFileContexts({
        prRef,
        baseCommitHash: isFullScope ? prData?.pr.destination?.commit?.hash : resolvedScope.baseCommitHash,
        headCommitHash: isFullScope ? prData?.pr.source?.commit?.hash : resolvedScope.headCommitHash,
    });

    const parsedDiff = useParsedDiff(prData?.diff ?? "");
    const { viewedFiles, setViewedFiles, versionIdByPath, markPathViewed, toggleViewedForPath } = useReviewViewedFiles({
        fileDiffFingerprints: parsedDiff.fileDiffFingerprints,
        diffNotReady: !prData || commitScopeLoading || (prData.diffstat.length > 0 && parsedDiff.fileDiffFingerprints.size === 0),
        storageKey: viewedStorageKey(prRef, diffScopeStorageSegment(resolvedScope)),
    });
    const model = useReviewDiffModel({
        parsedDiff,
        prData,
        pullRequest,
        activeFile,
        showUnviewedOnly,
        searchQuery: deferredSearchQuery,
        showSettingsPanel,
        viewedFiles,
        settingsTreeItems,
        inlineComment,
        theme: options.theme,
        fullFileContexts: readyFileContexts,
    });
    const { selectableDiffPathSet, allModeDiffEntries, treeOrderedVisiblePaths, settingsPathSet, visiblePathSet, sidebarThreads } = model;

    const unresolvedCommentCount = sidebarThreads.filter((thread) => !thread.isResolved).length;
    useEffect(() => {
        if (!prData || prQuery.isFetching || autoCollapsedSidebarContextRef.current === prContextKey) return;
        autoCollapsedSidebarContextRef.current = prContextKey;
        if (unresolvedCommentCount === 0) setRightSidebarCollapsed(true);
    }, [prContextKey, prData, prQuery.isFetching, setRightSidebarCollapsed, unresolvedCommentCount]);

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
    const toggleAllFilesViewed = () => {
        setViewedFiles((prev) => {
            const next = new Set(prev);
            for (const path of allDiffFilePaths) {
                if (areAllFilesViewed) next.delete(path);
                else next.add(path);
            }
            return next;
        });
    };

    const allModeSectionPaths = useMemo(() => {
        const paths = allModeDiffEntries.map((entry) => entry.filePath);
        return prData ? [PR_SUMMARY_PATH, ...paths] : paths;
    }, [allModeDiffEntries, prData]);
    const lastAllModeSectionPath = allModeSectionPaths.at(-1) ?? null;
    const allModeActive = viewMode === "all" && !showSettingsPanel;
    const allModeReveal = useAllModeReveal({ active: allModeActive, scrollRef: diffScrollRef, sectionPaths: allModeSectionPaths });
    const { pendingScrollPath: allModePendingScrollPath, clearPendingScrollPath } = allModeReveal;

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
    useSyncMergeStrategy({ prData, mergeStrategies: prQuery.hostCapabilities.mergeStrategies, mergeStrategy, setMergeStrategy });

    const currentUserReviewStatus = pullRequest?.currentUserReviewStatus ?? "none";
    const isApproved = currentUserReviewStatus === "approved";
    const actionPolicy = useMemo(
        () =>
            buildReviewActionPolicy({
                capabilities: prQuery.hostCapabilities,
                isAuthenticatedForWrite: auth.canWrite,
                isApprovedByCurrentUser: isApproved,
                prState: pullRequest?.state,
                isDraft: pullRequest?.draft,
            }),
        [auth.canWrite, isApproved, prQuery.hostCapabilities, pullRequest?.draft, pullRequest?.state],
    );

    const actions = useReviewActions({
        prRef,
        isLoaded: Boolean(pullRequest),
        pullRequestTitle: pullRequest?.title,
        authCanWrite: auth.canWrite,
        requestAuth,
        actionPolicy,
        isApprovedByCurrentUser: isApproved,
        isDraft: Boolean(pullRequest?.draft),
        refetchPullRequest: prQuery.refetch,
        refetchComments: prQuery.refetchComments,
        merge: { message: mergeMessage, mergeStrategy, closeSourceBranch },
        onMerged: () => setMergeOpen(false),
        inlineComment,
        getInlineDraftContent: drafts.getInlineDraftContent,
        clearInlineDraftContent: drafts.clearInlineDraftContent,
        setInlineComment,
    });
    const revealComment = useCommentReveal();

    const handleOpenOmnibar = () => {
        if (!mergeOpen) setOmnibarOpen(true);
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
    const toggleViewed = (path: string) => {
        if (!viewedFiles.has(path)) setCollapsedAllModeFiles((collapsed) => ({ ...collapsed, [path]: true }));
        toggleViewedForPath(path);
    };
    const navigateToComment = ({ path, commentId }: { path: string; commentId?: number }) => {
        if (!path) return;
        selectAndRevealFile(path);
        if (typeof commentId === "number") revealComment(commentId);
    };
    const handleHashPathResolved = useCallback(
        ({ path, commentId }: { path: string; commentId?: number }) => {
            suppressHashSyncRef.current = true;
            setShowSettingsPanel(false);
            if (typeof commentId === "number") revealComment(commentId);
            if (viewMode === "all") selectAndRevealFile(path);
            else setActiveFile(path);
        },
        [revealComment, selectAndRevealFile, setActiveFile, viewMode],
    );
    const handleObservedAllModePath = (path: string, { isSticky }: { isSticky: boolean }) => {
        const pendingPath = allModePendingScrollPath;
        if (pendingPath && path !== pendingPath) return;
        if (pendingPath) clearPendingScrollPath();
        if (path !== PR_SUMMARY_PATH && options.autoMarkViewedFiles) {
            const shouldMarkViewed = isSticky || pendingPath === path || (!pendingPath && path === lastAllModeSectionPath);
            if (shouldMarkViewed && allModeLastStickyPathRef.current !== path) markPathViewed(path);
        }
        if (isSticky) allModeLastStickyPathRef.current = path === PR_SUMMARY_PATH ? null : path;
        else if (allModeLastStickyPathRef.current === path) allModeLastStickyPathRef.current = null;
        if (activeFile === path) return;
        suppressHashSyncRef.current = true;
        setActiveFile(path);
    };

    useReviewFileHashSelection({
        selectableFilePaths: selectableDiffPathSet,
        comments: prData?.comments ?? [],
        commentsLoading: prQuery.isDeferredLoading,
        onHashPathResolved: handleHashPathResolved,
    });
    useAllModeScrollSelection({
        enabled: allModeActive,
        diffScrollRef,
        sectionPaths: allModeSectionPaths,
        stickyTopOffset: ALL_MODE_STICKY_OFFSET,
        programmaticTargetRef: allModeReveal.programmaticTargetRef,
        suppressObserverUntilRef: allModeReveal.suppressObserverUntilRef,
        onObservedActivePath: handleObservedAllModePath,
    });
    useReviewFileHashSync({
        activeFile,
        showSettingsPanel,
        settingsPathSet,
        selectableFilePaths: selectableDiffPathSet,
        isFileSelectionReady: selectableDiffPathSet.size > 0 || prData?.diffstat.length === 0,
        suppressHashSyncRef,
    });
    useInlineDraftFocus({ inlineComment, inlineDraftFocusRef });

    const { sortedRootPullRequests, openPullRequest } = useSelectedRepoPullRequests();
    const actionBusy =
        actions.approveMutation.isPending ||
        actions.removeApprovalMutation.isPending ||
        actions.requestChangesMutation.isPending ||
        actions.declineMutation.isPending ||
        actions.markDraftMutation.isPending ||
        actions.mergeMutation.isPending;
    const canCommentInline = actionPolicy.canCommentInline && isFullScope;
    const isDraft = Boolean(pullRequest?.draft);
    const threadProps = {
        canResolveThread: actionPolicy.canResolveThread,
        canCommentInline,
        createCommentPending: actions.createCommentMutation.isPending,
        resolveCommentPending: actions.resolveCommentMutation.isPending,
        deleteCommentPending: actions.deleteCommentMutation.isPending,
        updateCommentPending: actions.updateCommentMutation.isPending,
        currentUserDisplayName: pullRequest?.currentUser?.displayName,
        onDeleteComment: (commentId: number, hasInlineContext: boolean) => actions.deleteCommentMutation.mutate({ commentId, hasInlineContext }),
        onResolveThread: (commentId: number, resolve: boolean) => actions.resolveCommentMutation.mutate({ commentId, resolve }),
        onReplyToThread: actions.submitThreadReply,
        onEditComment: actions.submitCommentEdit,
    };

    return {
        host,
        workspace,
        repo,
        pullRequestId,
        auth,
        authPromptSlot,
        prData,
        pullRequest,
        pullRequestTitle,
        prQuery,
        diffScrollRef,
        layout,
        viewMode,
        setViewMode,
        showSettingsPanel,
        activeFile,
        setActiveFile,
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
        toggleAllFilesViewed,
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
        pendingScrollPath: allModePendingScrollPath,
        openInlineDraft,
        canCommentInline,
        allowNestedReplies: host === "bitbucket",
        threadProps,
        annotationProps: {
            ...threadProps,
            linkedCommentId: typeof window === "undefined" ? undefined : parsePrFileHashTarget(window.location.hash)?.commentId,
            allowNestedReplies: host === "bitbucket",
            workspace,
            repo,
            pullRequestId,
            getInlineDraftContent: drafts.getInlineDraftContent,
            setInlineDraftContent: drafts.setInlineDraftContent,
            onSubmitInlineComment: actions.submitInlineComment,
            onInlineDraftReady: (focus: () => void) => {
                inlineDraftFocusRef.current = focus;
            },
            onCancelInlineDraft: (draft: { path: string; line: number; side: "additions" | "deletions" }) => {
                drafts.clearInlineDraftContent(draft);
                setInlineComment(null);
            },
        },
        summaryProps: {
            ...threadProps,
            updateDescriptionPending: actions.updateDescriptionMutation.isPending,
            canEditDescription: auth.canWrite,
            onEditDescription: (description: string) => actions.updateDescriptionMutation.mutateAsync(description),
            onSelectComment: navigateToComment,
        },
        summaryComposer: {
            currentUserDisplayName: pullRequest?.currentUser?.displayName,
            currentUserAvatarUrl: pullRequest?.currentUser?.avatarUrl,
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
            canResolveThread: actionPolicy.canResolveThread,
            resolveCommentPending: actions.resolveCommentMutation.isPending,
            onToggleCollapsed: () => setRightSidebarCollapsed((collapsed) => !collapsed),
            onStartResize: layout.startRightSidebarResize,
            onSelectThread: navigateToComment,
            onResolveThread: threadProps.onResolveThread,
        },
        sidebarProps: {
            treeWidth: layout.treeWidth,
            treeCollapsed: layout.treeCollapsed,
            loading: prQuery.isLoading || commitScopeLoading,
            showLoadingActivity: prQuery.isDeferredLoading,
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
            loading: false,
            isRefreshing: prQuery.isFetching,
            treeCollapsed: layout.treeCollapsed,
            unviewedFileCount,
            rightSidebarCollapsed: layout.rightSidebarCollapsed,
            unresolvedCommentCount,
            host,
            pullRequestUrl: pullRequest?.links?.html?.href,
            sourceBranch: pullRequest?.source?.branch?.name ?? "source",
            destinationBranch: pullRequest?.destination?.branch?.name ?? "target",
            navbarState: model.navbarState,
            navbarStatusTimestamp: model.navbarStatusTimestamp,
            buildStatuses: prData?.buildStatuses,
            reviewers: prData?.reviewers,
            canApprove: actionPolicy.canApprove,
            canRequestChanges: actionPolicy.canRequestChanges,
            canMerge: actionPolicy.canMerge,
            canDecline: actionPolicy.canDecline,
            canMarkDraft: actionPolicy.canMarkDraft,
            isDraft,
            currentUserReviewStatus,
            isApprovePending: actions.approveMutation.isPending || actions.removeApprovalMutation.isPending,
            isRequestChangesPending: actions.requestChangesMutation.isPending,
            isDeclinePending: actions.declineMutation.isPending,
            isMarkDraftPending: actions.markDraftMutation.isPending,
            copiedSourceBranch: actions.copiedSourceBranch,
            onExpandTree: () => setTreeCollapsed(false),
            onExpandRightSidebar: () => setRightSidebarCollapsed(false),
            onCopySourceBranch: actions.handleCopySourceBranch,
            onApprove: actions.handleApprovePullRequest,
            onRequestChanges: actions.handleRequestChangesPullRequest,
            onDecline: actions.handleDeclinePullRequest,
            onMarkDraft: actions.handleMarkPullRequestAsDraft,
            onOpenMerge: () => setMergeOpen(true),
            onOpenOmnibar: handleOpenOmnibar,
        },
        omnibarProps: {
            open: omnibarOpen,
            onOpenChange: setOmnibarOpen,
            filePaths: model.omnibarFilePaths,
            pullRequests: sortedRootPullRequests,
            currentUserReviewStatus,
            isDraft,
            canApprove: actionPolicy.canApprove,
            canRequestChanges: actionPolicy.canRequestChanges,
            canMerge: actionPolicy.canMerge,
            canDecline: actionPolicy.canDecline,
            canMarkDraft: actionPolicy.canMarkDraft,
            actionBusy,
            onSelectFile: (path: string) => {
                setSearchQuery("");
                selectAndRevealFile(path);
            },
            onSelectPullRequest: openPullRequest,
            onApprove: actions.handleApprovePullRequest,
            onRequestChanges: actions.handleRequestChangesPullRequest,
            onOpenMerge: () => setMergeOpen(true),
            onDecline: actions.handleDeclinePullRequest,
            onMarkDraft: actions.handleMarkPullRequestAsDraft,
        },
        mergeDialogProps: {
            open: mergeOpen,
            onOpenChange: setMergeOpen,
            mergeStrategies: prQuery.hostCapabilities.mergeStrategies,
            mergeStrategy,
            onMergeStrategyChange: setMergeStrategy,
            mergeMessage,
            onMergeMessageChange: setMergeMessage,
            closeSourceBranch,
            onCloseSourceBranchChange: setCloseSourceBranch,
            canMerge: actionPolicy.canMerge,
            isMerging: actions.mergeMutation.isPending,
            onMerge: () => actions.mergeMutation.mutate(),
        },
    };
}

export type ReviewController = ReturnType<typeof useReviewController>;
