import { useDiffOptions, type DiffOptions } from "@/lib/diff-options-context";
import { DIFF_THEMES, type DiffTheme } from "@/lib/diff-themes";
import { FONT_FAMILY_OPTIONS, type FontFamilyValue } from "@/lib/font-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type BooleanOptionKey = {
  [K in keyof DiffOptions]: DiffOptions[K] extends boolean ? K : never;
}[keyof DiffOptions];

type NumberOptionKey = {
  [K in keyof DiffOptions]: DiffOptions[K] extends number ? K : never;
}[keyof DiffOptions];

function OptionSelect<K extends keyof DiffOptions>({
  label,
  optionKey,
  values,
}: {
  label: string;
  optionKey: K;
  values: readonly DiffOptions[K][];
}) {
  const { options, setOption } = useDiffOptions();
  return (
    <div className="space-y-1">
      <Label className="text-[12px] whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      <Select
        value={String(options[optionKey])}
        onValueChange={(v) => setOption(optionKey, v as DiffOptions[K])}
      >
        <SelectTrigger
          className="h-8 text-[12px] w-full min-w-[120px]"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((v) => (
            <SelectItem
              key={String(v)}
              value={String(v)}
              className="text-[12px]"
            >
              {String(v)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OptionSwitch({
  label,
  optionKey,
}: {
  label: string;
  optionKey: BooleanOptionKey;
}) {
  const { options, setOption } = useDiffOptions();
  return (
    <div className="flex items-center gap-2 pt-5">
      <Switch
        id={optionKey}
        checked={options[optionKey]}
        onCheckedChange={(v) => setOption(optionKey, v)}
        size="sm"
      />
      <Label
        htmlFor={optionKey}
        className="text-[12px] whitespace-nowrap text-muted-foreground"
      >
        {label}
      </Label>
    </div>
  );
}

function OptionNumber({
  label,
  optionKey,
  min,
  max,
  step,
}: {
  label: string;
  optionKey: NumberOptionKey;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { options, setOption } = useDiffOptions();
  return (
    <div className="space-y-1">
      <Label className="text-[12px] whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        value={options[optionKey]}
        onChange={(e) => setOption(optionKey, Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="h-8 w-full text-[12px]"
      />
    </div>
  );
}

export function DiffToolbar() {
  const { options, setOption } = useDiffOptions();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-[12px] whitespace-nowrap text-muted-foreground">
            Theme
          </Label>
          <Select
            value={options.theme}
            onValueChange={(v) => setOption("theme", v as DiffTheme)}
          >
            <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {DIFF_THEMES.map((t) => (
                <SelectItem key={t} value={t} className="text-[12px]">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[12px] whitespace-nowrap text-muted-foreground">
            Diff Font Family
          </Label>
          <Select
            value={options.diffFontFamily}
            onValueChange={(v) =>
              setOption("diffFontFamily", v as FontFamilyValue)
            }
          >
            <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {FONT_FAMILY_OPTIONS.map((font) => (
                <SelectItem
                  key={font.value}
                  value={font.value}
                  className="text-[12px]"
                >
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <OptionNumber
          label="Diff Font Size"
          optionKey="diffFontSize"
          min={10}
          max={20}
        />
        <OptionNumber
          label="Diff Line Height"
          optionKey="diffLineHeight"
          min={1}
          max={2.2}
          step={0.05}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OptionSelect
          label="Diff Layout"
          optionKey="diffStyle"
          values={["unified", "split"]}
        />
        <OptionSelect
          label="Change Indicators"
          optionKey="diffIndicators"
          values={["classic", "bars", "none"]}
        />
        <OptionSelect
          label="Hunk Separators"
          optionKey="hunkSeparators"
          values={["simple", "metadata", "line-info"]}
        />
        <OptionSelect
          label="Inline Diff"
          optionKey="lineDiffType"
          values={["word-alt", "word", "char", "none"]}
        />
        <OptionSelect
          label="Line Overflow"
          optionKey="overflow"
          values={["scroll", "wrap"]}
        />
        <OptionNumber
          label="Expansion Lines"
          optionKey="expansionLineCount"
          min={1}
          max={200}
        />
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <OptionSwitch
          label="Disable Background"
          optionKey="disableBackground"
        />
        <OptionSwitch label="Expand Unchanged" optionKey="expandUnchanged" />
        <OptionSwitch
          label="Hide Line Numbers"
          optionKey="disableLineNumbers"
        />
      </div>
    </div>
  );
}
