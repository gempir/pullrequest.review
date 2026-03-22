import { GitMerge, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ReviewMergeDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
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
};

export function ReviewMergeDialog({
    open,
    onOpenChange,
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
}: ReviewMergeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[34rem] overflow-hidden rounded-xl border-border-muted bg-background p-0 shadow-2xl [&>button]:right-3 [&>button]:top-5 [&>button]:-translate-y-1/2 [&>button]:rounded-md [&>button]:p-1 [&>button]:text-muted-foreground [&>button]:opacity-100 [&>button]:transition-colors [&>button]:hover:bg-surface-1 [&>button]:hover:text-foreground [&>button]:focus-visible:ring-1 [&>button]:focus-visible:ring-ring">
                <div className="flex h-10 items-center border-b border-border-muted bg-chrome px-3 pr-12">
                    <DialogTitle className="text-[13px] font-medium text-foreground">Merge pull request</DialogTitle>
                </div>

                <div className="space-y-4 bg-surface-1/20 px-3 py-2.5 text-[12px]">
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="merge-strategy" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Merge strategy
                            </Label>
                            {mergeStrategies?.length ? (
                                <Select value={mergeStrategy} onValueChange={onMergeStrategyChange}>
                                    <SelectTrigger
                                        id="merge-strategy"
                                        className="h-9 w-full rounded-md border-border-muted bg-background text-[12px] shadow-none"
                                        size="default"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-md border-border-muted bg-background">
                                        {mergeStrategies.map((strategy) => (
                                            <SelectItem key={strategy} value={strategy} className="text-[12px]">
                                                {strategy}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="merge-strategy"
                                    className="h-9 rounded-md border-border-muted bg-background text-[12px]"
                                    value={mergeStrategy}
                                    onChange={(e) => onMergeStrategyChange(e.target.value)}
                                    placeholder="merge_commit"
                                />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="merge-message" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Merge message
                            </Label>
                            <Input
                                id="merge-message"
                                className="h-9 rounded-md border-border-muted bg-background text-[12px]"
                                value={mergeMessage}
                                onChange={(e) => onMergeMessageChange(e.target.value)}
                                placeholder="Optional merge message"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-muted pt-4">
                        <label htmlFor="close-branch" className="inline-flex cursor-pointer select-none items-center gap-2 text-[12px] text-foreground">
                            <input
                                id="close-branch"
                                type="checkbox"
                                checked={closeSourceBranch}
                                onChange={(e) => onCloseSourceBranchChange(e.target.checked)}
                                className="size-4 shrink-0 rounded-[3px] border border-border-muted bg-muted accent-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            <span>Close source branch</span>
                        </label>

                        <div className="ml-auto flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 rounded-md text-[11px]" onClick={() => onOpenChange(false)}>
                                <X className="size-3.5" />
                                Cancel
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-md border-status-renamed/35 text-[11px] text-status-renamed hover:bg-status-renamed/12 hover:text-status-renamed"
                                disabled={isMerging || !canMerge}
                                onClick={onMerge}
                            >
                                {isMerging ? <Loader2 className="size-3.5 animate-spin" /> : <GitMerge className="size-3.5" />}
                                {isMerging ? "Merging..." : "Merge"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
