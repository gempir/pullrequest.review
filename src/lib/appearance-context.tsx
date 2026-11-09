import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_FONT_FAMILY, FONT_SIZE_LIMITS, type FontFamilyValue, fontFamilyToCss, LINE_HEIGHT_LIMITS } from "@/lib/font-options";
import { ensureStorageReady, readSetting, writeSetting } from "@/lib/storage";

type AppThemeMode = "auto" | "light" | "dark";

type AppearanceSettings = {
    appThemeMode: AppThemeMode;
    sansFontFamily: FontFamilyValue;
    monospaceFontFamily: FontFamilyValue;
    sansFontSize: number;
    sansLineHeight: number;
    monospaceFontSize: number;
    monospaceLineHeight: number;
};

type AppearanceContextValue = AppearanceSettings & {
    setAppThemeMode: (mode: AppThemeMode) => void;
    setSansFontFamily: (font: FontFamilyValue) => void;
    setMonospaceFontFamily: (font: FontFamilyValue) => void;
    setSansFontSize: (size: number) => void;
    setSansLineHeight: (lineHeight: number) => void;
    setMonospaceFontSize: (size: number) => void;
    setMonospaceLineHeight: (lineHeight: number) => void;
    resetAppearance: () => void;
};

const defaultAppearance: AppearanceSettings = {
    appThemeMode: "auto",
    sansFontFamily: "geist-sans",
    monospaceFontFamily: DEFAULT_FONT_FAMILY,
    sansFontSize: 14,
    sansLineHeight: 1.25,
    monospaceFontSize: 13,
    monospaceLineHeight: 1.25,
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

function parseStoredSettings(raw: Record<string, unknown> | null): AppearanceSettings | null {
    if (!raw) return null;
    const appThemeMode =
        raw.appThemeMode === "light" || raw.appThemeMode === "dark" || raw.appThemeMode === "auto" ? raw.appThemeMode : defaultAppearance.appThemeMode;

    return {
        appThemeMode,
        sansFontFamily: (raw.sansFontFamily as FontFamilyValue) ?? defaultAppearance.sansFontFamily,
        monospaceFontFamily: (raw.monospaceFontFamily as FontFamilyValue) ?? defaultAppearance.monospaceFontFamily,
        sansFontSize: normalizeFontSize(Number(raw.sansFontSize ?? defaultAppearance.sansFontSize), FONT_SIZE_LIMITS.min, FONT_SIZE_LIMITS.max),
        sansLineHeight: normalizeLineHeight(Number(raw.sansLineHeight ?? defaultAppearance.sansLineHeight), LINE_HEIGHT_LIMITS.min, LINE_HEIGHT_LIMITS.max),
        monospaceFontSize: normalizeFontSize(Number(raw.monospaceFontSize ?? defaultAppearance.monospaceFontSize), FONT_SIZE_LIMITS.min, FONT_SIZE_LIMITS.max),
        monospaceLineHeight: normalizeLineHeight(
            Number(raw.monospaceLineHeight ?? defaultAppearance.monospaceLineHeight),
            LINE_HEIGHT_LIMITS.min,
            LINE_HEIGHT_LIMITS.max,
        ),
    };
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearance);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            await ensureStorageReady();
            if (cancelled) return;
            const parsed = parseStoredSettings(readSetting("appearance"));
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
        writeSetting("appearance", settings);
    }, [settings, hydrated]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.style.setProperty("--app-font-family", fontFamilyToCss(settings.sansFontFamily));
        root.style.setProperty("--mono-font-family", fontFamilyToCss(settings.monospaceFontFamily));
        root.style.setProperty("--sans-font-size", `${settings.sansFontSize}px`);
        root.style.setProperty("--sans-line-height", String(settings.sansLineHeight));
        root.style.setProperty("--mono-font-size", `${settings.monospaceFontSize}px`);
        root.style.setProperty("--mono-line-height", String(settings.monospaceLineHeight));
        root.style.setProperty("--app-font-size", `${settings.sansFontSize}px`);
        root.style.setProperty("--app-line-height", String(settings.sansLineHeight));
        root.style.setProperty("--tree-font-family", fontFamilyToCss(settings.sansFontFamily));
        root.style.setProperty("--comment-font-family", fontFamilyToCss(settings.sansFontFamily));
        root.style.setProperty("--tree-font-size", `${normalizeFontSize(settings.sansFontSize - 2, 10, 18)}px`);
        root.style.setProperty("--tree-line-height", String(normalizeLineHeight(settings.sansLineHeight - 0.1, 1, 2.2)));
    }, [
        settings.sansFontFamily,
        settings.monospaceFontFamily,
        settings.sansFontSize,
        settings.sansLineHeight,
        settings.monospaceFontSize,
        settings.monospaceLineHeight,
    ]);

    useEffect(() => {
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
            sansFontSize: normalizeFontSize(size, FONT_SIZE_LIMITS.min, FONT_SIZE_LIMITS.max),
        }));
    }, []);
    const setSansLineHeight = useCallback((lineHeight: number) => {
        setSettings((prev) => ({
            ...prev,
            sansLineHeight: normalizeLineHeight(lineHeight, LINE_HEIGHT_LIMITS.min, LINE_HEIGHT_LIMITS.max),
        }));
    }, []);
    const setMonospaceFontSize = useCallback((size: number) => {
        setSettings((prev) => ({
            ...prev,
            monospaceFontSize: normalizeFontSize(size, FONT_SIZE_LIMITS.min, FONT_SIZE_LIMITS.max),
        }));
    }, []);
    const setMonospaceLineHeight = useCallback((lineHeight: number) => {
        setSettings((prev) => ({
            ...prev,
            monospaceLineHeight: normalizeLineHeight(lineHeight, LINE_HEIGHT_LIMITS.min, LINE_HEIGHT_LIMITS.max),
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
