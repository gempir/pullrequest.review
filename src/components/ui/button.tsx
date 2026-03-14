import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    {
        variants: {
            variant: {
                default: "bg-accent text-accent-foreground border border-accent hover:bg-accent-muted hover:border-accent-muted",
                destructive: "bg-destructive text-destructive-foreground border border-destructive hover:bg-destructive/90",
                outline: "border border-border bg-transparent text-foreground hover:bg-surface-2 hover:border-border",
                secondary: "bg-surface-1 text-foreground border border-border-muted hover:bg-surface-2",
                ghost: "bg-transparent text-foreground border border-transparent hover:bg-surface-1",
                link: "bg-transparent text-accent underline-offset-4 hover:underline border-none",
            },
            size: {
                default: "h-8 px-4 py-1 text-[13px] has-[>svg]:px-3",
                xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
                lg: "h-9 px-5 text-[13px] has-[>svg]:px-4",
                icon: "size-8",
                "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-7",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : "button";

    return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button };
