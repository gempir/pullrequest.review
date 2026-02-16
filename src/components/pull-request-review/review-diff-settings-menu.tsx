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
                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => onViewModeChange("single")}>
                    <FileCode2 className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Single file view</span>
                    {viewMode === "single" ? <Check className="size-3 text-accent-foreground" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => onViewModeChange("all")}>
                    <Files className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Multi-file view</span>
                    {viewMode === "all" ? <Check className="size-3 text-accent-foreground" /> : null}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Diff Layout</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => setOption("diffStyle", "unified")}>
                    <Rows3 className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Unified</span>
                    {diffStyle === "unified" ? <Check className="size-3 text-accent-foreground" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => setOption("diffStyle", "split")}>
                    <SquareSplitVertical className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Split</span>
                    {diffStyle === "split" ? <Check className="size-3 text-accent-foreground" /> : null}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="cursor-pointer py-1.5 text-[12px] flex items-center gap-2" onSelect={() => onOpenDiffSettings()}>
                    <Settings2 className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Open diff settings</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
