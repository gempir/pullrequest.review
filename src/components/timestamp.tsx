import type { ComponentProps } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeTimestamp, type TimestampValue } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

const TIMESTAMP_STYLE = { fontFamily: "var(--mono-font-family)" } as const;
const TIMESTAMP_CLASS = "inline-block tabular-nums text-[9px] leading-4 text-muted-foreground";

type TimestampProps = {
    value: TimestampValue;
    className?: string;
    tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
    unknownLabel?: string;
    withTooltip?: boolean;
};

export function Timestamp({ value, className, tooltipSide = "top", unknownLabel, withTooltip = true }: TimestampProps) {
    const display = describeTimestamp(value, { unknownLabel });
    const content = (
        <span className={cn(TIMESTAMP_CLASS, className)} style={TIMESTAMP_STYLE}>
            {display.label}
        </span>
    );

    if (!withTooltip || !display.isRelative || !display.absoluteLabel) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side={tooltipSide}>{display.absoluteLabel}</TooltipContent>
        </Tooltip>
    );
}
