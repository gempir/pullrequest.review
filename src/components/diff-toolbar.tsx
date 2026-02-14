import {
    BetweenHorizontalStart,
    Expand,
    FoldVertical,
    Hash,
    ImageOff,
    Rows3,
    Ruler,
    SquareSplitVertical,
    TextCursorInput,
    Type,
    UnfoldVertical,
    WholeWord,
    WrapText,
} from "lucide-react";
import type { ComponentType } from "react";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type DiffOptions, useDiffOptions } from "@/lib/diff-options-context";
import { FONT_FAMILY_OPTIONS, type FontFamilyValue } from "@/lib/font-options";

type BooleanOptionKey = {
    [K in keyof DiffOptions]: DiffOptions[K] extends boolean ? K : never;
}[keyof DiffOptions];

type NumberOptionKey = {
    [K in keyof DiffOptions]: DiffOptions[K] extends number ? K : never;
}[keyof DiffOptions];

type IconComponent = ComponentType<{ className?: string }>;

function SettingLabel({ label, icon: Icon, htmlFor }: { label: string; icon: IconComponent; htmlFor?: string }) {
    return (
        <Label htmlFor={htmlFor} className="text-[12px] whitespace-nowrap text-muted-foreground inline-flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {label}
        </Label>
    );
}

function OptionSelect<K extends keyof DiffOptions>({
    label,
    icon,
    optionKey,
    values,
}: {
    label: string;
    icon: IconComponent;
    optionKey: K;
    values: readonly DiffOptions[K][];
}) {
    const { options, setOption } = useDiffOptions();
    return (
        <div className="space-y-1">
            <SettingLabel label={label} icon={icon} />
            <Select value={String(options[optionKey])} onValueChange={(v) => setOption(optionKey, v as DiffOptions[K])}>
                <SelectTrigger className="h-9 text-[12px] w-full min-w-[120px]" size="sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {values.map((v) => (
                        <SelectItem key={String(v)} value={String(v)} className="text-[12px]">
                            {String(v)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function OptionSwitch({ label, icon: Icon, optionKey }: { label: string; icon: IconComponent; optionKey: BooleanOptionKey }) {
    const { options, setOption } = useDiffOptions();
    return (
        <div className="flex items-center gap-2">
            <Switch id={optionKey} checked={options[optionKey]} onCheckedChange={(v) => setOption(optionKey, v)} size="sm" />
            <Label htmlFor={optionKey} className="text-[12px] whitespace-nowrap text-muted-foreground inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {label}
            </Label>
        </div>
    );
}

function OptionNumber({
    label,
    icon,
    optionKey,
    min,
    max,
    step,
    disabled = false,
}: {
    label: string;
    icon: IconComponent;
    optionKey: NumberOptionKey;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
}) {
    const { options, setOption } = useDiffOptions();
    return (
        <div className="space-y-1">
            <SettingLabel label={label} icon={icon} />
            <NumberStepperInput
                value={options[optionKey]}
                onValueChange={(value) => setOption(optionKey, value)}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="w-full"
            />
        </div>
    );
}

export function DiffToolbar() {
    const { options, setOption } = useDiffOptions();

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <SettingLabel label="Diff Font Family" icon={Type} />
                    <div className="flex items-center justify-between px-0.5 py-1">
                        <Label htmlFor="diff-custom-typography" className="text-[12px] text-muted-foreground">
                            Override diff typography
                        </Label>
                        <Switch
                            id="diff-custom-typography"
                            checked={options.diffUseCustomTypography}
                            onCheckedChange={(value) => setOption("diffUseCustomTypography", value)}
                            size="sm"
                        />
                    </div>
                    <Select
                        value={options.diffFontFamily}
                        onValueChange={(v) => setOption("diffFontFamily", v as FontFamilyValue)}
                        disabled={!options.diffUseCustomTypography}
                    >
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

                <OptionNumber
                    label="Diff Font Size"
                    icon={TextCursorInput}
                    optionKey="diffFontSize"
                    min={10}
                    max={20}
                    disabled={!options.diffUseCustomTypography}
                />
                <OptionNumber
                    label="Diff Line Height"
                    icon={Ruler}
                    optionKey="diffLineHeight"
                    min={1}
                    max={2.2}
                    step={0.05}
                    disabled={!options.diffUseCustomTypography}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <OptionSelect label="Diff Layout" icon={SquareSplitVertical} optionKey="diffStyle" values={["unified", "split"]} />
                <OptionSelect label="Change Indicators" icon={BetweenHorizontalStart} optionKey="diffIndicators" values={["classic", "bars", "none"]} />
                <OptionSelect label="Hunk Separators" icon={Rows3} optionKey="hunkSeparators" values={["simple", "metadata", "line-info"]} />
                <OptionSelect label="Inline Diff" icon={WholeWord} optionKey="lineDiffType" values={["word-alt", "word", "char", "none"]} />
                <OptionSelect label="Line Overflow" icon={WrapText} optionKey="overflow" values={["scroll", "wrap"]} />
                <OptionNumber label="Expansion Lines" icon={Expand} optionKey="expansionLineCount" min={1} max={200} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <OptionSwitch label="Disable Background" icon={ImageOff} optionKey="disableBackground" />
                <OptionSwitch label="Expand Unchanged" icon={UnfoldVertical} optionKey="expandUnchanged" />
                <OptionSwitch label="Hide Line Numbers" icon={Hash} optionKey="disableLineNumbers" />
                <OptionSwitch label="Fold Viewed Files By Default" icon={FoldVertical} optionKey="collapseViewedFilesByDefault" />
            </div>
        </div>
    );
}
