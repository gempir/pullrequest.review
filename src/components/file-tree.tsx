import { useFileTree, type FileNode, type ChangeKind } from "@/lib/file-tree-context";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileText, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  path: string;
  level?: number;
  kinds?: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  filterQuery?: string;
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

function kindBgColor(kind: ChangeKind) {
  switch (kind) {
    case "add":
      return "bg-[#22c55e]";
    case "del":
      return "bg-[#ef4444]";
    case "mix":
      return "bg-[#eab308]";
  }
}

function kindLabel(kind: ChangeKind) {
  switch (kind) {
    case "add":
      return "A";
    case "del":
      return "D";
    case "mix":
      return "M";
  }
}

export function FileTree({
  path,
  level = 0,
  kinds,
  activeFile,
  filterQuery,
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
    if (!normalizedQuery) return true;
    if (node.type === "file") {
      return node.path.toLowerCase().includes(normalizedQuery);
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
  viewedFiles,
  onToggleViewed,
  onFileClick,
}: {
  node: FileNode;
  level: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  filterQuery?: string;
  viewedFiles?: ReadonlySet<string>;
  onToggleViewed?: (path: string) => void;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const expanded = tree.isExpanded(node.path);
  const kind = kinds.get(node.path);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => (open ? tree.expand(node.path) : tree.collapse(node.path))}
    >
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full min-w-0 flex items-center gap-1.5 py-1 text-left",
            "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
            "text-[12px] text-muted-foreground",
          )}
          style={{ paddingLeft: `${4 + level * 12}px` }}
        >
          <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground">
            {expanded ? (
              <FolderOpen className="size-3.5" />
            ) : (
              <Folder className="size-3.5" />
            )}
          </span>
          <span className={cn("flex-1 min-w-0 truncate", kind && kindColor(kind))}>
            {node.name}
          </span>
          {kind && (
            <div className={cn("shrink-0 size-1.5 mr-1", kindBgColor(kind))} />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
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
            viewedFiles={viewedFiles}
            onToggleViewed={onToggleViewed}
            onFileClick={onFileClick}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
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
      className={cn(
        "w-full min-w-0 flex items-center gap-1.5 py-1 text-left",
        "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
        "text-[12px]",
        isActive 
          ? "bg-accent text-accent-foreground" 
          : "text-muted-foreground",
      )}
      style={{ paddingLeft: `${4 + level * 12 + 12}px` }}
      onClick={() => {
        tree.setActiveFile(node.path);
        onFileClick?.(node);
      }}
    >
      <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground/60">
        <FileText className="size-3.5" />
      </span>
      <span className={cn("flex-1 min-w-0 truncate", kind && kindColor(kind))}>
        {node.name}
      </span>
      <input
        type="checkbox"
        checked={Boolean(viewed)}
        onChange={(e) => {
          e.stopPropagation();
          onToggleViewed?.(node.path);
        }}
        onClick={(e) => e.stopPropagation()}
        className="size-3.5"
        aria-label={`Mark ${node.path} as viewed`}
      />
      {kind && (
        <span 
          className={cn(
            "shrink-0 w-4 text-center text-[10px] font-medium",
            kindColor(kind)
          )}
        >
          {kindLabel(kind)}
        </span>
      )}
    </button>
  );
}
