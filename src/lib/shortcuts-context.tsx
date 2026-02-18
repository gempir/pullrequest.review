import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readShortcutsRecord, writeShortcutsRecord } from "@/lib/data/query-collections";

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

interface Shortcuts {
    nextUnviewedFile: ShortcutConfig;
    previousUnviewedFile: ShortcutConfig;
    scrollDown: ShortcutConfig;
    scrollUp: ShortcutConfig;
    nextFile: ShortcutConfig;
    previousFile: ShortcutConfig;
    markFileViewed: ShortcutConfig;
    markFileViewedAndFold: ShortcutConfig;
    approvePullRequest: ShortcutConfig;
    requestChangesPullRequest: ShortcutConfig;
}

const DEFAULT_SHORTCUTS: Shortcuts = {
    nextUnviewedFile: {
        key: "l",
        modifiers: { shift: true },
        description: "Navigate to next unviewed file",
    },
    previousUnviewedFile: {
        key: "h",
        modifiers: { shift: true },
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
        modifiers: {},
        description: "Navigate to next file",
    },
    previousFile: {
        key: "h",
        modifiers: {},
        description: "Navigate to previous file",
    },
    markFileViewed: {
        key: "v",
        modifiers: {},
        description: "Mark current file as viewed",
    },
    markFileViewedAndFold: {
        key: "v",
        modifiers: { shift: true },
        description: "Mark current file as viewed and fold",
    },
    approvePullRequest: {
        key: "a",
        modifiers: { shift: true },
        description: "Approve pull request",
    },
    requestChangesPullRequest: {
        key: "r",
        modifiers: { shift: true },
        description: "Request changes on pull request",
    },
};

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
        const stored = readShortcutsRecord();
        if (stored) {
            setShortcuts({ ...DEFAULT_SHORTCUTS, ...stored });
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        writeShortcutsRecord(shortcuts);
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

    const value = useMemo(
        () => ({
            shortcuts,
            updateShortcut,
            resetToDefaults,
            getShortcutDisplay,
        }),
        [shortcuts, updateShortcut, resetToDefaults, getShortcutDisplay],
    );

    return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts() {
    const ctx = useContext(ShortcutsContext);
    if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
    return ctx;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
    if (!target || typeof target !== "object") return false;

    const maybeElement = target as {
        tagName?: string;
        isContentEditable?: boolean;
        closest?: (selector: string) => unknown;
    };
    const tagName = maybeElement.tagName?.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return true;
    }
    if (maybeElement.isContentEditable) return true;
    if (typeof maybeElement.closest === "function") {
        return maybeElement.closest('[contenteditable="true"]') !== null;
    }
    return false;
}

export function useKeyboardNavigation({
    onNextUnviewedFile,
    onPreviousUnviewedFile,
    onScrollDown,
    onScrollUp,
    onNextFile,
    onPreviousFile,
    onMarkFileViewed,
    onMarkFileViewedAndFold,
    onApprovePullRequest,
    onRequestChangesPullRequest,
}: {
    onNextUnviewedFile?: () => void;
    onPreviousUnviewedFile?: () => void;
    onScrollDown?: () => void;
    onScrollUp?: () => void;
    onNextFile?: () => void;
    onPreviousFile?: () => void;
    onMarkFileViewed?: () => void;
    onMarkFileViewedAndFold?: () => void;
    onApprovePullRequest?: () => void;
    onRequestChangesPullRequest?: () => void;
}) {
    const { shortcuts } = useShortcuts();
    const shortcutsRef = useRef(shortcuts);
    const handlersRef = useRef({
        onNextUnviewedFile,
        onPreviousUnviewedFile,
        onScrollDown,
        onScrollUp,
        onNextFile,
        onPreviousFile,
        onMarkFileViewed,
        onMarkFileViewedAndFold,
        onApprovePullRequest,
        onRequestChangesPullRequest,
    });

    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        handlersRef.current = {
            onNextUnviewedFile,
            onPreviousUnviewedFile,
            onScrollDown,
            onScrollUp,
            onNextFile,
            onPreviousFile,
            onMarkFileViewed,
            onMarkFileViewedAndFold,
            onApprovePullRequest,
            onRequestChangesPullRequest,
        };
    }, [
        onNextUnviewedFile,
        onPreviousUnviewedFile,
        onScrollDown,
        onScrollUp,
        onNextFile,
        onPreviousFile,
        onMarkFileViewed,
        onMarkFileViewedAndFold,
        onApprovePullRequest,
        onRequestChangesPullRequest,
    ]);

    useEffect(() => {
        const matchesShortcut = (event: KeyboardEvent, shortcut: ShortcutConfig) => {
            if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
            if (event.ctrlKey !== !!shortcut.modifiers.ctrl) return false;
            if (event.altKey !== !!shortcut.modifiers.alt) return false;
            if (event.shiftKey !== !!shortcut.modifiers.shift) return false;
            if (event.metaKey !== !!shortcut.modifiers.meta) return false;
            return true;
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableShortcutTarget(event.target)) return;

            const activeShortcuts = shortcutsRef.current;
            const handlers = handlersRef.current;

            if (matchesShortcut(event, activeShortcuts.nextUnviewedFile)) {
                event.preventDefault();
                handlers.onNextUnviewedFile?.();
            } else if (matchesShortcut(event, activeShortcuts.previousUnviewedFile)) {
                event.preventDefault();
                handlers.onPreviousUnviewedFile?.();
            } else if (matchesShortcut(event, activeShortcuts.scrollDown)) {
                event.preventDefault();
                handlers.onScrollDown?.();
            } else if (matchesShortcut(event, activeShortcuts.scrollUp)) {
                event.preventDefault();
                handlers.onScrollUp?.();
            } else if (matchesShortcut(event, activeShortcuts.nextFile)) {
                event.preventDefault();
                handlers.onNextFile?.();
            } else if (matchesShortcut(event, activeShortcuts.previousFile)) {
                event.preventDefault();
                handlers.onPreviousFile?.();
            } else if (matchesShortcut(event, activeShortcuts.markFileViewedAndFold)) {
                event.preventDefault();
                handlers.onMarkFileViewedAndFold?.();
            } else if (matchesShortcut(event, activeShortcuts.markFileViewed)) {
                event.preventDefault();
                handlers.onMarkFileViewed?.();
            } else if (matchesShortcut(event, activeShortcuts.approvePullRequest)) {
                event.preventDefault();
                handlers.onApprovePullRequest?.();
            } else if (matchesShortcut(event, activeShortcuts.requestChangesPullRequest)) {
                event.preventDefault();
                handlers.onRequestChangesPullRequest?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
}
