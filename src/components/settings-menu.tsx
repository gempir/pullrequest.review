import { RotateCcw, Settings2 } from "lucide-react";
import { useCallback } from "react";
import type { SettingsTab } from "@/components/settings-navigation";
import { Button } from "@/components/ui/button";
import { AppearanceTab, DiffSettingsTab, ShortcutsTab, StorageTab, TreeTab, type WorkspaceMode } from "@/features/settings/components/settings-tabs";
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

function useResolvedSettingsTab({ activeTab: controlledActiveTab }: Pick<SettingsPanelSharedProps, "activeTab">) {
    return { resolvedActiveTab: controlledActiveTab ?? "appearance" };
}

function SettingsPanelHeader({ onClose, onResetAllSettings }: { onClose?: () => void; onResetAllSettings?: () => void }) {
    const hasActions = Boolean(onClose || onResetAllSettings);

    return (
        <div className="h-10 bg-chrome px-2.5 flex items-center gap-2">
            <div className="flex w-full items-center gap-2 text-[12px] font-medium">
                <Settings2 className="size-4" />
                Settings
                {hasActions ? (
                    <div className="ml-auto flex items-center gap-2">
                        {onResetAllSettings ? (
                            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]" onClick={onResetAllSettings}>
                                <RotateCcw className="size-3.5" />
                                Reset all settings
                            </Button>
                        ) : null}
                        {onClose ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onClose}>
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
    if (activeTab === "storage") return <StorageTab />;
    return <AppearanceTab />;
}

export function SettingsPanelContentOnly({ workspaceMode, onWorkspaceModeChange, onClose, activeTab }: SettingsPanelSharedProps = {}) {
    const { resolvedActiveTab } = useResolvedSettingsTab({ activeTab });
    const resetAllSettings = useResetAllSettingsAction();

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SettingsPanelHeader onClose={onClose} onResetAllSettings={resetAllSettings} />
            <div className="flex-1 overflow-auto px-3 py-2.5">
                <SettingsPanelContent workspaceMode={workspaceMode} onWorkspaceModeChange={onWorkspaceModeChange} activeTab={resolvedActiveTab} />
            </div>
        </div>
    );
}
