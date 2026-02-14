"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
    className,
    size = "default",
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
    size?: "sm" | "default";
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            data-size={size}
            className={cn(
                "group/switch peer inline-flex shrink-0 items-center border transition-colors outline-none",
                "data-[state=checked]:bg-foreground data-[state=unchecked]:bg-background",
                "data-[state=checked]:border-foreground data-[state=unchecked]:border-input",
                "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block border transition-transform",
                    "data-[state=checked]:bg-background data-[state=unchecked]:bg-foreground",
                    "data-[state=checked]:border-foreground data-[state=unchecked]:border-transparent",
                    "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
                    "data-[state=checked]:translate-x-[calc(100%+1px)] data-[state=unchecked]:translate-x-0",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
