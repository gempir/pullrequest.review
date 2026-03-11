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
                "group/switch peer inline-flex shrink-0 items-center rounded-full border transition-colors outline-none",
                "data-[state=checked]:border-primary/35 data-[state=checked]:bg-primary/90 data-[state=unchecked]:border-border data-[state=unchecked]:bg-muted",
                "focus-visible:ring-2 focus-visible:ring-ring/35",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block rounded-full border border-transparent bg-background transition-transform",
                    "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
                    "data-[state=checked]:translate-x-[calc(100%+1px)] data-[state=unchecked]:translate-x-0",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
