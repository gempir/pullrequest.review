import { Command } from "cmdk";
import { GitPullRequest, Search } from "lucide-react";
import { useState } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { getPullRequestOmnibarKeywords, OMNIBAR_GROUP_CLASS_NAME, OMNIBAR_ITEM_CLASS_NAME } from "@/components/omnibar/omnibar-helpers";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import type { RepoRef } from "@/lib/git-host/types";

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
                        <span className="hidden max-w-[30%] shrink truncate text-[11px] text-muted-foreground sm:inline">
                            {sourceBranch} -&gt; {destinationBranch}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                            <GitHostIcon host={row.host} className="size-3" />
                            <span className="max-w-[8rem] truncate">{row.repo.fullName}</span>
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
            overlayClassName="fixed inset-0 z-50 bg-overlay animate-in fade-in-0 duration-150"
            contentClassName="glass-strong animate-in fade-in-0 zoom-in-[0.98] duration-150 fixed left-1/2 top-[16vh] z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-popover"
        >
            <div className="flex h-13 items-center gap-2.5 border-b border-border-muted px-4">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Command.Input
                    autoFocus
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search pull requests by id, title, or branch..."
                    aria-label="Search pull requests"
                    className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-faint-foreground"
                />
                <kbd className="rounded-md bg-surface-hover px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">esc</kbd>
            </div>

            <Command.List className="max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto p-1.5 [scroll-padding-block:0.375rem]">
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

            <div className="flex items-center justify-between border-t border-border-muted px-4 py-2 text-[11px] text-faint-foreground">
                <span>Navigate with arrows, select with Enter</span>
            </div>
        </Command.Dialog>
    );
}
