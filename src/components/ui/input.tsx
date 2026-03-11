import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-9 w-full rounded-[2px] border border-input bg-card px-3 py-1 text-[13px] text-foreground transition-colors",
                "placeholder:text-muted-foreground",
                "hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:border-strong-border",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
