import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function ReviewSidebar({ className, children }: PropsWithChildren<{ className?: string }>) {
    return (
        <aside data-component="sidebar" className={cn("shrink-0 bg-sidebar flex flex-col", className)}>
            {children}
        </aside>
    );
}
