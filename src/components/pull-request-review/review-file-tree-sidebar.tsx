import { Eye, EyeOff, FolderMinus, FolderPlus, PanelLeftClose } from "lucide-react";
import type { MouseEventHandler } from "react";
import { FileTree } from "@/components/file-tree";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReviewFileTreeSidebarProps = {
    treeWidth: number;
    treeCollapsed: boolean;
    loading: boolean;
    showSettingsPanel: boolean;
    searchQuery: string;
    showUnviewedOnly: boolean;
    allowedPathSet: Set<string>;
    viewedFiles: Set<string>;
    onHome: () => void;
    onToggleSettings: () => void;
    onCollapseTree: () => void;
    onSearchQueryChange: (value: string) => void;
    onToggleUnviewedOnly: () => void;
    onCollapseAllDirectories: () => void;
    onExpandAllDirectories: () => void;
    onToggleViewed: (path: string) => void;
    onFileClick: (path: string) => void;
    onStartTreeResize: MouseEventHandler<HTMLButtonElement>;
};

export function ReviewFileTreeSidebar({
    treeWidth,
    treeCollapsed,
    loading,
    showSettingsPanel,
    searchQuery,
    showUnviewedOnly,
    allowedPathSet,
    viewedFiles,
    onHome,
    onToggleSettings,
    onCollapseTree,
    onSearchQueryChange,
    onToggleUnviewedOnly,
    onCollapseAllDirectories,
    onExpandAllDirectories,
    onToggleViewed,
    onFileClick,
    onStartTreeResize,
}: ReviewFileTreeSidebarProps) {
    return (
        <aside
            className={cn("relative shrink-0 bg-background flex flex-col overflow-hidden", treeCollapsed ? "border-r-0" : "border-r border-border")}
            style={{ width: treeCollapsed ? 0 : treeWidth }}
        >
            {!treeCollapsed ? (
                <>
                    <SidebarTopControls
                        onHome={onHome}
                        onSettings={onToggleSettings}
                        settingsActive={showSettingsPanel}
                        settingsAriaLabel={showSettingsPanel ? "Close settings" : "Open settings"}
                        rightContent={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onCollapseTree} aria-label="Collapse file tree">
                                <PanelLeftClose className="size-3.5" />
                            </Button>
                        }
                    />
                    <div className="h-10 border-b border-border bg-chrome flex items-center" data-component="search-sidebar">
                        <Input
                            className="h-full text-[12px] flex-1 min-w-0 border-0 border-r border-border rounded-none focus-visible:border-0 focus-visible:border-r focus-visible:border-border focus-visible:ring-0"
                            placeholder="search files"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            disabled={loading}
                        />
                        {!loading ? (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className={cn("size-7 p-0", showUnviewedOnly ? "bg-accent text-foreground" : "")}
                                            onClick={onToggleUnviewedOnly}
                                            aria-label={showUnviewedOnly ? "Show all files" : "Show unviewed files only"}
                                        >
                                            {showUnviewedOnly ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{showUnviewedOnly ? "Showing unviewed files" : "Show unviewed files only"}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="size-7 p-0"
                                            onClick={onCollapseAllDirectories}
                                            aria-label="Collapse all directories"
                                        >
                                            <FolderMinus className="size-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Collapse all directories</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="size-7 p-0"
                                            onClick={onExpandAllDirectories}
                                            aria-label="Expand all directories"
                                        >
                                            <FolderPlus className="size-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Expand all directories</TooltipContent>
                                </Tooltip>
                            </>
                        ) : null}
                    </div>
                    {loading ? (
                        <div className="flex-1 min-h-0 px-2 py-3 text-[12px] text-muted-foreground">Loading file tree...</div>
                    ) : (
                        <ScrollArea className="flex-1 min-h-0" viewportClassName="tree-font-scope pb-2">
                            <div data-component="tree">
                                <FileTree
                                    path=""
                                    filterQuery={searchQuery}
                                    allowedFiles={allowedPathSet}
                                    viewedFiles={viewedFiles}
                                    onToggleViewed={onToggleViewed}
                                    onFileClick={(node) => onFileClick(node.path)}
                                />
                            </div>
                        </ScrollArea>
                    )}
                    <button
                        type="button"
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-border/30"
                        onMouseDown={onStartTreeResize}
                        aria-label="Resize file tree"
                    />
                </>
            ) : null}
        </aside>
    );
}
