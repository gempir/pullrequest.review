import { type FileDiffOptions, parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { FileCode2, Files, RotateCcw, Settings2 } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { DiffToolbar } from "@/components/diff-toolbar";
import type { SettingsTab } from "@/components/settings-navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppearance } from "@/lib/appearance-context";
import {
    clearCacheTierData,
    clearExpiredDataNow,
    type DataCollectionsDebugSnapshot,
    getDataCollectionsDebugSnapshot,
    type StorageTier,
} from "@/lib/data/query-collections";
import { getDetectedFontOptionFromValue, useDetectedMonospaceFontOptions } from "@/lib/detected-monospace-fonts";
import { useDiffOptions } from "@/lib/diff-options-context";
import { DIFF_THEMES, type DiffTheme } from "@/lib/diff-themes";
import { useFileTree } from "@/lib/file-tree-context";
import {
    FONT_FAMILY_OPTIONS,
    type FontFamilyValue,
    fontFamilyToCss,
    isDetectedFontFamilyValue,
    MONO_FONT_FAMILY_OPTIONS,
    SANS_FONT_FAMILY_OPTIONS,
} from "@/lib/font-options";
import { type ShortcutConfig, useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

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

function useResetAllSettingsAction() {
    const { resetAppearance } = useAppearance();
    const { resetOptions } = useDiffOptions();
    const { resetTreePreferences } = useFileTree();
    const { resetToDefaults: resetShortcuts } = useShortcuts();

    return useCallback(() => {
        resetAppearance();
        resetOptions();
        resetTreePreferences();
        resetShortcuts();
    }, [resetAppearance, resetOptions, resetTreePreferences, resetShortcuts]);
}

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
                <ShortcutRow label="Mark File Viewed" shortcut={shortcuts.markFileViewed} onChange={(config) => updateShortcut("markFileViewed", config)} />
                <ShortcutRow
                    label="Mark File Viewed + Fold"
                    shortcut={shortcuts.markFileViewedAndFold}
                    onChange={(config) => updateShortcut("markFileViewedAndFold", config)}
                />
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
            {workspaceMode && onWorkspaceModeChange && (
                <div className="flex items-center gap-2">
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
    const detectedMonospaceFonts = useDetectedMonospaceFontOptions();
    const resolvedDetectedMonospaceFonts = useMemo(() => {
        if (!isDetectedFontFamilyValue(monospaceFontFamily)) return detectedMonospaceFonts;
        if (detectedMonospaceFonts.some((font) => font.value === monospaceFontFamily)) return detectedMonospaceFonts;
        const fallback = getDetectedFontOptionFromValue(monospaceFontFamily);
        return fallback ? [...detectedMonospaceFonts, fallback] : detectedMonospaceFonts;
    }, [detectedMonospaceFonts, monospaceFontFamily]);
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
                                <SelectGroup>
                                    <SelectLabel className="text-[11px] text-muted-foreground">Curated fonts</SelectLabel>
                                    {MONO_FONT_FAMILY_OPTIONS.map((font) => (
                                        <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                            {font.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                                {resolvedDetectedMonospaceFonts.length ? (
                                    <>
                                        <SelectSeparator />
                                        <SelectGroup>
                                            <SelectLabel className="text-[11px] text-muted-foreground">Detected on this device</SelectLabel>
                                            {resolvedDetectedMonospaceFonts.map((font) => (
                                                <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                                    {font.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </>
                                ) : null}
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

function formatBytes(bytes: number | null) {
    if (bytes === null || !Number.isFinite(bytes)) return "n/a";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTimestamp(timestamp: number | null) {
    if (!timestamp || !Number.isFinite(timestamp)) return "n/a";
    return new Date(timestamp).toLocaleString();
}

function StorageTab() {
    const [state, setState] = useState<{
        snapshot: DataCollectionsDebugSnapshot | null;
        loading: boolean;
        busyAction: "refresh" | "clear-cache" | "clear-expired" | "export" | null;
        statusMessage: string | null;
    }>({
        snapshot: null,
        loading: true,
        busyAction: null,
        statusMessage: null,
    });

    const refreshSnapshots = useCallback(async () => {
        setState((prev) => ({ ...prev, busyAction: "refresh" }));
        try {
            const snapshot = await getDataCollectionsDebugSnapshot();
            setState((prev) => ({
                ...prev,
                snapshot,
            }));
        } finally {
            setState((prev) => ({ ...prev, busyAction: null, loading: false }));
        }
    }, []);

    useEffect(() => {
        void refreshSnapshots();
    }, [refreshSnapshots]);

    const runClearCache = useCallback(async () => {
        if (!window.confirm("Clear cache-tier storage now? This removes cached pull request data and forces refetches.")) return;
        setState((prev) => ({ ...prev, busyAction: "clear-cache", statusMessage: null }));
        const startedAt = Date.now();
        try {
            const result = await clearCacheTierData();
            await refreshSnapshots();
            setState((prev) => ({
                ...prev,
                statusMessage: `Cleared cache tier: ${result.removed} records removed in ${Date.now() - startedAt}ms (app ${result.appRemoved}, host ${result.hostRemoved}).`,
            }));
        } finally {
            setState((prev) => ({ ...prev, busyAction: null }));
        }
    }, [refreshSnapshots]);

    const runClearExpired = useCallback(async () => {
        if (!window.confirm("Clear expired storage entries now?")) return;
        setState((prev) => ({ ...prev, busyAction: "clear-expired", statusMessage: null }));
        const startedAt = Date.now();
        try {
            const result = await clearExpiredDataNow();
            await refreshSnapshots();
            setState((prev) => ({
                ...prev,
                statusMessage: `Cleared expired data: ${result.removed} records removed in ${Date.now() - startedAt}ms (app ${result.appRemoved}, host ${result.hostRemoved}).`,
            }));
        } finally {
            setState((prev) => ({ ...prev, busyAction: null }));
        }
    }, [refreshSnapshots]);

    const runExportDiagnostics = useCallback(async () => {
        setState((prev) => ({ ...prev, busyAction: "export", statusMessage: null }));
        try {
            const snapshot = await getDataCollectionsDebugSnapshot();
            const payload = JSON.stringify(
                {
                    generatedAt: new Date().toISOString(),
                    storage: snapshot,
                },
                null,
                2,
            );

            let copied = false;
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(payload);
                    copied = true;
                } catch {
                    copied = false;
                }
            }

            if (!copied && typeof window !== "undefined") {
                const blob = new Blob([payload], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `storage-diagnostics-${Date.now()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                setState((prev) => ({ ...prev, statusMessage: "Diagnostics exported as JSON file." }));
            } else {
                setState((prev) => ({ ...prev, statusMessage: "Diagnostics copied to clipboard as JSON." }));
            }
        } finally {
            setState((prev) => ({ ...prev, busyAction: null }));
        }
    }, []);

    const tierOrder: StorageTier[] = ["cache", "state", "permanent"];
    const snapshot = state.snapshot;

    if (state.loading && !snapshot) {
        return <div className="text-[12px] text-muted-foreground">Loading storage diagnostics...</div>;
    }

    return (
        <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] text-muted-foreground">Storage diagnostics and safe maintenance actions.</div>
                <Button variant="outline" size="sm" onClick={() => void refreshSnapshots()} disabled={state.busyAction !== null}>
                    Refresh
                </Button>
            </div>

            {state.statusMessage ? <div className="text-[11px] px-2 py-1.5 bg-secondary/40">{state.statusMessage}</div> : null}

            {snapshot ? (
                <section className="space-y-2">
                    <h3 className="text-[12px] font-medium">Storage Health</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                        <div className="border border-border p-2">
                            <div>Collections backend: {snapshot.backendMode}</div>
                            <div>Host cache backend: {snapshot.hostBackendMode}</div>
                            <div>Persistence degraded: {snapshot.persistenceDegraded ? "yes" : "no"}</div>
                            <div>Last sweep: {formatTimestamp(snapshot.lastSweepAt)}</div>
                        </div>
                        <div className="border border-border p-2">
                            <div>Total records: {snapshot.totalRecords}</div>
                            <div>Total bytes: {formatBytes(snapshot.totalBytes)}</div>
                            <div>
                                Quota estimate: {formatBytes(snapshot.estimatedUsageBytes)} / {formatBytes(snapshot.estimatedQuotaBytes)}
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}

            {snapshot ? (
                <section className="space-y-2">
                    <h3 className="text-[12px] font-medium">Tier Summary</h3>
                    <div className="border border-border divide-y divide-border text-[12px]">
                        {tierOrder.map((tier) => {
                            const summary = snapshot.tiers[tier];
                            return (
                                <div key={tier} className="p-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                                    <div className="font-medium capitalize">{tier}</div>
                                    <div>Records: {summary.count}</div>
                                    <div>Bytes: {formatBytes(summary.approxBytes)}</div>
                                    <div>Oldest: {formatTimestamp(summary.oldestUpdatedAt)}</div>
                                    <div>Newest: {formatTimestamp(summary.newestUpdatedAt)}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {snapshot ? (
                <section className="space-y-2">
                    <h3 className="text-[12px] font-medium">Collections</h3>
                    <div className="border border-border divide-y divide-border text-[12px]">
                        {snapshot.collections.map((summary) => (
                            <div key={`${summary.tier}:${summary.name}`} className="p-2 grid grid-cols-1 md:grid-cols-7 gap-2">
                                <div className="font-medium min-w-0 md:col-span-2">
                                    <div className="break-all" title={summary.name}>
                                        {summary.name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">tier: {summary.tier}</div>
                                </div>
                                <div className="min-w-0">Records: {summary.count}</div>
                                <div className="min-w-0">Bytes: {formatBytes(summary.approxBytes)}</div>
                                <div className="min-w-0">Expired: {summary.expiredCount}</div>
                                <div className="min-w-0">Oldest: {formatTimestamp(summary.oldestUpdatedAt)}</div>
                                <div className="min-w-0">Newest: {formatTimestamp(summary.newestUpdatedAt)}</div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="space-y-2">
                <h3 className="text-[12px] font-medium">Actions</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" disabled={state.busyAction !== null} onClick={() => void runClearCache()}>
                        Clear cache tier
                    </Button>
                    <Button variant="outline" size="sm" disabled={state.busyAction !== null} onClick={() => void runClearExpired()}>
                        Clear expired now
                    </Button>
                    <Button variant="outline" size="sm" disabled={state.busyAction !== null} onClick={() => void runExportDiagnostics()}>
                        Export diagnostics JSON
                    </Button>
                </div>
            </section>

            <section className="space-y-1 text-[11px] text-muted-foreground">
                <div>Quota notes: browser storage quotas are dynamic and may be evicted under storage pressure.</div>
                <div>Typical ranges: Chromium around 60% of disk, Firefox around min(10% disk, 10GiB), Safari often around 60% for browser apps.</div>
                <div>localStorage fallback is substantially smaller than IndexedDB.</div>
            </section>
        </div>
    );
}

type SettingsPanelSharedProps = {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onClose?: () => void;
    activeTab?: SettingsTab;
    onActiveTabChange?: (tab: SettingsTab) => void;
};

function useResolvedSettingsTab({ activeTab: controlledActiveTab }: Pick<SettingsPanelSharedProps, "activeTab">) {
    return { resolvedActiveTab: controlledActiveTab ?? "appearance" };
}

function SettingsPanelHeader({ onClose, onResetAllSettings }: { onClose?: () => void; onResetAllSettings?: () => void }) {
    const hasActions = Boolean(onClose || onResetAllSettings);

    return (
        <div className="h-10 px-2.5 border-b border-border bg-chrome flex items-center gap-2">
            <div className="text-[12px] font-medium flex items-center gap-2 w-full">
                <Settings2 className="size-4" />
                Settings
                {hasActions ? (
                    <div className="ml-auto flex items-center gap-2">
                        {onResetAllSettings ? (
                            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1.5" onClick={onResetAllSettings}>
                                <RotateCcw className="size-3.5" />
                                Reset all settings
                            </Button>
                        ) : null}
                        {onClose ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onClose}>
                                Back to review
                            </Button>
                        ) : null}
                    </div>
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
            {activeTab === "storage" ? <StorageTab /> : null}
        </>
    );
}

export function SettingsPanelContentOnly({ workspaceMode, onWorkspaceModeChange, onClose, activeTab }: SettingsPanelSharedProps = {}) {
    const { resolvedActiveTab } = useResolvedSettingsTab({
        activeTab,
    });
    const resetAllSettings = useResetAllSettingsAction();

    return (
        <div className="h-full min-h-0 flex flex-col">
            <SettingsPanelHeader onClose={onClose} onResetAllSettings={resetAllSettings} />
            <div className="flex-1 px-3 py-2.5 overflow-auto">
                <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={resolvedActiveTab} />
            </div>
        </div>
    );
}
