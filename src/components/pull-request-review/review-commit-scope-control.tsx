import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReviewDiffScopeMode } from "@/lib/review-diff-scope";
import { cn } from "@/lib/utils";

type CommitOption = {
    hash: string;
    label: string;
    timestamp: string;
    message?: string;
};

export function ReviewCommitScopeControl({
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
    const scopeLabel = mode === "full" ? "All Changes" : `Range (${selectedCount})`;
    const selectedIndices = commitOptions
        .map((option, index) => (selectedSet.has(option.hash) ? index : -1))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);
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
                        className="h-7 min-w-[80px] justify-between border-0 bg-background px-2 text-[11px] focus-visible:ring-0"
                    >
                        <span className="truncate">{scopeLabel}</span>
                        <GitCompare className="ml-1 size-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[430px] p-0">
                    <DropdownMenuItem
                        className={cn(
                            "rounded-none px-2 py-2 border-t border-border/30 first:border-t-0 cursor-pointer",
                            mode === "full" ? "bg-status-renamed/20 focus:bg-status-renamed/25" : "",
                        )}
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
                                                "items-start gap-2 px-2 py-1 rounded-none border-t border-border/30 first:border-t-0 cursor-crosshair",
                                                selected ? "bg-status-renamed/20 focus:bg-status-renamed/25" : inRange ? "bg-muted/35 focus:bg-muted/45" : "",
                                            )}
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                onToggleCommitSelection(option.hash);
                                            }}
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-2 text-[11px]">
                                                    <span className={cn("font-mono", selected ? "text-foreground" : "text-foreground/90")}>{option.label}</span>
                                                    <span className="text-muted-foreground">{option.timestamp}</span>
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
