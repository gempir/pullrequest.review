import { useFileTree, type FileNode, type ChangeKind } from "@/lib/file-tree-context";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  path: string;
  level?: number;
  kinds?: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
  onFileClick?: (node: FileNode) => void;
}

function kindColor(kind: ChangeKind) {
  switch (kind) {
    case "add":
      return "text-green-500";
    case "del":
      return "text-red-500";
    case "mix":
      return "text-yellow-500";
  }
}

function kindBgColor(kind: ChangeKind) {
  switch (kind) {
    case "add":
      return "bg-green-500";
    case "del":
      return "bg-red-500";
    case "mix":
      return "bg-yellow-500";
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
  onFileClick,
}: FileTreeProps) {
  const tree = useFileTree();
  const resolvedKinds = kinds ?? tree.kinds;
  const nodes = tree.children(path);
  const active = activeFile ?? tree.activeFile;

  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        if (node.type === "directory") {
          return (
            <DirectoryNode
              key={node.path}
              node={node}
              level={level}
              kinds={resolvedKinds}
              activeFile={active}
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
  onFileClick,
}: {
  node: FileNode;
  level: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  activeFile?: string;
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
            "w-full min-w-0 h-7 flex items-center gap-1.5 rounded-md px-1.5 text-left",
            "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
            "text-xs text-muted-foreground",
          )}
          style={{ paddingLeft: `${8 + level * 12}px` }}
        >
          <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground/60">
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </span>
          <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground/60">
            {expanded ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />}
          </span>
          <span className={cn("flex-1 min-w-0 truncate", kind && kindColor(kind))}>
            {node.name}
          </span>
          {kind && (
            <div className={cn("shrink-0 size-1.5 rounded-full mr-1", kindBgColor(kind))} />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${8 + level * 12 + 8}px` }}
          />
          <FileTree
            path={node.path}
            level={level + 1}
            kinds={kinds}
            activeFile={activeFile}
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
  onFileClick,
}: {
  node: FileNode;
  level: number;
  kinds: ReadonlyMap<string, ChangeKind>;
  active?: string;
  onFileClick?: (node: FileNode) => void;
}) {
  const tree = useFileTree();
  const kind = kinds.get(node.path);
  const isActive = node.path === active;

  return (
    <button
      className={cn(
        "w-full min-w-0 h-7 flex items-center gap-1.5 rounded-md px-1.5 text-left",
        "hover:bg-accent active:bg-accent/80 transition-colors cursor-pointer",
        "text-xs",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
      style={{ paddingLeft: `${8 + level * 12 + 20}px` }}
      onClick={() => {
        tree.setActiveFile(node.path);
        onFileClick?.(node);
      }}
    >
      <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground/60">
        <File className="size-3.5" />
      </span>
      <span className={cn("flex-1 min-w-0 truncate", kind && kindColor(kind))}>
        {node.name}
      </span>
      {kind && (
        <span className={cn("shrink-0 w-4 text-center text-[11px] font-medium", kindColor(kind))}>
          {kindLabel(kind)}
        </span>
      )}
    </button>
  );
}
