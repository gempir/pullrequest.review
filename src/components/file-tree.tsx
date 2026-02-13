import {
  ChevronDown,
  ChevronRight,
  Command,
  Folder,
  FolderOpen,
  FolderTree,
  MonitorCog,
  ScrollText,
  SlidersHorizontal,
  SwatchBook,
} from "lucide-react";
import { FileIcon } from "react-files-icons";
import {
  type ChangeKind,
  type FileNode,
  useFileTree,
} from "@/lib/file-tree-context";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  path: string;
  level?: number;
  kinds?: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  filterQuery?: string;
  allowedFiles?: ReadonlySet<string>;
  viewedFiles?: ReadonlySet<string>;
  onToggleViewed?: (path: string) => void;
  onFileClick?: (node: FileNode) => void;
}

const SETTINGS_PATH_PREFIX = "__settings__/";

function kindColor(kind: ChangeKind) {
  switch (kind) {
    case "add":
      return "text-[#22c55e]";
    case "del":
      return "text-[#ef4444]";
    case "mix":
      return "text-[#eab308]";
  }
}

function kindMarker(kind?: ChangeKind) {
  if (!kind) return null;
  return (
    <span
      className={cn("h-3 w-0.5 shrink-0 rounded-sm", kindColor(kind))}
      aria-hidden
    />
  );
}

function isSettingsPath(path: string) {
  return path.startsWith(SETTINGS_PATH_PREFIX);
}

function settingsIcon(path: string) {
  if (!isSettingsPath(path)) return null;
  const tab = path.slice(SETTINGS_PATH_PREFIX.length);
  if (tab === "appearance") return <SwatchBook className="size-3.5" />;
  if (tab === "diff") return <SlidersHorizontal className="size-3.5" />;
  if (tab === "tree") return <FolderTree className="size-3.5" />;
  if (tab === "shortcuts") return <Command className="size-3.5" />;
  if (tab === "workspace") return <MonitorCog className="size-3.5" />;
  return null;
}

export function FileTree({
  path,
  level = 0,
  kinds,
  activeFile,
  filterQuery,
  allowedFiles,
  viewedFiles,
  onToggleViewed,
  onFileClick,
}: FileTreeProps) {
  const tree = useFileTree();
  const resolvedKinds = kinds ?? tree.kinds;
  const rawNodes = tree.children(path);
  const active = activeFile ?? tree.activeFile;
  const treeIndentSize = tree.treeIndentSize;
  const normalizedQuery = filterQuery?.trim().toLowerCase() ?? "";

  const matchesNode = (node: FileNode): boolean => {
    if (node.type === "summary") {
      if (!normalizedQuery) return true;
      const summarySearch = `${node.name} ${node.path}`.toLowerCase();
      return summarySearch.includes(normalizedQuery);
    }
    if (node.type === "file") {
      const queryMatch =
        !normalizedQuery || node.path.toLowerCase().includes(normalizedQuery);
      const allowedMatch = !allowedFiles || allowedFiles.has(node.path);
      return queryMatch && allowedMatch;
    }
    const children = tree.children(node.path);
    return children.some(matchesNode);
  };

  const nodes = rawNodes.filter(matchesNode);

  return (
    <div className="flex flex-col tree-font-scope">
      {nodes.map((node) => {
        if (node.type === "directory") {
          return (
            <DirectoryNode
              key={node.path}
              node={node}
              level={level}
              treeIndentSize={treeIndentSize}
              kinds={resolvedKinds}
              activeFile={active}
              filterQuery={filterQuery}
              allowedFiles={allowedFiles}
              viewedFiles={viewedFiles}
              onToggleViewed={onToggleViewed}
              onFileClick={onFileClick}
            />
          );
        }
        return (
          <FileNodeRow
            key={node.path}
            node={node}
            level={level}
            treeIndentSize={treeIndentSize}
            kinds={resolvedKinds}
            active={active}
            viewed={viewedFiles?.has(node.path)}
            onFileClick={onFileClick}
          />
        );
      })}
    </div>
  );
}

function DirectoryNode({
  node,
  level,
  treeIndentSize,
  kinds,
  activeFile,
  filterQuery,
  allowedFiles,
  viewedFiles,
  onToggleViewed,
  onFileClick,
}: {
  node: FileNode;
  level: number;
  treeIndentSize: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  filterQuery?: string;
  allowedFiles?: ReadonlySet<string>;
  viewedFiles?: ReadonlySet<string>;
  onToggleViewed?: (path: string) => void;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const compactEnabled = tree.compactSingleChildDirectories;
  let displayNode = node;
  const nameParts = [node.name];

  if (compactEnabled) {
    while (true) {
      const children = tree.children(displayNode.path);
      if (children.length !== 1) break;
      const nextNode = children[0];
      if (nextNode.type !== "directory") break;
      nameParts.push(nextNode.name);
      displayNode = nextNode;
    }
  }

  const expanded = tree.isExpanded(displayNode.path);
  const kind = kinds.get(displayNode.path);
  const displayName = nameParts.join("/");

  return (
    <div>
      <button
        type="button"
        className={cn(
          "group w-full min-w-0 flex items-center gap-3 py-1 text-left",
          "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
          "text-muted-foreground",
        )}
        style={{ paddingLeft: `${4 + level * treeIndentSize}px` }}
        onClick={() => tree.toggle(displayNode.path)}
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "relative size-4 flex items-center justify-center shrink-0 text-muted-foreground",
          )}
        >
          <span className="group-hover:hidden">
            {expanded ? (
              <FolderOpen className="size-3.5" />
            ) : (
              <Folder className="size-3.5" />
            )}
          </span>
          <span className="absolute inset-0 hidden items-center justify-center group-hover:flex">
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        </span>
        {kindMarker(kind)}
        <span className="flex-1 min-w-0 truncate text-foreground">
          {displayName}
        </span>
      </button>
      {expanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border opacity-30"
            style={{ left: `${4 + level * treeIndentSize + 8}px` }}
          />
          <FileTree
            path={displayNode.path}
            level={level + 1}
            kinds={kinds}
            activeFile={activeFile}
            filterQuery={filterQuery}
            allowedFiles={allowedFiles}
            viewedFiles={viewedFiles}
            onToggleViewed={onToggleViewed}
            onFileClick={onFileClick}
          />
        </div>
      )}
    </div>
  );
}

function FileNodeRow({
  node,
  level,
  treeIndentSize,
  kinds,
  active,
  viewed,
  onFileClick,
}: {
  node: FileNode;
  level: number;
  treeIndentSize: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  active?: string;
  viewed?: boolean;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const kind = node.type === "summary" ? undefined : kinds.get(node.path);
  const nodeSettingsIcon =
    node.type === "file" ? settingsIcon(node.path) : null;
  const isSettingsNode = node.type === "file" && isSettingsPath(node.path);
  const isActive = node.path === active;

  return (
    <button
      type="button"
      className={cn(
        "w-full min-w-0 flex items-center gap-3 py-1 text-left",
        "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
      style={{ paddingLeft: `${4 + level * treeIndentSize}px` }}
      onClick={() => {
        tree.setActiveFile(node.path);
        onFileClick?.(node);
      }}
    >
      <span className={cn("size-4 flex items-center justify-center shrink-0")}>
        {node.type === "summary" ? (
          <ScrollText className="size-3.5" />
        ) : nodeSettingsIcon ? (
          nodeSettingsIcon
        ) : (
          <FileIcon name={node.name} className="size-3.5" />
        )}
      </span>
      {kindMarker(kind)}
      <span className="flex-1 min-w-0 truncate pr-2 text-foreground">
        {node.name}
      </span>
      {node.type !== "summary" && !isSettingsNode && !viewed && (
        <span
          className="sticky right-2 ml-auto size-2.5 shrink-0 rounded-full bg-accent"
          aria-hidden
        />
      )}
    </button>
  );
}
