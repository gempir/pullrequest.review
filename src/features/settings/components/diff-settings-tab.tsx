import { type FileDiffOptions, parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { FileCode2, Files } from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { DiffToolbar } from "@/components/diff-toolbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkspaceMode } from "@/features/settings/components/settings-workspace-mode";
import { useAppearance } from "@/lib/appearance-context";
import { useDiffOptions } from "@/lib/diff-options-context";
import { DIFF_THEMES, type DiffTheme } from "@/lib/diff-themes";
import { fontFamilyToCss } from "@/lib/font-options";

const DIFF_PREVIEW_PATCH = `diff --git a/src/feature.ts b/src/feature.ts
index 1111111..2222222 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1,5 +1,8 @@
-const title = "settings-modal";
+const title = "settings-inline";
+const summary = "This preview includes a deliberately long line to verify wrapping behavior when overflow is set to wrap instead of scroll in the diff settings panel.";
+const notes = "Another verbose line for spacing checks: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.";
 export function run() {
-  return title;
+  return [title, summary, notes].join(" ");
}
`;

export function DiffSettingsTab({
    workspaceMode,
    onWorkspaceModeChange,
}: {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
}) {
    const { options, setOption } = useDiffOptions();
    const { monospaceFontFamily, monospaceFontSize, monospaceLineHeight } = useAppearance();
    const previewFileDiff = useMemo(() => parsePatchFiles(DIFF_PREVIEW_PATCH)[0]?.files[0], []);
    const previewStyle = useMemo(() => {
        const fontFamily = fontFamilyToCss(options.diffUseCustomTypography ? options.diffFontFamily : monospaceFontFamily);
        const fontSize = `${options.diffUseCustomTypography ? options.diffFontSize : monospaceFontSize}px`;
        const lineHeight = String(options.diffUseCustomTypography ? options.diffLineHeight : monospaceLineHeight);
        return {
            "--diff-font-family": fontFamily,
            "--diff-font-size": fontSize,
            "--diff-line-height": lineHeight,
            "--diffs-font-family": fontFamily,
            "--diffs-font-size": fontSize,
            "--diffs-line-height": lineHeight,
        } as CSSProperties;
    }, [
        monospaceFontFamily,
        monospaceFontSize,
        monospaceLineHeight,
        options.diffFontFamily,
        options.diffFontSize,
        options.diffLineHeight,
        options.diffUseCustomTypography,
    ]);
    const previewDiffOptions = useMemo<FileDiffOptions<undefined>>(
        () => ({
            theme: options.theme,
            diffStyle: options.diffStyle,
            diffIndicators: options.diffIndicators,
            disableBackground: options.disableBackground,
            hunkSeparators: options.hunkSeparators,
            expandUnchanged: options.expandUnchanged,
            expansionLineCount: options.expansionLineCount,
            lineDiffType: options.lineDiffType,
            disableLineNumbers: options.disableLineNumbers,
            overflow: options.overflow,
            disableFileHeader: true,
        }),
        [options],
    );

    return (
        <div className="space-y-2.5">
            <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">Diff Theme</Label>
                <Select
                    value={options.followSystemTheme ? "__system__" : options.theme}
                    onValueChange={(value) => {
                        if (value === "__system__") {
                            setOption("followSystemTheme", true);
                            return;
                        }
                        setOption("followSystemTheme", false);
                        setOption("theme", value as DiffTheme);
                    }}
                >
                    <SelectTrigger className="h-9 w-full text-[12px]" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                        <SelectItem value="__system__" className="text-[12px]">
                            Auto (github dark/light default)
                        </SelectItem>
                        {DIFF_THEMES.map((theme) => (
                            <SelectItem key={theme} value={theme} className="text-[12px]">
                                {theme}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {workspaceMode && onWorkspaceModeChange ? (
                <div className="flex items-center gap-2">
                    <Button
                        variant={workspaceMode === "single" ? "default" : "outline"}
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => onWorkspaceModeChange("single")}
                    >
                        <FileCode2 className="size-3.5" />
                        Single file
                    </Button>
                    <Button
                        variant={workspaceMode === "all" ? "default" : "outline"}
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => onWorkspaceModeChange("all")}
                    >
                        <Files className="size-3.5" />
                        All files
                    </Button>
                </div>
            ) : null}
            <DiffToolbar />
            <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Preview</div>
                {previewFileDiff ? (
                    <FileDiff
                        fileDiff={previewFileDiff as FileDiffMetadata}
                        options={previewDiffOptions}
                        className="compact-diff pr-diff-font"
                        style={previewStyle}
                    />
                ) : (
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Preview unavailable.</div>
                )}
            </div>
        </div>
    );
}
