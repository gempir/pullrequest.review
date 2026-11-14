import { RotateCcw, Settings2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { DiffSettingsTab, type WorkspaceMode } from "@/features/settings/components/diff-settings-tab";
import { ShortcutsTab } from "@/features/settings/components/shortcuts-tab";
import { TreeTab } from "@/features/settings/components/tree-tab";
import type { SettingsTab } from "@/features/settings/model/settings-navigation";
import { useAppearance } from "@/lib/appearance-context";
import { useDiffOptions } from "@/lib/diff-options-context";
import { useFileTree } from "@/lib/file-tree-context";
import { useShortcuts } from "@/lib/shortcuts-context";

type SettingsPanelProps = {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onClose?: () => void;
    activeTab: SettingsTab;
};

function useResetAllSettingsAction() {
    const { resetAppearance } = useAppearance();
    const { resetOptions } = useDiffOptions();
    const { resetTreePreferences } = useFileTree();
    const { resetToDefaults: resetShortcuts } = useShortcuts();

    return useCallback(() => {
        resetAppearance();
        resetOptions();
        resetTreePreferences();
        resetShortcuts();
    }, [resetAppearance, resetOptions, resetShortcuts, resetTreePreferences]);
}

const SETTINGS_TAB_TITLES: Record<SettingsTab, string> = {
    appearance: "Appearance",
    diff: "Diff",
    shortcuts: "Shortcuts",
    tree: "Tree",
};

function SettingsPanelHeader({ title, onClose, onResetAllSettings }: { title: string; onClose?: () => void; onResetAllSettings: () => void }) {
    return (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-muted bg-chrome px-3" data-component="navbar">
            <div className="flex w-full items-center gap-1.5 text-[13px]">
                <Settings2 className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Settings</span>
                <span className="text-faint-foreground">/</span>
                <span className="font-medium text-foreground">{title}</span>
                <div className="ml-auto flex items-center gap-1.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 px-2 font-normal text-muted-foreground hover:text-foreground"
                        onClick={onResetAllSettings}
                    >
                        <RotateCcw className="size-3.5" />
                        Reset all settings
                    </Button>
                    {onClose ? (
                        <Button type="button" variant="outline" size="sm" className="px-2.5" onClick={onClose}>
                            Back to review
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function SettingsPanelContent({ workspaceMode, onWorkspaceModeChange, activeTab }: Omit<SettingsPanelProps, "onClose">) {
    if (activeTab === "diff") return <DiffSettingsTab workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} />;
    if (activeTab === "tree") return <TreeTab />;
    if (activeTab === "shortcuts") return <ShortcutsTab />;
    return <AppearanceTab />;
}

export function SettingsPanel({ workspaceMode, onWorkspaceModeChange, onClose, activeTab }: SettingsPanelProps) {
    const resetAllSettings = useResetAllSettingsAction();

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SettingsPanelHeader title={SETTINGS_TAB_TITLES[activeTab]} onClose={onClose} onResetAllSettings={resetAllSettings} />
            <div className="flex-1 overflow-auto px-6 py-5">
                <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={activeTab} />
            </div>
        </div>
    );
}
