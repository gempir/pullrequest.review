import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

export function OmnibarMenubarInput({ onOpen, className }: { onOpen: () => void; className?: string }) {
    const { shortcuts, getShortcutDisplay } = useShortcuts();
    const shortcutLabel = getShortcutDisplay(shortcuts.openOmnibar);

    return (
        <div className={cn("review-navbar-command @container flex min-w-0 flex-1 items-center justify-center self-stretch px-2", className)}>
            <Button
                type="button"
                variant="outline"
                className={cn(
                    "hidden h-8 w-full min-w-0 max-w-md justify-start rounded-sm border-border-muted bg-surface-1 px-2.5 text-[12px] font-normal text-faint-foreground shadow-sm",
                    "hover:border-input hover:bg-surface-hover hover:text-muted-foreground @min-[8rem]:flex",
                )}
                aria-label={`Open omnibar (${shortcutLabel})`}
                onClick={() => {
                    onOpen();
                }}
            >
                <Search className="size-3.5" aria-hidden="true" />
                <span className="hidden min-w-0 truncate text-left @min-[18rem]:block">Search files, actions, and pull requests</span>
                <kbd className="ml-auto shrink-0 rounded-[3px] border border-border-muted bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                    {shortcutLabel}
                </kbd>
            </Button>
        </div>
    );
}
