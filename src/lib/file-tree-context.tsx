import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureDataCollectionsReady, readTreeSettingsRecord, writeTreeSettingsRecord } from "@/lib/data/query-collections";

export type TreeDensityValue = "compact" | "default" | "relaxed";

interface FileTreeContextType {
    activeFile: string | undefined;
    treeDensity: TreeDensityValue;
    setActiveFile: (path: string | undefined) => void;
    setTreeDensity: (density: TreeDensityValue) => void;
    resetTreePreferences: () => void;
}

const DEFAULT_TREE_DENSITY: TreeDensityValue = "default";
const FileTreeContext = createContext<FileTreeContextType | null>(null);

function parseStoredTreeDensity(value: unknown): TreeDensityValue {
    if (value === "compact" || value === "default" || value === "relaxed") {
        return value;
    }
    return DEFAULT_TREE_DENSITY;
}

function useFileTreeProviderValue(): FileTreeContextType {
    const [activeFile, setActiveFile] = useState<string | undefined>();
    const [treeDensity, setTreeDensityState] = useState<TreeDensityValue>(DEFAULT_TREE_DENSITY);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            await ensureDataCollectionsReady();
            if (cancelled) return;
            const stored = readTreeSettingsRecord();
            if (stored) {
                setTreeDensityState(parseStoredTreeDensity(stored.treeDensity));
            }
            setHydrated(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        writeTreeSettingsRecord({ treeDensity });
    }, [hydrated, treeDensity]);

    const setTreeDensity = useCallback((density: TreeDensityValue) => {
        setTreeDensityState(parseStoredTreeDensity(density));
    }, []);

    const resetTreePreferences = useCallback(() => {
        setTreeDensityState(DEFAULT_TREE_DENSITY);
    }, []);

    return useMemo(
        () => ({
            activeFile,
            treeDensity,
            setActiveFile,
            setTreeDensity,
            resetTreePreferences,
        }),
        [activeFile, resetTreePreferences, setTreeDensity, treeDensity],
    );
}

export function FileTreeProvider({ children }: { children: ReactNode }) {
    const value = useFileTreeProviderValue();
    return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}

export function useFileTree() {
    const ctx = useContext(FileTreeContext);
    if (!ctx) throw new Error("useFileTree must be used within FileTreeProvider");
    return ctx;
}
