import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { House, NotebookPen, RefreshCw, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarTopControlsProps = {
    onHome?: () => void;
    onRefresh: () => Promise<void> | void;
    refreshAriaLabel?: string;
    showLoadingActivity?: boolean;
    onSettings?: () => void;
    settingsActive?: boolean;
    settingsAriaLabel?: string;
    settingsButtonClassName?: string;
    rightContent?: ReactNode;
};

export function SidebarTopControls({
    onHome,
    onRefresh,
    refreshAriaLabel = "Refresh current view data",
    showLoadingActivity = false,
    onSettings,
    settingsActive = false,
    settingsAriaLabel = "Settings",
    settingsButtonClassName,
    rightContent,
}: SidebarTopControlsProps) {
    const [manualRefreshInFlight, setManualRefreshInFlight] = useState(false);
    const [isRefreshHovered, setIsRefreshHovered] = useState(false);
    const queryClient = useQueryClient();
    const isFetching = useIsFetching() > 0;
    const shouldSpin = isFetching || manualRefreshInFlight;
    const activeFetches = isFetching ? queryClient.getQueryCache().findAll({ fetchStatus: "fetching" }) : [];
    const activityLabels = activeFetches.flatMap((query) => (typeof query.meta?.activity === "string" ? [query.meta.activity] : []));
    if (activityLabels.length === 0 && showLoadingActivity) activityLabels.push("Comments");

    return (
        <div data-component="top-sidebar" className="flex h-12 shrink-0 items-center gap-0.5 px-2.5">
            {onHome ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onHome}
                    aria-label="Home"
                >
                    <House className="size-3.5" />
                </Button>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                    "h-8 w-8 p-0 text-muted-foreground hover:text-foreground",
                    settingsActive ? "bg-selection text-accent hover:text-accent" : null,
                    settingsButtonClassName,
                )}
                onClick={onSettings}
                aria-label={settingsAriaLabel}
            >
                <Settings2 className="size-3.5" />
            </Button>
            <Tooltip open={isRefreshHovered}>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onMouseEnter={() => setIsRefreshHovered(true)}
                        onMouseLeave={() => setIsRefreshHovered(false)}
                        onClick={() => {
                            if (manualRefreshInFlight) return;
                            setManualRefreshInFlight(true);
                            Promise.resolve(onRefresh()).finally(() => {
                                setManualRefreshInFlight(false);
                            });
                        }}
                        aria-label={refreshAriaLabel}
                    >
                        <RefreshCw className={cn("size-3.5", shouldSpin ? "animate-spin" : undefined)} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[360px] p-2 text-[11px]">
                    {activityLabels.length > 0 ? (
                        <ul aria-label="Loading requests" className="min-w-[200px] space-y-1">
                            {activityLabels.map((label) => (
                                <li key={label} className="flex items-center gap-2 text-foreground">
                                    <NotebookPen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                    {label}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div>Refresh</div>
                    )}
                </TooltipContent>
            </Tooltip>
            {rightContent ? <div className="ml-auto flex min-w-0 items-center justify-end gap-1">{rightContent}</div> : null}
        </div>
    );
}
