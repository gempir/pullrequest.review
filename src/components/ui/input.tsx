import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-9 w-full rounded-md border border-border bg-surface-hover px-3 py-1 text-[13px] transition-colors",
                "placeholder:text-faint-foreground",
                "hover:border-input",
                "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
