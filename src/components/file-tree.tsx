import {
  useFileTree,
  type FileNode,
  type ChangeKind,
} from "@/lib/file-tree-context";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { FileIcon } from "react-files-icons";
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
  const normalizedQuery = filterQuery?.trim().toLowerCase() ?? "";

  const matchesNode = (node: FileNode): boolean => {
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
    <div className="flex flex-col">
      {nodes.map((node) => {
        if (node.type === "directory") {
          return (
            <DirectoryNode
              key={node.path}
              node={node}
              level={level}
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
            kinds={resolvedKinds}
            active={active}
            viewed={viewedFiles?.has(node.path)}
            onToggleViewed={onToggleViewed}
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
  kinds: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  filterQuery?: string;
  allowedFiles?: ReadonlySet<string>;
  viewedFiles?: ReadonlySet<string>;
  onToggleViewed?: (path: string) => void;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const expanded = tree.isExpanded(node.path);
  const kind = kinds.get(node.path);

  return (
    <div>
      <button
        type="button"
        className={cn(
          "group w-full min-w-0 flex items-center gap-3 py-1 text-left",
          "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
          "text-[12px] text-muted-foreground",
        )}
        style={{ paddingLeft: `${4 + level * 12}px` }}
        onClick={() => tree.toggle(node.path)}
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
          {node.name}
        </span>
      </button>
      {expanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border opacity-30"
            style={{ left: `${4 + level * 12 + 8}px` }}
          />
          <FileTree
            path={node.path}
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
  kinds,
  active,
  viewed,
  onToggleViewed,
  onFileClick,
}: {
  node: FileNode;
  level: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  active?: string;
  viewed?: boolean;
  onToggleViewed?: (path: string) => void;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const kind = kinds.get(node.path);
  const isActive = node.path === active;

  return (
    <button
      type="button"
      className={cn(
        "w-full min-w-0 flex items-center gap-3 py-1 text-left",
        "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
        "text-[12px]",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
      style={{ paddingLeft: `${4 + level * 12}px` }}
      onClick={() => {
        tree.setActiveFile(node.path);
        onFileClick?.(node);
      }}
    >
      <span className={cn("size-4 flex items-center justify-center shrink-0")}>
        <FileIcon name={node.name} className="size-3.5" />
      </span>
      {kindMarker(kind)}
      <span className="flex-1 min-w-0 truncate text-foreground">
        {node.name}
      </span>
      <input
        type="checkbox"
        checked={Boolean(viewed)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleViewed?.(node.path)}
        className={cn(
          "mr-2 size-4 shrink-0 flex items-center justify-center transition-colors",
          viewed
            ? "bg-accent text-foreground"
            : "bg-muted/40 text-transparent border border-border/70",
        )}
        aria-label={`Mark ${node.path} as viewed`}
      />
    </button>
  );
}
