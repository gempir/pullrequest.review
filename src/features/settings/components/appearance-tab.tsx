import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppearance } from "@/lib/appearance-context";
import {
    DEFAULT_FONT_FAMILY,
    FONT_SIZE_LIMITS,
    type FontFamilyValue,
    fontFamilyToCss,
    getCustomFontName,
    LINE_HEIGHT_LIMITS,
    MONO_FONT_FAMILY_OPTIONS,
    makeCustomFontFamilyValue,
    SANS_FONT_FAMILY_OPTIONS,
} from "@/lib/font-options";

export function AppearanceTab() {
    const appearance = useAppearance();
    const customMonospaceFont = getCustomFontName(appearance.monospaceFontFamily);

    return (
        <div className="max-w-3xl space-y-4">
            <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">App Theme</Label>
                <Select value={appearance.appThemeMode} onValueChange={(value) => appearance.setAppThemeMode(value as "auto" | "light" | "dark")}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Auto (follow system)</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid max-w-3xl grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Sans Font</Label>
                        <Select value={appearance.sansFontFamily} onValueChange={(value) => appearance.setSansFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {SANS_FONT_FAMILY_OPTIONS.map((font) => (
                                    <SelectItem key={font.value} value={font.value}>
                                        {font.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Sans Font Size</Label>
                        <NumberStepperInput
                            value={appearance.sansFontSize}
                            min={FONT_SIZE_LIMITS.min}
                            max={FONT_SIZE_LIMITS.max}
                            step={1}
                            onValueChange={appearance.setSansFontSize}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Sans Line Height</Label>
                        <NumberStepperInput
                            value={appearance.sansLineHeight}
                            min={LINE_HEIGHT_LIMITS.min}
                            max={LINE_HEIGHT_LIMITS.max}
                            step={0.05}
                            onValueChange={appearance.setSansLineHeight}
                        />
                    </div>
                    <div className="rounded-md border border-border-muted bg-card p-3">
                        <div className="mb-1.5 text-[11px] font-medium text-faint-foreground">Preview</div>
                        <div
                            className="space-y-1"
                            style={{
                                fontFamily: fontFamilyToCss(appearance.sansFontFamily),
                                fontSize: `${appearance.sansFontSize}px`,
                                lineHeight: String(appearance.sansLineHeight),
                            }}
                        >
                            <p>Pull request summaries should stay readable even when comments and metadata span several wrapped lines in a compact layout.</p>
                            <p>This intentionally long sentence exercises wrapping and makes line-height changes obvious across multiple rows of sans text.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Monospaced Font</Label>
                        <Select value={appearance.monospaceFontFamily} onValueChange={(value) => appearance.setMonospaceFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {customMonospaceFont ? <SelectItem value={appearance.monospaceFontFamily}>{customMonospaceFont}</SelectItem> : null}
                                {MONO_FONT_FAMILY_OPTIONS.map((font) => (
                                    <SelectItem key={font.value} value={font.value}>
                                        {font.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="custom-monospace-font" className="text-[12px] font-medium text-muted-foreground">
                            Custom Monospaced Font
                        </Label>
                        <Input
                            id="custom-monospace-font"
                            placeholder="Any installed font, e.g. Berkeley Mono"
                            value={customMonospaceFont ?? ""}
                            onChange={(event) => {
                                const name = event.target.value;
                                appearance.setMonospaceFontFamily(name ? makeCustomFontFamilyValue(name) : DEFAULT_FONT_FAMILY);
                            }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Monospaced Font Size</Label>
                        <NumberStepperInput
                            value={appearance.monospaceFontSize}
                            min={FONT_SIZE_LIMITS.min}
                            max={FONT_SIZE_LIMITS.max}
                            step={1}
                            onValueChange={appearance.setMonospaceFontSize}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Monospaced Line Height</Label>
                        <NumberStepperInput
                            value={appearance.monospaceLineHeight}
                            min={LINE_HEIGHT_LIMITS.min}
                            max={LINE_HEIGHT_LIMITS.max}
                            step={0.05}
                            onValueChange={appearance.setMonospaceLineHeight}
                        />
                    </div>
                    <div className="rounded-md border border-border-muted bg-card p-3">
                        <div className="mb-1.5 text-[11px] font-medium text-faint-foreground">Preview</div>
                        <div
                            className="whitespace-pre-wrap"
                            style={{
                                fontFamily: fontFamilyToCss(appearance.monospaceFontFamily),
                                fontSize: `${appearance.monospaceFontSize}px`,
                                lineHeight: String(appearance.monospaceLineHeight),
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
