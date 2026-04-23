import type { CSSProperties } from "react";
import { useMemo } from "react";
import { FileTree } from "@/components/file-tree";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Input } from "@/components/ui/input";
import type { LandingTreeEntry } from "@/features/landing/model/landing-model";

export function LandingSidebar({
    activeFile,
    showSettingsPanel,
    searchQuery,
    pullRequestTreeEntries,
    onSearchQueryChange,
    onHome,
    onRefresh,
    onToggleSettings,
    onFileClick,
}: {
    activeFile?: string;
    showSettingsPanel: boolean;
    searchQuery: string;
    pullRequestTreeEntries: LandingTreeEntry[];
    onSearchQueryChange: (value: string) => void;
    onHome: () => void;
    onRefresh: () => Promise<void>;
    onToggleSettings: () => void;
    onFileClick: (path: string) => void;
}) {
    const settingsTreeEntries = useMemo(
        () =>
            getSettingsTreeItems().map((item) => ({
                appPath: item.path,
                treePath: item.name,
            })),
        [],
    );
    const entries = showSettingsPanel ? settingsTreeEntries : pullRequestTreeEntries;

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
                {!showSettingsPanel && pullRequestTreeEntries.length === 0 ? (
                    <div className="px-2 py-3 text-[12px] text-muted-foreground">No repositories or pull requests match.</div>
                ) : (
                    <FileTree
                        entries={entries}
                        selectedAppPath={activeFile}
                        searchQuery={searchQuery}
                        onSelectPath={onFileClick}
                        style={{ "--trees-bg-override": "var(--surface-1)" } as CSSProperties}
                    />
                )}
            </div>
        </aside>
    );
}
