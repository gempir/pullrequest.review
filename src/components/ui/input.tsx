import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-8 w-full rounded-sm border border-input bg-surface-1 px-2.5 py-1 text-[13px] transition-[color,background-color,border-color,box-shadow] duration-150",
                "placeholder:text-faint-foreground",
                "hover:border-faint-foreground/60",
                "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
