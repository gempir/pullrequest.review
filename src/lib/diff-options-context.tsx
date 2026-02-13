import type { BaseDiffOptions } from "@pierre/diffs";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { registerExtendedDiffThemes } from "@/lib/diff-theme-registration";
import { DEFAULT_DIFF_THEME, type DiffTheme } from "@/lib/diff-themes";
import { DEFAULT_FONT_FAMILY, type FontFamilyValue } from "@/lib/font-options";

export interface DiffOptions {
  theme: DiffTheme;
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
}

const STORAGE_KEY = "pr_review_diff_options";

const defaultOptions: DiffOptions = {
  theme: DEFAULT_DIFF_THEME,
  diffFontFamily: DEFAULT_FONT_FAMILY,
  diffFontSize: 13,
  diffLineHeight: 1.45,
  diffStyle: "unified",
  diffIndicators: "none",
  disableBackground: false,
  hunkSeparators: "simple",
  expandUnchanged: false,
  expansionLineCount: 20,
  collapsedContextThreshold: 5,
  lineDiffType: "word",
  disableLineNumbers: false,
  overflow: "scroll",
  collapseViewedFilesByDefault: true,
};

interface DiffOptionsContextType {
  options: DiffOptions;
  setOption: <K extends keyof DiffOptions>(
    key: K,
    value: DiffOptions[K],
  ) => void;
}

const DiffOptionsContext = createContext<DiffOptionsContextType | null>(null);

function normalizeDiffFontSize(value: number) {
  if (!Number.isFinite(value)) return 13;
  return Math.min(20, Math.max(10, Math.round(value)));
}

function normalizeDiffLineHeight(value: number) {
  if (!Number.isFinite(value)) return 1.45;
  const clamped = Math.min(2.2, Math.max(1, value));
  return Number(clamped.toFixed(2));
}

function parseStoredOptions(raw: string | null): DiffOptions | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DiffOptions>;
    return {
      ...defaultOptions,
      ...parsed,
      diffFontFamily:
        (parsed.diffFontFamily as FontFamilyValue) ??
        defaultOptions.diffFontFamily,
      diffFontSize: normalizeDiffFontSize(
        Number(parsed.diffFontSize ?? defaultOptions.diffFontSize),
      ),
      diffLineHeight: normalizeDiffLineHeight(
        Number(parsed.diffLineHeight ?? defaultOptions.diffLineHeight),
      ),
    };
  } catch {
    return null;
  }
}

export function DiffOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DiffOptions>(defaultOptions);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    registerExtendedDiffThemes();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseStoredOptions(window.localStorage.getItem(STORAGE_KEY));
    if (parsed) {
      setOptions(parsed);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [hydrated, options]);

  const setOption = useCallback(
    <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
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
    },
    [],
  );

  const value = useMemo(() => ({ options, setOption }), [options, setOption]);

  return (
    <DiffOptionsContext.Provider value={value}>
      {children}
    </DiffOptionsContext.Provider>
  );
}

export function useDiffOptions() {
  const ctx = useContext(DiffOptionsContext);
  if (!ctx)
    throw new Error("useDiffOptions must be used within DiffOptionsProvider");
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
