import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, GitCompare } from "lucide-react";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReviewDiffScopeMode } from "@/lib/review-diff-scope";
import { cn } from "@/lib/utils";

type CommitOption = {
    hash: string;
    label: string;
    timestamp?: string;
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
    const scopeLabel = mode === "full" ? "All Changes" : `${selectedCount} Commits`;
    const selectedIndices = commitOptions.flatMap((option, index) => (selectedSet.has(option.hash) ? [index] : [])).sort((a, b) => a - b);
    const rangeStart = selectedIndices[0] ?? -1;
    const rangeEnd = selectedIndices[selectedIndices.length - 1] ?? -1;
    const statusMessage = [isFetching ? "Loading commits." : null, notice].filter(Boolean).join(" ");

    return (
        <div className="flex min-w-0 items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 min-w-[88px] justify-between rounded-sm border border-transparent bg-[var(--diffs-bg,var(--background))] px-2 text-[11px] text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
                    >
                        <span className="truncate">{scopeLabel}</span>
                        <GitCompare className="ml-1 size-3" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[430px] p-0">
                    <DropdownMenuPrimitive.RadioGroup
                        value={mode}
                        aria-label="Diff scope"
                        onValueChange={(value) => {
                            if (value === "full") onSetFullScope();
                        }}
                    >
                        <DropdownMenuPrimitive.RadioItem
                            value="full"
                            className={cn(
                                "relative flex cursor-pointer select-none items-center gap-2 rounded-none border-t border-border/30 px-2 py-2 text-foreground outline-hidden transition-colors first:border-t-0 focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                mode === "full" ? "bg-status-renamed/20 focus:bg-status-renamed/25" : "",
                            )}
                            onSelect={(event) => event.preventDefault()}
                        >
                            <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                                <DropdownMenuPrimitive.ItemIndicator>
                                    <span className="size-1.5 rounded-full bg-current" />
                                </DropdownMenuPrimitive.ItemIndicator>
                            </span>
                            <div className="min-w-0 w-full text-[11px]">All Changes</div>
                        </DropdownMenuPrimitive.RadioItem>
                    </DropdownMenuPrimitive.RadioGroup>
                    <DropdownMenuSeparator className="my-0" />
                    {commitOptions.length > 0 ? (
                        <div className="max-h-[60vh] min-h-0 overflow-y-auto">
                            <div className="space-y-0">
                                {commitOptions.map((option, index) => {
                                    const selected = selectedSet.has(option.hash);
                                    const inRange = rangeStart >= 0 && rangeEnd >= 0 && index >= rangeStart && index <= rangeEnd;
                                    return (
                                        <DropdownMenuPrimitive.CheckboxItem
                                            key={option.hash}
                                            checked={selected}
                                            className={cn(
                                                "relative flex cursor-crosshair select-none items-start gap-2 rounded-none border-t border-border/30 px-2 py-1 text-foreground outline-hidden transition-colors first:border-t-0 focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                                selected
                                                    ? "bg-status-renamed/20 focus:bg-status-renamed/25"
                                                    : inRange
                                                      ? "bg-surface-1 focus:bg-surface-hover"
                                                      : "",
                                            )}
                                            onCheckedChange={() => onToggleCommitSelection(option.hash)}
                                            onSelect={(event) => event.preventDefault()}
                                        >
                                            <span className="flex size-4 shrink-0 items-center justify-center pt-0.5" aria-hidden="true">
                                                <DropdownMenuPrimitive.ItemIndicator>
                                                    <Check className="size-3" />
                                                </DropdownMenuPrimitive.ItemIndicator>
                                            </span>
                                            <div className="min-w-0 w-full space-y-0.5">
                                                <div className="flex min-w-0 items-center gap-2 text-[11px]">
                                                    <span className={cn("min-w-0 truncate font-mono", selected ? "text-foreground" : "text-foreground/90")}>
                                                        {option.label}
                                                    </span>
                                                    <Timestamp value={option.timestamp} className="ml-auto shrink-0 text-right" />
                                                </div>
                                                <div className="truncate text-[11px] text-muted-foreground">{option.message || "(no message)"}</div>
                                            </div>
                                        </DropdownMenuPrimitive.CheckboxItem>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No commits available.</div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {statusMessage}
            </span>
            {isFetching ? (
                <span className="text-[10px] text-muted-foreground" aria-hidden="true">
                    Loading commits...
                </span>
            ) : null}
            {notice ? (
                <span className="max-w-[220px] truncate text-[10px] text-muted-foreground" aria-hidden="true">
                    {notice}
                </span>
            ) : null}
        </div>
    );
}
