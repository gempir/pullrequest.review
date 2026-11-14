import type { ComponentProps } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeCommentTimestamp, describeTimestamp, type TimestampValue } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

const TIMESTAMP_CLASS = "inline-block whitespace-nowrap tabular-nums text-[11px] leading-4 text-faint-foreground";

type TimestampProps = {
    value: TimestampValue;
    className?: string;
    tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
    tooltipLabel?: string;
    variant?: "default" | "comment";
    withTooltip?: boolean;
};

export function Timestamp({ value, className, tooltipSide = "top", tooltipLabel, variant = "default", withTooltip = true }: TimestampProps) {
    const display = variant === "comment" ? describeCommentTimestamp(value) : describeTimestamp(value);
    const content = <span className={cn(TIMESTAMP_CLASS, className)}>{display.label}</span>;

    // Comment timestamps always get the exact date and time tooltip, since their full label has no seconds.
    const showTooltip = withTooltip && Boolean(display.absoluteLabel) && (variant === "comment" || display.isRelative);
    if (!showTooltip) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side={tooltipSide}>
                {tooltipLabel ? <div className="mb-1 text-[10px] text-muted-foreground">{tooltipLabel}</div> : null}
                <div>{display.absoluteLabel}</div>
            </TooltipContent>
        </Tooltip>
    );
}
