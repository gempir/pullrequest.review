"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn("fixed inset-0 z-50 bg-overlay/70", className)} {...props} />;
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
    return (
        <DialogPortal data-slot="dialog-portal">
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    "bg-background border border-border fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] shadow-lg",
                    className,
                )}
                {...props}
            >
                {children}
                <DialogPrimitive.Close className="absolute right-4 top-4 opacity-70 hover:opacity-100 focus:outline-none disabled:pointer-events-none">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export { Dialog, DialogContent, DialogTitle };
