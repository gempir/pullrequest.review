import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppearance } from "@/lib/appearance-context";
import { useFileTree } from "@/lib/file-tree-context";
import { FONT_FAMILY_OPTIONS, type FontFamilyValue } from "@/lib/font-options";

export function TreeTab() {
    const appearance = useAppearance();
    const fileTree = useFileTree();

    return (
        <div className="max-w-3xl space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <Label htmlFor="tree-compact-single-child" className="text-[12px] text-foreground">
                        Compact single-child folder chains
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Example: services/foo/bar/file.php as services/foo/bar.</p>
                </div>
                <Switch
                    id="tree-compact-single-child"
                    checked={fileTree.compactSingleChildDirectories}
                    onCheckedChange={fileTree.setCompactSingleChildDirectories}
                    size="sm"
                />
            </div>
            <div className="max-w-56 space-y-1">
                <Label className="text-[12px] text-muted-foreground">Indentation Size</Label>
                <NumberStepperInput value={fileTree.treeIndentSize} min={8} max={24} step={1} onValueChange={fileTree.setTreeIndentSize} />
            </div>
            <div className="flex items-start justify-between gap-3">
                <Label htmlFor="tree-custom-typography" className="text-[12px] text-foreground">
                    Override tree typography
                </Label>
                <Switch
                    id="tree-custom-typography"
                    checked={appearance.treeUseCustomTypography}
                    onCheckedChange={appearance.setTreeUseCustomTypography}
                    size="sm"
                />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <Label className="text-[12px] text-muted-foreground">Font Family</Label>
                    <Select
                        value={appearance.treeFontFamily}
                        onValueChange={(value) => appearance.setTreeFontFamily(value as FontFamilyValue)}
                        disabled={!appearance.treeUseCustomTypography}
                    >
                        <SelectTrigger className="h-9 w-full text-[12px]" size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {FONT_FAMILY_OPTIONS.map((font) => (
                                <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                    {font.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[12px] text-muted-foreground">Font Size</Label>
                    <NumberStepperInput
                        value={appearance.treeFontSize}
                        min={10}
                        max={18}
                        step={1}
                        onValueChange={appearance.setTreeFontSize}
                        disabled={!appearance.treeUseCustomTypography}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[12px] text-muted-foreground">Line Height</Label>
                    <NumberStepperInput
                        value={appearance.treeLineHeight}
                        min={1}
                        max={2.2}
                        step={0.05}
                        onValueChange={appearance.setTreeLineHeight}
                        disabled={!appearance.treeUseCustomTypography}
                    />
                </div>
            </div>
        </div>
    );
}
