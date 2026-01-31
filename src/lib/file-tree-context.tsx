import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
  dirState: Record<string, DirectoryState>;
  activeFile: string | undefined;
  expand: (path: string) => void;
  collapse: (path: string) => void;
  toggle: (path: string) => void;
  isExpanded: (path: string) => boolean;
  setActiveFile: (path: string | undefined) => void;
  children: (path: string) => FileNode[];
}

const FileTreeContext = createContext<FileTreeContextType | null>(null);

// Dummy data mimicking a real repo structure
const DUMMY_TREE: FileNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "components",
        path: "src/components",
        type: "directory",
        children: [
          { name: "Header.tsx", path: "src/components/Header.tsx", type: "file" },
          { name: "Footer.tsx", path: "src/components/Footer.tsx", type: "file" },
          {
            name: "ui",
            path: "src/components/ui",
            type: "directory",
            children: [
              { name: "Button.tsx", path: "src/components/ui/Button.tsx", type: "file" },
              { name: "Input.tsx", path: "src/components/ui/Input.tsx", type: "file" },
              { name: "Modal.tsx", path: "src/components/ui/Modal.tsx", type: "file" },
            ],
          },
        ],
      },
      {
        name: "hooks",
        path: "src/hooks",
        type: "directory",
        children: [
          { name: "useAuth.ts", path: "src/hooks/useAuth.ts", type: "file" },
          { name: "useApi.ts", path: "src/hooks/useApi.ts", type: "file" },
        ],
      },
      {
        name: "lib",
        path: "src/lib",
        type: "directory",
        children: [
          { name: "utils.ts", path: "src/lib/utils.ts", type: "file" },
          { name: "api.ts", path: "src/lib/api.ts", type: "file" },
        ],
      },
      {
        name: "routes",
        path: "src/routes",
        type: "directory",
        children: [
          { name: "index.tsx", path: "src/routes/index.tsx", type: "file" },
          { name: "login.tsx", path: "src/routes/login.tsx", type: "file" },
          { name: "dashboard.tsx", path: "src/routes/dashboard.tsx", type: "file" },
        ],
      },
      { name: "app.tsx", path: "src/app.tsx", type: "file" },
      { name: "main.ts", path: "src/main.ts", type: "file" },
    ],
  },
  {
    name: "public",
    path: "public",
    type: "directory",
    children: [
      { name: "favicon.ico", path: "public/favicon.ico", type: "file" },
      { name: "robots.txt", path: "public/robots.txt", type: "file" },
    ],
  },
  { name: "package.json", path: "package.json", type: "file" },
  { name: "tsconfig.json", path: "tsconfig.json", type: "file" },
  { name: "README.md", path: "README.md", type: "file" },
];

// Dummy change kinds for some files
export const DUMMY_KINDS = new Map<string, ChangeKind>([
  ["src/components/Header.tsx", "mix"],
  ["src/components/ui/Button.tsx", "mix"],
  ["src/hooks/useAuth.ts", "mix"],
  ["src/lib/api.ts", "add"],
  ["src/routes/dashboard.tsx", "add"],
  ["src/main.ts", "del"],
]);

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
  const [dirState, setDirState] = useState<Record<string, DirectoryState>>({
    "": { expanded: true },
    src: { expanded: true },
  });
  const [activeFile, setActiveFile] = useState<string | undefined>();

  const nodeIndex = buildNodeIndex(DUMMY_TREE);

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
    [],
  );

  return (
    <FileTreeContext.Provider
      value={{
        root: DUMMY_TREE,
        dirState,
        activeFile,
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
