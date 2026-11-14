import { Search } from "lucide-react";
import { formatShortcut } from "@/lib/shortcut-format";
import { useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

function useOmnibarShortcut() {
    return formatShortcut(useShortcuts().shortcuts.openOmnibar);
}

/** The user's configured omnibar shortcut, for hints next to the omnibar. */
export function OmnibarShortcutLabel() {
    return <>{useOmnibarShortcut()}</>;
}

export function OmnibarMenubarInput({ onOpen, className }: { onOpen: () => void; className?: string }) {
    const shortcutLabel = useOmnibarShortcut();

    return (
        <div className={cn("@container flex min-w-0 flex-1 items-center justify-center self-stretch px-2", className)}>
            <button
                type="button"
                className={cn(
                    "hidden h-7 w-full min-w-0 max-w-md cursor-pointer items-center gap-2 rounded-sm border border-border-muted bg-background px-2 text-left text-[12px] text-faint-foreground transition-colors hover:border-border hover:text-muted-foreground",
                    "@min-[8rem]:flex",
                )}
                aria-label={`Open omnibar (${shortcutLabel})`}
                onClick={onOpen}
            >
                <Search className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">Search or jump to...</span>
                <kbd className="hidden shrink-0 rounded-[3px] border border-border-muted bg-surface-1 px-1 text-[10px] leading-4 text-muted-foreground @min-[14rem]:block">
                    {shortcutLabel}
                </kbd>
            </button>
        </div>
    );
}
