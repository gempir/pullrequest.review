import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, FileCode2, Files, Rows3, Settings2, SlidersHorizontal, SquareSplitVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDiffOptions } from "@/lib/diff-options-context";

type ReviewDiffSettingsMenuProps = {
    viewMode: "single" | "all";
    onViewModeChange: (mode: "single" | "all") => void;
    onOpenDiffSettings: () => void;
};

export function ReviewDiffSettingsMenu({ viewMode, onViewModeChange, onOpenDiffSettings }: ReviewDiffSettingsMenuProps) {
    const { options, setOption } = useDiffOptions();
    const diffStyle = options.diffStyle;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" aria-label="Diff view settings" title="Diff view settings">
                    <SlidersHorizontal className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-60 p-1">
                <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                <DropdownMenuPrimitive.RadioGroup
                    value={viewMode}
                    aria-label="View mode"
                    onValueChange={(value) => {
                        if (value === "single" || value === "all") onViewModeChange(value);
                    }}
                >
                    <DropdownMenuPrimitive.RadioItem
                        value="single"
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground outline-hidden transition-colors focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                        <FileCode2 className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left">Single file view</span>
                        <DropdownMenuPrimitive.ItemIndicator>
                            <Check className="size-3 text-accent-foreground" />
                        </DropdownMenuPrimitive.ItemIndicator>
                    </DropdownMenuPrimitive.RadioItem>
                    <DropdownMenuPrimitive.RadioItem
                        value="all"
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground outline-hidden transition-colors focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                        <Files className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left">Multi-file view</span>
                        <DropdownMenuPrimitive.ItemIndicator>
                            <Check className="size-3 text-accent-foreground" />
                        </DropdownMenuPrimitive.ItemIndicator>
                    </DropdownMenuPrimitive.RadioItem>
                </DropdownMenuPrimitive.RadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Diff Layout</DropdownMenuLabel>
                <DropdownMenuPrimitive.RadioGroup
                    value={diffStyle}
                    aria-label="Diff layout"
                    onValueChange={(value) => {
                        if (value === "unified" || value === "split") setOption("diffStyle", value);
                    }}
                >
                    <DropdownMenuPrimitive.RadioItem
                        value="unified"
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground outline-hidden transition-colors focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                        <Rows3 className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left">Unified</span>
                        <DropdownMenuPrimitive.ItemIndicator>
                            <Check className="size-3 text-accent-foreground" />
                        </DropdownMenuPrimitive.ItemIndicator>
                    </DropdownMenuPrimitive.RadioItem>
                    <DropdownMenuPrimitive.RadioItem
                        value="split"
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground outline-hidden transition-colors focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                        <SquareSplitVertical className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left">Split</span>
                        <DropdownMenuPrimitive.ItemIndicator>
                            <Check className="size-3 text-accent-foreground" />
                        </DropdownMenuPrimitive.ItemIndicator>
                    </DropdownMenuPrimitive.RadioItem>
                </DropdownMenuPrimitive.RadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => onOpenDiffSettings()}>
                    <Settings2 className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Open diff settings</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
