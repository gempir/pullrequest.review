import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

type ReviewFileTreeToggleIconProps = {
    direction: "expand" | "collapse";
    badgeValue?: string | null;
};

export function ReviewFileTreeToggleIcon({ direction, badgeValue }: ReviewFileTreeToggleIconProps) {
    const chevron = (
        <span className="flex size-3 items-center justify-center">
            <ChevronRight className={cn("size-3", direction === "expand" ? "-scale-x-100" : null)} />
        </span>
    );

    const folder = (
        <span className="flex items-center justify-center gap-1">
            <Folder className="size-3.5" />
            {badgeValue ? <span className="text-[11px] font-medium leading-none tabular-nums text-accent">{badgeValue}</span> : null}
        </span>
    );

    return (
        <span className="flex items-center justify-center gap-0.5" aria-hidden="true">
            {direction === "expand" ? chevron : folder}
            {direction === "expand" ? folder : chevron}
        </span>
    );
}
