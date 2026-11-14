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
                "group/switch peer inline-flex shrink-0 items-center rounded-full border-0 p-0.5 transition-colors duration-150 outline-none",
                "data-[state=checked]:bg-accent-solid data-[state=unchecked]:bg-surface-3",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block rounded-full border-0 bg-white shadow-sm transition-transform duration-150 ease-out",
                    "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
                    "data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
