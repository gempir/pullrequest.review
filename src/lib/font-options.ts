const CUSTOM_FONT_VALUE_PREFIX = "custom:" as const;
type CustomFontFamilyValue = `${typeof CUSTOM_FONT_VALUE_PREFIX}${string}`;

export type FontFamilyValue =
    | "geist-sans"
    | "jetbrains-mono"
    | "menlo"
    | "inter"
    | "manrope"
    | "sora"
    | "ui-sans"
    | "system-ui"
    | "geist-pixel"
    | "fira-code"
    | "cascadia-code"
    | "source-code-pro"
    | "ibm-plex-mono"
    | "geist-mono"
    | "ui-monospace"
    | "system-sans"
    | CustomFontFamilyValue;

export type FontOption = {
    value: FontFamilyValue;
    label: string;
    cssFamily: string;
};

const FONT_FAMILY_OPTIONS: ReadonlyArray<FontOption> = [
    {
        value: "geist-sans",
        label: "Geist Sans",
        cssFamily: '"Geist Sans", Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "jetbrains-mono",
        label: "JetBrains Mono",
        cssFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "menlo",
        label: "Menlo",
        cssFamily: 'Menlo, "Geist Mono", ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    {
        value: "inter",
        label: "Inter",
        cssFamily: 'Inter, "Geist Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "manrope",
        label: "Manrope",
        cssFamily: 'Manrope, Inter, "Geist Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "sora",
        label: "Sora",
        cssFamily: 'Sora, Inter, "Geist Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "ui-sans",
        label: "UI Sans",
        cssFamily: 'ui-sans-serif, "Geist Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "system-ui",
        label: "System UI",
        cssFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
        value: "geist-pixel",
        label: "Geist Pixel",
        cssFamily:
            '"Geist Pixel", "Geist Mono", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "fira-code",
        label: "Fira Code",
        cssFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "cascadia-code",
        label: "Cascadia Code",
        cssFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "source-code-pro",
        label: "Source Code Pro",
        cssFamily: '"Source Code Pro", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "ibm-plex-mono",
        label: "IBM Plex Mono",
        cssFamily: '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "geist-mono",
        label: "Geist Mono",
        cssFamily: '"Geist Mono", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Roboto Mono", Consolas, "Courier New", monospace',
    },
    {
        value: "ui-monospace",
        label: "UI Monospace",
        cssFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    {
        value: "system-sans",
        label: "System Sans",
        cssFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif',
    },
];

export const SANS_FONT_FAMILY_OPTIONS: ReadonlyArray<{
    value: FontFamilyValue;
    label: string;
}> = [
    { value: "geist-sans", label: "Geist Sans" },
    { value: "inter", label: "Inter" },
    { value: "manrope", label: "Manrope" },
    { value: "sora", label: "Sora" },
    { value: "ui-sans", label: "UI Sans" },
    { value: "system-ui", label: "System UI" },
    { value: "system-sans", label: "System Sans" },
];

export const MONO_FONT_FAMILY_OPTIONS: ReadonlyArray<{
    value: FontFamilyValue;
    label: string;
}> = [
    { value: "menlo", label: "Menlo" },
    { value: "jetbrains-mono", label: "JetBrains Mono" },
    { value: "fira-code", label: "Fira Code" },
    { value: "cascadia-code", label: "Cascadia Code" },
    { value: "source-code-pro", label: "Source Code Pro" },
    { value: "ibm-plex-mono", label: "IBM Plex Mono" },
    { value: "geist-mono", label: "Geist Mono" },
    { value: "ui-monospace", label: "UI Monospace" },
    { value: "geist-pixel", label: "Geist Pixel" },
];

export const DEFAULT_FONT_FAMILY: FontFamilyValue = "menlo";

export function makeCustomFontFamilyValue(name: string): FontFamilyValue {
    return `${CUSTOM_FONT_VALUE_PREFIX}${name}` as FontFamilyValue;
}

export function getCustomFontName(value: FontFamilyValue): string | null {
    return value.startsWith(CUSTOM_FONT_VALUE_PREFIX) ? value.slice(CUSTOM_FONT_VALUE_PREFIX.length) : null;
}

export function fontFamilyToCss(value: FontFamilyValue): string {
    const option = FONT_FAMILY_OPTIONS.find((item) => item.value === value);
    if (option) return option.cssFamily;
    const customName = getCustomFontName(value);
    if (customName) return `"${customName.replace(/"/g, '\\"')}", monospace`;
    return FONT_FAMILY_OPTIONS[0].cssFamily;
}

/** Bounds shared by the settings inputs and the stored-value clamps. */
export const FONT_SIZE_LIMITS = { min: 11, max: 20 } as const;
export const LINE_HEIGHT_LIMITS = { min: 1, max: 2.2 } as const;
