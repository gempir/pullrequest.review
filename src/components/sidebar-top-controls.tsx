import {
    Activity,
    FolderGit2,
    GitCompareArrows,
    GitPullRequest,
    History,
    House,
    type LucideIcon,
    MessageSquareText,
    NotebookPen,
    RefreshCw,
    Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getGitHostFetchActivitySnapshot, subscribeGitHostFetchActivity } from "@/lib/git-host/query-collections";
import { cn } from "@/lib/utils";

function describeFetch(label: string): { Icon: LucideIcon; description: string } {
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel.includes("pull request comments")) return { Icon: NotebookPen, description: "Comments" };
    if (normalizedLabel.includes("[deferred]")) return { Icon: MessageSquareText, description: "Comments and review activity" };
    if (normalizedLabel.includes("commit range diff")) return { Icon: GitCompareArrows, description: "Commit range diff" };
    if (normalizedLabel.includes("file history")) return { Icon: History, description: "File history" };
    if (normalizedLabel.includes("repository pull requests")) return { Icon: GitPullRequest, description: "Repository pull requests" };
    if (normalizedLabel.includes("repositories")) return { Icon: FolderGit2, description: "Repositories" };
    if (normalizedLabel.includes("pull request details")) return { Icon: GitPullRequest, description: "Pull request files and diff" };
    return { Icon: Activity, description: label.split("(", 1)[0]?.trim() || "Loading data" };
}

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
    const [isRefreshFocused, setIsRefreshFocused] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const fetchActivity = useSyncExternalStore(subscribeGitHostFetchActivity, getGitHostFetchActivitySnapshot, getGitHostFetchActivitySnapshot);
    const isFetching = fetchActivity.activeFetchCount > 0;
    const shouldSpin = isFetching || manualRefreshInFlight;
    const isRefreshTooltipOpen = showLoadingActivity || isRefreshHovered || isRefreshFocused;
    const activeFetchRows = useMemo(
        () =>
            fetchActivity.activeFetches.map((fetch) => ({
                ...describeFetch(fetch.label),
                key: fetch.scopeId,
                ...fetch,
                elapsedSeconds: Math.max(0, Math.floor((now - fetch.startedAt) / 1000)),
            })),
        [fetchActivity.activeFetches, now],
    );
    const visibleFetchRows =
        activeFetchRows.length > 0
            ? activeFetchRows
            : showLoadingActivity
              ? [{ key: "comments-loading", Icon: NotebookPen, description: "Comments", elapsedSeconds: 0 }]
              : [];

    useEffect(() => {
        if (!isFetching) return;
        const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [isFetching]);

    return (
        <div data-component="top-sidebar" className="h-11 pl-2 pr-0 bg-sidebar-chrome border-b border-sidebar-border flex items-center gap-1">
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
                    settingsActive ? "bg-selection text-accent" : null,
                    settingsButtonClassName,
                )}
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
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onMouseEnter={() => setIsRefreshHovered(true)}
                        onMouseLeave={() => setIsRefreshHovered(false)}
                        onFocus={() => setIsRefreshFocused(true)}
                        onBlur={() => setIsRefreshFocused(false)}
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
                    {visibleFetchRows.length > 0 ? (
                        <table aria-label="Loading requests" className="min-w-[240px]">
                            <tbody>
                                {visibleFetchRows.map(({ key, Icon, description, elapsedSeconds }) => (
                                    <tr key={key} className="border-b border-border/40 last:border-b-0">
                                        <td className="py-1 pr-2 text-muted-foreground">
                                            <Icon className="size-3.5" aria-hidden="true" />
                                        </td>
                                        <td className="max-w-[260px] truncate py-1 text-foreground" title={description}>
                                            {description}
                                        </td>
                                        <td className="py-1 pl-2 text-right font-mono tabular-nums text-muted-foreground">{elapsedSeconds}s</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div>Refresh</div>
                    )}
                </TooltipContent>
            </Tooltip>
            {rightContent ? <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1">{rightContent}</div> : null}
        </div>
    );
}
