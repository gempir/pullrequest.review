import { GitMerge, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
            <DialogContent className="max-w-lg p-0">
                <div className="h-10 border-b border-border bg-card px-2.5 pr-12 flex items-center">
                    <DialogTitle className="text-[12px] font-medium leading-none">Merge pull request</DialogTitle>
                </div>

                <div className="space-y-3 px-2.5 py-3 text-[12px]">
                    <div className="space-y-1.5">
                        <Label htmlFor="merge-strategy" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Merge strategy
                        </Label>
                        {mergeStrategies?.length ? (
                            <Select value={mergeStrategy} onValueChange={onMergeStrategyChange}>
                                <SelectTrigger id="merge-strategy" className="h-8 w-full text-[12px] font-mono" size="sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {mergeStrategies.map((strategy) => (
                                        <SelectItem key={strategy} value={strategy} className="text-[12px] font-mono">
                                            {strategy}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id="merge-strategy"
                                className="h-8 text-[12px] font-mono"
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
                            className="h-8 text-[12px]"
                            value={mergeMessage}
                            onChange={(e) => onMergeMessageChange(e.target.value)}
                            placeholder="Optional merge message"
                        />
                    </div>

                    <div className="flex items-center gap-2 border border-border px-2 py-1.5">
                        <Switch checked={closeSourceBranch} onCheckedChange={onCloseSourceBranchChange} id="close-branch" size="sm" />
                        <Label htmlFor="close-branch" className="text-[12px]">
                            Close source branch
                        </Label>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            <X className="size-4" />
                            Cancel
                        </Button>
                        <Button size="sm" disabled={isMerging || !canMerge} onClick={onMerge}>
                            {isMerging ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />} Merge
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
