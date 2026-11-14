import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type TreeDensityValue, useFileTree } from "@/lib/file-tree-context";

const TREE_DENSITY_OPTIONS: Array<{ value: TreeDensityValue; label: string }> = [
    { value: "compact", label: "Compact" },
    { value: "default", label: "Default" },
    { value: "relaxed", label: "Relaxed" },
];

export function TreeTab() {
    const fileTree = useFileTree();

    return (
        <div className="max-w-3xl space-y-3">
            <div className="max-w-56 space-y-1">
                <Label className="text-[12px] font-medium text-muted-foreground">Density</Label>
                <Select value={fileTree.treeDensity} onValueChange={(value) => fileTree.setTreeDensity(value as TreeDensityValue)}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TREE_DENSITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
