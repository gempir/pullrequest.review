import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_FONT_FAMILY, type FontFamilyValue, fontFamilyToCss } from "@/lib/font-options";
import { makeVersionedStorageKey, readLocalStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

export type AppThemeMode = "auto" | "light" | "dark";

type AppearanceSettings = {
    appThemeMode: AppThemeMode;
    sansFontFamily: FontFamilyValue;
    monospaceFontFamily: FontFamilyValue;
    sansFontSize: number;
    sansLineHeight: number;
    monospaceFontSize: number;
    monospaceLineHeight: number;
    treeUseCustomTypography: boolean;
    treeFontFamily: FontFamilyValue;
    treeFontSize: number;
    treeLineHeight: number;
};

type AppearanceContextValue = AppearanceSettings & {
    setAppThemeMode: (mode: AppThemeMode) => void;
    setSansFontFamily: (font: FontFamilyValue) => void;
    setMonospaceFontFamily: (font: FontFamilyValue) => void;
    setSansFontSize: (size: number) => void;
    setSansLineHeight: (lineHeight: number) => void;
    setMonospaceFontSize: (size: number) => void;
    setMonospaceLineHeight: (lineHeight: number) => void;
    setTreeUseCustomTypography: (enabled: boolean) => void;
    setTreeFontFamily: (font: FontFamilyValue) => void;
    setTreeFontSize: (size: number) => void;
    setTreeLineHeight: (lineHeight: number) => void;
    resetAppearance: () => void;
};

const STORAGE_KEY_BASE = "pr_review_appearance";
const STORAGE_KEY = makeVersionedStorageKey(STORAGE_KEY_BASE, 2);

const defaultAppearance: AppearanceSettings = {
    appThemeMode: "auto",
    sansFontFamily: "geist-sans",
    monospaceFontFamily: DEFAULT_FONT_FAMILY,
    sansFontSize: 14,
    sansLineHeight: 1.25,
    monospaceFontSize: 13,
    monospaceLineHeight: 1.25,
    treeUseCustomTypography: false,
    treeFontFamily: "geist-sans",
    treeFontSize: 12,
    treeLineHeight: 1.45,
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function normalizeFontSize(size: number, min: number, max: number) {
    if (!Number.isFinite(size)) return min;
    return Math.min(max, Math.max(min, Math.round(size)));
}

function normalizeLineHeight(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    const clamped = Math.min(max, Math.max(min, value));
    return Number(clamped.toFixed(2));
}

function deriveTreeFontSize(treeUseCustomTypography: boolean, treeFontSize: number, sansFontSize: number) {
    if (treeUseCustomTypography) {
        return treeFontSize;
    }
    const reduced = sansFontSize - 1;
    return normalizeFontSize(reduced, 10, 18);
}

function deriveTreeLineHeight(treeUseCustomTypography: boolean, treeLineHeight: number, sansLineHeight: number) {
    if (treeUseCustomTypography) {
        return treeLineHeight;
    }
    const reduced = sansLineHeight - 0.05;
    return normalizeLineHeight(reduced, 1, 2.2);
}

function parseStoredSettings(raw: string | null): AppearanceSettings | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
        const appThemeMode =
            parsed.appThemeMode === "light" || parsed.appThemeMode === "dark" || parsed.appThemeMode === "auto"
                ? parsed.appThemeMode
                : defaultAppearance.appThemeMode;

        return {
            appThemeMode,
            sansFontFamily: (parsed.sansFontFamily as FontFamilyValue) ?? defaultAppearance.sansFontFamily,
            monospaceFontFamily: (parsed.monospaceFontFamily as FontFamilyValue) ?? defaultAppearance.monospaceFontFamily,
            sansFontSize: normalizeFontSize(Number(parsed.sansFontSize ?? defaultAppearance.sansFontSize), 11, 20),
            sansLineHeight: normalizeLineHeight(Number(parsed.sansLineHeight ?? defaultAppearance.sansLineHeight), 1, 2.2),
            monospaceFontSize: normalizeFontSize(Number(parsed.monospaceFontSize ?? defaultAppearance.monospaceFontSize), 11, 20),
            monospaceLineHeight: normalizeLineHeight(Number(parsed.monospaceLineHeight ?? defaultAppearance.monospaceLineHeight), 1, 2.2),
            treeUseCustomTypography:
                typeof parsed.treeUseCustomTypography === "boolean" ? parsed.treeUseCustomTypography : defaultAppearance.treeUseCustomTypography,
            treeFontFamily: (parsed.treeFontFamily as FontFamilyValue) ?? defaultAppearance.treeFontFamily,
            treeFontSize: normalizeFontSize(Number(parsed.treeFontSize ?? defaultAppearance.treeFontSize), 10, 18),
            treeLineHeight: normalizeLineHeight(Number(parsed.treeLineHeight ?? defaultAppearance.treeLineHeight), 1, 2.2),
        };
    } catch {
        return null;
    }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearance);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const parsed = parseStoredSettings(readLocalStorageValue(STORAGE_KEY));
        if (parsed) {
            setSettings(parsed);
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        writeLocalStorageValue(STORAGE_KEY, JSON.stringify(settings));
    }, [settings, hydrated]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const root = window.document.documentElement;
        root.style.setProperty("--app-font-family", fontFamilyToCss(settings.sansFontFamily));
        root.style.setProperty("--mono-font-family", fontFamilyToCss(settings.monospaceFontFamily));
        root.style.setProperty("--sans-font-size", `${settings.sansFontSize}px`);
        root.style.setProperty("--sans-line-height", String(settings.sansLineHeight));
        root.style.setProperty("--mono-font-size", `${settings.monospaceFontSize}px`);
        root.style.setProperty("--mono-line-height", String(settings.monospaceLineHeight));
        // Legacy aliases retained to avoid stale references.
        root.style.setProperty("--app-font-size", `${settings.sansFontSize}px`);
        root.style.setProperty("--app-line-height", String(settings.sansLineHeight));
        const resolvedTreeFontFamily = fontFamilyToCss(settings.treeUseCustomTypography ? settings.treeFontFamily : settings.sansFontFamily);
        const resolvedTreeFontSize = deriveTreeFontSize(settings.treeUseCustomTypography, settings.treeFontSize, settings.sansFontSize);
        const resolvedTreeLineHeight = deriveTreeLineHeight(settings.treeUseCustomTypography, settings.treeLineHeight, settings.sansLineHeight);
        root.style.setProperty("--tree-font-family", resolvedTreeFontFamily);
        root.style.setProperty("--comment-font-family", fontFamilyToCss(settings.sansFontFamily));
        root.style.setProperty("--tree-font-size", `${resolvedTreeFontSize}px`);
        root.style.setProperty("--tree-line-height", String(resolvedTreeLineHeight));
    }, [
        settings.sansFontFamily,
        settings.monospaceFontFamily,
        settings.sansFontSize,
        settings.sansLineHeight,
        settings.monospaceFontSize,
        settings.monospaceLineHeight,
        settings.treeUseCustomTypography,
        settings.treeFontFamily,
        settings.treeFontSize,
        settings.treeLineHeight,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const root = window.document.documentElement;
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        const applyTheme = () => {
            root.classList.remove("light", "dark");
            if (settings.appThemeMode === "light") {
                root.classList.add("light");
                return;
            }
            if (settings.appThemeMode === "dark") {
                root.classList.add("dark");
                return;
            }
            root.classList.add(media.matches ? "dark" : "light");
        };

        applyTheme();
        const onChange = () => {
            if (settings.appThemeMode !== "auto") return;
            applyTheme();
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [settings.appThemeMode]);

    const setAppThemeMode = useCallback((mode: AppThemeMode) => {
        setSettings((prev) => ({ ...prev, appThemeMode: mode }));
    }, []);
    const setSansFontFamily = useCallback((font: FontFamilyValue) => {
        setSettings((prev) => ({ ...prev, sansFontFamily: font }));
    }, []);
    const setMonospaceFontFamily = useCallback((font: FontFamilyValue) => {
        setSettings((prev) => ({ ...prev, monospaceFontFamily: font }));
    }, []);
    const setSansFontSize = useCallback((size: number) => {
        setSettings((prev) => ({
            ...prev,
            sansFontSize: normalizeFontSize(size, 11, 20),
        }));
    }, []);
    const setSansLineHeight = useCallback((lineHeight: number) => {
        setSettings((prev) => ({
            ...prev,
            sansLineHeight: normalizeLineHeight(lineHeight, 1, 2.2),
        }));
    }, []);
    const setMonospaceFontSize = useCallback((size: number) => {
        setSettings((prev) => ({
            ...prev,
            monospaceFontSize: normalizeFontSize(size, 11, 20),
        }));
    }, []);
    const setMonospaceLineHeight = useCallback((lineHeight: number) => {
        setSettings((prev) => ({
            ...prev,
            monospaceLineHeight: normalizeLineHeight(lineHeight, 1, 2.2),
        }));
    }, []);
    const setTreeUseCustomTypography = useCallback((enabled: boolean) => {
        setSettings((prev) => ({ ...prev, treeUseCustomTypography: enabled }));
    }, []);
    const setTreeFontFamily = useCallback((font: FontFamilyValue) => {
        setSettings((prev) => ({ ...prev, treeFontFamily: font }));
    }, []);
    const setTreeFontSize = useCallback((size: number) => {
        setSettings((prev) => ({
            ...prev,
            treeFontSize: normalizeFontSize(size, 10, 18),
        }));
    }, []);
    const setTreeLineHeight = useCallback((lineHeight: number) => {
        setSettings((prev) => ({
            ...prev,
            treeLineHeight: normalizeLineHeight(lineHeight, 1, 2.2),
        }));
    }, []);
    const resetAppearance = useCallback(() => {
        setSettings(() => ({ ...defaultAppearance }));
    }, []);

    const value = useMemo<AppearanceContextValue>(
        () => ({
            ...settings,
            setAppThemeMode,
            setSansFontFamily,
            setMonospaceFontFamily,
            setSansFontSize,
            setSansLineHeight,
            setMonospaceFontSize,
            setMonospaceLineHeight,
            setTreeUseCustomTypography,
            setTreeFontFamily,
            setTreeFontSize,
            setTreeLineHeight,
            resetAppearance,
        }),
        [
            settings,
            setAppThemeMode,
            setSansFontFamily,
            setMonospaceFontFamily,
            setSansFontSize,
            setSansLineHeight,
            setMonospaceFontSize,
            setMonospaceLineHeight,
            setTreeUseCustomTypography,
            setTreeFontFamily,
            setTreeFontSize,
            setTreeLineHeight,
            resetAppearance,
        ],
    );

    return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
    const ctx = useContext(AppearanceContext);
    if (!ctx) {
        throw new Error("useAppearance must be used within AppearanceProvider");
    }
    return ctx;
}
