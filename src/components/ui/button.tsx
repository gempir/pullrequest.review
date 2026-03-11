import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-0",
    {
        variants: {
            variant: {
                default: "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90",
                destructive: "border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline: "border-border bg-card text-foreground hover:border-strong-border hover:bg-accent",
                secondary: "border-subtle-border bg-muted text-secondary-foreground hover:border-border hover:bg-accent",
                ghost: "border-transparent bg-transparent text-foreground hover:border-subtle-border hover:bg-accent/85",
                link: "border-transparent bg-transparent text-foreground underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-1 text-[13px] has-[>svg]:px-3",
                xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
                lg: "h-10 px-5 text-[13px] has-[>svg]:px-4",
                icon: "size-9",
                "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
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
