import type { ComponentProps } from "react";
import { useMemo } from "react";
import type { ReviewPageMainView } from "./review-page-main-view";

type MainViewProps = ComponentProps<typeof ReviewPageMainView>;

export function useReviewPageViewProps({
    treeWidth,
    treeCollapsed,
    showSettingsPanel,
    searchQuery,
    showUnviewedOnly,
    unviewedFileCount,
    allowedPathSet,
    viewedFiles,
    pullRequest,
    isRefreshing,
    navbarState,
    navbarStatusDate,
    buildStatuses,
    actionPolicy,
    currentUserReviewStatus,
    approvePending,
    requestChangesPending,
    declinePending,
    markDraftPending,
    copiedSourceBranch,
    onHome,
    onToggleSettings,
    onCollapseTree,
    onExpandTree,
    onSearchQueryChange,
    onToggleUnviewedOnly,
    onCollapseAllDirectories,
    onExpandAllDirectories,
    onToggleViewed,
    onFileClick,
    onStartTreeResize,
    onCopySourceBranch,
    onApprove,
    onRequestChanges,
    onDecline,
    onMarkDraft,
    onOpenMerge,
    mergeOpen,
    onMergeDialogOpenChange,
    mergeStrategies,
    mergeStrategy,
    onMergeStrategyChange,
    mergeMessage,
    onMergeMessageChange,
    closeSourceBranch,
    onCloseSourceBranchChange,
    canMerge,
    isMerging,
    onMerge,
}: {
    treeWidth: number;
    treeCollapsed: boolean;
    showSettingsPanel: boolean;
    searchQuery: string;
    showUnviewedOnly: boolean;
    unviewedFileCount: number;
    allowedPathSet: Set<string>;
    viewedFiles: Set<string>;
    pullRequest: { source?: { branch?: { name?: string } }; destination?: { branch?: { name?: string } } };
    isRefreshing: boolean;
    navbarState: string;
    navbarStatusDate: string;
    buildStatuses: MainViewProps["navbarProps"]["buildStatuses"];
    actionPolicy: { canApprove: boolean; canRequestChanges: boolean; canMerge: boolean; canDecline: boolean; canMarkDraft: boolean };
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    approvePending: boolean;
    requestChangesPending: boolean;
    declinePending: boolean;
    markDraftPending: boolean;
    copiedSourceBranch: boolean;
    onHome: MainViewProps["sidebarProps"]["onHome"];
    onToggleSettings: MainViewProps["sidebarProps"]["onToggleSettings"];
    onCollapseTree: MainViewProps["sidebarProps"]["onCollapseTree"];
    onExpandTree: MainViewProps["navbarProps"]["onExpandTree"];
    onSearchQueryChange: MainViewProps["sidebarProps"]["onSearchQueryChange"];
    onToggleUnviewedOnly: MainViewProps["sidebarProps"]["onToggleUnviewedOnly"];
    onCollapseAllDirectories: MainViewProps["sidebarProps"]["onCollapseAllDirectories"];
    onExpandAllDirectories: MainViewProps["sidebarProps"]["onExpandAllDirectories"];
    onToggleViewed: MainViewProps["sidebarProps"]["onToggleViewed"];
    onFileClick: MainViewProps["sidebarProps"]["onFileClick"];
    onStartTreeResize: MainViewProps["sidebarProps"]["onStartTreeResize"];
    onCopySourceBranch: MainViewProps["navbarProps"]["onCopySourceBranch"];
    onApprove: MainViewProps["navbarProps"]["onApprove"];
    onRequestChanges: MainViewProps["navbarProps"]["onRequestChanges"];
    onDecline: MainViewProps["navbarProps"]["onDecline"];
    onMarkDraft: MainViewProps["navbarProps"]["onMarkDraft"];
    onOpenMerge: MainViewProps["navbarProps"]["onOpenMerge"];
    mergeOpen: boolean;
    onMergeDialogOpenChange: (open: boolean) => void;
    mergeStrategies: string[] | undefined;
    mergeStrategy: string;
    onMergeStrategyChange: (strategy: string) => void;
    mergeMessage: string;
    onMergeMessageChange: (message: string) => void;
    closeSourceBranch: boolean;
    onCloseSourceBranchChange: (next: boolean) => void;
    canMerge: boolean;
    isMerging: boolean;
    onMerge: () => void;
}) {
    const sidebarProps = useMemo<MainViewProps["sidebarProps"]>(
        () => ({
            treeWidth,
            treeCollapsed,
            loading: false,
            showSettingsPanel,
            searchQuery,
            showUnviewedOnly,
            unviewedFileCount,
            allowedPathSet,
            viewedFiles,
            onHome,
            onToggleSettings,
            onCollapseTree,
            onSearchQueryChange,
            onToggleUnviewedOnly,
            onCollapseAllDirectories,
            onExpandAllDirectories,
            onToggleViewed,
            onFileClick,
            onStartTreeResize,
        }),
        [
            allowedPathSet,
            onCollapseAllDirectories,
            onCollapseTree,
            onExpandAllDirectories,
            onFileClick,
            onHome,
            onSearchQueryChange,
            onStartTreeResize,
            onToggleSettings,
            onToggleUnviewedOnly,
            onToggleViewed,
            searchQuery,
            showSettingsPanel,
            showUnviewedOnly,
            unviewedFileCount,
            treeCollapsed,
            treeWidth,
            viewedFiles,
        ],
    );

    const navbarProps = useMemo<MainViewProps["navbarProps"]>(
        () => ({
            loading: false,
            isRefreshing,
            treeCollapsed,
            sourceBranch: pullRequest?.source?.branch?.name ?? "source",
            destinationBranch: pullRequest?.destination?.branch?.name ?? "target",
            navbarState,
            navbarStatusDate,
            buildStatuses,
            canApprove: actionPolicy.canApprove,
            canRequestChanges: actionPolicy.canRequestChanges,
            canMerge: actionPolicy.canMerge,
            canDecline: actionPolicy.canDecline,
            canMarkDraft: actionPolicy.canMarkDraft,
            currentUserReviewStatus,
            isApprovePending: approvePending,
            isRequestChangesPending: requestChangesPending,
            isDeclinePending: declinePending,
            isMarkDraftPending: markDraftPending,
            copiedSourceBranch,
            onExpandTree,
            onCopySourceBranch,
            onApprove,
            onRequestChanges,
            onDecline,
            onMarkDraft,
            onOpenMerge,
        }),
        [
            actionPolicy.canApprove,
            actionPolicy.canDecline,
            actionPolicy.canMarkDraft,
            actionPolicy.canMerge,
            actionPolicy.canRequestChanges,
            approvePending,
            buildStatuses,
            copiedSourceBranch,
            currentUserReviewStatus,
            declinePending,
            isRefreshing,
            markDraftPending,
            navbarState,
            navbarStatusDate,
            onApprove,
            onDecline,
            onCopySourceBranch,
            onExpandTree,
            onMarkDraft,
            onOpenMerge,
            onRequestChanges,
            pullRequest,
            requestChangesPending,
            treeCollapsed,
        ],
    );

    const mergeDialogProps = useMemo<MainViewProps["mergeDialogProps"]>(
        () => ({
            open: mergeOpen,
            onOpenChange: onMergeDialogOpenChange,
            mergeStrategies,
            mergeStrategy,
            onMergeStrategyChange,
            mergeMessage,
            onMergeMessageChange,
            closeSourceBranch,
            onCloseSourceBranchChange,
            canMerge,
            isMerging,
            onMerge,
        }),
        [
            canMerge,
            closeSourceBranch,
            isMerging,
            mergeMessage,
            mergeOpen,
            mergeStrategies,
            mergeStrategy,
            onCloseSourceBranchChange,
            onMerge,
            onMergeDialogOpenChange,
            onMergeMessageChange,
            onMergeStrategyChange,
        ],
    );

    return { sidebarProps, navbarProps, mergeDialogProps };
}
