import { GitCompare } from "lucide-react";
import { useMemo } from "react";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReviewDiffScopeMode, ReviewDiffScopeSearch, resolveReviewDiffScope } from "@/lib/review-diff-scope";
import { cn } from "@/lib/utils";

type CommitOption = {
    hash: string;
    label: string;
    timestamp?: string;
    message?: string;
};

function ReviewCommitScopeControl({
    mode,
    commitOptions,
    selectedCommitHashes,
    isFetching,
    notice,
    onSetFullScope,
    onToggleCommitSelection,
}: {
    mode: ReviewDiffScopeMode;
    commitOptions: CommitOption[];
    selectedCommitHashes: string[];
    isFetching: boolean;
    notice?: string | null;
    onSetFullScope: () => void;
    onToggleCommitSelection: (hash: string) => void;
}) {
    const selectedSet = new Set(selectedCommitHashes);
    const selectedCount = selectedSet.size;
    const scopeLabel = mode === "full" ? "All Changes" : `${selectedCount} Commits`;
    const selectedIndices = commitOptions.flatMap((option, index) => (selectedSet.has(option.hash) ? [index] : [])).sort((a, b) => a - b);
    const rangeStart = selectedIndices[0] ?? -1;
    const rangeEnd = selectedIndices[selectedIndices.length - 1] ?? -1;

    return (
        <div className="flex min-w-0 items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 min-w-[88px] justify-between rounded-full bg-surface-hover px-3 text-[12px] text-foreground hover:bg-surface-active"
                    >
                        <span className="truncate">{scopeLabel}</span>
                        <GitCompare className="ml-1 size-3" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[430px] p-0">
                    <DropdownMenuItem
                        className={cn("px-2.5 py-2 cursor-pointer", mode === "full" ? "bg-status-renamed/20 focus:bg-status-renamed/25" : "")}
                        onSelect={(event) => {
                            event.preventDefault();
                            onSetFullScope();
                        }}
                    >
                        <div className="min-w-0 w-full text-[11px]">All Changes</div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-0" />
                    {commitOptions.length > 0 ? (
                        <div className="max-h-[60vh] min-h-0 overflow-y-auto">
                            <div className="space-y-0">
                                {commitOptions.map((option, index) => {
                                    const selected = selectedSet.has(option.hash);
                                    const inRange = rangeStart >= 0 && rangeEnd >= 0 && index >= rangeStart && index <= rangeEnd;
                                    return (
                                        <DropdownMenuItem
                                            key={option.hash}
                                            className={cn(
                                                "items-start gap-2 px-2.5 py-1.5 cursor-crosshair",
                                                selected
                                                    ? "bg-status-renamed/20 focus:bg-status-renamed/25"
                                                    : inRange
                                                      ? "bg-surface-1 focus:bg-surface-hover"
                                                      : "",
                                            )}
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                onToggleCommitSelection(option.hash);
                                            }}
                                        >
                                            <div className="min-w-0 w-full space-y-0.5">
                                                <div className="flex min-w-0 items-center gap-2 text-[11px]">
                                                    <span className={cn("min-w-0 truncate font-mono", selected ? "text-foreground" : "text-foreground/90")}>
                                                        {option.label}
                                                    </span>
                                                    <Timestamp value={option.timestamp} className="ml-auto shrink-0 text-right" />
                                                </div>
                                                <div className="truncate text-[11px] text-muted-foreground">{option.message || "(no message)"}</div>
                                            </div>
                                        </DropdownMenuItem>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No commits available.</div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {isFetching ? <span className="text-[10px] text-muted-foreground">loading...</span> : null}
            {notice ? <span className="max-w-[220px] truncate text-[10px] text-muted-foreground">{notice}</span> : null}
        </div>
    );
}

export function ReviewCommitScope({
    resolvedScope,
    commitScopeLoading,
    scopeNotice,
    setScopeNotice,
    onSearchChange,
}: {
    resolvedScope: ReturnType<typeof resolveReviewDiffScope>;
    commitScopeLoading: boolean;
    scopeNotice: string | null;
    setScopeNotice: (notice: string | null) => void;
    onSearchChange?: (next: ReviewDiffScopeSearch) => void;
}) {
    const { visibleCommits } = resolvedScope;
    const commitOptions = useMemo(
        () =>
            visibleCommits.toReversed().map((commit) => ({
                hash: commit.hash,
                label: commit.hash.slice(0, 8),
                timestamp: commit.date,
                message: commit.summary?.raw?.trim() || commit.message?.trim() || "(no message)",
            })),
        [visibleCommits],
    );
    const selectedHashes = resolvedScope.mode === "range" ? resolvedScope.selectedCommitHashes : [];

    const toggleCommit = (hash: string) => {
        const nextSelected = new Set(selectedHashes);
        if (!nextSelected.delete(hash)) nextSelected.add(hash);
        const indexes = visibleCommits.flatMap((commit, index) => (nextSelected.has(commit.hash) ? [index] : []));
        const from = visibleCommits[indexes[0]]?.hash;
        const to = visibleCommits[indexes[indexes.length - 1]]?.hash;
        if (!from || !to) {
            setScopeNotice(nextSelected.size > 0 ? "Selected commits are unavailable. Switched to full diff." : null);
            onSearchChange?.({});
            return;
        }
        const isContiguous = indexes[indexes.length - 1] - indexes[0] + 1 === indexes.length;
        setScopeNotice(isContiguous ? null : "Expanded to a contiguous commit range.");
        onSearchChange?.(from === to ? { from } : { from, to });
    };

    return (
        <ReviewCommitScopeControl
            mode={resolvedScope.mode}
            commitOptions={commitOptions}
            selectedCommitHashes={selectedHashes}
            isFetching={commitScopeLoading}
            notice={scopeNotice}
            onSetFullScope={() => {
                setScopeNotice(null);
                onSearchChange?.({});
            }}
            onToggleCommitSelection={toggleCommit}
        />
    );
}
