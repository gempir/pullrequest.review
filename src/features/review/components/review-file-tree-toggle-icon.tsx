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
        <span className="relative flex size-6 items-center justify-center">
            <Folder className="size-[14px]" />
            {badgeValue ? <span className="absolute -bottom-1 right-0 font-mono leading-none text-status-renamed scale-65">{badgeValue}</span> : null}
        </span>
    );

    return (
        <span className="flex items-center justify-center gap-0.5" aria-hidden="true">
            {direction === "expand" ? chevron : folder}
            {direction === "expand" ? folder : chevron}
        </span>
    );
}
