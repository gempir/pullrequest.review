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
