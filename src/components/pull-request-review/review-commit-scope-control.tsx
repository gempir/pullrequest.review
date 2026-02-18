import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReviewDiffScopeMode } from "@/lib/review-diff-scope";
import { cn } from "@/lib/utils";

type CommitOption = {
    hash: string;
    label: string;
    message?: string;
};

function shortHash(hash?: string) {
    if (!hash) return "";
    return hash.slice(0, 8);
}

export function ReviewCommitScopeControl({
    mode,
    includeMerge,
    commitOptions,
    fromCommitHash,
    toCommitHash,
    baselineCommitHash,
    hasBaseline,
    isFetching,
    notice,
    onModeChange,
    onFromCommitChange,
    onToCommitChange,
    onIncludeMergeChange,
}: {
    mode: ReviewDiffScopeMode;
    includeMerge: boolean;
    commitOptions: CommitOption[];
    fromCommitHash?: string;
    toCommitHash?: string;
    baselineCommitHash?: string | null;
    hasBaseline: boolean;
    isFetching: boolean;
    notice?: string | null;
    onModeChange: (mode: ReviewDiffScopeMode) => void;
    onFromCommitChange: (hash: string) => void;
    onToCommitChange: (hash: string) => void;
    onIncludeMergeChange: (value: boolean) => void;
}) {
    const firstHash = commitOptions[0]?.hash;
    const lastHash = commitOptions[commitOptions.length - 1]?.hash;
    const effectiveFrom = fromCommitHash ?? firstHash ?? "";
    const effectiveTo = toCommitHash ?? lastHash ?? "";
    const baselineText = baselineCommitHash ? shortHash(baselineCommitHash) : "none";

    return (
        <div className="flex min-w-0 items-center gap-1">
            <Select value={mode} onValueChange={(value) => onModeChange(value as ReviewDiffScopeMode)}>
                <SelectTrigger size="sm" className="h-7 min-w-[102px] border-border bg-background px-2 text-[11px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                    <SelectItem value="full">Full PR</SelectItem>
                    <SelectItem value="range">Commit Range</SelectItem>
                    <SelectItem value="since" disabled={!hasBaseline}>
                        Since Baseline
                    </SelectItem>
                </SelectContent>
            </Select>

            {mode === "range" ? (
                <>
                    <Select value={effectiveFrom} onValueChange={onFromCommitChange}>
                        <SelectTrigger size="sm" className="h-7 min-w-[88px] border-border bg-background px-2 text-[11px] font-mono">
                            <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent align="start">
                            {commitOptions.map((option) => (
                                <SelectItem key={`from-${option.hash}`} value={option.hash}>
                                    <span className="font-mono">{option.label}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={effectiveTo} onValueChange={onToCommitChange}>
                        <SelectTrigger size="sm" className="h-7 min-w-[88px] border-border bg-background px-2 text-[11px] font-mono">
                            <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent align="start">
                            {commitOptions.map((option) => (
                                <SelectItem key={`to-${option.hash}`} value={option.hash}>
                                    <span className="font-mono">{option.label}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </>
            ) : null}

            {mode === "since" ? <span className="truncate text-[10px] text-muted-foreground">baseline {baselineText}</span> : null}
            {!hasBaseline && mode !== "since" ? <span className="truncate text-[10px] text-muted-foreground">set a baseline in Commits</span> : null}

            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-[10px]", includeMerge ? "text-foreground" : "text-muted-foreground")}
                onClick={() => onIncludeMergeChange(!includeMerge)}
                aria-label={includeMerge ? "Hide merge commits" : "Include merge commits"}
                title={includeMerge ? "Hide merge commits" : "Include merge commits"}
            >
                <Filter className="mr-1 size-3" />
                merge
            </Button>

            {isFetching ? <span className="text-[10px] text-muted-foreground">loading...</span> : null}
            {notice ? <span className="max-w-[220px] truncate text-[10px] text-muted-foreground">{notice}</span> : null}
        </div>
    );
}
