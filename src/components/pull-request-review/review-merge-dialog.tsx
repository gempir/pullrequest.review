import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Merge pull request</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="merge-strategy">Merge strategy</Label>
                        {mergeStrategies?.length ? (
                            <select
                                id="merge-strategy"
                                value={mergeStrategy}
                                onChange={(e) => onMergeStrategyChange(e.target.value)}
                                className="h-9 w-full border border-input bg-background px-3 text-[13px]"
                            >
                                {mergeStrategies.map((strategy) => (
                                    <option key={strategy} value={strategy}>
                                        {strategy}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <Input
                                id="merge-strategy"
                                className="border-0 focus-visible:border-0 focus-visible:ring-0"
                                value={mergeStrategy}
                                onChange={(e) => onMergeStrategyChange(e.target.value)}
                                placeholder="merge_commit"
                            />
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="merge-message">Merge message</Label>
                        <Input
                            id="merge-message"
                            className="border-0 focus-visible:border-0 focus-visible:ring-0"
                            value={mergeMessage}
                            onChange={(e) => onMergeMessageChange(e.target.value)}
                            placeholder="Optional merge message"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch checked={closeSourceBranch} onCheckedChange={onCloseSourceBranchChange} id="close-branch" />
                        <Label htmlFor="close-branch">Close source branch</Label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button disabled={isMerging || !canMerge} onClick={onMerge}>
                            {isMerging ? <Loader2 className="size-4 animate-spin" /> : null} Merge
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
