import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatShortcut } from "@/lib/shortcut-format";
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

    return (
        <div className="flex items-center justify-between gap-3 border-b border-border-muted px-3 py-2.5 last:border-b-0">
            <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium">{label}</span>
                <span className="text-[12px] text-muted-foreground">{shortcut.description}</span>
            </div>
            <button
                type="button"
                onClick={() => setIsRecording(true)}
                onKeyDown={handleKeyDown}
                onBlur={() => setIsRecording(false)}
                className={cn(
                    "h-7 min-w-[96px] rounded-sm border px-2.5 text-center text-[12px] font-medium transition-colors",
                    isRecording
                        ? "border-accent-solid bg-selection-subtle text-accent"
                        : "border-border bg-surface-1 text-foreground hover:border-input hover:bg-surface-hover",
                )}
            >
                {isRecording ? "Press key..." : formatShortcut(shortcut)}
            </button>
        </div>
    );
}

export function ShortcutsTab() {
    const { shortcuts, updateShortcut, resetToDefaults } = useShortcuts();

    return (
        <div className="max-w-3xl space-y-3">
            <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={resetToDefaults} className="gap-1.5">
                    <RotateCcw className="size-3.5" />
                    Reset Defaults
                </Button>
            </div>

            <div className="overflow-hidden rounded-md border border-border-muted bg-card">
                <ShortcutRow label="Open Omnibar" shortcut={shortcuts.openOmnibar} onChange={(config) => updateShortcut("openOmnibar", config)} />
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
                <ShortcutRow label="Go to Summary" shortcut={shortcuts.goToSummary} onChange={(config) => updateShortcut("goToSummary", config)} />
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
                    label="Revise"
                    shortcut={shortcuts.requestChangesPullRequest}
                    onChange={(config) => updateShortcut("requestChangesPullRequest", config)}
                />
            </div>
        </div>
    );
}
