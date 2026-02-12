export type FontFamilyValue =
  | "jetbrains-mono"
  | "fira-code"
  | "cascadia-code"
  | "source-code-pro"
  | "ibm-plex-mono"
  | "geist-mono"
  | "ui-monospace"
  | "system-sans";

export const FONT_FAMILY_OPTIONS: ReadonlyArray<{
  value: FontFamilyValue;
  label: string;
  cssFamily: string;
}> = [
  {
    value: "jetbrains-mono",
    label: "JetBrains Mono",
    cssFamily:
      '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "fira-code",
    label: "Fira Code",
    cssFamily:
      '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "cascadia-code",
    label: "Cascadia Code",
    cssFamily:
      '"Cascadia Code", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "source-code-pro",
    label: "Source Code Pro",
    cssFamily:
      '"Source Code Pro", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "ibm-plex-mono",
    label: "IBM Plex Mono",
    cssFamily:
      '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "geist-mono",
    label: "Geist Mono",
    cssFamily:
      '"Geist Mono", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
  },
  {
    value: "ui-monospace",
    label: "UI Monospace",
    cssFamily:
      'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  {
    value: "system-sans",
    label: "System Sans",
    cssFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif',
  },
];

export const DEFAULT_FONT_FAMILY: FontFamilyValue = "jetbrains-mono";

export function fontFamilyToCss(value: FontFamilyValue): string {
  const option = FONT_FAMILY_OPTIONS.find((item) => item.value === value);
  return option?.cssFamily ?? FONT_FAMILY_OPTIONS[0].cssFamily;
}
