import { AnimatePresence, m } from "motion/react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

const PANEL_SPRING = { type: "spring", bounce: 0, duration: 0.38 } as const;
const OFFSCREEN_MARGIN = 24;

/**
 * A glass panel floating above the canvas. It slides in from its own edge and leaves along the
 * same path. Springs start from the current on-screen value, so toggling mid-flight reverses it.
 */
export function FloatingPanel({
    side,
    open,
    width,
    resizeLabel,
    onStartResize,
    className,
    children,
    ...rest
}: {
    side: "left" | "right";
    open: boolean;
    width: number;
    resizeLabel: string;
    onStartResize: MouseEventHandler<HTMLButtonElement>;
    className?: string;
    children: ReactNode;
    "data-component"?: string;
}) {
    const hiddenX = (side === "left" ? -1 : 1) * (width + OFFSCREEN_MARGIN);
    return (
        <AnimatePresence initial={false}>
            {open ? (
                <m.aside
                    key={side}
                    data-component={rest["data-component"]}
                    className={cn("glass absolute z-30 flex flex-col overflow-hidden", className)}
                    style={{
                        width,
                        top: "var(--panel-inset)",
                        bottom: "var(--panel-inset)",
                        borderRadius: "var(--panel-radius)",
                        [side]: "var(--panel-inset)",
                    }}
                    initial={{ x: hiddenX, opacity: 0.4 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: hiddenX, opacity: 0.4 }}
                    transition={PANEL_SPRING}
                >
                    {children}
                    <button
                        type="button"
                        className={cn(
                            "absolute inset-y-5 z-10 w-1.5 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-accent/50 active:bg-accent",
                            side === "left" ? "right-0.5" : "left-0.5",
                        )}
                        onMouseDown={onStartResize}
                        aria-label={resizeLabel}
                    />
                </m.aside>
            ) : null}
        </AnimatePresence>
    );
}
