import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppearance } from "@/lib/appearance-context";
import { getDetectedFontOptionFromValue, useDetectedMonospaceFontOptions } from "@/lib/detected-monospace-fonts";
import { type FontFamilyValue, fontFamilyToCss, isDetectedFontFamilyValue, MONO_FONT_FAMILY_OPTIONS, SANS_FONT_FAMILY_OPTIONS } from "@/lib/font-options";

export function AppearanceTab() {
    const appearance = useAppearance();
    const detectedMonospaceFonts = useDetectedMonospaceFontOptions();
    const resolvedDetectedMonospaceFonts = useMemo(() => {
        if (!isDetectedFontFamilyValue(appearance.monospaceFontFamily)) return detectedMonospaceFonts;
        if (detectedMonospaceFonts.some((font) => font.value === appearance.monospaceFontFamily)) return detectedMonospaceFonts;
        const fallback = getDetectedFontOptionFromValue(appearance.monospaceFontFamily);
        return fallback ? [...detectedMonospaceFonts, fallback] : detectedMonospaceFonts;
    }, [appearance.monospaceFontFamily, detectedMonospaceFonts]);

    return (
        <div className="max-w-3xl space-y-3">
            <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">App Theme</Label>
                <Select value={appearance.appThemeMode} onValueChange={(value) => appearance.setAppThemeMode(value as "auto" | "light" | "dark")}>
                    <SelectTrigger className="h-9 w-full text-[12px]" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto" className="text-[12px]">
                            Auto (follow system)
                        </SelectItem>
                        <SelectItem value="dark" className="text-[12px]">
                            Dark
                        </SelectItem>
                        <SelectItem value="light" className="text-[12px]">
                            Light
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Sans Font</Label>
                        <Select value={appearance.sansFontFamily} onValueChange={(value) => appearance.setSansFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="h-9 w-full text-[12px]" size="sm">
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
                        <NumberStepperInput value={appearance.sansFontSize} min={11} max={20} step={1} onValueChange={appearance.setSansFontSize} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Sans Line Height</Label>
                        <NumberStepperInput value={appearance.sansLineHeight} min={1} max={2.2} step={0.05} onValueChange={appearance.setSansLineHeight} />
                    </div>
                    <div className="py-1">
                        <div className="mb-1 text-[11px] text-muted-foreground">Sans</div>
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
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Font</Label>
                        <Select value={appearance.monospaceFontFamily} onValueChange={(value) => appearance.setMonospaceFontFamily(value as FontFamilyValue)}>
                            <SelectTrigger className="h-9 w-full text-[12px]" size="sm">
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
                                    <SelectGroup>
                                        <SelectLabel className="text-[11px] text-muted-foreground">Detected fonts</SelectLabel>
                                        {resolvedDetectedMonospaceFonts.map((font) => (
                                            <SelectItem key={font.value} value={font.value} className="text-[12px]">
                                                {font.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ) : null}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Font Size</Label>
                        <NumberStepperInput value={appearance.monospaceFontSize} min={10} max={18} step={1} onValueChange={appearance.setMonospaceFontSize} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[12px] text-muted-foreground">Monospaced Line Height</Label>
                        <NumberStepperInput
                            value={appearance.monospaceLineHeight}
                            min={1}
                            max={2.2}
                            step={0.05}
                            onValueChange={appearance.setMonospaceLineHeight}
                        />
                    </div>
                    <div className="py-1">
                        <div className="mb-1 text-[11px] text-muted-foreground">Monospace</div>
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
