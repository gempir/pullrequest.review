import { useMemo } from "react";
import { FileTree } from "@/components/file-tree";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
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
    const treePathToAppPath = useMemo(() => {
        const map = new Map<string, string>();
        for (const entry of entries) {
            map.set(entry.treePath, entry.appPath);
            map.set(entry.treePath.replace(/\/+$/, ""), entry.appPath);
        }
        return map;
    }, [entries]);

    return (
        <aside data-component="sidebar" className="w-[300px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
            <SidebarTopControls onHome={onHome} onRefresh={onRefresh} onSettings={onToggleSettings} settingsActive={showSettingsPanel} />
            <div className="flex-1 min-h-0 overflow-y-auto" data-component="tree">
                {!showSettingsPanel && pullRequestTreeEntries.length === 0 ? (
                    <div className="px-2 py-3 text-[12px] text-muted-foreground">No repositories or pull requests match.</div>
                ) : (
                    <FileTree
                        entries={entries}
                        selectedAppPath={activeFile}
                        searchQuery={searchQuery}
                        onSearchQueryChange={onSearchQueryChange}
                        onSelectPath={onFileClick}
                        onTreeItemClick={(treePath) => {
                            const nextAppPath = treePathToAppPath.get(treePath.replace(/\/+$/, ""));
                            if (nextAppPath) {
                                onFileClick(nextAppPath);
                            }
                        }}
                    />
                )}
            </div>
        </aside>
    );
}
