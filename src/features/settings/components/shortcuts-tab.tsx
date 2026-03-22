import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type ShortcutConfig, useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

function ShortcutRow({ label, shortcut, onChange }: { label: string; shortcut: ShortcutConfig; onChange: (config: Partial<ShortcutConfig>) => void }) {
    const [isRecording, setIsRecording] = useState(false);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (!isRecording) return;
        event.preventDefault();

        if (event.key === "Escape") {
            setIsRecording(false);
            return;
        }

        if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;

        onChange({
            key: event.key.toLowerCase(),
            modifiers: {
                ctrl: event.ctrlKey && event.key !== "Control",
                alt: event.altKey && event.key !== "Alt",
                shift: event.shiftKey && event.key !== "Shift",
                meta: event.metaKey && event.key !== "Meta",
            },
        });
        setIsRecording(false);
    };

    const displayShortcut = () => {
        const parts: string[] = [];
        if (shortcut.modifiers.ctrl) parts.push("Ctrl");
        if (shortcut.modifiers.alt) parts.push("Alt");
        if (shortcut.modifiers.shift) parts.push("Shift");
        if (shortcut.modifiers.meta) parts.push("Cmd");
        parts.push(shortcut.key.toUpperCase());
        return parts.join("+");
    };

    return (
        <div className="flex items-center justify-between gap-3 px-2 py-2.5">
            <div className="flex flex-col">
                <span className="text-[13px]">{label}</span>
                <span className="text-[11px] text-muted-foreground">{shortcut.description}</span>
            </div>
            <button
                type="button"
                onClick={() => setIsRecording(true)}
                onKeyDown={handleKeyDown}
                onBlur={() => setIsRecording(false)}
                className={cn(
                    "h-8 min-w-[96px] px-2.5 text-center text-[12px] transition-colors",
                    isRecording ? "bg-accent text-accent-foreground" : "border border-border-muted bg-surface-1 hover:bg-surface-2",
                )}
            >
                {isRecording ? "Press key..." : displayShortcut()}
            </button>
        </div>
    );
}

export function ShortcutsTab() {
    const { shortcuts, updateShortcut, resetToDefaults } = useShortcuts();

    return (
        <div className="max-w-3xl space-y-2.5">
            <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={resetToDefaults} className="gap-1.5">
                    <RotateCcw className="size-3.5" />
                    Reset Defaults
                </Button>
            </div>

            <div>
                <ShortcutRow
                    label="Next Unviewed File"
                    shortcut={shortcuts.nextUnviewedFile}
                    onChange={(config) => updateShortcut("nextUnviewedFile", config)}
                />
                <ShortcutRow
                    label="Previous Unviewed File"
                    shortcut={shortcuts.previousUnviewedFile}
                    onChange={(config) => updateShortcut("previousUnviewedFile", config)}
                />
                <ShortcutRow label="Open File Tree" shortcut={shortcuts.openFileTree} onChange={(config) => updateShortcut("openFileTree", config)} />
                <ShortcutRow
                    label="Open Comments Sidebar"
                    shortcut={shortcuts.openCommentsSidebar}
                    onChange={(config) => updateShortcut("openCommentsSidebar", config)}
                />
                <ShortcutRow label="Scroll Down" shortcut={shortcuts.scrollDown} onChange={(config) => updateShortcut("scrollDown", config)} />
                <ShortcutRow label="Scroll Up" shortcut={shortcuts.scrollUp} onChange={(config) => updateShortcut("scrollUp", config)} />
                <ShortcutRow label="Next File" shortcut={shortcuts.nextFile} onChange={(config) => updateShortcut("nextFile", config)} />
                <ShortcutRow label="Previous File" shortcut={shortcuts.previousFile} onChange={(config) => updateShortcut("previousFile", config)} />
                <ShortcutRow label="Mark File Viewed" shortcut={shortcuts.markFileViewed} onChange={(config) => updateShortcut("markFileViewed", config)} />
                <ShortcutRow
                    label="Mark File Viewed + Fold"
                    shortcut={shortcuts.markFileViewedAndFold}
                    onChange={(config) => updateShortcut("markFileViewedAndFold", config)}
                />
                <ShortcutRow
                    label="Approve Pull Request"
                    shortcut={shortcuts.approvePullRequest}
                    onChange={(config) => updateShortcut("approvePullRequest", config)}
                />
                <ShortcutRow
                    label="Request Changes"
                    shortcut={shortcuts.requestChangesPullRequest}
                    onChange={(config) => updateShortcut("requestChangesPullRequest", config)}
                />
            </div>
        </div>
    );
}
