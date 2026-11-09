import { Input } from "@/components/ui/input";
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
            <Input
                readOnly
                tabIndex={0}
                className={cn(
                    "hidden h-8 w-full min-w-0 max-w-md cursor-pointer rounded-sm border-border-muted bg-surface-1 px-3 text-center text-[12px] leading-none",
                    "@min-[8rem]:block",
                )}
                placeholder={shortcutLabel}
                aria-label={`Open omnibar (${shortcutLabel})`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onOpen();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen();
                    }
                }}
            />
        </div>
    );
}
