import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ensureDataCollectionsReady, readShortcutsRecord, writeShortcutsRecord } from "@/lib/data/query-collections";

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
    openFileTree: ShortcutConfig;
    openCommentsSidebar: ShortcutConfig;
    goToSummary: ShortcutConfig;
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
    openFileTree: {
        key: "f",
        modifiers: {},
        description: "Open file tree",
    },
    openCommentsSidebar: {
        key: "c",
        modifiers: {},
        description: "Open comments sidebar",
    },
    goToSummary: {
        key: "1",
        modifiers: {},
        description: "Jump to pull request summary",
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
        let cancelled = false;
        void (async () => {
            await ensureDataCollectionsReady();
            if (cancelled) return;
            const stored = readShortcutsRecord();
            if (stored) {
                setShortcuts({ ...DEFAULT_SHORTCUTS, ...stored });
            }
            setHydrated(true);
        })();
        return () => {
            cancelled = true;
        };
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

export function isEditableShortcutEvent(event: Pick<KeyboardEvent, "target" | "composedPath">): boolean {
    if (isEditableShortcutTarget(event.target)) return true;
    return event.composedPath().some((target) => isEditableShortcutTarget(target ?? null));
}

export function useKeyboardNavigation({
    onNextUnviewedFile,
    onPreviousUnviewedFile,
    onOpenFileTree,
    onOpenCommentsSidebar,
    onGoToSummary,
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
    onOpenFileTree?: () => void;
    onOpenCommentsSidebar?: () => void;
    onGoToSummary?: () => void;
    onScrollDown?: (event: KeyboardEvent) => void;
    onScrollUp?: (event: KeyboardEvent) => void;
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
        onOpenFileTree,
        onOpenCommentsSidebar,
        onGoToSummary,
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
            onOpenFileTree,
            onOpenCommentsSidebar,
            onGoToSummary,
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
        onOpenFileTree,
        onOpenCommentsSidebar,
        onGoToSummary,
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
            if (isEditableShortcutEvent(event)) return;

            const activeShortcuts = shortcutsRef.current;
            const handlers = handlersRef.current;

            if (matchesShortcut(event, activeShortcuts.nextUnviewedFile)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onNextUnviewedFile?.();
            } else if (matchesShortcut(event, activeShortcuts.previousUnviewedFile)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onPreviousUnviewedFile?.();
            } else if (matchesShortcut(event, activeShortcuts.openFileTree)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onOpenFileTree?.();
            } else if (matchesShortcut(event, activeShortcuts.openCommentsSidebar)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onOpenCommentsSidebar?.();
            } else if (matchesShortcut(event, activeShortcuts.goToSummary)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onGoToSummary?.();
            } else if (matchesShortcut(event, activeShortcuts.scrollDown)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onScrollDown?.(event);
            } else if (matchesShortcut(event, activeShortcuts.scrollUp)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onScrollUp?.(event);
            } else if (matchesShortcut(event, activeShortcuts.nextFile)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onNextFile?.();
            } else if (matchesShortcut(event, activeShortcuts.previousFile)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onPreviousFile?.();
            } else if (matchesShortcut(event, activeShortcuts.markFileViewedAndFold)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onMarkFileViewedAndFold?.();
            } else if (matchesShortcut(event, activeShortcuts.markFileViewed)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onMarkFileViewed?.();
            } else if (matchesShortcut(event, activeShortcuts.approvePullRequest)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onApprovePullRequest?.();
            } else if (matchesShortcut(event, activeShortcuts.requestChangesPullRequest)) {
                event.preventDefault();
                event.stopPropagation();
                handlers.onRequestChangesPullRequest?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, []);
}
