import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function ReviewNavbar({ className, children }: PropsWithChildren<{ className?: string }>) {
    return (
        <header data-component="navbar" className={cn("h-11 border-b border-border bg-card px-3 flex items-center gap-2 text-[12px]", className)}>
            {children}
        </header>
    );
}
