import { FileTree } from "@/components/file-tree";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Input } from "@/components/ui/input";
import type { FileNode } from "@/lib/file-tree-context";

export function LandingSidebar({
    showSettingsPanel,
    searchQuery,
    pullRequestTreeRoot,
    onSearchQueryChange,
    onHome,
    onRefresh,
    onToggleSettings,
    onFileClick,
    onDirectoryClick,
}: {
    showSettingsPanel: boolean;
    searchQuery: string;
    pullRequestTreeRoot: FileNode[];
    onSearchQueryChange: (value: string) => void;
    onHome: () => void;
    onRefresh: () => Promise<void>;
    onToggleSettings: () => void;
    onFileClick: (path: string) => void;
    onDirectoryClick: (path: string) => boolean | undefined;
}) {
    return (
        <aside data-component="sidebar" className="w-[300px] shrink-0 bg-surface-1 border-r border-border-muted flex flex-col">
            <SidebarTopControls onHome={onHome} onRefresh={onRefresh} onSettings={onToggleSettings} settingsActive={showSettingsPanel} />
            <div data-component="search-sidebar" className="h-10 pl-2 pr-2 bg-chrome border-b border-border-muted flex items-center gap-2">
                <Input
                    className="h-7 text-[12px] border-0 rounded-none focus-visible:ring-0"
                    placeholder={showSettingsPanel ? "search settings" : "search repos or pull requests"}
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" data-component="tree">
                {!showSettingsPanel && pullRequestTreeRoot.length === 0 ? (
                    <div className="px-2 py-3 text-[12px] text-muted-foreground">No repositories or pull requests match.</div>
                ) : (
                    <FileTree
                        path=""
                        filterQuery={searchQuery}
                        showUnviewedIndicator={false}
                        onFileClick={(node) => onFileClick(node.path)}
                        onDirectoryClick={(node) => onDirectoryClick(node.path)}
                    />
                )}
            </div>
        </aside>
    );
}
