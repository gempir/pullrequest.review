import { House, RefreshCw, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getGitHostFetchActivitySnapshot, refetchAllGitHostData, subscribeGitHostFetchActivity } from "@/lib/git-host/query-collections";
import { cn } from "@/lib/utils";

type SidebarTopControlsProps = {
    onHome: () => void;
    onSettings?: () => void;
    settingsActive?: boolean;
    settingsAriaLabel?: string;
    settingsButtonClassName?: string;
    rightContent?: ReactNode;
};

export function SidebarTopControls({
    onHome,
    onSettings,
    settingsActive = false,
    settingsAriaLabel = "Settings",
    settingsButtonClassName,
    rightContent,
}: SidebarTopControlsProps) {
    const [manualRefreshInFlight, setManualRefreshInFlight] = useState(false);
    const [isRefreshHovered, setIsRefreshHovered] = useState(false);
    const [isRefreshFocused, setIsRefreshFocused] = useState(false);
    const fetchActivity = useSyncExternalStore(subscribeGitHostFetchActivity, getGitHostFetchActivitySnapshot, getGitHostFetchActivitySnapshot);
    const isFetching = fetchActivity.activeFetchCount > 0;
    const shouldSpin = isFetching || manualRefreshInFlight;
    const isRefreshTooltipOpen = isRefreshHovered || isRefreshFocused;
    const now = Date.now();
    const activeFetches = useMemo(
        () =>
            fetchActivity.activeFetches.map((fetch) => ({
                ...fetch,
                elapsedSeconds: Math.max(0, Math.floor((now - fetch.startedAt) / 1000)),
            })),
        [fetchActivity.activeFetches, now],
    );

    return (
        <div data-component="top-sidebar" className="h-11 px-2 border-b border-border bg-chrome flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onHome} aria-label="Home">
                <House className="size-3.5" />
            </Button>
            <Button
                type="button"
                variant={settingsActive ? "default" : "ghost"}
                size="sm"
                className={cn("h-8 w-8 p-0", settingsButtonClassName)}
                onClick={onSettings}
                aria-label={settingsAriaLabel}
            >
                <Settings2 className="size-3.5" />
            </Button>
            <Tooltip open={isRefreshTooltipOpen}>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onMouseEnter={() => setIsRefreshHovered(true)}
                        onMouseLeave={() => setIsRefreshHovered(false)}
                        onFocus={() => setIsRefreshFocused(true)}
                        onBlur={() => setIsRefreshFocused(false)}
                        onClick={() => {
                            if (manualRefreshInFlight) return;
                            setManualRefreshInFlight(true);
                            void refetchAllGitHostData({ throwOnError: false }).finally(() => {
                                setManualRefreshInFlight(false);
                            });
                        }}
                        aria-label="Refresh all host data"
                    >
                        <RefreshCw className={cn("size-3.5", shouldSpin ? "animate-spin" : undefined)} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[360px] p-2 text-[11px]">
                    {activeFetches.length === 0 && <div>Refresh</div>}
                    {activeFetches.map((fetch) => (
                        <div key={fetch.scopeId} className="px-2 py-1 border-b border-border/40 last:border-b-0">
                            <div className="text-foreground">{fetch.label}</div>
                            <div className="text-muted-foreground">{`Running for ${fetch.elapsedSeconds}s`}</div>
                        </div>
                    ))}
                </TooltipContent>
            </Tooltip>
            {rightContent ? <div className="ml-auto flex items-center">{rightContent}</div> : null}
        </div>
    );
}
