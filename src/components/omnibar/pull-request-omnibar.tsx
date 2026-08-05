import { Command } from "cmdk";
import { GitPullRequest, Search } from "lucide-react";
import { useState } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import type { RepoRef } from "@/lib/git-host/types";

export const OMNIBAR_ITEM_CLASS_NAME =
    "flex min-h-9 cursor-default select-none items-center gap-2 px-2 text-[12px] text-foreground outline-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45 data-[selected=true]:bg-selection";

export const OMNIBAR_GROUP_CLASS_NAME =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground";

export function getPullRequestOmnibarKeywords(row: SortedRootPullRequest) {
    const { pullRequest, repo, host } = row;
    return [
        String(pullRequest.id),
        `#${pullRequest.id}`,
        pullRequest.title,
        repo.fullName,
        repo.workspace,
        repo.repo,
        host,
        pullRequest.state,
        pullRequest.author?.displayName ?? "",
        pullRequest.source?.branch?.name ?? "",
        pullRequest.destination?.branch?.name ?? "",
    ].filter(Boolean);
}

export function PullRequestOmnibarGroup({
    pullRequests,
    onSelectPullRequest,
}: {
    pullRequests: readonly SortedRootPullRequest[];
    onSelectPullRequest: (repo: RepoRef, pullRequestId: string) => void;
}) {
    if (pullRequests.length === 0) return null;

    return (
        <Command.Group heading="Pull requests" className={OMNIBAR_GROUP_CLASS_NAME}>
            {pullRequests.map((row) => {
                const sourceBranch = row.pullRequest.source?.branch?.name ?? "source";
                const destinationBranch = row.pullRequest.destination?.branch?.name ?? "target";
                return (
                    <Command.Item
                        key={`${row.host}:${row.repo.fullName}:${row.pullRequest.id}`}
                        value={`pr:${row.host}:${row.repo.fullName}:${row.pullRequest.id}:${row.pullRequest.title}`}
                        keywords={getPullRequestOmnibarKeywords(row)}
                        onSelect={() => onSelectPullRequest(row.repo, String(row.pullRequest.id))}
                        className={OMNIBAR_ITEM_CLASS_NAME}
                    >
                        <GitPullRequest className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                            <span className="text-muted-foreground">#{row.pullRequest.id}</span> {row.pullRequest.title}
                        </span>
                        <span className="hidden max-w-[30%] shrink truncate font-mono text-[10px] text-muted-foreground sm:inline">
                            {sourceBranch} -&gt; {destinationBranch}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                            <GitHostIcon host={row.host} className="size-3" />
                            <span className="max-w-[8rem] truncate font-mono">{row.repo.fullName}</span>
                        </span>
                    </Command.Item>
                );
            })}
        </Command.Group>
    );
}

export function PullRequestOmnibar({
    open,
    onOpenChange,
    pullRequests,
    onSelectPullRequest,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pullRequests: readonly SortedRootPullRequest[];
    onSelectPullRequest: (repo: RepoRef, pullRequestId: string) => void;
}) {
    const [search, setSearch] = useState("");

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
                    placeholder="Search pull requests by id, title, or branch..."
                    aria-label="Search pull requests"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="border border-border-muted bg-surface-1 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</span>
            </div>

            <Command.List className="max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto p-1 [scroll-padding-block:0.25rem]">
                <Command.Empty className="px-2 py-8 text-center text-[12px] text-muted-foreground">
                    {pullRequests.length === 0 ? "No pull requests loaded. Select repositories first." : "No matching pull requests."}
                </Command.Empty>
                <PullRequestOmnibarGroup
                    pullRequests={pullRequests}
                    onSelectPullRequest={(repo, pullRequestId) => {
                        setSearch("");
                        onOpenChange(false);
                        onSelectPullRequest(repo, pullRequestId);
                    }}
                />
            </Command.List>

            <div className="flex items-center justify-between border-t border-border-muted bg-chrome px-3 py-1.5 text-[10px] text-muted-foreground">
                <span>Navigate with arrows, select with Enter</span>
                <span className="hidden sm:inline">cmd + k</span>
            </div>
        </Command.Dialog>
    );
}
