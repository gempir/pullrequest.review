import { Command } from "cmdk";
import { Check, ChevronRight, FileCode2, GitMerge, PanelTop, PenSquare, Search, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { cn } from "@/lib/utils";

type ReviewOmnibarProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filePaths: readonly string[];
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    isDraft: boolean;
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    actionBusy: boolean;
    onSelectFile: (path: string) => void;
    onApprove: () => void;
    onRequestChanges: () => void;
    onOpenMerge: () => void;
    onDecline: () => void;
    onMarkDraft: () => void;
};

const COMMAND_ITEM_CLASS_NAME =
    "flex min-h-9 cursor-default select-none items-center gap-2 px-2 text-[12px] text-foreground outline-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45 data-[selected=true]:bg-selection";

export function getOmnibarFileName(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? path : path.slice(separatorIndex + 1);
}

function getOmnibarDirectory(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
}

export function ReviewOmnibar({
    open,
    onOpenChange,
    filePaths,
    currentUserReviewStatus,
    isDraft,
    canApprove,
    canRequestChanges,
    canMerge,
    canDecline,
    canMarkDraft,
    actionBusy,
    onSelectFile,
    onApprove,
    onRequestChanges,
    onOpenMerge,
    onDecline,
    onMarkDraft,
}: ReviewOmnibarProps) {
    const [search, setSearch] = useState("");
    const hasActions = canApprove || canRequestChanges || canMerge || canDecline || (isDraft && canMarkDraft);

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
                    placeholder="Search files and actions..."
                    aria-label="Search pull request files and actions"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="border border-border-muted bg-surface-1 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</span>
            </div>

            <Command.List className="max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto p-1 [scroll-padding-block:0.25rem]">
                <Command.Empty className="px-2 py-8 text-center text-[12px] text-muted-foreground">No matching files or actions.</Command.Empty>

                <Command.Group
                    heading="Navigate"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                    <Command.Item
                        value="navigation summary pull request overview"
                        keywords={["summary", "overview", "pull request"]}
                        onSelect={() => closeAndRun(() => onSelectFile(PR_SUMMARY_PATH))}
                        className={COMMAND_ITEM_CLASS_NAME}
                    >
                        <PanelTop className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">Summary</span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Command.Item>
                </Command.Group>

                <Command.Separator className="my-1 h-px bg-border-muted" />

                <Command.Group
                    heading="Files"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                    {filePaths.map((path) => {
                        const fileName = getOmnibarFileName(path);
                        const directory = getOmnibarDirectory(path);
                        return (
                            <Command.Item
                                key={path}
                                value={`file:${path}`}
                                keywords={[path, fileName, ...directory.split("/").filter(Boolean)]}
                                onSelect={() => closeAndRun(() => onSelectFile(path))}
                                className={COMMAND_ITEM_CLASS_NAME}
                            >
                                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{fileName}</span>
                                {directory ? <span className="max-w-[45%] shrink truncate text-[11px] text-muted-foreground">{directory}</span> : null}
                            </Command.Item>
                        );
                    })}
                </Command.Group>

                {hasActions ? <Command.Separator className="my-1 h-px bg-border-muted" /> : null}
                {hasActions ? (
                    <Command.Group
                        heading="Actions"
                        className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                    >
                        {canApprove ? (
                            <Command.Item
                                value={currentUserReviewStatus === "approved" ? "action remove approval" : "action approve pull request"}
                                keywords={["approve", "review"]}
                                disabled={actionBusy}
                                onSelect={() => closeAndRun(onApprove)}
                                className={cn(COMMAND_ITEM_CLASS_NAME, "data-[selected=true]:text-status-added")}
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
                                className={cn(COMMAND_ITEM_CLASS_NAME, "data-[selected=true]:text-status-modified")}
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
                                className={cn(COMMAND_ITEM_CLASS_NAME, "data-[selected=true]:text-status-merged")}
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
                                className={COMMAND_ITEM_CLASS_NAME}
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
                                className={cn(COMMAND_ITEM_CLASS_NAME, "data-[selected=true]:text-status-removed")}
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
                <span className="hidden sm:inline">cmd + k</span>
            </div>
        </Command.Dialog>
    );
}
