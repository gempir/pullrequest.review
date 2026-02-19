import type { BaseDiffOptions } from "@pierre/diffs";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureDataCollectionsReady, readDiffOptionsRecord, writeDiffOptionsRecord } from "@/lib/data/query-collections";
import { registerExtendedDiffThemes } from "@/lib/diff-theme-registration";
import { DEFAULT_DIFF_THEME, type DiffTheme } from "@/lib/diff-themes";
import { DEFAULT_FONT_FAMILY, type FontFamilyValue } from "@/lib/font-options";

export interface DiffOptions {
    followSystemTheme: boolean;
    theme: DiffTheme;
    diffUseCustomTypography: boolean;
    diffFontFamily: FontFamilyValue;
    diffFontSize: number;
    diffLineHeight: number;
    diffStyle: "unified" | "split";
    diffIndicators: "classic" | "bars" | "none";
    disableBackground: boolean;
    hunkSeparators: "simple" | "metadata" | "line-info";
    expandUnchanged: boolean;
    expansionLineCount: number;
    collapsedContextThreshold: number;
    lineDiffType: "word-alt" | "word" | "char" | "none";
    disableLineNumbers: boolean;
    overflow: "scroll" | "wrap";
    collapseViewedFilesByDefault: boolean;
    autoMarkViewedFiles: boolean;
}

const defaultOptions: DiffOptions = {
    followSystemTheme: true,
    theme: DEFAULT_DIFF_THEME,
    diffUseCustomTypography: false,
    diffFontFamily: DEFAULT_FONT_FAMILY,
    diffFontSize: 13,
    diffLineHeight: 1.45,
    diffStyle: "unified",
    diffIndicators: "none",
    disableBackground: false,
    hunkSeparators: "simple",
    expandUnchanged: false,
    expansionLineCount: 100,
    collapsedContextThreshold: 5,
    lineDiffType: "word",
    disableLineNumbers: false,
    overflow: "scroll",
    collapseViewedFilesByDefault: false,
    autoMarkViewedFiles: true,
};

interface DiffOptionsContextType {
    options: DiffOptions;
    setOption: <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => void;
    resetOptions: () => void;
}

const DiffOptionsContext = createContext<DiffOptionsContextType | null>(null);

function getBrowserPreferredTheme(): DiffTheme {
    if (typeof window === "undefined") return DEFAULT_DIFF_THEME;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "github-dark-default" : "github-light-default";
}

function normalizeDiffFontSize(value: number) {
    if (!Number.isFinite(value)) return 13;
    return Math.min(20, Math.max(10, Math.round(value)));
}

function normalizeDiffLineHeight(value: number) {
    if (!Number.isFinite(value)) return 1.45;
    const clamped = Math.min(2.2, Math.max(1, value));
    return Number(clamped.toFixed(2));
}

function parseStoredOptions(raw: Record<string, unknown> | null): DiffOptions | null {
    if (!raw) return null;
    const parsed = raw as Partial<DiffOptions>;
    const parsedTheme = typeof parsed.theme === "string" ? parsed.theme : getBrowserPreferredTheme();
    return {
        ...defaultOptions,
        ...parsed,
        theme: parsedTheme,
        followSystemTheme: typeof parsed.followSystemTheme === "boolean" ? parsed.followSystemTheme : defaultOptions.followSystemTheme,
        diffFontFamily: (parsed.diffFontFamily as FontFamilyValue) ?? defaultOptions.diffFontFamily,
        diffFontSize: normalizeDiffFontSize(Number(parsed.diffFontSize ?? defaultOptions.diffFontSize)),
        diffLineHeight: normalizeDiffLineHeight(Number(parsed.diffLineHeight ?? defaultOptions.diffLineHeight)),
    };
}

export function DiffOptionsProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<DiffOptions>(() => {
        return {
            ...defaultOptions,
            theme: getBrowserPreferredTheme(),
        };
    });
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        registerExtendedDiffThemes();
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            await ensureDataCollectionsReady();
            if (cancelled) return;
            const parsed = parseStoredOptions(readDiffOptionsRecord());
            if (parsed) {
                setOptions(parsed);
            }
            setHydrated(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        writeDiffOptionsRecord(options);
    }, [hydrated, options]);

    useEffect(() => {
        if (typeof window === "undefined" || !options.followSystemTheme) return;
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const apply = (isDark: boolean) => {
            setOptions((prev) => {
                if (!prev.followSystemTheme) return prev;
                const nextTheme = isDark ? "github-dark-default" : "github-light-default";
                if (prev.theme === nextTheme) return prev;
                return { ...prev, theme: nextTheme };
            });
        };
        apply(media.matches);
        const onChange = (event: MediaQueryListEvent) => {
            apply(event.matches);
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [options.followSystemTheme]);

    const setOption = useCallback(<K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
        setOptions((prev) => {
            if (key === "diffFontSize") {
                return {
                    ...prev,
                    diffFontSize: normalizeDiffFontSize(Number(value)),
                };
            }
            if (key === "diffLineHeight") {
                return {
                    ...prev,
                    diffLineHeight: normalizeDiffLineHeight(Number(value)),
                };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const resetOptions = useCallback(() => {
        setOptions(() => ({
            ...defaultOptions,
            theme: getBrowserPreferredTheme(),
        }));
    }, []);

    const value = useMemo(() => ({ options, setOption, resetOptions }), [options, setOption, resetOptions]);

    return <DiffOptionsContext.Provider value={value}>{children}</DiffOptionsContext.Provider>;
}

export function useDiffOptions() {
    const ctx = useContext(DiffOptionsContext);
    if (!ctx) throw new Error("useDiffOptions must be used within DiffOptionsProvider");
    return ctx;
}

export function toLibraryOptions(opts: DiffOptions): BaseDiffOptions {
    return {
        theme: opts.theme,
        diffStyle: opts.diffStyle,
        diffIndicators: opts.diffIndicators,
        disableBackground: opts.disableBackground,
        hunkSeparators: opts.hunkSeparators,
        expandUnchanged: opts.expandUnchanged,
        expansionLineCount: opts.expansionLineCount,
        lineDiffType: opts.lineDiffType,
        disableLineNumbers: opts.disableLineNumbers,
        overflow: opts.overflow,
    };
}
