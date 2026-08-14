import { Command } from "cmdk";
import { Check, ChevronRight, FileCode2, GitMerge, PanelTop, PenSquare, Search, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { OMNIBAR_GROUP_CLASS_NAME, OMNIBAR_ITEM_CLASS_NAME, PullRequestOmnibarGroup } from "@/components/omnibar/pull-request-omnibar";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import type { RepoRef } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

type ReviewOmnibarProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filePaths: readonly string[];
    pullRequests?: readonly SortedRootPullRequest[];
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    isDraft: boolean;
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    actionBusy: boolean;
    onSelectFile: (path: string) => void;
    onSelectPullRequest?: (repo: RepoRef, pullRequestId: string) => void;
    onApprove: () => void;
    onRequestChanges: () => void;
    onOpenMerge: () => void;
    onDecline: () => void;
    onMarkDraft: () => void;
};

export function getOmnibarFileName(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? path : path.slice(separatorIndex + 1);
}

function getOmnibarDirectory(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
}

export function ReviewOmnibarShortcutHint({ shortcutLabel }: { shortcutLabel: string }) {
    return <kbd className="hidden rounded-[3px] border border-border-muted bg-surface-1 px-1.5 py-0.5 font-mono leading-none sm:inline">{shortcutLabel}</kbd>;
}

export function ReviewOmnibar({
    open,
    onOpenChange,
    filePaths,
    pullRequests = [],
    currentUserReviewStatus,
    isDraft,
    canApprove,
    canRequestChanges,
    canMerge,
    canDecline,
    canMarkDraft,
    actionBusy,
    onSelectFile,
    onSelectPullRequest,
    onApprove,
    onRequestChanges,
    onOpenMerge,
    onDecline,
    onMarkDraft,
}: ReviewOmnibarProps) {
    const [search, setSearch] = useState("");
    const { shortcuts, getShortcutDisplay } = useShortcuts();
    const shortcutLabel = getShortcutDisplay(shortcuts.openOmnibar);
    const hasActions = canApprove || canRequestChanges || canMerge || canDecline || (isDraft && canMarkDraft);
    const hasPullRequests = pullRequests.length > 0 && Boolean(onSelectPullRequest);

    const closeAndRun = (action: () => void) => {
        setSearch("");
        onOpenChange(false);
        action();
    };
    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setSearch("");
        onOpenChange(nextOpen);
    };

    return (
        <Command.Dialog
            data-component="omnibar"
            open={open}
            onOpenChange={handleOpenChange}
            label="Pull request omnibar"
            loop
            overlayClassName="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-[1px]"
            contentClassName="fixed left-1/2 top-[16vh] z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden border border-border bg-popover shadow-2xl"
            className="font-mono"
        >
            <div className="flex h-11 items-center gap-2 border-b border-border-muted bg-chrome px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Command.Input
                    autoFocus
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search files, actions, or pull requests..."
                    aria-label="Search pull request files, actions, and pull requests"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="border border-border-muted bg-surface-1 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</span>
            </div>

            <Command.List className="max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto p-1 [scroll-padding-block:0.25rem]">
                <Command.Empty className="px-2 py-8 text-center text-[12px] text-muted-foreground">No matching files, actions, or pull requests.</Command.Empty>

                <Command.Group heading="Navigate" className={OMNIBAR_GROUP_CLASS_NAME}>
                    <Command.Item
                        value="navigation summary pull request overview"
                        keywords={["summary", "overview", "pull request"]}
                        onSelect={() => closeAndRun(() => onSelectFile(PR_SUMMARY_PATH))}
                        className={OMNIBAR_ITEM_CLASS_NAME}
                    >
                        <PanelTop className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">Summary</span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Command.Item>
                </Command.Group>

                <Command.Separator className="my-1 h-px bg-border-muted" />

                <Command.Group heading="Files" className={OMNIBAR_GROUP_CLASS_NAME}>
                    {filePaths.map((path) => {
                        const fileName = getOmnibarFileName(path);
                        const directory = getOmnibarDirectory(path);
                        return (
                            <Command.Item
                                key={path}
                                value={`file:${path}`}
                                keywords={[path, fileName, ...directory.split("/").filter(Boolean)]}
                                onSelect={() => closeAndRun(() => onSelectFile(path))}
                                className={OMNIBAR_ITEM_CLASS_NAME}
                            >
                                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{fileName}</span>
                                {directory ? <span className="max-w-[45%] shrink truncate text-[11px] text-muted-foreground">{directory}</span> : null}
                            </Command.Item>
                        );
                    })}
                </Command.Group>

                {hasPullRequests ? <Command.Separator className="my-1 h-px bg-border-muted" /> : null}
                {hasPullRequests && onSelectPullRequest ? (
                    <PullRequestOmnibarGroup
                        pullRequests={pullRequests}
                        onSelectPullRequest={(repo, pullRequestId) => closeAndRun(() => onSelectPullRequest(repo, pullRequestId))}
                    />
                ) : null}

                {hasActions ? <Command.Separator className="my-1 h-px bg-border-muted" /> : null}
                {hasActions ? (
                    <Command.Group heading="Actions" className={OMNIBAR_GROUP_CLASS_NAME}>
                        {canApprove ? (
                            <Command.Item
                                value={currentUserReviewStatus === "approved" ? "action remove approval" : "action approve pull request"}
                                keywords={["approve", "review"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onApprove)}
                                className={cn(OMNIBAR_ITEM_CLASS_NAME, "data-[selected=true]:text-status-added")}
                            >
                                <Check className="size-3.5 shrink-0 text-status-added" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{currentUserReviewStatus === "approved" ? "Remove approval" : "Approve"}</span>
                            </Command.Item>
                        ) : null}
                        {canRequestChanges ? (
                            <Command.Item
                                value="action request changes revise"
                                keywords={["request changes", "revise"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onRequestChanges)}
                                className={cn(OMNIBAR_ITEM_CLASS_NAME, "data-[selected=true]:text-status-modified")}
                            >
                                <TriangleAlert className="size-3.5 shrink-0 text-status-modified" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">Request changes</span>
                            </Command.Item>
                        ) : null}
                        {canMerge ? (
                            <Command.Item
                                value="action merge pull request"
                                keywords={["merge"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onOpenMerge)}
                                className={cn(OMNIBAR_ITEM_CLASS_NAME, "data-[selected=true]:text-status-merged")}
                            >
                                <GitMerge className="size-3.5 shrink-0 text-status-merged" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">Merge pull request</span>
                            </Command.Item>
                        ) : null}
                        {isDraft && canMarkDraft ? (
                            <Command.Item
                                value="action mark pull request ready"
                                keywords={["ready", "draft"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onMarkDraft)}
                                className={OMNIBAR_ITEM_CLASS_NAME}
                            >
                                <PenSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">Mark as ready</span>
                            </Command.Item>
                        ) : null}
                        {canDecline ? (
                            <Command.Item
                                value="action decline pull request"
                                keywords={["decline", "close"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onDecline)}
                                className={cn(OMNIBAR_ITEM_CLASS_NAME, "data-[selected=true]:text-status-removed")}
                            >
                                <XCircle className="size-3.5 shrink-0 text-status-removed" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">Decline pull request</span>
                            </Command.Item>
                        ) : null}
                    </Command.Group>
                ) : null}
            </Command.List>

            <div className="flex items-center justify-between border-t border-border-muted bg-chrome px-3 py-1.5 text-[10px] text-muted-foreground">
                <span>Navigate with arrows, select with Enter</span>
                <ReviewOmnibarShortcutHint shortcutLabel={shortcutLabel} />
            </div>
        </Command.Dialog>
    );
}
