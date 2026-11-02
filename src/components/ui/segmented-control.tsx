import { m } from "motion/react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

const THUMB_SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    label,
    className,
}: {
    value: T;
    options: ReadonlyArray<{ value: T; label: ReactNode }>;
    onChange: (value: T) => void;
    label: string;
    className?: string;
}) {
    const layoutId = useId();
    return (
        <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-[10px] bg-surface-hover p-0.5", className)}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    // biome-ignore lint/a11y/useSemanticElements: a styled segmented control, native radios cannot host the sliding thumb
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={cn(
                            "pressable relative inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => onChange(option.value)}
                    >
                        {selected ? (
                            <m.span
                                layoutId={layoutId}
                                className="absolute inset-0 rounded-lg bg-surface-1 shadow-sm ring-1 ring-border-muted"
                                transition={THUMB_SPRING}
                            />
                        ) : null}
                        <span className="relative inline-flex items-center gap-1.5">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
