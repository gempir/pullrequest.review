import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";

export interface ShortcutConfig {
  key: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  description: string;
}

export interface Shortcuts {
  nextUnviewedFile: ShortcutConfig;
  previousUnviewedFile: ShortcutConfig;
  scrollDown: ShortcutConfig;
  scrollUp: ShortcutConfig;
  nextFile: ShortcutConfig;
  previousFile: ShortcutConfig;
}

const DEFAULT_SHORTCUTS: Shortcuts = {
  nextUnviewedFile: {
    key: "l",
    modifiers: {},
    description: "Navigate to next unviewed file",
  },
  previousUnviewedFile: {
    key: "h",
    modifiers: {},
    description: "Navigate to previous unviewed file",
  },
  scrollDown: {
    key: "j",
    modifiers: {},
    description: "Scroll down",
  },
  scrollUp: {
    key: "k",
    modifiers: {},
    description: "Scroll up",
  },
  nextFile: {
    key: "l",
    modifiers: { shift: true },
    description: "Navigate to next file",
  },
  previousFile: {
    key: "h",
    modifiers: { shift: true },
    description: "Navigate to previous file",
  },
};

const STORAGE_KEY = "pr_review_shortcuts";

interface ShortcutsContextType {
  shortcuts: Shortcuts;
  updateShortcut: (action: keyof Shortcuts, config: Partial<ShortcutConfig>) => void;
  resetToDefaults: () => void;
  getShortcutDisplay: (shortcut: ShortcutConfig) => string;
}

const ShortcutsContext = createContext<ShortcutsContextType | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcuts>(DEFAULT_SHORTCUTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Shortcuts;
        setShortcuts({ ...DEFAULT_SHORTCUTS, ...parsed });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  }, [shortcuts, hydrated]);

  const updateShortcut = useCallback((action: keyof Shortcuts, config: Partial<ShortcutConfig>) => {
    setShortcuts((prev) => ({
      ...prev,
      [action]: { ...prev[action], ...config },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  const getShortcutDisplay = useCallback((shortcut: ShortcutConfig): string => {
    const parts: string[] = [];
    if (shortcut.modifiers.ctrl) parts.push("Ctrl");
    if (shortcut.modifiers.alt) parts.push("Alt");
    if (shortcut.modifiers.shift) parts.push("Shift");
    if (shortcut.modifiers.meta) parts.push("Cmd");
    parts.push(shortcut.key.toUpperCase());
    return parts.join("+");
  }, []);

  const value = useMemo(() => ({
    shortcuts,
    updateShortcut,
    resetToDefaults,
    getShortcutDisplay,
  }), [shortcuts, updateShortcut, resetToDefaults, getShortcutDisplay]);

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
  return ctx;
}

export function useKeyboardNavigation({
  onNextUnviewedFile,
  onPreviousUnviewedFile,
  onScrollDown,
  onScrollUp,
  onNextFile,
  onPreviousFile,
}: {
  onNextUnviewedFile?: () => void;
  onPreviousUnviewedFile?: () => void;
  onScrollDown?: () => void;
  onScrollUp?: () => void;
  onNextFile?: () => void;
  onPreviousFile?: () => void;
}) {
  const { shortcuts } = useShortcuts();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const matchesShortcut = (shortcut: ShortcutConfig): boolean => {
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
        if (e.ctrlKey !== !!shortcut.modifiers.ctrl) return false;
        if (e.altKey !== !!shortcut.modifiers.alt) return false;
        if (e.shiftKey !== !!shortcut.modifiers.shift) return false;
        if (e.metaKey !== !!shortcut.modifiers.meta) return false;
        return true;
      };

      if (matchesShortcut(shortcuts.nextUnviewedFile)) {
        e.preventDefault();
        onNextUnviewedFile?.();
      } else if (matchesShortcut(shortcuts.previousUnviewedFile)) {
        e.preventDefault();
        onPreviousUnviewedFile?.();
      } else if (matchesShortcut(shortcuts.scrollDown)) {
        e.preventDefault();
        onScrollDown?.();
      } else if (matchesShortcut(shortcuts.scrollUp)) {
        e.preventDefault();
        onScrollUp?.();
      } else if (matchesShortcut(shortcuts.nextFile)) {
        e.preventDefault();
        onNextFile?.();
      } else if (matchesShortcut(shortcuts.previousFile)) {
        e.preventDefault();
        onPreviousFile?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shortcuts,
    onNextUnviewedFile,
    onPreviousUnviewedFile,
    onScrollDown,
    onScrollUp,
    onNextFile,
    onPreviousFile,
  ]);
}
