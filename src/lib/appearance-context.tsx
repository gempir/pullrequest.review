import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppChromeThemeId } from "@/lib/app-chrome-themes";
import { ensureDataCollectionsReady, readAppearanceSettingsRecord, writeAppearanceSettingsRecord } from "@/lib/data/query-collections";
import { DEFAULT_FONT_FAMILY, type FontFamilyValue, fontFamilyToCss } from "@/lib/font-options";

type AppearanceSettings = {
    appChromeThemeId: AppChromeThemeId;
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
    setAppChromeThemeId: (themeId: AppChromeThemeId) => void;
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

const defaultAppearance: AppearanceSettings = {
    appChromeThemeId: "system",
    sansFontFamily: "geist-sans",
    monospaceFontFamily: DEFAULT_FONT_FAMILY,
    sansFontSize: 15,
    sansLineHeight: 1.5,
    monospaceFontSize: 14,
    monospaceLineHeight: 1.45,
    treeUseCustomTypography: false,
    treeFontFamily: "geist-sans",
    treeFontSize: 13,
    treeLineHeight: 1.5,
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

function parseStoredSettings(raw: Record<string, unknown> | null): AppearanceSettings | null {
    if (!raw) return null;
    const hasStoredThemeId = raw.appChromeThemeId === "system" || raw.appChromeThemeId === "paper" || raw.appChromeThemeId === "graphite";
    const legacyThemeMode = raw.appThemeMode === "light" || raw.appThemeMode === "dark" || raw.appThemeMode === "auto" ? raw.appThemeMode : null;
    const appChromeThemeId: AppChromeThemeId = hasStoredThemeId
        ? (raw.appChromeThemeId as AppChromeThemeId)
        : legacyThemeMode === "light"
          ? "paper"
          : legacyThemeMode === "dark"
            ? "graphite"
            : defaultAppearance.appChromeThemeId;

    return {
        appChromeThemeId: legacyThemeMode === "auto" ? "system" : appChromeThemeId,
        sansFontFamily: (raw.sansFontFamily as FontFamilyValue) ?? defaultAppearance.sansFontFamily,
        monospaceFontFamily: (raw.monospaceFontFamily as FontFamilyValue) ?? defaultAppearance.monospaceFontFamily,
        sansFontSize: normalizeFontSize(Number(raw.sansFontSize ?? defaultAppearance.sansFontSize), 12, 20),
        sansLineHeight: normalizeLineHeight(Number(raw.sansLineHeight ?? defaultAppearance.sansLineHeight), 1, 2.2),
        monospaceFontSize: normalizeFontSize(Number(raw.monospaceFontSize ?? defaultAppearance.monospaceFontSize), 12, 20),
        monospaceLineHeight: normalizeLineHeight(Number(raw.monospaceLineHeight ?? defaultAppearance.monospaceLineHeight), 1, 2.2),
        treeUseCustomTypography: typeof raw.treeUseCustomTypography === "boolean" ? raw.treeUseCustomTypography : defaultAppearance.treeUseCustomTypography,
        treeFontFamily: (raw.treeFontFamily as FontFamilyValue) ?? defaultAppearance.treeFontFamily,
        treeFontSize: normalizeFontSize(Number(raw.treeFontSize ?? defaultAppearance.treeFontSize), 11, 18),
        treeLineHeight: normalizeLineHeight(Number(raw.treeLineHeight ?? defaultAppearance.treeLineHeight), 1, 2.2),
    };
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearance);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            await ensureDataCollectionsReady();
            if (cancelled) return;
            const parsed = parseStoredSettings(readAppearanceSettingsRecord());
            if (parsed) {
                setSettings(parsed);
            }
            setHydrated(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        writeAppearanceSettingsRecord(settings);
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
            const effectiveThemeId: Exclude<AppChromeThemeId, "system"> =
                settings.appChromeThemeId === "system" ? (media.matches ? "graphite" : "paper") : settings.appChromeThemeId;
            root.classList.remove("light", "dark");
            root.classList.add(effectiveThemeId === "paper" ? "light" : "dark");
            root.dataset.chromeTheme = effectiveThemeId;
        };

        applyTheme();
        const onChange = () => {
            if (settings.appChromeThemeId !== "system") return;
            applyTheme();
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [settings.appChromeThemeId]);

    const setAppChromeThemeId = useCallback((themeId: AppChromeThemeId) => {
        setSettings((prev) => ({ ...prev, appChromeThemeId: themeId }));
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
            setAppChromeThemeId,
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
            setAppChromeThemeId,
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
