import type { FileTreeIcons, GitStatusEntry } from "@pierre/trees";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, PanelLeftClose, Search } from "lucide-react";
import { type MouseEventHandler, useEffect, useMemo, useRef, useState } from "react";
import { AppFileTreeView, type FileTreeEntry, useAppFileTreeModel } from "@/components/file-tree";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Button } from "@/components/ui/button";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { cn } from "@/lib/utils";

type ReviewFileTreeSidebarProps = {
    treeWidth: number;
    treeCollapsed: boolean;
    loading: boolean;
    showLoadingActivity?: boolean;
    loadProgress?: number | null;
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

const LOAD_COMPLETE_DISPLAY_MS = 1000;

function FileTreeSearchInput({
    searchQuery,
    loadProgress,
    onSearchQueryChange,
}: Pick<ReviewFileTreeSidebarProps, "searchQuery" | "loadProgress" | "onSearchQueryChange">) {
    const isLoading = typeof loadProgress === "number";
    const [justCompleted, setJustCompleted] = useState(false);
    const wasLoadingRef = useRef(false);
    useEffect(() => {
        const finished = wasLoadingRef.current && !isLoading;
        wasLoadingRef.current = isLoading;
        setJustCompleted(finished);
        if (!finished) return;
        const timeoutId = window.setTimeout(() => setJustCompleted(false), LOAD_COMPLETE_DISPLAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [isLoading]);
    const showProgress = isLoading || justCompleted;
    const progress = loadProgress ?? 100;

    return (
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-md bg-surface-hover">
            <output className="sr-only" aria-live="polite">
                {justCompleted ? "Pull request loaded" : isLoading ? "Loading pull request" : ""}
            </output>
            <div
                className={cn(
                    "pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-accent duration-700 ease-out motion-reduce:transition-none",
                    progress === 0 ? "transition-opacity" : "transition-[width,opacity]",
                    showProgress ? "opacity-100" : "opacity-0",
                )}
                style={{ width: `${progress}%` }}
                aria-hidden="true"
            />
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" aria-hidden="true" />
            <Input
                className="relative h-8 min-w-0 rounded-md border-0 bg-transparent pl-7 pr-2 text-[12px] hover:bg-transparent focus-visible:ring-0"
                value={searchQuery}
                placeholder="Search files"
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Search files"
            />
        </div>
    );
}

function FileTreeSearchRow({
    searchQuery,
    loadProgress,
    showUnviewedOnly,
    unviewedFileCount,
    onSearchQueryChange,
    onToggleUnviewedOnly,
}: Pick<
    ReviewFileTreeSidebarProps,
    "searchQuery" | "loadProgress" | "showUnviewedOnly" | "unviewedFileCount" | "onSearchQueryChange" | "onToggleUnviewedOnly"
>) {
    return (
        <div data-component="search-sidebar" className="flex items-center gap-1 px-2.5 pb-2">
            <FileTreeSearchInput searchQuery={searchQuery} loadProgress={loadProgress} onSearchQueryChange={onSearchQueryChange} />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground", showUnviewedOnly ? "bg-selection text-accent" : "")}
                        onClick={onToggleUnviewedOnly}
                        aria-label={showUnviewedOnly ? "Show all files" : "Show unviewed files only"}
                    >
                        {showUnviewedOnly ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{showUnviewedOnly ? `Showing ${unviewedFileCount} unviewed` : "Show unviewed files only"}</TooltipContent>
            </Tooltip>
        </div>
    );
}

export function ReviewFileTreeSidebar({
    treeWidth,
    treeCollapsed,
    loading,
    showLoadingActivity,
    loadProgress,
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
        <FloatingPanel
            side="left"
            open={!treeCollapsed}
            width={treeWidth}
            resizeLabel="Resize file tree"
            onStartResize={onStartTreeResize}
            data-component="sidebar"
        >
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
                    <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                        onClick={onCollapseTree}
                        aria-label="Collapse file tree"
                    >
                        <PanelLeftClose className="size-3.5" />
                    </Button>
                }
            />
            <FileTreeSearchRow
                searchQuery={searchQuery}
                loadProgress={loadProgress}
                showUnviewedOnly={showUnviewedOnly}
                unviewedFileCount={unviewedFileCount}
                onSearchQueryChange={onSearchQueryChange}
                onToggleUnviewedOnly={onToggleUnviewedOnly}
            />
            {loading ? (
                <div className="flex-1 min-h-0 px-4 py-3 text-[12px] text-muted-foreground">Loading files...</div>
            ) : (
                <div
                    className="tree-font-scope min-h-0 flex-1 overflow-hidden pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-20px),transparent)]"
                    data-component="tree"
                >
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
        </FloatingPanel>
    );
}
