import { RotateCcw } from "lucide-react";
import { useCallback } from "react";
import type { SettingsTab } from "@/components/settings-navigation";
import { Button } from "@/components/ui/button";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { DiffSettingsTab, type WorkspaceMode } from "@/features/settings/components/diff-settings-tab";
import { ShortcutsTab } from "@/features/settings/components/shortcuts-tab";
import { TreeTab } from "@/features/settings/components/tree-tab";
import { useAppearance } from "@/lib/appearance-context";
import { useDiffOptions } from "@/lib/diff-options-context";
import { useFileTree } from "@/lib/file-tree-context";
import { useShortcuts } from "@/lib/shortcuts-context";

type SettingsPanelSharedProps = {
    workspaceMode?: WorkspaceMode;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onClose?: () => void;
    activeTab?: SettingsTab;
    onActiveTabChange?: (tab: SettingsTab) => void;
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

function SettingsPanelHeader({ onClose, onResetAllSettings }: { onClose?: () => void; onResetAllSettings?: () => void }) {
    const hasActions = Boolean(onClose || onResetAllSettings);

    return (
        <div className="flex items-center gap-2 pb-4">
            <div className="flex w-full items-center gap-2">
                <h1 className="display-title text-[26px]">Settings</h1>
                {hasActions ? (
                    <div className="ml-auto flex items-center gap-2">
                        {onResetAllSettings ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-full px-3 text-[12px] text-muted-foreground"
                                onClick={onResetAllSettings}
                            >
                                <RotateCcw className="size-3.5" />
                                Reset all settings
                            </Button>
                        ) : null}
                        {onClose ? (
                            <Button type="button" variant="secondary" size="sm" className="h-8 rounded-full px-3 text-[12px]" onClick={onClose}>
                                Back to review
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SettingsPanelContent({
    workspaceMode,
    onWorkspaceModeChange,
    activeTab,
}: Pick<SettingsPanelSharedProps, "workspaceMode" | "onWorkspaceModeChange"> & { activeTab: SettingsTab }) {
    if (activeTab === "diff") return <DiffSettingsTab workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} />;
    if (activeTab === "tree") return <TreeTab />;
    if (activeTab === "shortcuts") return <ShortcutsTab />;
    return <AppearanceTab />;
}

export function SettingsPanelContentOnly({ workspaceMode, onWorkspaceModeChange, onClose, activeTab }: SettingsPanelSharedProps = {}) {
    const resetAllSettings = useResetAllSettingsAction();

    return (
        <div className="canvas-page">
            <div className="mx-auto max-w-[760px] px-3 pt-4" data-component="settings">
                <SettingsPanelHeader onClose={onClose} onResetAllSettings={resetAllSettings} />
                <div className="canvas-card p-5">
                    <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={activeTab ?? "appearance"} />
                </div>
            </div>
        </div>
    );
}
