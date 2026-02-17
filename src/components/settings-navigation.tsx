export type SettingsTab = "appearance" | "diff" | "tree" | "shortcuts";

const SETTINGS_PATH_PREFIX = "__settings__/";

const SETTINGS_NAV_ITEMS: ReadonlyArray<{
    tab: SettingsTab;
    name: string;
}> = [
    { tab: "appearance", name: "Appearance" },
    { tab: "diff", name: "Diff" },
    { tab: "tree", name: "Tree" },
    { tab: "shortcuts", name: "Shortcuts" },
];

export function settingsPathForTab(tab: SettingsTab) {
    return `${SETTINGS_PATH_PREFIX}${tab}`;
}

export function getSettingsTreeItems() {
    return SETTINGS_NAV_ITEMS.map((item) => ({
        tab: item.tab,
        name: item.name,
        path: settingsPathForTab(item.tab),
    }));
}

export function settingsTabFromPath(path?: string): SettingsTab | null {
    if (!path || !path.startsWith(SETTINGS_PATH_PREFIX)) return null;
    const tab = path.slice(SETTINGS_PATH_PREFIX.length);
    if (tab === "appearance" || tab === "diff" || tab === "tree" || tab === "shortcuts") {
        return tab;
    }
    return null;
}
