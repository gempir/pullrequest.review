import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileTree } from "@/components/file-tree";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Input } from "@/components/ui/input";
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { getSettingsTreeItems, settingsTabFromPath } from "@/features/settings/model/settings-navigation";
import { useFileTree } from "@/lib/file-tree-context";

export function SettingsPage() {
    const navigate = useNavigate();
    const { activeFile, setActiveFile } = useFileTree();
    const [searchQuery, setSearchQuery] = useState("");
    const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
    const settingsPathSet = useMemo(() => new Set(settingsTreeItems.map((item) => item.path)), [settingsTreeItems]);
    const treeEntries = useMemo(
        () =>
            settingsTreeItems.map((item) => ({
                appPath: item.path,
                treePath: item.name,
            })),
        [settingsTreeItems],
    );

    // Until a settings page is picked, the first one shows.
    const selectedPath = activeFile && settingsPathSet.has(activeFile) ? activeFile : settingsTreeItems[0]?.path;

    return (
        <div className="h-full min-h-0 flex bg-background">
            <aside data-component="sidebar" className="w-[280px] shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
                <SidebarTopControls
                    onHome={() => {
                        navigate({ to: "/" });
                    }}
                    settingsActive
                />

                <div data-component="search-sidebar" className="h-10 px-2 border-b border-sidebar-border flex items-center gap-2">
                    <Input
                        className="h-7 border-border-muted bg-background px-2 text-[12px]"
                        placeholder="Filter settings"
                        aria-label="Filter settings"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto tree-font-scope" data-component="tree">
                    <FileTree
                        entries={treeEntries}
                        selectedAppPath={selectedPath}
                        searchQuery={searchQuery}
                        hideSearchChrome
                        onSelectPath={(path) => {
                            if (settingsPathSet.has(path)) setActiveFile(path);
                        }}
                    />
                </div>
            </aside>

            <section className="flex-1 min-w-0 min-h-0 flex flex-col">
                <main data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto">
                    <div className="h-full min-h-0">
                        <SettingsPanel activeTab={settingsTabFromPath(selectedPath) ?? "appearance"} />
                    </div>
                </main>
            </section>
        </div>
    );
}
