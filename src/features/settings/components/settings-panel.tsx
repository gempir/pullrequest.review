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

function SettingsPanelHeader({ onClose, onResetAllSettings }: { onClose?: () => void; onResetAllSettings: () => void }) {
    return (
        <div className="h-10 bg-chrome px-2.5 flex items-center gap-2">
            <div className="flex w-full items-center gap-2 text-[12px] font-medium">
                <Settings2 className="size-4" />
                Settings
                <div className="ml-auto flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]" onClick={onResetAllSettings}>
                        <RotateCcw className="size-3.5" />
                        Reset all settings
                    </Button>
                    {onClose ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onClose}>
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
            <SettingsPanelHeader onClose={onClose} onResetAllSettings={resetAllSettings} />
            <div className="flex-1 overflow-auto px-3 py-2.5">
                <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={activeTab} />
            </div>
        </div>
    );
}
