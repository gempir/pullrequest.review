import { Search } from "lucide-react";
import { useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

export function OmnibarMenubarInput({ onOpen, className }: { onOpen: () => void; className?: string }) {
    const { shortcuts, getShortcutDisplay } = useShortcuts();
    const shortcutLabel = getShortcutDisplay(shortcuts.openOmnibar);

    return (
        <div className={cn("flex min-w-0 flex-1 items-center justify-end self-stretch px-1", className)}>
            <button
                type="button"
                className="pressable inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-muted-foreground outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open omnibar (${shortcutLabel})`}
                onClick={onOpen}
            >
                <Search className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{shortcutLabel}</span>
            </button>
        </div>
    );
}
