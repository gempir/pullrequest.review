import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from "react";

export type FileNodeType = "file" | "directory";
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
  setTree: (tree: FileNode[]) => void;
  setKinds: (kinds: ReadonlyMap<string, ChangeKind>) => void;
  reset: () => void;
  expand: (path: string) => void;
  collapse: (path: string) => void;
  toggle: (path: string) => void;
  isExpanded: (path: string) => boolean;
  setActiveFile: (path: string | undefined) => void;
  children: (path: string) => FileNode[];
}

const FileTreeContext = createContext<FileTreeContextType | null>(null);

function sortTree(nodes: FileNode[]): FileNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
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
        dirNode = { name: part, path: currentPath, type: "directory", children: [] };
        dirMap.set(currentPath, dirNode);
        children.push(dirNode);
      }
      children = dirNode.children ?? [];
      dirNode.children = children;
    });
  }

  return sortTree(root);
}

export function buildKindMapForTree(
  root: FileNode[],
  fileKinds: ReadonlyMap<string, ChangeKind>,
): ReadonlyMap<string, ChangeKind> {
  const result = new Map(fileKinds);

  const visit = (node: FileNode): ChangeKind | undefined => {
    if (node.type === "file") {
      return fileKinds.get(node.path);
    }
    const childKinds = (node.children ?? [])
      .map(visit)
      .filter((kind): kind is ChangeKind => Boolean(kind));
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

export function FileTreeProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [kinds, setKinds] = useState<ReadonlyMap<string, ChangeKind>>(new Map());
  const [dirState, setDirState] = useState<Record<string, DirectoryState>>({
    "": { expanded: true },
  });
  const [activeFile, setActiveFile] = useState<string | undefined>();

  const nodeIndex = useMemo(() => buildNodeIndex(tree), [tree]);

  const isExpanded = useCallback(
    (path: string) => dirState[path]?.expanded ?? false,
    [dirState],
  );

  const expand = useCallback((path: string) => {
    setDirState((prev) => ({ ...prev, [path]: { expanded: true } }));
  }, []);

  const collapse = useCallback((path: string) => {
    setDirState((prev) => ({ ...prev, [path]: { expanded: false } }));
  }, []);

  const toggle = useCallback(
    (path: string) => {
      setDirState((prev) => ({
        ...prev,
        [path]: { expanded: !(prev[path]?.expanded ?? false) },
      }));
    },
    [],
  );

  const getChildren = useCallback(
    (path: string) => nodeIndex.get(path) ?? [],
    [nodeIndex],
  );

  const reset = useCallback(() => {
    setTree([]);
    setKinds(new Map());
    setDirState({ "": { expanded: true } });
    setActiveFile(undefined);
  }, []);

  return (
    <FileTreeContext.Provider
      value={{
        root: tree,
        kinds,
        dirState,
        activeFile,
        setTree,
        setKinds,
        reset,
        expand,
        collapse,
        toggle,
        isExpanded,
        setActiveFile,
        children: getChildren,
      }}
    >
      {children}
    </FileTreeContext.Provider>
  );
}

export function useFileTree() {
  const ctx = useContext(FileTreeContext);
  if (!ctx) throw new Error("useFileTree must be used within FileTreeProvider");
  return ctx;
}
