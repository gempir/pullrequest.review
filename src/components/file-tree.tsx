import type { FileTreeIcons, FileTreeRowDecoration, FileTreeRowDecorationContext, FileTreeSortComparator, GitStatusEntry } from "@pierre/trees";
import { FileTree as PierreFileTree, prepareFileTreeInput } from "@pierre/trees";
import { FileTree as PierreReactFileTree } from "@pierre/trees/react";
import { type CSSProperties, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
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
    onTreeItemClick?: (treePath: string) => void;
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
    position: relative;
  }

  [data-file-tree-search-container]:has([data-file-tree-search-input]:placeholder-shown)::after {
    color: var(--trees-fg-muted);
    content: 'Search... (cmd + k)';
    font-size: var(--trees-font-size);
    inset: 0;
    line-height: 40px;
    padding-inline: 8px;
    pointer-events: none;
    position: absolute;
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

  [data-file-tree-search-input]::placeholder {
    color: transparent;
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

function getTreeItemPathFromEvent(event: MouseEvent<HTMLElement>) {
    for (const target of event.nativeEvent.composedPath()) {
        if (!(target instanceof HTMLElement)) continue;
        if (target.dataset.type !== "item") continue;
        return target.dataset.itemPath ?? null;
    }
    return null;
}

function blurActiveTreeItem(hostElement: HTMLElement) {
    const activeElement = hostElement.shadowRoot?.activeElement;
    if (!(activeElement instanceof HTMLElement)) return;
    if (activeElement.dataset.type !== "item") return;
    activeElement.blur();
}

function getTreeSearchInput(hostElement: HTMLElement) {
    return hostElement.shadowRoot?.querySelector<HTMLInputElement>("[data-file-tree-search-input]") ?? null;
}

function isTreeSearchInputEvent(event: ReactKeyboardEvent<HTMLElement>) {
    return event.nativeEvent.composedPath().some((target) => target instanceof HTMLElement && target.hasAttribute("data-file-tree-search-input"));
}

function isTreeSearchShortcut(event: Pick<globalThis.KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">) {
    return event.key.toLowerCase() === "k" && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

function isImplicitTreeSearchKey(event: ReactKeyboardEvent<HTMLElement>) {
    return event.key.length === 1 && /^[\p{L}\p{N}]$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function getTreeScrollElement(model: PierreFileTree) {
    return model.getFileTreeContainer()?.shadowRoot?.querySelector<HTMLElement>("[data-file-tree-virtualized-scroll='true']") ?? null;
}

function getTreeItemElement(model: PierreFileTree, treePath: string) {
    const shadowRoot = model.getFileTreeContainer()?.shadowRoot;
    if (!shadowRoot) return null;
    for (const item of shadowRoot.querySelectorAll<HTMLElement>("[data-type='item']")) {
        if (item.dataset.itemPath === treePath) return item;
    }
    return null;
}

function getCenteredTreeScrollTop(scrollElement: HTMLElement, rowTop: number, rowHeight: number) {
    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    return Math.max(0, Math.min(maxScrollTop, rowTop - (scrollElement.clientHeight - rowHeight) / 2));
}

function adjustRenderedTreePathIntoView(model: PierreFileTree, treePath: string) {
    const scrollElement = getTreeScrollElement(model);
    const itemElement = getTreeItemElement(model, treePath);
    if (!scrollElement || !itemElement) return false;

    const scrollRect = scrollElement.getBoundingClientRect();
    const itemRect = itemElement.getBoundingClientRect();
    if (itemRect.top < scrollRect.top || itemRect.bottom > scrollRect.bottom) {
        const rowTop = scrollElement.scrollTop + itemRect.top - scrollRect.top;
        scrollElement.scrollTop = getCenteredTreeScrollTop(scrollElement, rowTop, itemRect.height);
        return true;
    }
    return true;
}

function revealTreePath(model: PierreFileTree, treePath: string, rowIndex: number | undefined) {
    const scrollElement = getTreeScrollElement(model);
    if (scrollElement && rowIndex !== undefined) {
        const rowTop = rowIndex * model.getItemHeight();
        const rowBottom = rowTop + model.getItemHeight();
        const viewportBottom = scrollElement.scrollTop + scrollElement.clientHeight;
        if (rowTop < scrollElement.scrollTop || rowBottom > viewportBottom) {
            scrollElement.scrollTop = getCenteredTreeScrollTop(scrollElement, rowTop, model.getItemHeight());
        }
    }

    requestAnimationFrame(() => {
        if (adjustRenderedTreePathIntoView(model, treePath)) return;
        requestAnimationFrame(() => {
            adjustRenderedTreePathIntoView(model, treePath);
        });
    });
}

type TreeIndexNode = {
    kind: "directory" | "file";
    path: string;
    children: Map<string, TreeIndexNode>;
};

function createTreeIndexNode(kind: TreeIndexNode["kind"], path: string): TreeIndexNode {
    return { kind, path, children: new Map() };
}

function addTreeIndexPath(root: TreeIndexNode, treePath: string) {
    const segments = treePath.split("/").filter(Boolean);
    let node = root;
    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        if (!segment) continue;
        const isLast = index === segments.length - 1;
        const kind = isLast && !treePath.endsWith("/") ? "file" : "directory";
        const path = segments.slice(0, index + 1).join("/") + (kind === "directory" ? "/" : "");
        const child = node.children.get(segment) ?? createTreeIndexNode(kind, path);
        node.children.set(segment, child);
        node = child;
    }
}

function getFlattenedDirectoryNode(node: TreeIndexNode) {
    let current = node;
    while (current.children.size === 1) {
        const child = current.children.values().next().value;
        if (!child || child.kind !== "directory") break;
        current = child;
    }
    return current;
}

function createVisibleTreePathIndex(treePaths: readonly string[]) {
    const root = createTreeIndexNode("directory", "");
    for (const treePath of treePaths) {
        addTreeIndexPath(root, treePath);
    }

    const indexByPath = new Map<string, number>();
    let rowIndex = 0;
    const visit = (node: TreeIndexNode) => {
        if (node.kind === "file") {
            indexByPath.set(node.path, rowIndex);
            rowIndex += 1;
            return;
        }

        const visibleNode = getFlattenedDirectoryNode(node);
        if (visibleNode.path) {
            indexByPath.set(visibleNode.path, rowIndex);
            rowIndex += 1;
        }
        for (const child of visibleNode.children.values()) {
            visit(child);
        }
    };

    for (const child of root.children.values()) {
        visit(child);
    }
    return indexByPath;
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
    const initialIconsRef = useRef(icons);
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
    const visibleTreePathIndex = useMemo(() => createVisibleTreePathIndex(preparedInput.paths), [preparedInput]);

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
                icons: initialIconsRef.current,
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
        [preparedInput, treeDensity, treeSort],
    );

    useEffect(() => {
        return () => {
            model.cleanUp();
        };
    }, [model]);

    useEffect(() => {
        model.setIcons(icons);
    }, [icons, model]);

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
        revealTreePath(model, treePath, visibleTreePathIndex.get(treePath));
    }, [model, selectedAppPath, visibleTreePathIndex]);

    return model;
}

export function AppFileTreeView({
    className,
    header,
    model,
    onTreeItemClick,
    style,
}: {
    className?: string;
    header?: ReactNode;
    model: PierreFileTree;
    onTreeItemClick?: (treePath: string) => void;
    style?: CSSProperties;
}) {
    const hostStyle = useMemo(() => ({ ...TREE_HOST_STYLE, ...style }), [style]);
    useEffect(() => {
        const handleSearchShortcut = (event: globalThis.KeyboardEvent) => {
            if (!isTreeSearchShortcut(event)) return;
            const hostElement = model.getFileTreeContainer();
            if (!hostElement) return;
            event.preventDefault();
            event.stopPropagation();
            getTreeSearchInput(hostElement)?.focus();
        };
        window.addEventListener("keydown", handleSearchShortcut, true);
        return () => window.removeEventListener("keydown", handleSearchShortcut, true);
    }, [model]);
    const handleClickCapture = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (!eventPathContainsTreeItem(event)) return;
            const treePath = getTreeItemPathFromEvent(event);
            if (treePath) {
                onTreeItemClick?.(treePath);
            }
            const hostElement = event.currentTarget;
            requestAnimationFrame(() => blurActiveTreeItem(hostElement));
        },
        [onTreeItemClick],
    );
    const handleKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
        if (isTreeSearchInputEvent(event)) return;
        if (isTreeSearchShortcut(event)) {
            event.preventDefault();
            event.stopPropagation();
            getTreeSearchInput(event.currentTarget)?.focus();
            return;
        }
        if (!isImplicitTreeSearchKey(event)) return;
        event.preventDefault();
        event.stopPropagation();
    }, []);
    return (
        <PierreReactFileTree
            className={className}
            header={header}
            model={model}
            onClickCapture={handleClickCapture}
            onKeyDownCapture={handleKeyDownCapture}
            style={hostStyle}
        />
    );
}

export function FileTree(props: AppFileTreeProps) {
    const { className, header, onTreeItemClick, style, ...modelProps } = props;
    const model = useAppFileTreeModel(modelProps);
    return <AppFileTreeView className={className} header={header} model={model} onTreeItemClick={onTreeItemClick} style={style} />;
}
