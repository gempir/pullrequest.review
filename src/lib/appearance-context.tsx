import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_FONT_FAMILY,
  type FontFamilyValue,
  fontFamilyToCss,
} from "@/lib/font-options";

export type AppThemeMode = "auto" | "light" | "dark";

type AppearanceSettings = {
  appThemeMode: AppThemeMode;
  pageFontFamily: FontFamilyValue;
  pageFontSize: number;
  pageLineHeight: number;
  treeFontFamily: FontFamilyValue;
  treeFontSize: number;
  treeLineHeight: number;
};

type AppearanceContextValue = AppearanceSettings & {
  setAppThemeMode: (mode: AppThemeMode) => void;
  setPageFontFamily: (font: FontFamilyValue) => void;
  setPageFontSize: (size: number) => void;
  setPageLineHeight: (lineHeight: number) => void;
  setTreeFontFamily: (font: FontFamilyValue) => void;
  setTreeFontSize: (size: number) => void;
  setTreeLineHeight: (lineHeight: number) => void;
};

const STORAGE_KEY = "pr_review_appearance";

const defaultAppearance: AppearanceSettings = {
  appThemeMode: "auto",
  pageFontFamily: DEFAULT_FONT_FAMILY,
  pageFontSize: 13,
  pageLineHeight: 1.5,
  treeFontFamily: DEFAULT_FONT_FAMILY,
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

function parseStoredSettings(raw: string | null): AppearanceSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    const appThemeMode =
      parsed.appThemeMode === "light" ||
      parsed.appThemeMode === "dark" ||
      parsed.appThemeMode === "auto"
        ? parsed.appThemeMode
        : defaultAppearance.appThemeMode;
    return {
      appThemeMode,
      pageFontFamily:
        (parsed.pageFontFamily as FontFamilyValue) ??
        defaultAppearance.pageFontFamily,
      pageFontSize: normalizeFontSize(
        Number(parsed.pageFontSize ?? defaultAppearance.pageFontSize),
        11,
        20,
      ),
      pageLineHeight: normalizeLineHeight(
        Number(parsed.pageLineHeight ?? defaultAppearance.pageLineHeight),
        1,
        2.2,
      ),
      treeFontFamily:
        (parsed.treeFontFamily as FontFamilyValue) ??
        defaultAppearance.treeFontFamily,
      treeFontSize: normalizeFontSize(
        Number(parsed.treeFontSize ?? defaultAppearance.treeFontSize),
        10,
        18,
      ),
      treeLineHeight: normalizeLineHeight(
        Number(parsed.treeLineHeight ?? defaultAppearance.treeLineHeight),
        1,
        2.2,
      ),
    };
  } catch {
    return null;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] =
    useState<AppearanceSettings>(defaultAppearance);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseStoredSettings(
      window.localStorage.getItem(STORAGE_KEY),
    );
    if (parsed) {
      setSettings(parsed);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    root.style.setProperty(
      "--app-font-family",
      fontFamilyToCss(settings.pageFontFamily),
    );
    root.style.setProperty("--app-font-size", `${settings.pageFontSize}px`);
    root.style.setProperty(
      "--app-line-height",
      String(settings.pageLineHeight),
    );
    root.style.setProperty(
      "--tree-font-family",
      fontFamilyToCss(settings.treeFontFamily),
    );
    root.style.setProperty("--tree-font-size", `${settings.treeFontSize}px`);
    root.style.setProperty(
      "--tree-line-height",
      String(settings.treeLineHeight),
    );
  }, [
    settings.pageFontFamily,
    settings.pageFontSize,
    settings.pageLineHeight,
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
  const setPageFontFamily = useCallback((font: FontFamilyValue) => {
    setSettings((prev) => ({ ...prev, pageFontFamily: font }));
  }, []);
  const setPageFontSize = useCallback((size: number) => {
    setSettings((prev) => ({
      ...prev,
      pageFontSize: normalizeFontSize(size, 11, 20),
    }));
  }, []);
  const setPageLineHeight = useCallback((lineHeight: number) => {
    setSettings((prev) => ({
      ...prev,
      pageLineHeight: normalizeLineHeight(lineHeight, 1, 2.2),
    }));
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

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...settings,
      setAppThemeMode,
      setPageFontFamily,
      setPageFontSize,
      setPageLineHeight,
      setTreeFontFamily,
      setTreeFontSize,
      setTreeLineHeight,
    }),
    [
      settings,
      setAppThemeMode,
      setPageFontFamily,
      setPageFontSize,
      setPageLineHeight,
      setTreeFontFamily,
      setTreeFontSize,
      setTreeLineHeight,
    ],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
