import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readTreeSettingsRecord, writeTreeSettingsRecord } from "@/lib/data/query-collections";

export type FileNodeType = "summary" | "file" | "directory";
export type ChangeKind = "add" | "del" | "mix";

export interface FileNode {
    name: string;
    path: string;
    type: FileNodeType;
    children?: FileNode[];
}

interface DirectoryState {
    expanded: boolean;
}

interface FileTreeContextType {
    root: FileNode[];
    kinds: ReadonlyMap<string, ChangeKind>;
    dirState: Record<string, DirectoryState>;
    activeFile: string | undefined;
    compactSingleChildDirectories: boolean;
    treeIndentSize: number;
    setTree: (tree: FileNode[]) => void;
    setKinds: (kinds: ReadonlyMap<string, ChangeKind>) => void;
    reset: () => void;
    expand: (path: string) => void;
    collapse: (path: string) => void;
    toggle: (path: string) => void;
    setDirectoryExpandedMap: (next: Record<string, boolean>) => void;
    isExpanded: (path: string) => boolean;
    setActiveFile: (path: string | undefined) => void;
    setCompactSingleChildDirectories: (enabled: boolean) => void;
    setTreeIndentSize: (size: number) => void;
    resetTreePreferences: () => void;
    firstFile: () => string | undefined;
    ensureActiveFile: (allowedPaths?: ReadonlySet<string>) => string | undefined;
    getChildrenForPath: (path: string) => FileNode[];
    navigateToNextFile: () => string | undefined;
    navigateToPreviousFile: () => string | undefined;
    allFiles: () => FileNode[];
}

const FileTreeContext = createContext<FileTreeContextType | null>(null);
const DEFAULT_TREE_INDENT_SIZE = 8;
const MIN_TREE_INDENT_SIZE = 8;
const MAX_TREE_INDENT_SIZE = 24;

function sortTree(nodes: FileNode[]): FileNode[] {
    const sorted = [...nodes].sort((a, b) => {
        if (a.type !== b.type) {
            if (a.type === "summary") return -1;
            if (b.type === "summary") return 1;
            return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    for (const node of sorted) {
        if (node.type === "directory" && node.children) {
            node.children = sortTree(node.children);
        }
    }
    return sorted;
}

export function buildTreeFromPaths(paths: string[]): FileNode[] {
    const root: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    for (const rawPath of paths) {
        const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
        if (!normalized) continue;
        const parts = normalized.split("/").filter(Boolean);
        let currentPath = "";
        let children = root;

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isFile = index === parts.length - 1;
            if (isFile) {
                if (!children.some((node) => node.path === currentPath)) {
                    children.push({ name: part, path: currentPath, type: "file" });
                }
                return;
            }

            let dirNode = dirMap.get(currentPath);
            if (!dirNode) {
                dirNode = {
                    name: part,
                    path: currentPath,
                    type: "directory",
                    children: [],
                };
                dirMap.set(currentPath, dirNode);
                children.push(dirNode);
            }
            children = dirNode.children ?? [];
            dirNode.children = children;
        });
    }

    return sortTree(root);
}

export function buildKindMapForTree(root: FileNode[], fileKinds: ReadonlyMap<string, ChangeKind>): ReadonlyMap<string, ChangeKind> {
    const result = new Map(fileKinds);

    const visit = (node: FileNode): ChangeKind | undefined => {
        if (node.type === "summary") {
            return undefined;
        }
        if (node.type === "file") {
            return fileKinds.get(node.path);
        }
        const childKinds = (node.children ?? []).map(visit).filter((kind): kind is ChangeKind => Boolean(kind));
        if (childKinds.length === 0) return undefined;
        const unique = new Set(childKinds);
        const kind = unique.size === 1 ? childKinds[0] : "mix";
        result.set(node.path, kind);
        return kind;
    };

    root.forEach(visit);
    return result;
}

function buildNodeIndex(nodes: FileNode[]): Map<string, FileNode[]> {
    const index = new Map<string, FileNode[]>();

    const visit = (parentPath: string, children: FileNode[]) => {
        index.set(parentPath, children);
        for (const node of children) {
            if (node.type === "directory" && node.children) {
                visit(node.path, node.children);
            }
        }
    };

    visit("", nodes);
    return index;
}

function getAllFiles(nodes: FileNode[]): FileNode[] {
    const files: FileNode[] = [];
    const visit = (node: FileNode) => {
        if (node.type === "file" || node.type === "summary") {
            files.push(node);
        } else if (node.children) {
            node.children.forEach(visit);
        }
    };
    nodes.forEach(visit);
    return files;
}

function useFileTreeProviderValue(): FileTreeContextType {
    const [tree, setTree] = useState<FileNode[]>([]);
    const [kinds, setKinds] = useState<ReadonlyMap<string, ChangeKind>>(new Map());
    const [dirState, setDirState] = useState<Record<string, DirectoryState>>({
        "": { expanded: true },
    });
    const [activeFile, setActiveFile] = useState<string | undefined>();
    const [compactSingleChildDirectories, setCompactSingleChildDirectories] = useState(true);
    const [treeIndentSize, setTreeIndentSizeState] = useState(DEFAULT_TREE_INDENT_SIZE);

    useEffect(() => {
        const stored = readTreeSettingsRecord();
        if (stored) {
            setCompactSingleChildDirectories(stored.compactSingleChildDirectories);
            const parsedIndentSize = Number(stored.treeIndentSize);
            if (Number.isFinite(parsedIndentSize) && parsedIndentSize >= MIN_TREE_INDENT_SIZE && parsedIndentSize <= MAX_TREE_INDENT_SIZE) {
                setTreeIndentSizeState(parsedIndentSize);
            }
        }
    }, []);

    useEffect(() => {
        writeTreeSettingsRecord({ compactSingleChildDirectories, treeIndentSize });
    }, [compactSingleChildDirectories, treeIndentSize]);

    const setTreeIndentSize = useCallback((size: number) => {
        const next = Math.max(MIN_TREE_INDENT_SIZE, Math.min(MAX_TREE_INDENT_SIZE, Math.round(size)));
        setTreeIndentSizeState(next);
    }, []);

    const nodeIndex = useMemo(() => buildNodeIndex(tree), [tree]);

    const isExpanded = useCallback((path: string) => dirState[path]?.expanded ?? true, [dirState]);

    const expand = useCallback((path: string) => {
        setDirState((prev) => ({ ...prev, [path]: { expanded: true } }));
    }, []);

    const collapse = useCallback((path: string) => {
        setDirState((prev) => ({ ...prev, [path]: { expanded: false } }));
    }, []);

    const toggle = useCallback((path: string) => {
        setDirState((prev) => ({
            ...prev,
            [path]: { expanded: !(prev[path]?.expanded ?? true) },
        }));
    }, []);

    const setDirectoryExpandedMap = useCallback((next: Record<string, boolean>) => {
        const mapped: Record<string, DirectoryState> = {
            "": { expanded: true },
        };
        for (const [path, expanded] of Object.entries(next)) {
            if (!path) continue;
            mapped[path] = { expanded };
        }
        setDirState(mapped);
    }, []);

    const getChildren = useCallback((path: string) => nodeIndex.get(path) ?? [], [nodeIndex]);

    const reset = useCallback(() => {
        setTree([]);
        setKinds(new Map());
        setDirState({ "": { expanded: true } });
        setActiveFile(undefined);
    }, []);

    const resetTreePreferences = useCallback(() => {
        setCompactSingleChildDirectories(true);
        setTreeIndentSizeState(DEFAULT_TREE_INDENT_SIZE);
    }, []);

    const allFiles = useCallback(() => getAllFiles(tree), [tree]);
    const firstFile = useCallback(() => getAllFiles(tree)[0]?.path, [tree]);

    const ensureActiveFile = useCallback(
        (allowedPaths?: ReadonlySet<string>) => {
            const files = getAllFiles(tree);
            if (files.length === 0) {
                setActiveFile(undefined);
                return undefined;
            }

            if (activeFile) {
                const exists = files.some((file) => file.path === activeFile);
                const allowed = allowedPaths ? allowedPaths.has(activeFile) : true;
                if (exists && allowed) return activeFile;
            }

            const next = allowedPaths ? files.find((file) => allowedPaths.has(file.path))?.path : files[0]?.path;
            setActiveFile(next);
            return next;
        },
        [tree, activeFile],
    );

    const navigateToNextFile = useCallback(() => {
        const files = getAllFiles(tree);
        if (files.length === 0) return undefined;

        if (!activeFile) {
            const firstFile = files[0];
            setActiveFile(firstFile.path);
            return firstFile.path;
        }

        const currentIndex = files.findIndex((f) => f.path === activeFile);
        if (currentIndex === -1) {
            const firstFile = files[0];
            setActiveFile(firstFile.path);
            return firstFile.path;
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex < files.length) {
            const nextFile = files[nextIndex];
            setActiveFile(nextFile.path);
            return nextFile.path;
        }

        return activeFile;
    }, [tree, activeFile]);

    const navigateToPreviousFile = useCallback(() => {
        const files = getAllFiles(tree);
        if (files.length === 0) return undefined;

        if (!activeFile) {
            const lastFile = files[files.length - 1];
            setActiveFile(lastFile.path);
            return lastFile.path;
        }

        const currentIndex = files.findIndex((f) => f.path === activeFile);
        if (currentIndex === -1) {
            const lastFile = files[files.length - 1];
            setActiveFile(lastFile.path);
            return lastFile.path;
        }

        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
            const prevFile = files[prevIndex];
            setActiveFile(prevFile.path);
            return prevFile.path;
        }

        return activeFile;
    }, [tree, activeFile]);

    const value = useMemo(
        () => ({
            root: tree,
            kinds,
            dirState,
            activeFile,
            compactSingleChildDirectories,
            treeIndentSize,
            setTree,
            setKinds,
            reset,
            expand,
            collapse,
            toggle,
            setDirectoryExpandedMap,
            isExpanded,
            setActiveFile,
            setCompactSingleChildDirectories,
            setTreeIndentSize,
            resetTreePreferences,
            firstFile,
            ensureActiveFile,
            getChildrenForPath: getChildren,
            navigateToNextFile,
            navigateToPreviousFile,
            allFiles,
        }),
        [
            tree,
            kinds,
            dirState,
            activeFile,
            compactSingleChildDirectories,
            treeIndentSize,
            reset,
            expand,
            collapse,
            toggle,
            setDirectoryExpandedMap,
            isExpanded,
            resetTreePreferences,
            firstFile,
            setTreeIndentSize,
            ensureActiveFile,
            getChildren,
            navigateToNextFile,
            navigateToPreviousFile,
            allFiles,
        ],
    );

    return value;
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
