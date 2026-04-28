import type { FileTreeIcons, FileTreeRowDecoration, FileTreeRowDecorationContext, FileTreeSortComparator, GitStatusEntry } from "@pierre/trees";
import { FileTree as PierreFileTree, prepareFileTreeInput } from "@pierre/trees";
import { FileTree as PierreReactFileTree } from "@pierre/trees/react";
import { type CSSProperties, type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { type TreeDensityValue, useFileTree } from "@/lib/file-tree-context";
import { compareFileTreeSortEntries } from "@/lib/file-tree-order";

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
    pinnedFirstTreePath?: string;
    searchQuery?: string;
    gitStatus?: readonly GitStatusEntry[];
    icons?: FileTreeIcons;
    onSelectPath?: (appPath: string) => void;
    onSearchQueryChange?: (value: string) => void;
    renderRowDecoration?: (context: AppFileTreeRowDecorationContext) => FileTreeRowDecoration | null;
};

type AppFileTreeProps = UseAppFileTreeModelProps & {
    className?: string;
    header?: ReactNode;
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
    "--trees-search-bg-override": "var(--chrome)",
    "--trees-selected-bg-override": "color-mix(in oklab, var(--accent) 18%, transparent)",
    "--trees-git-renamed-color-override": "var(--status-renamed)",
    "--trees-focus-ring-width-override": "0px",
    "--trees-border-radius-override": "0px",
    "--trees-item-margin-x-override": "0px",
    "--trees-item-padding-x-override": "4px",
    "--trees-level-gap-override": "4px",
    "--trees-item-row-gap-override": "2px",
    "--trees-padding-inline-override": "0px",
    "--trees-scrollbar-thumb-override": "var(--border)",
    "--trees-scrollbar-gutter-override": "0px",
} as CSSProperties;

const TREE_UNSAFE_CSS = `
  [role='tree'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 40px minmax(0, 1fr);
    min-height: 0;
  }

  [data-type='header-slot'] {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }

  [data-type='item'][data-item-focused='true']::before,
  [data-type='item']:focus-visible::before {
    display: none;
  }

  [data-type='item'][data-item-focused='true'] [data-item-flattened-subitems],
  [data-type='item']:focus-visible [data-item-flattened-subitems] {
    --truncate-marker-block-inset: 0px;
  }

  [data-file-tree-search-container] {
    grid-column: 1;
    grid-row: 1;
    padding-inline: 0;
    margin-bottom: 0;
    min-width: 0;
  }

  [data-file-tree-search-input] {
    background-color: var(--chrome);
    border-inline: 0;
    border-top: 1px solid var(--trees-border-color);
    border-bottom: 1px solid var(--trees-border-color);
    height: 40px;
    line-height: 40px;
    margin-block: 0;
  }

  [data-file-tree-search-input]:focus-visible,
  [data-file-tree-search-input][data-file-tree-search-input-fake-focus='true'] {
    outline: none;
  }

  [data-file-tree-virtualized-scroll='true'] {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 0;
  }

  [data-item-section='git'] {
    display: none;
  }
`;

function createTreeSort(pinnedFirstTreePath?: string): FileTreeSortComparator | "default" {
    if (!pinnedFirstTreePath) return "default";
    return (left, right) => {
        if (left.path === pinnedFirstTreePath && right.path !== pinnedFirstTreePath) return -1;
        if (right.path === pinnedFirstTreePath && left.path !== pinnedFirstTreePath) return 1;
        return compareFileTreeSortEntries(left, right);
    };
}

function normalizeSearchQuery(searchQuery?: string) {
    const trimmed = searchQuery?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}

function toTreeDensity(density: TreeDensityValue) {
    return density;
}

function normalizeTreeLookupPath(path: string) {
    return path.replace(/\/+$/, "");
}

function createTreePathToAppPathMap(entries: readonly FileTreeEntry[]) {
    const map = new Map<string, string>();
    for (const entry of entries) {
        map.set(entry.treePath, entry.appPath);
        const normalizedTreePath = normalizeTreeLookupPath(entry.treePath);
        if (normalizedTreePath) {
            map.set(normalizedTreePath, entry.appPath);
        }
    }
    return map;
}

function getTreeItemHeight(density: TreeDensityValue) {
    if (density === "compact") return 20;
    if (density === "relaxed") return 28;
    return 24;
}

function areTreePathsEqual(left: readonly string[], right: readonly string[]) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) return false;
    }
    return true;
}

function eventPathContainsTreeItem(event: MouseEvent<HTMLElement>) {
    if (event.detail <= 0) return false;
    return event.nativeEvent.composedPath().some((target) => target instanceof HTMLElement && target.dataset.type === "item");
}

function blurActiveTreeItem(hostElement: HTMLElement) {
    const activeElement = hostElement.shadowRoot?.activeElement;
    if (!(activeElement instanceof HTMLElement)) return;
    if (activeElement.dataset.type !== "item") return;
    activeElement.blur();
}

function useStableTreePaths(entries: readonly FileTreeEntry[]) {
    const treePathsRef = useRef<readonly string[]>([]);
    return useMemo(() => {
        const nextTreePaths = entries.map((entry) => entry.treePath);
        if (areTreePathsEqual(treePathsRef.current, nextTreePaths)) {
            return treePathsRef.current;
        }
        treePathsRef.current = nextTreePaths;
        return nextTreePaths;
    }, [entries]);
}

export function useAppFileTreeModel({
    entries,
    selectedAppPath,
    pinnedFirstTreePath,
    searchQuery,
    gitStatus,
    icons,
    onSelectPath,
    onSearchQueryChange,
    renderRowDecoration,
}: UseAppFileTreeModelProps) {
    const { treeDensity } = useFileTree();
    const appPathToTreePathRef = useRef(new Map<string, string>());
    const treePathToAppPathRef = useRef(new Map<string, string>());
    const selectedAppPathRef = useRef(selectedAppPath);
    const initialSearchQueryRef = useRef(normalizeSearchQuery(searchQuery) ?? "");
    const onSelectPathRef = useRef(onSelectPath);
    const onSearchQueryChangeRef = useRef(onSearchQueryChange);
    const renderRowDecorationRef = useRef(renderRowDecoration);

    selectedAppPathRef.current = selectedAppPath;
    onSelectPathRef.current = onSelectPath;
    onSearchQueryChangeRef.current = onSearchQueryChange;
    renderRowDecorationRef.current = renderRowDecoration;

    const treePaths = useStableTreePaths(entries);
    const treeSort = useMemo(() => createTreeSort(pinnedFirstTreePath), [pinnedFirstTreePath]);
    const preparedInput = useMemo(() => prepareFileTreeInput(treePaths, { sort: treeSort }), [treePaths, treeSort]);

    useEffect(() => {
        appPathToTreePathRef.current = new Map(entries.map((entry) => [entry.appPath, normalizeTreeLookupPath(entry.treePath) || entry.treePath]));
        treePathToAppPathRef.current = createTreePathToAppPathMap(entries);
    }, [entries]);

    const model = useMemo(
        () =>
            new PierreFileTree({
                preparedInput,
                density: toTreeDensity(treeDensity),
                fileTreeSearchMode: "hide-non-matches",
                icons,
                initialExpansion: "open",
                itemHeight: getTreeItemHeight(treeDensity),
                sort: treeSort,
                onSelectionChange: (selectedPaths) => {
                    const nextTreePath = selectedPaths.at(-1);
                    if (!nextTreePath) return;
                    const nextAppPath = treePathToAppPathRef.current.get(nextTreePath);
                    if (!nextAppPath) {
                        const selectedTreePath = selectedAppPathRef.current ? appPathToTreePathRef.current.get(selectedAppPathRef.current) : undefined;
                        if (selectedTreePath && selectedTreePath !== nextTreePath) {
                            model.getItem(nextTreePath)?.deselect();
                            model.getItem(selectedTreePath)?.select();
                        }
                        return;
                    }
                    onSelectPathRef.current?.(nextAppPath);
                },
                onSearchChange: (value) => {
                    onSearchQueryChangeRef.current?.(value ?? "");
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
                searchBlurBehavior: "retain",
                initialSearchQuery: initialSearchQueryRef.current,
                unsafeCSS: TREE_UNSAFE_CSS,
            }),
        [icons, preparedInput, treeDensity, treeSort],
    );

    useEffect(() => {
        return () => {
            model.cleanUp();
        };
    }, [model]);

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
    }, [model, selectedAppPath]);

    return model;
}

export function AppFileTreeView({ className, header, model, style }: { className?: string; header?: ReactNode; model: PierreFileTree; style?: CSSProperties }) {
    const hostStyle = useMemo(() => ({ ...TREE_HOST_STYLE, ...style }), [style]);
    const handleClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
        if (!eventPathContainsTreeItem(event)) return;
        const hostElement = event.currentTarget;
        requestAnimationFrame(() => blurActiveTreeItem(hostElement));
    }, []);
    return <PierreReactFileTree className={className} header={header} model={model} onClickCapture={handleClickCapture} style={hostStyle} />;
}

export function FileTree(props: AppFileTreeProps) {
    const { className, header, style, ...modelProps } = props;
    const model = useAppFileTreeModel(modelProps);
    return <AppFileTreeView className={className} header={header} model={model} style={style} />;
}
