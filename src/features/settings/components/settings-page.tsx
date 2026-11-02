import { useNavigate } from "@tanstack/react-router";
import { Keyboard, ListTree, Palette, SquareSplitHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import { getSettingsTreeItems, type SettingsTab, settingsPathForTab, settingsTabFromPath } from "@/components/settings-navigation";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Input } from "@/components/ui/input";
import { useFileTree } from "@/lib/file-tree-context";
import { cn } from "@/lib/utils";

const SETTINGS_ICONS: Record<SettingsTab, typeof Palette> = {
    appearance: Palette,
    diff: SquareSplitHorizontal,
    tree: ListTree,
    shortcuts: Keyboard,
};

export function SettingsPage() {
    const navigate = useNavigate();
    const { activeFile, setActiveFile } = useFileTree();
    const [searchQuery, setSearchQuery] = useState("");
    const settingsItems = useMemo(() => getSettingsTreeItems(), []);
    const settingsPathSet = useMemo(() => new Set(settingsItems.map((item) => item.path)), [settingsItems]);
    const term = searchQuery.trim().toLowerCase();
    const visibleItems = term ? settingsItems.filter((item) => item.name.toLowerCase().includes(term)) : settingsItems;

    useEffect(() => {
        const firstSettingsPath = settingsItems[0]?.path;
        if (!firstSettingsPath) return;
        if (!activeFile || !settingsPathSet.has(activeFile)) {
            setActiveFile(firstSettingsPath);
        }
    }, [activeFile, setActiveFile, settingsPathSet, settingsItems]);

    return (
        <div className="relative h-full min-h-0 overflow-hidden">
            <main data-component="diff-view" className="absolute inset-0 overflow-y-auto" style={{ paddingLeft: 270 }}>
                <SettingsPanelContentOnly
                    activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
                    onActiveTabChange={(tab) => {
                        setActiveFile(settingsPathForTab(tab));
                    }}
                />
            </main>
            <aside
                data-component="sidebar"
                className="glass absolute flex w-[250px] flex-col overflow-hidden"
                style={{ top: "var(--panel-inset)", bottom: "var(--panel-inset)", left: "var(--panel-inset)", borderRadius: "var(--panel-radius)" }}
            >
                <SidebarTopControls
                    onHome={() => {
                        navigate({ to: "/" });
                    }}
                    onRefresh={() => Promise.resolve()}
                    settingsActive
                />
                <div data-component="search-sidebar" className="px-2.5 pb-2">
                    <Input
                        className="h-8 border-0 text-[12px]"
                        placeholder="Search settings"
                        aria-label="Search settings"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </div>
                <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2" aria-label="Settings sections">
                    {visibleItems.map((item) => {
                        const Icon = SETTINGS_ICONS[item.tab];
                        const selected = activeFile === item.path;
                        return (
                            <button
                                key={item.path}
                                type="button"
                                aria-current={selected ? "page" : undefined}
                                className={cn(
                                    "pressable flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    selected ? "bg-accent-solid font-medium text-accent-foreground" : "text-foreground hover:bg-surface-hover",
                                )}
                                onClick={() => setActiveFile(item.path)}
                            >
                                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                                {item.name}
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </div>
    );
}
