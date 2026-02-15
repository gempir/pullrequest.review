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
    allowedPathSet,
    viewedFiles,
    pullRequest,
    navbarState,
    navbarStatusDate,
    buildStatuses,
    unresolvedThreadCount,
    actionPolicy,
    isApproved,
    approvePending,
    requestChangesPending,
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
    allowedPathSet: Set<string>;
    viewedFiles: Set<string>;
    pullRequest: { source?: { branch?: { name?: string } }; destination?: { branch?: { name?: string } } };
    navbarState: string;
    navbarStatusDate: string;
    buildStatuses: MainViewProps["navbarProps"]["buildStatuses"];
    unresolvedThreadCount: number;
    actionPolicy: { canApprove: boolean; canRequestChanges: boolean; canMerge: boolean };
    isApproved: boolean;
    approvePending: boolean;
    requestChangesPending: boolean;
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
            treeCollapsed,
            treeWidth,
            viewedFiles,
        ],
    );

    const navbarProps = useMemo<MainViewProps["navbarProps"]>(
        () => ({
            loading: false,
            treeCollapsed,
            sourceBranch: pullRequest?.source?.branch?.name ?? "source",
            destinationBranch: pullRequest?.destination?.branch?.name ?? "target",
            navbarState,
            navbarStatusDate,
            buildStatuses,
            unresolvedThreadCount,
            canApprove: actionPolicy.canApprove,
            canRequestChanges: actionPolicy.canRequestChanges,
            canMerge: actionPolicy.canMerge,
            isApproved,
            isApprovePending: approvePending,
            isRequestChangesPending: requestChangesPending,
            copiedSourceBranch,
            onExpandTree,
            onCopySourceBranch,
            onApprove,
            onRequestChanges,
            onOpenMerge,
        }),
        [
            actionPolicy.canApprove,
            actionPolicy.canMerge,
            actionPolicy.canRequestChanges,
            approvePending,
            buildStatuses,
            copiedSourceBranch,
            isApproved,
            navbarState,
            navbarStatusDate,
            onApprove,
            onCopySourceBranch,
            onExpandTree,
            onOpenMerge,
            onRequestChanges,
            pullRequest,
            requestChangesPending,
            treeCollapsed,
            unresolvedThreadCount,
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
