import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePrContext } from "@/lib/pr-context";
import { useDiffOptions, toLibraryOptions } from "@/lib/diff-options-context";
import {
  buildKindMapForTree,
  buildTreeFromPaths,
  useFileTree,
  type ChangeKind,
} from "@/lib/file-tree-context";
import {
  approvePullRequest,
  createPullRequestComment,
  fetchBitbucketPullRequestBundle,
  fetchBitbucketRepoPullRequests,
  mergePullRequest,
  resolvePullRequestComment,
  unapprovePullRequest,
  type BitbucketComment,
} from "@/lib/bitbucket-api";
import { fileAnchorId } from "@/lib/file-anchors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileTree } from "@/components/file-tree";
import { SettingsMenu } from "@/components/settings-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Check,
  FileText,
  GitPullRequest,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

type ViewMode = "single" | "all";

type CommentDraft = {
  content: string;
  line: string;
};

interface CommentThread {
  id: number;
  root: BitbucketComment;
  replies: BitbucketComment[];
}

const TREE_WIDTH_KEY = "pr_review_tree_width";
const TREE_COLLAPSED_KEY = "pr_review_tree_collapsed";
const VIEW_MODE_KEY = "pr_review_diff_view_mode";
const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 520;

function commentThreadSort(a: CommentThread, b: CommentThread) {
  const left = new Date(a.root.created_on ?? 0).getTime();
  const right = new Date(b.root.created_on ?? 0).getTime();
  return left - right;
}

function buildThreads(comments: BitbucketComment[]): CommentThread[] {
  const roots = comments.filter((comment) => !comment.parent?.id);
  const repliesByParent = new Map<number, BitbucketComment[]>();

  for (const comment of comments) {
    const parentId = comment.parent?.id;
    if (!parentId) continue;
    const replies = repliesByParent.get(parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(parentId, replies);
  }

  return roots
    .map((root) => ({
      id: root.id,
      root,
      replies: (repliesByParent.get(root.id) ?? []).sort(
        (a, b) => new Date(a.created_on ?? 0).getTime() - new Date(b.created_on ?? 0).getTime(),
      ),
    }))
    .sort(commentThreadSort);
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function linesUpdated(diffstat: Array<{ lines_added?: number; lines_removed?: number }>) {
  let added = 0;
  let removed = 0;
  for (const entry of diffstat) {
    added += Number(entry.lines_added ?? 0);
    removed += Number(entry.lines_removed ?? 0);
  }
  return { added, removed };
}

function getCommentPath(comment: BitbucketComment) {
  return comment.inline?.path ?? "";
}

function getFilePath(fileDiff: FileDiffMetadata, index: number) {
  return fileDiff.name ?? fileDiff.prevName ?? String(index);
}

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { prUrl, auth, setPrUrl, repos, clearAuth, clearRepos } = usePrContext();
  const { options } = useDiffOptions();
  const libOptions = toLibraryOptions(options);
  const {
    setTree,
    setKinds,
    reset: resetTree,
    firstFile,
    activeFile,
    setActiveFile,
  } = useFileTree();
  const queryClient = useQueryClient();

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [prInput, setPrInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnviewedOnly, setShowUnviewedOnly] = useState(false);
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMessage, setMergeMessage] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState("merge_commit");
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);
  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  const prQuery = useQuery({
    queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken],
    queryFn: () => fetchBitbucketPullRequestBundle({ data: { prUrl, auth } }),
    enabled: Boolean(prUrl),
  });

  const repoPrsQuery = useQuery({
    queryKey: ["bitbucket-repo-prs", repos, auth?.accessToken],
    queryFn: () => fetchBitbucketRepoPullRequests({ data: { repos, auth } }),
    enabled: Boolean(auth?.accessToken) && repos.length > 0 && !prUrl,
  });

  const prData = prQuery.data;

  const viewedStorageKey = useMemo(() => {
    if (!prData) return "";
    return `bitbucket_viewed:${prData.prRef.workspace}/${prData.prRef.repo}/${prData.prRef.pullRequestId}`;
  }, [prData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedWidth = Number(window.localStorage.getItem(TREE_WIDTH_KEY));
    if (Number.isFinite(storedWidth) && storedWidth >= MIN_TREE_WIDTH && storedWidth <= MAX_TREE_WIDTH) {
      setTreeWidth(storedWidth);
    }

    const storedCollapsed = window.localStorage.getItem(TREE_COLLAPSED_KEY);
    if (storedCollapsed === "true") setTreeCollapsed(true);

    const storedMode = window.localStorage.getItem(VIEW_MODE_KEY);
    if (storedMode === "single" || storedMode === "all") {
      setViewMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TREE_WIDTH_KEY, String(treeWidth));
  }, [treeWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TREE_COLLAPSED_KEY, String(treeCollapsed));
  }, [treeCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!viewedStorageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(viewedStorageKey);
      if (!raw) {
        setViewedFiles(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setViewedFiles(new Set(parsed));
    } catch {
      setViewedFiles(new Set());
    }
  }, [viewedStorageKey]);

  useEffect(() => {
    if (!viewedStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(viewedStorageKey, JSON.stringify(Array.from(viewedFiles)));
  }, [viewedStorageKey, viewedFiles]);

  const diffText = prData?.diff ?? "";

  const fileDiffs = useMemo(() => {
    if (!diffText) return [] as FileDiffMetadata[];
    const patches = parsePatchFiles(diffText);
    return patches.flatMap((patch) => patch.files);
  }, [diffText]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDiffs = useMemo(() => {
    return fileDiffs.filter((fileDiff, index) => {
      const filePath = getFilePath(fileDiff, index);
      const path = filePath.toLowerCase();
      const matchesSearch = !normalizedSearch || path.includes(normalizedSearch);
      const matchesViewedFilter = !showUnviewedOnly || !viewedFiles.has(filePath);
      return matchesSearch && matchesViewedFilter;
    });
  }, [fileDiffs, normalizedSearch, showUnviewedOnly, viewedFiles]);

  const diffByPath = useMemo(() => {
    const map = new Map<string, FileDiffMetadata>();
    fileDiffs.forEach((fileDiff, index) => {
      const path = getFilePath(fileDiff, index);
      if (!map.has(path)) map.set(path, fileDiff);
    });
    return map;
  }, [fileDiffs]);

  const visibleFilePaths = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];
    filteredDiffs.forEach((fileDiff, index) => {
      const path = getFilePath(fileDiff, index);
      if (seen.has(path)) return;
      seen.add(path);
      values.push(path);
    });
    return values;
  }, [filteredDiffs]);

  const visiblePathSet = useMemo(() => new Set(visibleFilePaths), [visibleFilePaths]);

  useEffect(() => {
    if (!prData) return;
    const paths = prData.diffstat
      .map((entry) => entry.new?.path ?? entry.old?.path)
      .filter((path): path is string => Boolean(path));

    const tree = buildTreeFromPaths(paths);
    const fileKinds = new Map<string, ChangeKind>();
    for (const entry of prData.diffstat) {
      const path = entry.new?.path ?? entry.old?.path;
      if (!path) continue;
      switch (entry.status) {
        case "added":
          fileKinds.set(path, "add");
          break;
        case "removed":
          fileKinds.set(path, "del");
          break;
        case "modified":
        case "renamed":
          fileKinds.set(path, "mix");
          break;
      }
    }

    setTree(tree);
    setKinds(buildKindMapForTree(tree, fileKinds));
  }, [prData, setKinds, setTree]);

  useEffect(() => {
    if (!prUrl) {
      resetTree();
      setSearchQuery("");
    }
  }, [prUrl, resetTree]);

  useEffect(() => {
    if (visibleFilePaths.length === 0) {
      const fallback = firstFile();
      if (fallback && activeFile !== fallback) {
        setActiveFile(fallback);
      }
      return;
    }

    if (!activeFile || !visiblePathSet.has(activeFile)) {
      setActiveFile(visibleFilePaths[0]);
    }
  }, [activeFile, firstFile, setActiveFile, visibleFilePaths, visiblePathSet]);

  const selectedFilePath = useMemo(() => {
    if (!activeFile) return undefined;
    if (!diffByPath.has(activeFile)) return undefined;
    return activeFile;
  }, [activeFile, diffByPath]);

  const selectedFileDiff = useMemo(() => {
    if (!selectedFilePath) return undefined;
    return diffByPath.get(selectedFilePath);
  }, [diffByPath, selectedFilePath]);

  const comments = prData?.comments ?? [];
  const threads = useMemo(() => buildThreads(comments), [comments]);
  const unresolvedThreads = threads.filter((thread) => !thread.root.resolution && !thread.root.deleted);

  const threadsByPath = useMemo(() => {
    const grouped = new Map<string, CommentThread[]>();
    for (const thread of threads) {
      const path = getCommentPath(thread.root);
      const bucket = grouped.get(path) ?? [];
      bucket.push(thread);
      grouped.set(path, bucket);
    }
    return grouped;
  }, [threads]);

  const selectedThreads = useMemo(() => {
    if (!selectedFilePath) return [] as CommentThread[];
    return (threadsByPath.get(selectedFilePath) ?? []).sort(commentThreadSort);
  }, [selectedFilePath, threadsByPath]);

  const prStats = useMemo(() => {
    const summary = {
      files: prData?.diffstat.length ?? 0,
      added: 0,
      removed: 0,
      modified: 0,
      renamed: 0,
    };

    for (const entry of prData?.diffstat ?? []) {
      if (entry.status === "added") summary.added += 1;
      if (entry.status === "removed") summary.removed += 1;
      if (entry.status === "modified") summary.modified += 1;
      if (entry.status === "renamed") summary.renamed += 1;
    }

    return summary;
  }, [prData?.diffstat]);

  const lineStats = useMemo(() => linesUpdated(prData?.diffstat ?? []), [prData?.diffstat]);

  const isApproved = Boolean(prData?.pr.participants?.some((participant) => participant.approved));

  const approveMutation = useMutation({
    mutationFn: () => approvePullRequest({ data: { prRef: prData!.prRef, auth } }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to approve pull request");
    },
  });

  const unapproveMutation = useMutation({
    mutationFn: () => unapprovePullRequest({ data: { prRef: prData!.prRef, auth } }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to remove approval");
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      mergePullRequest({
        data: {
          prRef: prData!.prRef,
          auth,
          message: mergeMessage,
          mergeStrategy,
          closeSourceBranch,
        },
      }),
    onSuccess: async () => {
      setMergeOpen(false);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to merge pull request");
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (payload: { path: string; content: string; line?: number }) =>
      createPullRequestComment({
        data: {
          prRef: prData!.prRef,
          auth,
          content: payload.content,
          inline: { path: payload.path, to: payload.line },
        },
      }),
    onSuccess: async (_, vars) => {
      setCommentDrafts((prev) => ({
        ...prev,
        [vars.path]: { content: "", line: "" },
      }));
      await queryClient.invalidateQueries({ queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to create comment");
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (payload: { commentId: number; resolve: boolean }) =>
      resolvePullRequestComment({
        data: {
          prRef: prData!.prRef,
          auth,
          commentId: payload.commentId,
          resolve: payload.resolve,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bitbucket-pr-bundle", prUrl, auth?.accessToken] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update comment resolution");
    },
  });

  const toggleViewed = (path: string) => {
    setViewedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const setDraft = (path: string, patch: Partial<CommentDraft>) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [path]: {
        content: patch.content ?? prev[path]?.content ?? "",
        line: patch.line ?? prev[path]?.line ?? "",
      },
    }));
  };

  const submitComment = (path: string) => {
    const draft = commentDrafts[path] ?? { content: "", line: "" };
    const content = draft.content.trim();
    if (!content) return;

    const parsedLine = Number(draft.line);
    const line = Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : undefined;
    createCommentMutation.mutate({ path, content, line });
  };

  const startTreeResize = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!workspaceRef.current) return;

    const initialWidth = treeWidth;
    const startX = event.clientX;
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, initialWidth + delta));
      setTreeWidth(next);
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [treeWidth]);

  if (!prUrl) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="w-full max-w-3xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
            <GitPullRequest className="size-4 text-muted-foreground" />
            <span className="text-[13px] font-medium">Load a Pull Request</span>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Enter a Bitbucket Cloud pull request URL to review.
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="https://bitbucket.org/workspace/repo/pull-requests/123"
                  value={prInput}
                  onChange={(e) => setPrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = prInput.trim();
                      if (trimmed) setPrUrl(trimmed);
                    }
                  }}
                  className="pl-9 font-mono text-xs"
                />
              </div>
              <Button
                onClick={() => {
                  const trimmed = prInput.trim();
                  if (trimmed) setPrUrl(trimmed);
                }}
              >
                Load PR
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
                  Open Pull Requests
                </span>
                <span className="text-[11px] text-muted-foreground">{repos.length} repositories</span>
              </div>

              {repoPrsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-[13px]">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading pull requests...</span>
                </div>
              ) : repoPrsQuery.error ? (
                <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px]">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>
                      [ERROR]{" "}
                      {repoPrsQuery.error instanceof Error
                        ? repoPrsQuery.error.message
                        : "Failed to load pull requests"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border border-border bg-background max-h-80 overflow-auto">
                  <div className="divide-y divide-border">
                    {(repoPrsQuery.data ?? []).map(({ repo, pullRequests }) => (
                      <div key={repo.fullName} className="p-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                          <span className="font-mono">{repo.fullName}</span>
                        </div>
                        {pullRequests.length === 0 ? (
                          <div className="text-[12px] text-muted-foreground py-2">No open pull requests.</div>
                        ) : (
                          <div className="space-y-1">
                            {pullRequests.map((pr) => (
                              <button
                                key={`${repo.fullName}-${pr.id}`}
                                className="w-full text-left border border-border px-3 py-2 text-[13px] hover:bg-accent transition-colors bg-card"
                                onClick={() => {
                                  const href = pr.links?.html?.href;
                                  if (href) setPrUrl(href);
                                }}
                              >
                                <div className="font-medium truncate text-foreground">{pr.title}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  #{pr.id} · {pr.author?.display_name ?? "Unknown author"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (prQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[13px]">Loading pull request...</span>
        </div>
      </div>
    );
  }

  if (prQuery.error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="border border-destructive bg-destructive/10 p-6 max-w-lg">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="size-5" />
            <span className="text-[13px] font-medium">[ERROR]</span>
          </div>
          <p className="text-destructive text-[13px]">
            {prQuery.error instanceof Error ? prQuery.error.message : "Failed to load pull request"}
          </p>
        </div>
      </div>
    );
  }

  if (!prData) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="h-11 px-3 flex items-center gap-3">
          <div className="min-w-0 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate text-foreground font-medium">
              {prData.pr.source?.repository?.full_name ?? "repo"}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="truncate">{prData.pr.destination?.branch?.name ?? "branch"}</span>
            <span className="px-1.5 py-0.5 border border-border bg-secondary uppercase text-[10px] text-foreground">
              {prData.pr.state}
            </span>
            <span className="text-[10px]">#{prData.pr.id}</span>
          </div>

          <div className="flex-1 max-w-lg relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-[12px]"
              placeholder="Search changes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={approveMutation.isPending || unapproveMutation.isPending}
              onClick={() => {
                if (isApproved) {
                  if (!window.confirm("Remove approval from this pull request?")) return;
                  unapproveMutation.mutate();
                  return;
                }
                if (!window.confirm("Approve this pull request?")) return;
                approveMutation.mutate();
              }}
            >
              <Check className="size-3.5" />
              {isApproved ? "Approved" : "Approve"}
            </Button>
            <Button size="sm" className="h-8" onClick={() => setMergeOpen(true)}>
              Merge
            </Button>
            <SettingsMenu
              workspaceMode={viewMode}
              onWorkspaceModeChange={setViewMode}
              onDisconnect={() => {
                setPrUrl("");
                setTreeCollapsed(false);
                setSearchQuery("");
                setCommentDrafts({});
                setViewedFiles(new Set());
                clearRepos();
                clearAuth();
              }}
            />

            <details className="relative">
              <summary className="list-none h-8 px-2 border border-border bg-background hover:bg-accent cursor-pointer text-[12px] flex items-center">
                ...
              </summary>
              <div className="absolute right-0 mt-1 w-72 border border-border bg-card p-3 text-[12px] space-y-2 z-30">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Files</span>
                  <span>{prStats.files}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unresolved threads</span>
                  <span>{unresolvedThreads.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lines added</span>
                  <span className="text-status-added">+{lineStats.added}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lines removed</span>
                  <span className="text-status-removed">-{lineStats.removed}</span>
                </div>
                <div className="pt-2 border-t border-border text-muted-foreground">
                  Author: {prData.pr.author?.display_name ?? "Unknown"}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="border-b border-destructive bg-destructive/10 text-destructive px-3 py-1.5 text-[12px]">
          {actionError}
        </div>
      )}

      <div ref={workspaceRef} className="flex-1 min-h-0 flex">
        <aside
          className="shrink-0 border-r border-border bg-sidebar flex flex-col"
          style={{ width: treeCollapsed ? 36 : treeWidth }}
        >
          {treeCollapsed ? (
            <div className="h-full flex items-start justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setTreeCollapsed(false)}
                aria-label="Expand file tree"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="h-8 px-2 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="uppercase">Files</span>
                <span className="ml-auto">{visibleFilePaths.length}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1.5"
                  onClick={() => setShowUnviewedOnly((prev) => !prev)}
                >
                  <span
                    className={
                      showUnviewedOnly
                        ? "size-3.5 border border-border bg-accent text-foreground flex items-center justify-center"
                        : "size-3.5 border border-input bg-background text-transparent flex items-center justify-center"
                    }
                  >
                    <Check className="size-2.5" />
                  </span>
                  Unviewed
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setTreeCollapsed(true)}
                  aria-label="Collapse file tree"
                >
                  <PanelLeftClose className="size-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <FileTree
                  path=""
                  filterQuery={searchQuery}
                  allowedFiles={visiblePathSet}
                  viewedFiles={viewedFiles}
                  onToggleViewed={toggleViewed}
                  onFileClick={(node) => {
                    const anchor = document.getElementById(fileAnchorId(node.path));
                    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>
            </>
          )}
        </aside>

        {!treeCollapsed && (
          <div
            className="w-1 shrink-0 cursor-col-resize bg-border/30 hover:bg-border"
            onMouseDown={startTreeResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file tree"
          />
        )}

        <main className="flex-1 min-h-0 overflow-auto p-2">
          {viewMode === "single" ? (
            selectedFileDiff && selectedFilePath ? (
              <div id={fileAnchorId(selectedFilePath)} className="border border-border bg-card">
                <div className="border-b border-border px-3 py-2 flex items-center gap-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-mono text-[12px] truncate">{selectedFilePath}</span>
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground"
                    onClick={() => toggleViewed(selectedFilePath)}
                  >
                    <span
                      className={
                        viewedFiles.has(selectedFilePath)
                          ? "size-4 border border-border bg-accent text-foreground flex items-center justify-center"
                          : "size-4 border border-input bg-background text-transparent flex items-center justify-center"
                      }
                    >
                      <Check className="size-3" />
                    </span>
                    Viewed
                  </button>
                </div>

                <div className="border-b border-border bg-background/50 px-3 py-2 flex items-center gap-2">
                  <Input
                    placeholder="line"
                    className="h-7 w-20"
                    value={commentDrafts[selectedFilePath]?.line ?? ""}
                    onChange={(e) => setDraft(selectedFilePath, { line: e.target.value })}
                  />
                  <Input
                    placeholder="Add a file or line comment"
                    className="h-7"
                    value={commentDrafts[selectedFilePath]?.content ?? ""}
                    onChange={(e) => setDraft(selectedFilePath, { content: e.target.value })}
                  />
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={createCommentMutation.isPending}
                    onClick={() => submitComment(selectedFilePath)}
                  >
                    Comment
                  </Button>
                </div>

                <div className="p-3">
                  <FileDiff fileDiff={selectedFileDiff} options={libOptions} />
                </div>

                {selectedThreads.length > 0 && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {selectedThreads.map((thread) => (
                      <div key={thread.id} className="border border-border bg-background p-2 text-[12px]">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <MessageSquare className="size-3.5" />
                          <span>{thread.root.user?.display_name ?? "Unknown"}</span>
                          <span>{formatDate(thread.root.created_on)}</span>
                          <span className="ml-auto">{thread.root.resolution ? "Resolved" : "Unresolved"}</span>
                        </div>
                        <div className="text-[13px] whitespace-pre-wrap">{thread.root.content?.raw ?? ""}</div>
                        {thread.replies.length > 0 && (
                          <div className="mt-2 pl-3 border-l border-border space-y-1">
                            {thread.replies.map((reply) => (
                              <div key={reply.id} className="text-[12px]">
                                <span className="text-muted-foreground">
                                  {reply.user?.display_name ?? "Unknown"}:
                                </span>{" "}
                                {reply.content?.raw ?? ""}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            disabled={resolveCommentMutation.isPending}
                            onClick={() =>
                              resolveCommentMutation.mutate({
                                commentId: thread.root.id,
                                resolve: !thread.root.resolution,
                              })
                            }
                          >
                            {thread.root.resolution ? "Unresolve" : "Resolve"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">
                No file selected for the current filter.
              </div>
            )
          ) : (
            <div className="space-y-3">
              {filteredDiffs.map((fileDiff, index) => {
                const filePath = getFilePath(fileDiff, index);
                const fileUnresolvedCount = (threadsByPath.get(filePath) ?? []).filter(
                  (thread) => !thread.root.resolution && !thread.root.deleted,
                ).length;

                return (
                  <div key={`${filePath}-${index}`} id={fileAnchorId(filePath)} className="border border-border bg-card">
                    <div className="border-b border-border px-3 py-2 flex items-center gap-3 text-[12px]">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-mono truncate">{filePath}</span>
                      {fileUnresolvedCount > 0 && (
                        <span className="ml-auto text-muted-foreground">
                          {fileUnresolvedCount} unresolved
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <FileDiff fileDiff={fileDiff} options={libOptions} />
                    </div>
                  </div>
                );
              })}

              {filteredDiffs.length === 0 && (
                <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">
                  No files match the current search.
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge pull request</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="merge-strategy">Merge strategy</Label>
              <Input
                id="merge-strategy"
                value={mergeStrategy}
                onChange={(e) => setMergeStrategy(e.target.value)}
                placeholder="merge_commit"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="merge-message">Merge message</Label>
              <Input
                id="merge-message"
                value={mergeMessage}
                onChange={(e) => setMergeMessage(e.target.value)}
                placeholder="Optional merge message"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={closeSourceBranch} onCheckedChange={setCloseSourceBranch} id="close-branch" />
              <Label htmlFor="close-branch">Close source branch</Label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMergeOpen(false)}>
                Cancel
              </Button>
              <Button disabled={mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>
                {mergeMutation.isPending && <Loader2 className="size-4 animate-spin" />} Merge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
