import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { registerExtendedDiffThemes } from "@/lib/diff-theme-registration";
import { DEFAULT_DIFF_THEME, type DiffTheme } from "@/lib/diff-themes";
import { ensureStorageReady, readSetting, writeSetting } from "@/lib/storage";

export interface DiffOptions {
    followSystemTheme: boolean;
    theme: DiffTheme;
    diffStyle: "unified" | "split";
    expandUnchanged: boolean;
    expansionLineCount: number;
    overflow: "scroll" | "wrap";
    collapseViewedFilesByDefault: boolean;
    autoMarkViewedFiles: boolean;
}

const defaultOptions: DiffOptions = {
    followSystemTheme: true,
    theme: DEFAULT_DIFF_THEME,
    diffStyle: "unified",
    expandUnchanged: false,
    expansionLineCount: 100,
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
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "pierre-dark" : "pierre-light";
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
            await ensureStorageReady();
            if (cancelled) return;
            const parsed = parseStoredOptions(readSetting("diff-options"));
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
        writeSetting("diff-options", options);
    }, [hydrated, options]);

    useEffect(() => {
        if (!options.followSystemTheme) return;
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const apply = (isDark: boolean) => {
            setOptions((prev) => {
                if (!prev.followSystemTheme) return prev;
                const nextTheme = isDark ? "pierre-dark" : "pierre-light";
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
        setOptions((prev) => ({ ...prev, [key]: value }));
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
