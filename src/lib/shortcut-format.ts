import type { ShortcutConfig } from "@/lib/shortcuts-context";

export function formatShortcut(shortcut: ShortcutConfig) {
    const parts: string[] = [];
    if (shortcut.modifiers.ctrl) parts.push("Ctrl");
    if (shortcut.modifiers.alt) parts.push("Alt");
    if (shortcut.modifiers.shift) parts.push("Shift");
    if (shortcut.modifiers.meta) parts.push("Cmd");
    parts.push(shortcut.key.toUpperCase());
    return parts.join("+");
}
