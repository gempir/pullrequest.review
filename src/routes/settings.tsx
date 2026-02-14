import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileTree } from "@/components/file-tree";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import {
  getSettingsTreeItems,
  settingsPathForTab,
  settingsTabFromPath,
} from "@/components/settings-navigation";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Input } from "@/components/ui/input";
import { type FileNode, useFileTree } from "@/lib/file-tree-context";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();
  const { setTree, setKinds, activeFile, setActiveFile } = useFileTree();
  const [searchQuery, setSearchQuery] = useState("");
  const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
  const settingsPathSet = useMemo(
    () => new Set(settingsTreeItems.map((item) => item.path)),
    [settingsTreeItems],
  );

  useEffect(() => {
    const settingsNodes: FileNode[] = settingsTreeItems.map((item) => ({
      name: item.name,
      path: item.path,
      type: "file",
    }));
    setTree(settingsNodes);
    setKinds(new Map());
  }, [setKinds, setTree, settingsTreeItems]);

  useEffect(() => {
    const firstSettingsPath = settingsTreeItems[0]?.path;
    if (!firstSettingsPath) return;
    if (!activeFile || !settingsPathSet.has(activeFile)) {
      setActiveFile(firstSettingsPath);
    }
  }, [activeFile, setActiveFile, settingsPathSet, settingsTreeItems]);

  return (
    <div className="h-full min-h-0 flex bg-background">
      <aside
        data-component="sidebar"
        className="w-[300px] shrink-0 border-r border-border bg-sidebar flex flex-col"
      >
        <SidebarTopControls
          onHome={() => {
            navigate({ to: "/" });
          }}
          settingsActive
        />

        <div
          data-component="search-sidebar"
          className="h-10 pl-2 pr-2 border-b border-border flex items-center gap-2"
        >
          <Input
            className="h-7 text-[12px] border-0 focus-visible:ring-0"
            placeholder="search settings"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto" data-component="tree">
          <FileTree
            path=""
            filterQuery={searchQuery}
            showUnviewedIndicator={false}
            onFileClick={(node) => {
              if (settingsPathSet.has(node.path)) {
                setActiveFile(node.path);
              }
            }}
          />
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header
          data-component="navbar"
          className="h-11 border-b border-border bg-card px-3 flex items-center gap-2 text-[12px]"
        >
          <span className="text-muted-foreground">Settings</span>
        </header>

        <main
          data-component="diff-view"
          className="flex-1 min-h-0 overflow-y-auto"
        >
          <div className="h-full min-h-0">
            <SettingsPanelContentOnly
              activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
              onActiveTabChange={(tab) => {
                setActiveFile(settingsPathForTab(tab));
              }}
            />
          </div>
        </main>
      </section>
    </div>
  );
}
