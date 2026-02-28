"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type * as React from "react";
import { cn } from "@/lib/utils";

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
    return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                data-slot="dropdown-menu-content"
                sideOffset={sideOffset}
                className={cn(
                    "z-50 min-w-40 overflow-hidden rounded-[2px] border-0 bg-popover p-1 text-[12px] text-popover-foreground shadow-none",
                    "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                    "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    className,
                )}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
    return (
        <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" className={cn("px-2 py-1.5 text-[11px] text-muted-foreground", className)} {...props} />
    );
}

function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
    return (
        <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-item"
            className={cn(
                "relative flex cursor-default select-none items-center gap-2 rounded-[2px] px-2 py-1.5 text-foreground outline-hidden transition-colors",
                "focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                inset && "pl-7",
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-0", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger };
