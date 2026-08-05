import { Input } from "@/components/ui/input";
import { useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

export function OmnibarMenubarInput({ onOpen, className }: { onOpen: () => void; className?: string }) {
    const { shortcuts, getShortcutDisplay } = useShortcuts();
    const shortcutLabel = getShortcutDisplay(shortcuts.openOmnibar);

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
