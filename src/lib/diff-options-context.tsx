import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BaseDiffOptions } from "@pierre/diffs";
import { DEFAULT_DIFF_THEME, type DiffTheme } from "@/lib/diff-themes";

export interface DiffOptions {
  theme: DiffTheme;
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
}

const defaultOptions: DiffOptions = {
  theme: DEFAULT_DIFF_THEME,
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
};

interface DiffOptionsContextType {
  options: DiffOptions;
  setOption: <K extends keyof DiffOptions>(
    key: K,
    value: DiffOptions[K],
  ) => void;
}

const DiffOptionsContext = createContext<DiffOptionsContextType | null>(null);

export function DiffOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DiffOptions>(defaultOptions);

  const setOption = useCallback(
    <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
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
