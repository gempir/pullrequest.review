import { GitMerge, Loader2 } from "lucide-react";
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
            <DialogContent className="max-w-[34rem] overflow-hidden p-0 [&>button]:top-2">
                <div className="flex h-11 items-center border-b border-border-muted px-4 pr-12">
                    <DialogTitle className="text-[13px] font-semibold tracking-normal text-foreground">Merge pull request</DialogTitle>
                </div>

                <div className="space-y-4 px-4 py-4 text-[13px]">
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="merge-strategy" className="text-[12px] font-medium text-muted-foreground">
                                Merge strategy
                            </Label>
                            {mergeStrategies?.length ? (
                                <Select value={mergeStrategy} onValueChange={onMergeStrategyChange}>
                                    <SelectTrigger id="merge-strategy" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mergeStrategies.map((strategy) => (
                                            <SelectItem key={strategy} value={strategy}>
                                                {strategy}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="merge-strategy"
                                    value={mergeStrategy}
                                    onChange={(e) => onMergeStrategyChange(e.target.value)}
                                    placeholder="merge_commit"
                                />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="merge-message" className="text-[12px] font-medium text-muted-foreground">
                                Merge message
                            </Label>
                            <Input
                                id="merge-message"
                                value={mergeMessage}
                                onChange={(e) => onMergeMessageChange(e.target.value)}
                                placeholder="Optional merge message"
                            />
                        </div>
                    </div>

                    <div className="-mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-muted bg-chrome px-4 py-3">
                        <label htmlFor="close-branch" className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-foreground">
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
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" disabled={isMerging || !canMerge} onClick={onMerge}>
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
