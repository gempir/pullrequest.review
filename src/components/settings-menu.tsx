import { type FileDiffOptions, parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { RotateCcw, Settings2 } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { DiffToolbar } from "@/components/diff-toolbar";
import { getSettingsTabIcon, getSettingsTreeItems, type SettingsTab } from "@/components/settings-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppearance } from "@/lib/appearance-context";
import { useDiffOptions } from "@/lib/diff-options-context";
import { DIFF_THEMES, type DiffTheme } from "@/lib/diff-themes";
import { useFileTree } from "@/lib/file-tree-context";
import { FONT_FAMILY_OPTIONS, type FontFamilyValue, fontFamilyToCss, MONO_FONT_FAMILY_OPTIONS, SANS_FONT_FAMILY_OPTIONS } from "@/lib/font-options";
import { type ShortcutConfig, useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

export type { SettingsTab } from "@/components/settings-navigation";
export {
    getSettingsTreeItems,
    settingsPathForTab,
    settingsTabFromPath,
} from "@/components/settings-navigation";

type WorkspaceMode = "single" | "all";

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

function ShortcutRow({ label, shortcut, onChange }: { label: string; shortcut: ShortcutConfig; onChange: (config: Partial<ShortcutConfig>) => void }) {
    const [isRecording, setIsRecording] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isRecording) return;
        e.preventDefault();

        if (e.key === "Escape") {
            setIsRecording(false);
            return;
        }

        // Don't allow modifier-only keys
        if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

        onChange({
            key: e.key.toLowerCase(),
            modifiers: {
                ctrl: e.ctrlKey && e.key !== "Control",
                alt: e.altKey && e.key !== "Alt",
                shift: e.shiftKey && e.key !== "Shift",
                meta: e.metaKey && e.key !== "Meta",
            },
        });
        setIsRecording(false);
    };

    const displayShortcut = () => {
        const parts: string[] = [];
        if (shortcut.modifiers.ctrl) parts.push("Ctrl");
        if (shortcut.modifiers.alt) parts.push("Alt");
        if (shortcut.modifiers.shift) parts.push("Shift");
        if (shortcut.modifiers.meta) parts.push("Cmd");
        parts.push(shortcut.key.toUpperCase());
        return parts.join("+");
    };

    return (
        <div className="flex items-center justify-between px-2 py-2.5 gap-3">
            <div className="flex flex-col">
                <span className="text-[13px]">{label}</span>
                <span className="text-[11px] text-muted-foreground">{shortcut.description}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsRecording(true)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setIsRecording(false)}
                    className={cn(
                        "h-8 px-2.5 text-[12px] transition-colors min-w-[96px] text-center",
                        isRecording ? "bg-accent text-accent-foreground" : "bg-secondary/40 hover:bg-secondary/60",
                    )}
                >
                    {isRecording ? "Press key..." : displayShortcut()}
                </button>
            </div>
        </div>
    );
}

function ShortcutsTab() {
    const { shortcuts, updateShortcut, resetToDefaults } = useShortcuts();

    return (
        <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={resetToDefaults} className="gap-1.5">
                    <RotateCcw className="size-3.5" />
                    Reset Defaults
                </Button>
            </div>

            <div className="divide-y divide-border/40">
                <ShortcutRow
                    label="Next Unviewed File"
                    shortcut={shortcuts.nextUnviewedFile}
                    onChange={(config) => updateShortcut("nextUnviewedFile", config)}
                />
                <ShortcutRow
                    label="Previous Unviewed File"
                    shortcut={shortcuts.previousUnviewedFile}
                    onChange={(config) => updateShortcut("previousUnviewedFile", config)}
                />
                <ShortcutRow label="Scroll Down" shortcut={shortcuts.scrollDown} onChange={(config) => updateShortcut("scrollDown", config)} />
                <ShortcutRow label="Scroll Up" shortcut={shortcuts.scrollUp} onChange={(config) => updateShortcut("scrollUp", config)} />
                <ShortcutRow label="Next File" shortcut={shortcuts.nextFile} onChange={(config) => updateShortcut("nextFile", config)} />
                <ShortcutRow label="Previous File" shortcut={shortcuts.previousFile} onChange={(config) => updateShortcut("previousFile", config)} />
                <ShortcutRow
                    label="Approve Pull Request"
                    shortcut={shortcuts.approvePullRequest}
                    onChange={(config) => updateShortcut("approvePullRequest", config)}
                />
                <ShortcutRow
                    label="Request Changes"
                    shortcut={shortcuts.requestChangesPullRequest}
                    onChange={(config) => updateShortcut("requestChangesPullRequest", config)}
                />
            </div>
        </div>
    );
}

function DiffSettingsTab({ workspaceMode, onWorkspaceModeChange }: { workspaceMode?: WorkspaceMode; onWorkspaceModeChange?: (mode: WorkspaceMode) => void }) {
    const { options } = useDiffOptions();
    const { monospaceFontFamily, monospaceFontSize, monospaceLineHeight } = useAppearance();
    const previewFileDiff = useMemo(() => {
        const patches = parsePatchFiles(DIFF_PREVIEW_PATCH);
        return patches[0]?.files[0];
    }, []);
    const previewStyle = useMemo(
        () =>
            ({
                "--diff-font-family": fontFamilyToCss(options.diffUseCustomTypography ? options.diffFontFamily : monospaceFontFamily),
                "--diff-font-size": `${options.diffUseCustomTypography ? options.diffFontSize : monospaceFontSize}px`,
                "--diff-line-height": String(options.diffUseCustomTypography ? options.diffLineHeight : monospaceLineHeight),
            }) as CSSProperties,
        [
            monospaceFontFamily,
            monospaceFontSize,
            monospaceLineHeight,
            options.diffFontFamily,
            options.diffFontSize,
            options.diffLineHeight,
            options.diffUseCustomTypography,
        ],
    );
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
            {workspaceMode && onWorkspaceModeChange && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={workspaceMode === "single" ? "default" : "outline"}
                            size="sm"
                            className="h-8"
                            onClick={() => onWorkspaceModeChange("single")}
                        >
                            Single file
                        </Button>
                        <Button
                            variant={workspaceMode === "all" ? "default" : "outline"}
                            size="sm"
                            className="h-8"
                            onClick={() => onWorkspaceModeChange("all")}
                        >
                            All files
                        </Button>
                    </div>
                </div>
            )}
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

function AppearanceTab() {
    const {
        sansFontFamily,
        monospaceFontFamily,
        sansFontSize,
        sansLineHeight,
        monospaceFontSize,
        monospaceLineHeight,
        setSansFontFamily,
        setMonospaceFontFamily,
        setSansFontSize,
        setSansLineHeight,
        setMonospaceFontSize,
        setMonospaceLineHeight,
    } = useAppearance();
    const { options, setOption } = useDiffOptions();
    const appThemeValue = options.followSystemTheme ? "__system__" : options.theme;

    return (
        <div className="space-y-3 max-w-3xl">
            <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">Theme</Label>
                <Select
                    value={appThemeValue}
                    onValueChange={(value) => {
                        if (value === "__system__") {
                            setOption("followSystemTheme", true);
                            return;
                        }
                        setOption("followSystemTheme", false);
                        setOption("theme", value as DiffTheme);
                    }}
                >
                    <SelectTrigger className="h-9 text-[12px] w-full" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                        <SelectItem value="__system__" className="text-[12px]">
                            Detect browser preference (github dark/light default)
                        </SelectItem>
                        {DIFF_THEMES.map((theme) => (
                            <SelectItem key={theme} value={theme} className="text-[12px]">
                                {theme}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Sans Font</Label>
                        <Select value={sansFontFamily} onValueChange={(value) => setSansFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="h-9 text-[12px] w-full" size="sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {SANS_FONT_FAMILY_OPTIONS.map((font) => (
                                    <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                        {font.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Sans Font Size</Label>
                        <NumberStepperInput value={sansFontSize} min={11} max={20} step={1} onValueChange={setSansFontSize} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Sans Line Height</Label>
                        <NumberStepperInput value={sansLineHeight} min={1} max={2.2} step={0.05} onValueChange={setSansLineHeight} />
                    </div>
                    <div className="py-1">
                        <div className="text-[11px] text-muted-foreground mb-1">Sans</div>
                        <div
                            className="space-y-1"
                            style={{
                                fontFamily: fontFamilyToCss(sansFontFamily),
                                fontSize: `${sansFontSize}px`,
                                lineHeight: String(sansLineHeight),
                            }}
                        >
                            <p>Pull request summaries should stay readable even when comments and metadata span several wrapped lines in a compact layout.</p>
                            <p>This intentionally long sentence exercises wrapping and makes line-height changes obvious across multiple rows of sans text.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Font</Label>
                        <Select value={monospaceFontFamily} onValueChange={(value) => setMonospaceFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="h-9 text-[12px] w-full" size="sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {MONO_FONT_FAMILY_OPTIONS.map((font) => (
                                    <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                        {font.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Font Size</Label>
                        <NumberStepperInput value={monospaceFontSize} min={11} max={20} step={1} onValueChange={setMonospaceFontSize} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Line Height</Label>
                        <NumberStepperInput value={monospaceLineHeight} min={1} max={2.2} step={0.05} onValueChange={setMonospaceLineHeight} />
                    </div>
                    <div className="py-1">
                        <div className="text-[11px] text-muted-foreground mb-1">Monospace</div>
                        <div
                            className="whitespace-pre-wrap"
                            style={{
                                fontFamily: fontFamilyToCss(monospaceFontFamily),
                                fontSize: `${monospaceFontSize}px`,
                                lineHeight: String(monospaceLineHeight),
                            }}
                        >
                            {
                                'const previewId = "A1B2C3";\nconst longLine = "monospace preview long line for wrapping and spacing checks in settings panel output with detailed identifiers and timestamps";\nreturn previewId + " " + longLine;'
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TreeTab() {
    const {
        treeUseCustomTypography,
        setTreeUseCustomTypography,
        setTreeFontFamily,
        setTreeFontSize,
        setTreeLineHeight,
        treeFontFamily,
        treeFontSize,
        treeLineHeight,
    } = useAppearance();
    const { compactSingleChildDirectories, setCompactSingleChildDirectories, treeIndentSize, setTreeIndentSize } = useFileTree();

    return (
        <div className="space-y-3 max-w-3xl">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <Label htmlFor="tree-compact-single-child" className="text-[12px] text-foreground">
                        Compact single-child folder chains
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Example: services/foo/bar/file.php as services/foo/bar.</p>
                </div>
                <Switch id="tree-compact-single-child" checked={compactSingleChildDirectories} onCheckedChange={setCompactSingleChildDirectories} size="sm" />
            </div>
            <div className="max-w-56 space-y-1">
                <Label className="text-[12px] text-muted-foreground">Indentation Size</Label>
                <NumberStepperInput value={treeIndentSize} min={8} max={24} step={1} onValueChange={setTreeIndentSize} />
            </div>
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <Label htmlFor="tree-custom-typography" className="text-[12px] text-foreground">
                        Override tree typography
                    </Label>
                </div>
                <Switch id="tree-custom-typography" checked={treeUseCustomTypography} onCheckedChange={setTreeUseCustomTypography} size="sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <Label className="text-[12px] text-muted-foreground">Font Family</Label>
                    <Select value={treeFontFamily} onValueChange={(value) => setTreeFontFamily(value as FontFamilyValue)} disabled={!treeUseCustomTypography}>
                        <SelectTrigger className="h-9 text-[12px] w-full" size="sm">
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
                    <NumberStepperInput value={treeFontSize} min={10} max={18} step={1} onValueChange={setTreeFontSize} disabled={!treeUseCustomTypography} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[12px] text-muted-foreground">Line Height</Label>
                    <NumberStepperInput
                        value={treeLineHeight}
                        min={1}
                        max={2.2}
                        step={0.05}
                        onValueChange={setTreeLineHeight}
                        disabled={!treeUseCustomTypography}
                    />
                </div>
            </div>
        </div>
    );
}

export function SettingsMenu({
    workspaceMode,
    onWorkspaceModeChange,
}: {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
} = {}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Settings" data-component="settings">
                    <Settings2 className="size-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
                <SettingsPanelWithSidebar workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} />
            </DialogContent>
        </Dialog>
    );
}

type SettingsPanelSharedProps = {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onClose?: () => void;
    activeTab?: SettingsTab;
    onActiveTabChange?: (tab: SettingsTab) => void;
};

function useResolvedSettingsTab({ activeTab: controlledActiveTab, onActiveTabChange }: Pick<SettingsPanelSharedProps, "activeTab" | "onActiveTabChange">) {
    // Share controlled/uncontrolled tab behavior across explicit panel variants.
    const [internalActiveTab, setInternalActiveTab] = useState<SettingsTab>("appearance");
    const isControlled = controlledActiveTab !== undefined;
    const resolvedActiveTab = isControlled ? controlledActiveTab : internalActiveTab;
    const setActiveTab = (nextTab: SettingsTab) => {
        if (!isControlled) {
            setInternalActiveTab(nextTab);
        }
        onActiveTabChange?.(nextTab);
    };
    return { resolvedActiveTab, setActiveTab };
}

function SettingsPanelHeader({ onClose }: { onClose?: () => void }) {
    return (
        <div className="h-10 px-2.5 border-b border-border bg-card flex items-center gap-2">
            <div className="text-[12px] font-medium flex items-center gap-2 w-full">
                <Settings2 className="size-4" />
                Settings
                {onClose ? (
                    <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-[11px]" onClick={onClose}>
                        Back to review
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function SettingsPanelContent({
    workspaceMode,
    onWorkspaceModeChange,
    activeTab,
}: Pick<SettingsPanelSharedProps, "workspaceMode" | "onWorkspaceModeChange"> & {
    activeTab: SettingsTab;
}) {
    return (
        <>
            {activeTab === "diff" ? <DiffSettingsTab workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} /> : null}
            {activeTab === "appearance" ? <AppearanceTab /> : null}
            {activeTab === "tree" ? <TreeTab /> : null}
            {activeTab === "shortcuts" ? <ShortcutsTab /> : null}
        </>
    );
}

function SettingsPanelSidebar({ activeTab, onSelectTab }: { activeTab: SettingsTab; onSelectTab: (tab: SettingsTab) => void }) {
    return (
        <div className="w-56 border-r border-border bg-sidebar">
            <nav className="p-3 space-y-1.5">
                {getSettingsTreeItems().map((item) => {
                    const Icon = getSettingsTabIcon(item.tab);
                    return (
                        <button
                            key={item.tab}
                            type="button"
                            onClick={() => onSelectTab(item.tab)}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                                activeTab === item.tab ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
                            )}
                        >
                            <Icon className="size-4" />
                            {item.name}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

export function SettingsPanelWithSidebar({ workspaceMode, onWorkspaceModeChange, onClose, activeTab, onActiveTabChange }: SettingsPanelSharedProps = {}) {
    const { resolvedActiveTab, setActiveTab } = useResolvedSettingsTab({
        activeTab,
        onActiveTabChange,
    });

    return (
        <div className="h-full min-h-0 flex flex-col">
            <SettingsPanelHeader onClose={onClose} />
            <div className="flex flex-1 min-h-0">
                <SettingsPanelSidebar activeTab={resolvedActiveTab} onSelectTab={setActiveTab} />
                <div className="flex-1 px-3 py-2.5 overflow-auto">
                    <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={resolvedActiveTab} />
                </div>
            </div>
        </div>
    );
}

export function SettingsPanelContentOnly({ workspaceMode, onWorkspaceModeChange, onClose, activeTab, onActiveTabChange }: SettingsPanelSharedProps = {}) {
    const { resolvedActiveTab } = useResolvedSettingsTab({
        activeTab,
        onActiveTabChange,
    });

    return (
        <div className="h-full min-h-0 flex flex-col">
            <SettingsPanelHeader onClose={onClose} />
            <div className="flex-1 px-3 py-2.5 overflow-auto">
                <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={resolvedActiveTab} />
            </div>
        </div>
    );
}
