import {
    ChevronDown,
    ChevronRight,
    Command,
    Folder,
    FolderOpen,
    FolderTree,
    GitPullRequest,
    House,
    MonitorCog,
    ScrollText,
    SlidersHorizontal,
    SwatchBook,
} from "lucide-react";
import { GitHostIcon } from "@/components/git-host-icon";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { type ChangeKind, type FileNode, useFileTree } from "@/lib/file-tree-context";
import type { GitHost } from "@/lib/git-host/types";
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
    onDirectoryClick?: (node: FileNode) => boolean | undefined;
    showUnviewedIndicator?: boolean;
}

const SETTINGS_PATH_PREFIX = "__settings__/";
const HOME_PATH = "__home__";
const PR_PATH_PREFIX = "pr:";
const REPO_PATH_PREFIX = "repo:";
const HOST_PATH_PREFIX = "host:";

function kindColor(kind: ChangeKind) {
    switch (kind) {
        case "add":
            return "text-status-added";
        case "del":
            return "text-status-removed";
        case "mix":
            return "text-status-modified";
    }
}

function kindMarker(kind?: ChangeKind) {
    if (!kind) return null;
    return <span className={cn("h-3 w-0.5 shrink-0 rounded-sm", kindColor(kind))} aria-hidden />;
}

function isSettingsPath(path: string) {
    return path.startsWith(SETTINGS_PATH_PREFIX);
}

function isHomePath(path: string) {
    return path === HOME_PATH;
}

function isPullRequestPath(path: string) {
    return path.startsWith(PR_PATH_PREFIX);
}

function isRepositoryPath(path: string) {
    return path.startsWith(REPO_PATH_PREFIX);
}

function isHostPath(path: string) {
    return path.startsWith(HOST_PATH_PREFIX);
}

function hostFromTreePath(path: string): GitHost | null {
    const [, host] = path.split(":");
    if (host === "github" || host === "bitbucket") return host;
    return null;
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
    onDirectoryClick,
    showUnviewedIndicator = true,
}: FileTreeProps) {
    const tree = useFileTree();
    const resolvedKinds = kinds ?? tree.kinds;
    const rawNodes = tree.getChildrenForPath(path);
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
            const queryMatch = !normalizedQuery || node.path.toLowerCase().includes(normalizedQuery);
            const allowedMatch = !allowedFiles || allowedFiles.has(node.path);
            return queryMatch && allowedMatch;
        }
        const children = tree.getChildrenForPath(node.path);
        const host = hostFromTreePath(node.path);
        if (host && children.length === 0) {
            if (!normalizedQuery) return true;
            const hostSearch = `${node.name} ${node.path}`.toLowerCase();
            return hostSearch.includes(normalizedQuery);
        }
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
                            onDirectoryClick={onDirectoryClick}
                            showUnviewedIndicator={showUnviewedIndicator}
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
                        showUnviewedIndicator={showUnviewedIndicator}
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
    onDirectoryClick,
    showUnviewedIndicator,
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
    onDirectoryClick?: (node: FileNode) => boolean | undefined;
    showUnviewedIndicator: boolean;
}) {
    const tree = useFileTree();
    const compactEnabled = tree.compactSingleChildDirectories;
    let displayNode = node;
    const nameParts = [node.name];

    // Keep host roots stable and visible in landing trees.
    if (compactEnabled && !isHostPath(node.path)) {
        while (true) {
            const children = tree.getChildrenForPath(displayNode.path);
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
    const host = hostFromTreePath(displayNode.path);
    const isActive = activeFile === displayNode.path;
    const isRepositoryNode = isRepositoryPath(displayNode.path);
    const pullRequestCount = isRepositoryNode
        ? tree.getChildrenForPath(displayNode.path).filter((child) => child.type === "file" && isPullRequestPath(child.path)).length
        : 0;

    return (
        <div>
            <button
                type="button"
                className={cn(
                    "group w-full min-w-0 flex items-center gap-3 py-1 text-left",
                    "hover:bg-sidebar/70 active:bg-sidebar/90 transition-colors cursor-pointer",
                    isActive ? "bg-sidebar text-foreground" : "text-muted-foreground",
                )}
                style={{ paddingLeft: `${4 + level * treeIndentSize}px` }}
                onClick={() => {
                    tree.setActiveFile(displayNode.path);
                    const handled = onDirectoryClick?.(displayNode);
                    if (handled) return;
                    tree.toggle(displayNode.path);
                }}
                aria-expanded={expanded}
            >
                <span className={cn("relative size-4 flex items-center justify-center shrink-0 text-muted-foreground")}>
                    <span className="group-hover:hidden">
                        {isRepositoryNode ? (
                            <span className="inline-flex h-4 min-w-[14px] items-center justify-center rounded border border-border bg-secondary px-0.5 text-[9px] leading-none text-muted-foreground">
                                {pullRequestCount}
                            </span>
                        ) : host ? (
                            <GitHostIcon host={host} className="size-3.5" />
                        ) : expanded ? (
                            <FolderOpen className="size-3.5" />
                        ) : (
                            <Folder className="size-3.5" />
                        )}
                    </span>
                    <span className="absolute inset-0 hidden items-center justify-center group-hover:flex">
                        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </span>
                </span>
                {kindMarker(kind)}
                <span className="flex-1 min-w-0 truncate text-foreground">{displayName}</span>
            </button>
            {expanded && (
                <div className="relative">
                    <div className="absolute top-0 bottom-0 w-px bg-border opacity-30" style={{ left: `${4 + level * treeIndentSize + 8}px` }} />
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
                        onDirectoryClick={onDirectoryClick}
                        showUnviewedIndicator={showUnviewedIndicator}
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
    showUnviewedIndicator,
}: {
    node: FileNode;
    level: number;
    treeIndentSize: number;
    kinds: ReadonlyMap<string, ChangeKind>;
    active?: string;
    viewed?: boolean;
    onFileClick?: (node: FileNode) => void;
    showUnviewedIndicator: boolean;
}) {
    const tree = useFileTree();
    const kind = node.type === "summary" ? undefined : kinds.get(node.path);
    const nodeSettingsIcon = node.type === "file" ? settingsIcon(node.path) : null;
    const isHomeNode = isHomePath(node.path);
    const isPullRequestNode = isPullRequestPath(node.path);
    const isSettingsNode = node.type === "file" && isSettingsPath(node.path);
    const isActive = node.path === active;

    return (
        <button
            type="button"
            data-tree-path={node.path}
            className={cn(
                "w-full min-w-0 flex items-center gap-3 py-1 text-left",
                "hover:bg-sidebar/70 active:bg-sidebar/90 transition-colors cursor-pointer",
                isActive ? "bg-sidebar text-foreground" : "text-muted-foreground",
            )}
            style={{ paddingLeft: `${4 + level * treeIndentSize}px` }}
            onClick={() => {
                tree.setActiveFile(node.path);
                onFileClick?.(node);
            }}
        >
            <span className={cn("size-4 flex items-center justify-center shrink-0")}>
                {node.type === "summary" ? (
                    isHomeNode ? (
                        <House className="size-3.5" />
                    ) : (
                        <ScrollText className="size-3.5" />
                    )
                ) : nodeSettingsIcon ? (
                    nodeSettingsIcon
                ) : isHomeNode ? (
                    <House className="size-3.5" />
                ) : isPullRequestNode ? (
                    <GitPullRequest className="size-3.5" />
                ) : (
                    <RepositoryFileIcon fileName={node.name} className="size-3.5" />
                )}
            </span>
            {kindMarker(kind)}
            <span className="flex-1 min-w-0 truncate pr-2 text-foreground">{node.name}</span>
            {showUnviewedIndicator && node.type !== "summary" && !isSettingsNode && !isHomeNode && !viewed && (
                <span className="sticky right-2 ml-auto size-2.5 shrink-0 rounded-full bg-status-renamed" aria-hidden />
            )}
        </button>
    );
}
