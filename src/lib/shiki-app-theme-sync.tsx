import { useEffect } from "react";
import { bundledThemes } from "shiki";
import { useDiffOptions } from "@/lib/diff-options-context";

type ShikiThemeLike = {
    type?: "light" | "dark" | string;
    colors?: Record<string, string | undefined>;
};

const APP_COLOR_VARIABLES = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--border",
    "--input",
    "--ring",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
    "--status-added",
    "--status-removed",
    "--status-modified",
    "--status-renamed",
] as const;

type Rgb = { r: number; g: number; b: number };

function clampByte(value: number) {
    return Math.min(255, Math.max(0, Math.round(value)));
}

function normalizeHexColor(value?: string) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith("#")) return null;
    if (trimmed.length === 4 || trimmed.length === 5) {
        const chars = trimmed.slice(1).split("");
        const expanded = chars.map((char) => `${char}${char}`).join("");
        return `#${expanded}`.slice(0, 7);
    }
    if (trimmed.length === 7 || trimmed.length === 9) {
        return trimmed.slice(0, 7);
    }
    return null;
}

function parseHexColor(value: string): Rgb | null {
    const normalized = normalizeHexColor(value);
    if (!normalized) return null;
    const hex = normalized.slice(1);
    const parsed = Number.parseInt(hex, 16);
    if (!Number.isFinite(parsed)) return null;
    return {
        r: (parsed >> 16) & 0xff,
        g: (parsed >> 8) & 0xff,
        b: parsed & 0xff,
    };
}

function toHex({ r, g, b }: Rgb) {
    const rr = clampByte(r).toString(16).padStart(2, "0");
    const gg = clampByte(g).toString(16).padStart(2, "0");
    const bb = clampByte(b).toString(16).padStart(2, "0");
    return `#${rr}${gg}${bb}`;
}

function mixColors(from: string, to: string, ratio: number) {
    const source = parseHexColor(from);
    const target = parseHexColor(to);
    if (!source) return to;
    if (!target) return from;
    const amount = Math.min(1, Math.max(0, ratio));
    return toHex({
        r: source.r + (target.r - source.r) * amount,
        g: source.g + (target.g - source.g) * amount,
        b: source.b + (target.b - source.b) * amount,
    });
}

function relativeLuminance(color: string) {
    const parsed = parseHexColor(color);
    if (!parsed) return 0;
    const channels = [parsed.r, parsed.g, parsed.b].map((channel) => {
        const scaled = channel / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function isDark(color: string) {
    return relativeLuminance(color) < 0.4;
}

function pickColor(colors: Record<string, string | undefined>, keys: readonly string[]) {
    for (const key of keys) {
        const normalized = normalizeHexColor(colors[key]);
        if (normalized) return normalized;
    }
    return null;
}

function buildPalette(theme: ShikiThemeLike) {
    const colors = theme.colors ?? {};
    const lightTheme = theme.type === "light";
    const background = pickColor(colors, ["editor.background", "sideBar.background", "activityBar.background"]) ?? (lightTheme ? "#f7f7f8" : "#0a0a0a");
    const foreground = pickColor(colors, ["editor.foreground", "foreground"]) ?? (lightTheme ? "#141414" : "#e0e0e0");
    const selection =
        pickColor(colors, ["editor.selectionBackground", "editor.lineHighlightBackground", "focusBorder"]) ?? mixColors(background, foreground, 0.2);
    const darkBackground = isDark(background);
    const card = mixColors(background, foreground, darkBackground ? 0.07 : 0.04);
    const secondary = mixColors(background, foreground, darkBackground ? 0.11 : 0.08);
    const muted = mixColors(background, foreground, darkBackground ? 0.06 : 0.05);
    const mutedForeground = mixColors(foreground, background, darkBackground ? 0.45 : 0.5);
    const accent = mixColors(selection, background, darkBackground ? 0.45 : 0.3);
    const border = mixColors(background, foreground, darkBackground ? 0.2 : 0.22);
    const ring = mixColors(selection, foreground, 0.25);
    const sidebar = mixColors(background, foreground, darkBackground ? 0.05 : 0.03);
    const sidebarAccent = mixColors(sidebar, foreground, darkBackground ? 0.14 : 0.1);

    return {
        "--background": background,
        "--foreground": foreground,
        "--card": card,
        "--card-foreground": foreground,
        "--popover": card,
        "--popover-foreground": foreground,
        "--primary": foreground,
        "--primary-foreground": background,
        "--secondary": secondary,
        "--secondary-foreground": foreground,
        "--muted": muted,
        "--muted-foreground": mutedForeground,
        "--accent": accent,
        "--accent-foreground": foreground,
        "--border": border,
        "--input": border,
        "--ring": ring,
        "--sidebar": sidebar,
        "--sidebar-foreground": foreground,
        "--sidebar-primary": foreground,
        "--sidebar-primary-foreground": background,
        "--sidebar-accent": sidebarAccent,
        "--sidebar-accent-foreground": foreground,
        "--sidebar-border": border,
        "--sidebar-ring": ring,
        "--status-added": pickColor(colors, ["gitDecoration.addedResourceForeground", "terminal.ansiGreen"]) ?? "#22c55e",
        "--status-removed": pickColor(colors, ["gitDecoration.deletedResourceForeground", "terminal.ansiRed"]) ?? "#ef4444",
        "--status-modified": pickColor(colors, ["gitDecoration.modifiedResourceForeground", "terminal.ansiYellow"]) ?? "#eab308",
        "--status-renamed": pickColor(colors, ["gitDecoration.renamedResourceForeground", "terminal.ansiBlue"]) ?? "#3b82f6",
    } as const;
}

function clearPalette(root: HTMLElement) {
    for (const variableName of APP_COLOR_VARIABLES) {
        root.style.removeProperty(variableName);
    }
}

export function ShikiAppThemeSync() {
    const { options } = useDiffOptions();

    useEffect(() => {
        if (typeof window === "undefined") return;
        const root = window.document.documentElement;
        let cancelled = false;

        const loader = bundledThemes[options.theme as keyof typeof bundledThemes];
        if (!loader) {
            clearPalette(root);
            return;
        }

        void loader()
            .then((module) => {
                if (cancelled) return;
                const palette = buildPalette(module.default as ShikiThemeLike);
                for (const [key, value] of Object.entries(palette)) {
                    root.style.setProperty(key, value);
                }
            })
            .catch(() => {
                if (cancelled) return;
                clearPalette(root);
            });

        return () => {
            cancelled = true;
        };
    }, [options.theme]);

    return null;
}
