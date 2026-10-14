import type { FileTreeIcons, GitStatusEntry } from "@pierre/trees";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { type MouseEventHandler, useMemo, useSyncExternalStore } from "react";
import { AppFileTreeView, type FileTreeEntry, useAppFileTreeModel } from "@/components/file-tree";
import { ReviewFileTreeToggleIcon } from "@/components/pull-request-review/review-file-tree-toggle-icon";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getGitHostFetchActivitySnapshot, subscribeGitHostFetchActivity } from "@/lib/git-host/query-collections";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { cn } from "@/lib/utils";

type ReviewFileTreeSidebarProps = {
    treeWidth: number;
    treeCollapsed: boolean;
    loading: boolean;
    showLoadingActivity?: boolean;
    fetchScopeId?: string;
    showSettingsPanel: boolean;
    activeFile?: string;
    treeEntries: FileTreeEntry[];
    fileLineStats?: ReadonlyMap<string, { added: number; removed: number }>;
    searchQuery: string;
    showUnviewedOnly: boolean;
    unviewedFileCount: number;
    viewedFiles: Set<string>;
    onRefresh: () => Promise<void> | void;
    onToggleSettings: () => void;
    onCollapseTree: () => void;
    onSearchQueryChange: (value: string) => void;
    onToggleUnviewedOnly: () => void;
    onFileClick: (path: string) => void;
    onStartTreeResize: MouseEventHandler<HTMLButtonElement>;
};

function getDiffStatIconName(stats: { added: number; removed: number }) {
    return `file-tree-diff-stat-${stats.added}-${stats.removed}`;
}

function getDiffStatIconWidth(stats: { added: number; removed: number }) {
    return Math.max(`+${stats.added}`.length, `-${stats.removed}`.length) * 5;
}

function createDiffStatSymbol(stats: { added: number; removed: number }) {
    const name = getDiffStatIconName(stats);
    const width = getDiffStatIconWidth(stats);
    const addedText =
        stats.added > 0
            ? `<text x="${width}" y="7" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="8" font-weight="500" fill="var(--status-added)">+${stats.added}</text>`
            : "";
    const removedText =
        stats.removed > 0
            ? `<text x="${width}" y="15" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="8" font-weight="500" fill="var(--status-removed)">-${stats.removed}</text>`
            : "";
    return `<symbol id="${name}" viewBox="0 0 ${width} 16">${addedText}${removedText}</symbol>`;
}

function createDiffStatIcons(fileLineStats?: ReadonlyMap<string, { added: number; removed: number }>): FileTreeIcons | undefined {
    if (!fileLineStats) return undefined;
    const symbols = new Map<string, string>();
    for (const stats of fileLineStats.values()) {
        if (stats.added <= 0 && stats.removed <= 0) continue;
        symbols.set(getDiffStatIconName(stats), createDiffStatSymbol(stats));
    }
    if (symbols.size === 0) return undefined;
    return {
        set: "complete",
        colored: true,
        spriteSheet: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${Array.from(symbols.values()).join("")}</svg>`,
    };
}

function getReviewTreeRowDecoration({
    appPath,
    kind,
    showSettingsPanel,
    fileLineStats,
}: {
    appPath: string;
    kind: string;
    showSettingsPanel: boolean;
    fileLineStats?: ReadonlyMap<string, { added: number; removed: number }>;
}) {
    if (showSettingsPanel || kind !== "file" || appPath === PR_SUMMARY_PATH) return null;
    const stats = fileLineStats?.get(appPath);
    if (!stats || (stats.added <= 0 && stats.removed <= 0)) return null;
    return {
        icon: {
            name: getDiffStatIconName(stats),
            width: getDiffStatIconWidth(stats),
            height: 16,
            viewBox: `0 0 ${getDiffStatIconWidth(stats)} 16`,
        },
        title: `Added ${stats.added} lines, removed ${stats.removed} lines`,
    };
}

function FileTreeSearchInput({
    searchQuery,
    fetchScopeId,
    onSearchQueryChange,
}: Pick<ReviewFileTreeSidebarProps, "searchQuery" | "fetchScopeId" | "onSearchQueryChange">) {
    const fetchActivity = useSyncExternalStore(subscribeGitHostFetchActivity, getGitHostFetchActivitySnapshot, getGitHostFetchActivitySnapshot);
    const scopeId = `${fetchScopeId}:v2`;
    const currentFetch = fetchActivity.activeFetches.find((fetch) => fetch.scopeId === scopeId);
    const justCompleted = fetchActivity.recentlyCompletedScopeIds.includes(scopeId);
    const showProgress = Boolean(currentFetch) || justCompleted;
    const progress = currentFetch ? Math.round(((currentFetch.completedRequests ?? 0) / (currentFetch.totalRequests ?? 2)) * 100) : 100;

    return (
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-sm bg-[var(--diffs-bg,var(--background))]">
            <output className="sr-only" aria-live="polite">
                {justCompleted ? "Pull request loaded" : currentFetch ? "Loading pull request" : ""}
            </output>
            <div
                className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 bg-selection duration-700 ease-out motion-reduce:transition-none",
                    currentFetch?.completedRequests === 0 ? "transition-opacity" : "transition-[width,opacity]",
                    showProgress ? "opacity-100" : "opacity-0",
                )}
                style={{ width: `${progress}%` }}
                aria-hidden="true"
            >
                {currentFetch ? <span className="file-tree-search-progress-stripes absolute inset-0" /> : null}
            </div>
            <span
                className={cn(
                    "pointer-events-none absolute inset-0 flex items-center px-2 text-[12px] text-faint-foreground transition-opacity duration-500 ease-in-out motion-reduce:transition-none",
                    showProgress || searchQuery ? "opacity-0" : "opacity-100",
                )}
                aria-hidden="true"
            >
                Search...
            </span>
            <Input
                className="relative h-7 min-w-0 rounded-sm border-0 bg-transparent px-2 text-[12px] hover:bg-transparent focus-visible:ring-0"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Search files"
            />
        </div>
    );
}

function FileTreeRightControls({
    searchQuery,
    fetchScopeId,
    showUnviewedOnly,
    unviewedFileCount,
    onSearchQueryChange,
    onToggleUnviewedOnly,
    onCollapseTree,
}: Pick<
    ReviewFileTreeSidebarProps,
    "searchQuery" | "fetchScopeId" | "showUnviewedOnly" | "unviewedFileCount" | "onSearchQueryChange" | "onToggleUnviewedOnly" | "onCollapseTree"
>) {
    const badgeValue = unviewedFileCount > 999 ? "999+" : unviewedFileCount.toString();
    return (
        <>
            <FileTreeSearchInput searchQuery={searchQuery} fetchScopeId={fetchScopeId} onSearchQueryChange={onSearchQueryChange} />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "size-7 shrink-0 p-0 relative text-muted-foreground hover:text-foreground",
                            showUnviewedOnly ? "bg-selection text-foreground" : "",
                        )}
                        onClick={onToggleUnviewedOnly}
                        aria-label={showUnviewedOnly ? "Show all files" : "Show unviewed files only"}
                    >
                        {showUnviewedOnly ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {unviewedFileCount > 0 ? (
                            <span className="absolute -bottom-1 -left-0 font-mono leading-none text-status-renamed scale-65">{badgeValue}</span>
                        ) : null}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{showUnviewedOnly ? "Showing unviewed files" : "Show unviewed files only"}</TooltipContent>
            </Tooltip>
            <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-11 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                onClick={onCollapseTree}
                aria-label="Collapse file tree"
            >
                <ReviewFileTreeToggleIcon direction="collapse" />
            </Button>
        </>
    );
}

export function ReviewFileTreeSidebar({
    treeWidth,
    treeCollapsed,
    loading,
    showLoadingActivity,
    fetchScopeId,
    showSettingsPanel,
    activeFile,
    treeEntries,
    fileLineStats,
    searchQuery,
    showUnviewedOnly,
    unviewedFileCount,
    viewedFiles,
    onRefresh,
    onToggleSettings,
    onCollapseTree,
    onSearchQueryChange,
    onToggleUnviewedOnly,
    onFileClick,
    onStartTreeResize,
}: ReviewFileTreeSidebarProps) {
    const navigate = useNavigate();
    const diffStatIcons = useMemo(() => createDiffStatIcons(fileLineStats), [fileLineStats]);
    const treePathToAppPath = useMemo(() => new Map(treeEntries.map((entry) => [entry.treePath.replace(/\/+$/, ""), entry.appPath] as const)), [treeEntries]);
    const unviewedGitStatus = useMemo<GitStatusEntry[]>(() => {
        if (showSettingsPanel) return [];
        return treeEntries.flatMap((entry) =>
            entry.appPath !== PR_SUMMARY_PATH && !viewedFiles.has(entry.appPath) ? [{ path: entry.treePath, status: "renamed" }] : [],
        );
    }, [showSettingsPanel, treeEntries, viewedFiles]);
    const model = useAppFileTreeModel({
        entries: treeEntries,
        selectedAppPath: activeFile,
        pinnedFirstTreePath: showSettingsPanel ? undefined : PR_SUMMARY_NAME,
        searchQuery,
        hideSearchChrome: true,
        gitStatus: unviewedGitStatus,
        icons: diffStatIcons,
        onSelectPath: onFileClick,
        onSearchQueryChange,
        renderRowDecoration: ({ appPath, kind }) => getReviewTreeRowDecoration({ appPath, kind, showSettingsPanel, fileLineStats }),
    });

    return (
        <aside
            className={cn("relative shrink-0 bg-sidebar flex flex-col overflow-hidden border-r border-sidebar-border")}
            style={{ width: treeCollapsed ? 0 : treeWidth }}
        >
            {!treeCollapsed ? (
                <>
                    <SidebarTopControls
                        onHome={() => {
                            navigate({ to: "/" });
                        }}
                        onRefresh={onRefresh}
                        showLoadingActivity={showLoadingActivity}
                        onSettings={onToggleSettings}
                        settingsActive={showSettingsPanel}
                        settingsAriaLabel={showSettingsPanel ? "Close settings" : "Open settings"}
                        rightContent={
                            <FileTreeRightControls
                                searchQuery={searchQuery}
                                fetchScopeId={fetchScopeId}
                                showUnviewedOnly={showUnviewedOnly}
                                unviewedFileCount={unviewedFileCount}
                                onSearchQueryChange={onSearchQueryChange}
                                onToggleUnviewedOnly={onToggleUnviewedOnly}
                                onCollapseTree={onCollapseTree}
                            />
                        }
                    />
                    {loading ? (
                        <div className="flex-1 min-h-0 px-2 py-3 text-[12px] text-muted-foreground">Loading file tree...</div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-hidden tree-font-scope pb-2" data-component="tree">
                            <AppFileTreeView
                                model={model}
                                onTreeItemClick={(treePath) => {
                                    const nextAppPath = treePathToAppPath.get(treePath.replace(/\/+$/, ""));
                                    if (nextAppPath) {
                                        onFileClick(nextAppPath);
                                    }
                                }}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-accent/40"
                        onMouseDown={onStartTreeResize}
                        aria-label="Resize file tree"
                    />
                </>
            ) : null}
        </aside>
    );
}
