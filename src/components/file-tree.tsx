import type { FileTreeRowDecoration, FileTreeRowDecorationContext, GitStatusEntry } from "@pierre/trees";
import { FileTree as PierreFileTree, prepareFileTreeInput } from "@pierre/trees";
import { FileTree as PierreReactFileTree } from "@pierre/trees/react";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import { type TreeDensityValue, useFileTree } from "@/lib/file-tree-context";

export type FileTreeEntry = {
    treePath: string;
    appPath: string;
};

export type AppFileTreeRowDecorationContext = {
    appPath: string;
    treePath: string;
    kind: "directory" | "file";
    row: FileTreeRowDecorationContext["row"];
};

type UseAppFileTreeModelProps = {
    entries: readonly FileTreeEntry[];
    selectedAppPath?: string;
    searchQuery?: string;
    gitStatus?: readonly GitStatusEntry[];
    onSelectPath?: (appPath: string) => void;
    renderRowDecoration?: (context: AppFileTreeRowDecorationContext) => FileTreeRowDecoration | null;
};

type AppFileTreeProps = UseAppFileTreeModelProps & {
    className?: string;
    style?: CSSProperties;
};

const TREE_HOST_STYLE: CSSProperties = {
    height: "100%",
    "--trees-font-family-override": "var(--tree-font-family)",
    "--trees-font-size-override": "var(--tree-font-size)",
    "--trees-fg-override": "var(--foreground)",
    "--trees-fg-muted-override": "var(--muted-foreground)",
    "--trees-bg-override": "var(--background)",
    "--trees-bg-muted-override": "var(--surface-2)",
    "--trees-border-color-override": "var(--border-muted)",
    "--trees-accent-override": "var(--accent)",
    "--trees-selected-bg-override": "color-mix(in oklab, var(--accent) 18%, transparent)",
    "--trees-selected-focused-border-color-override": "var(--accent)",
    "--trees-focus-ring-color-override": "var(--accent)",
    "--trees-border-radius-override": "0px",
    "--trees-item-margin-x-override": "0px",
    "--trees-item-padding-x-override": "6px",
    "--trees-level-gap-override": "6px",
    "--trees-item-row-gap-override": "6px",
    "--trees-padding-inline-override": "8px",
    "--trees-scrollbar-thumb-override": "var(--border)",
    "--trees-scrollbar-gutter-override": "8px",
} as CSSProperties;

function normalizeSearchQuery(searchQuery?: string) {
    const trimmed = searchQuery?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}

function toTreeDensity(density: TreeDensityValue) {
    return density;
}

export function useAppFileTreeModel({ entries, selectedAppPath, searchQuery, gitStatus, onSelectPath, renderRowDecoration }: UseAppFileTreeModelProps) {
    const { treeDensity } = useFileTree();
    const appPathToTreePathRef = useRef(new Map<string, string>());
    const treePathToAppPathRef = useRef(new Map<string, string>());
    const onSelectPathRef = useRef(onSelectPath);
    const renderRowDecorationRef = useRef(renderRowDecoration);

    onSelectPathRef.current = onSelectPath;
    renderRowDecorationRef.current = renderRowDecoration;

    const treePaths = useMemo(() => entries.map((entry) => entry.treePath), [entries]);
    const preparedInput = useMemo(() => prepareFileTreeInput(treePaths), [treePaths]);

    useEffect(() => {
        appPathToTreePathRef.current = new Map(entries.map((entry) => [entry.appPath, entry.treePath]));
        treePathToAppPathRef.current = new Map(entries.map((entry) => [entry.treePath, entry.appPath]));
    }, [entries]);

    const model = useMemo(
        () =>
            new PierreFileTree({
                preparedInput,
                density: toTreeDensity(treeDensity),
                fileTreeSearchMode: "hide-non-matches",
                initialExpansion: "open",
                onSelectionChange: (selectedPaths) => {
                    const nextTreePath = selectedPaths.at(-1);
                    if (!nextTreePath) return;
                    const nextAppPath = treePathToAppPathRef.current.get(nextTreePath);
                    if (!nextAppPath) return;
                    onSelectPathRef.current?.(nextAppPath);
                },
                renderRowDecoration: (context) => {
                    const appPath = treePathToAppPathRef.current.get(context.item.path);
                    if (!appPath) return null;
                    return (
                        renderRowDecorationRef.current?.({
                            appPath,
                            treePath: context.item.path,
                            kind: context.item.kind,
                            row: context.row,
                        }) ?? null
                    );
                },
                search: true,
            }),
        [preparedInput, treeDensity],
    );

    useEffect(() => {
        return () => {
            model.cleanUp();
        };
    }, [model]);

    useEffect(() => {
        model.resetPaths(preparedInput.paths, { preparedInput });
    }, [model, preparedInput]);

    useEffect(() => {
        model.setGitStatus(gitStatus);
    }, [gitStatus, model]);

    useEffect(() => {
        model.setSearch(normalizeSearchQuery(searchQuery));
    }, [model, searchQuery]);

    useEffect(() => {
        if (!selectedAppPath) return;
        const treePath = appPathToTreePathRef.current.get(selectedAppPath);
        if (!treePath) return;
        for (const selectedPath of model.getSelectedPaths()) {
            if (selectedPath === treePath) continue;
            model.getItem(selectedPath)?.deselect();
        }
        model.getItem(treePath)?.select();
        model.focusNearestPath(treePath);
    }, [model, selectedAppPath]);

    return model;
}

export function AppFileTreeView({ className, model, style }: { className?: string; model: PierreFileTree; style?: CSSProperties }) {
    const hostStyle = useMemo(() => ({ ...TREE_HOST_STYLE, ...style }), [style]);
    return <PierreReactFileTree className={className} model={model} style={hostStyle} />;
}

export function FileTree(props: AppFileTreeProps) {
    const { className, style, ...modelProps } = props;
    const model = useAppFileTreeModel(modelProps);
    return <AppFileTreeView className={className} model={model} style={style} />;
}
