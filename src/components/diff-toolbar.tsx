import { useDiffOptions, type DiffOptions } from "@/lib/diff-options-context";
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

const THEMES = [
  "pierre-dark",
  "pierre-light",
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "ayu-light",
  "catppuccin-frappe",
  "catppuccin-latte",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula",
  "dracula-soft",
  "everforest-dark",
  "everforest-light",
  "github-dark",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "github-light",
  "github-light-default",
  "github-light-high-contrast",
  "gruvbox-dark-hard",
  "gruvbox-dark-medium",
  "gruvbox-dark-soft",
  "gruvbox-light-hard",
  "gruvbox-light-medium",
  "gruvbox-light-soft",
  "houston",
  "kanagawa-dragon",
  "kanagawa-lotus",
  "kanagawa-wave",
  "light-plus",
  "material-theme",
  "material-theme-darker",
  "material-theme-lighter",
  "material-theme-ocean",
  "material-theme-palenight",
  "min-dark",
  "min-light",
  "monokai",
  "night-owl",
  "night-owl-light",
  "nord",
  "one-dark-pro",
  "one-light",
  "poimandres",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "slack-dark",
  "slack-ochin",
  "snazzy-light",
  "solarized-dark",
  "solarized-light",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
  "vitesse-light",
];

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
    <div className="flex items-center gap-2">
      <Label className="text-[11px] whitespace-nowrap text-muted-foreground">{label}</Label>
      <Select
        value={String(options[optionKey])}
        onValueChange={(v) => setOption(optionKey, v as DiffOptions[K])}
      >
        <SelectTrigger className="h-7 text-[12px] w-auto min-w-[80px]" size="sm">
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

function OptionSwitch({
  label,
  optionKey,
}: {
  label: string;
  optionKey: keyof DiffOptions;
}) {
  const { options, setOption } = useDiffOptions();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={optionKey}
        checked={Boolean(options[optionKey])}
        onCheckedChange={(v) => setOption(optionKey, v as any)}
        size="sm"
      />
      <Label htmlFor={optionKey} className="text-[11px] whitespace-nowrap text-muted-foreground">
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
}: {
  label: string;
  optionKey: keyof DiffOptions;
  min?: number;
  max?: number;
}) {
  const { options, setOption } = useDiffOptions();
  return (
    <div className="flex items-center gap-2">
      <Label className="text-[11px] whitespace-nowrap text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number(options[optionKey])}
        onChange={(e) => setOption(optionKey, Number(e.target.value) as any)}
        min={min}
        max={max}
        className="h-7 w-16 text-[12px]"
      />
    </div>
  );
}

export function DiffToolbar() {
  const { options, setOption } = useDiffOptions();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-[11px] whitespace-nowrap text-muted-foreground">Theme</Label>
        <Select
          value={options.theme}
          onValueChange={(v) => setOption("theme", v)}
        >
          <SelectTrigger className="h-7 text-[12px] w-auto min-w-[140px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {THEMES.map((t) => (
              <SelectItem key={t} value={t} className="text-[12px]">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-4 bg-border" />

      <OptionSelect
        label="Diff"
        optionKey="diffStyle"
        values={["unified", "split"]}
      />

      <OptionSelect
        label="Indicators"
        optionKey="diffIndicators"
        values={["classic", "bars", "none"]}
      />

      <OptionSwitch label="Background" optionKey="disableBackground" />

      <div className="w-px h-4 bg-border" />

      <OptionSelect
        label="Separators"
        optionKey="hunkSeparators"
        values={["simple", "metadata", "line-info"]}
      />

      <OptionSwitch label="Expand" optionKey="expandUnchanged" />

      <OptionNumber
        label="Lines"
        optionKey="expansionLineCount"
        min={1}
        max={200}
      />

      <div className="w-px h-4 bg-border" />

      <OptionSelect
        label="Diff"
        optionKey="lineDiffType"
        values={["word-alt", "word", "char", "none"]}
      />

      <OptionSwitch label="Hide Lines" optionKey="disableLineNumbers" />

      <OptionSelect
        label="Overflow"
        optionKey="overflow"
        values={["scroll", "wrap"]}
      />
    </div>
  );
}
