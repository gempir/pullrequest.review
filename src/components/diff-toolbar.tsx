import { Expand, FoldVertical, SquareSplitVertical, UnfoldVertical, WrapText } from "lucide-react";
import type { ComponentType } from "react";
import { Label } from "@/components/ui/label";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type DiffOptions, useDiffOptions } from "@/lib/diff-options-context";

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
        <div className="space-y-1.5">
            <SettingLabel label={label} icon={icon} />
            <Select value={String(options[optionKey])} onValueChange={(v) => setOption(optionKey, v as DiffOptions[K])}>
                <SelectTrigger className="w-full min-w-[120px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {values.map((v) => (
                        <SelectItem key={String(v)} value={String(v)}>
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
            <Label htmlFor={optionKey} className="text-[12px] whitespace-nowrap text-foreground inline-flex items-center gap-1.5 [&_svg]:text-muted-foreground">
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
        <div className="space-y-1.5">
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
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <OptionSelect label="Diff Layout" icon={SquareSplitVertical} optionKey="diffStyle" values={["unified", "split"]} />
                <OptionSelect label="Line Overflow" icon={WrapText} optionKey="overflow" values={["scroll", "wrap"]} />
                <OptionNumber label="Expansion Lines" icon={Expand} optionKey="expansionLineCount" min={1} max={200} />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <OptionSwitch label="Expand Unchanged" icon={UnfoldVertical} optionKey="expandUnchanged" />
                <OptionSwitch label="Auto Mark Files as Viewed" icon={FoldVertical} optionKey="autoMarkViewedFiles" />
                <OptionSwitch label="Fold Viewed Files By Default" icon={FoldVertical} optionKey="collapseViewedFilesByDefault" />
            </div>
        </div>
    );
}
