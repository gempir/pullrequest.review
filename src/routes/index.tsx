import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";
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
  fetchBitbucketCommitDiff,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  GitCommit,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Search,
} from "lucide-react";

type ReviewTab = "overview" | "files" | "commits";

type CommentDraft = {
  content: string;
  line: string;
};

interface CommentThread {
  id: number;
  root: BitbucketComment;
  replies: BitbucketComment[];
}

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

function shortHash(hash: string) {
  return hash.slice(0, 8);
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

function linesUpdated(diffstat: ReturnType<typeof fetchBitbucketPullRequestBundle> extends Promise<infer T>
  ? T extends { diffstat: infer D }
    ? D
    : never
  : never) {
  let added = 0;
  let removed = 0;
  for (const entry of diffstat as any[]) {
    added += Number(entry.lines_added ?? 0);
    removed += Number(entry.lines_removed ?? 0);
  }
  return { added, removed };
}

function getCommentPath(comment: BitbucketComment) {
  return comment.inline?.path ?? "";
}

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { prUrl, auth, setPrUrl, repos } = usePrContext();
  const { options } = useDiffOptions();
  const libOptions = toLibraryOptions(options);
  const fileTree = useFileTree();
  const queryClient = useQueryClient();

  const [prInput, setPrInput] = useState("");
  const [activeTab, setActiveTab] = useState<ReviewTab>("files");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | undefined>();
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMessage, setMergeMessage] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState("merge_commit");
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);

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

  const commitDiffQuery = useQuery({
    queryKey: ["bitbucket-commit-diff", prData?.prRef, selectedCommitHash, auth?.accessToken],
    queryFn: () =>
      fetchBitbucketCommitDiff({
        data: {
          prRef: prData!.prRef,
          commitHash: selectedCommitHash!,
          auth,
        },
      }),
    enabled: Boolean(prData?.prRef && selectedCommitHash && activeTab === "commits"),
  });

  useEffect(() => {
    if (!prData?.commits?.length) {
      setSelectedCommitHash(undefined);
      return;
    }
    setSelectedCommitHash((current) => current ?? prData.commits[0]?.hash);
  }, [prData?.commits]);

  const storageKey = useMemo(() => {
    if (!prData) return "";
    return `bitbucket_viewed:${prData.prRef.workspace}/${prData.prRef.repo}/${prData.prRef.pullRequestId}`;
  }, [prData]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setViewedFiles(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setViewedFiles(new Set(parsed));
    } catch {
      setViewedFiles(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(viewedFiles)));
  }, [storageKey, viewedFiles]);

  const diffText =
    activeTab === "commits" && commitDiffQuery.data?.diff
      ? commitDiffQuery.data.diff
      : prData?.diff ?? "";

  const fileDiffs = useMemo(() => {
    if (!diffText) return [];
    const patches = parsePatchFiles(diffText);
    return patches.flatMap((patch) => patch.files);
  }, [diffText]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDiffs = useMemo(() => {
    if (!normalizedSearch) return fileDiffs;
    return fileDiffs.filter((fileDiff) => {
      const path = (fileDiff.name ?? fileDiff.prevName ?? "").toLowerCase();
      return path.includes(normalizedSearch);
    });
  }, [fileDiffs, normalizedSearch]);

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
    fileTree.setTree(tree);
    fileTree.setKinds(buildKindMapForTree(tree, fileKinds));
  }, [fileTree, prData]);

  useEffect(() => {
    if (!prUrl) {
      fileTree.reset();
      setSearchQuery("");
    }
  }, [fileTree, prUrl]);

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

  const lineStats = useMemo(() => {
    return linesUpdated(prData?.diffstat ?? []);
  }, [prData?.diffstat]);

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
      <div className="border-b border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{prData.pr.source?.repository?.full_name ?? "repository"}</span>
          <span>→</span>
          <span className="text-foreground">{prData.pr.destination?.branch?.name ?? "branch"}</span>
          <span className="px-2 py-0.5 border border-border bg-secondary text-[11px] font-medium text-foreground uppercase">
            {prData.pr.state}
          </span>

          <div className="ml-auto flex items-center gap-2">
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
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <span className="text-lg leading-none">...</span>
            </Button>
          </div>
        </div>

        <div className="text-[16px] font-semibold">{prData.pr.title}</div>

        <div className="flex items-center gap-1 border-b border-border">
          <button
            className={`px-3 py-2 text-[13px] ${activeTab === "overview" ? "text-foreground border-b border-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`px-3 py-2 text-[13px] ${activeTab === "files" ? "text-foreground border-b border-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("files")}
          >
            Files changed <span className="text-muted-foreground">{prStats.files}</span>
          </button>
          <button
            className={`px-3 py-2 text-[13px] ${activeTab === "commits" ? "text-foreground border-b border-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("commits")}
          >
            Commits <span className="text-muted-foreground">{prData.commits.length}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          <button className="inline-flex items-center gap-1 text-foreground">
            All changes <ChevronDown className="size-3.5" />
          </button>
          <button className="inline-flex items-center gap-1 text-foreground">
            Comments ({unresolvedThreads.length} unresolved) <ChevronDown className="size-3.5" />
          </button>
          <button className="inline-flex items-center gap-1 text-foreground">
            Sort by File tree <ChevronDown className="size-3.5" />
          </button>
          <div className="ml-auto w-80 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-7"
              placeholder="Search changes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {actionError && (
        <div className="border-b border-destructive bg-destructive/10 text-destructive px-4 py-2 text-[12px]">
          {actionError}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <aside className="w-80 shrink-0 border-r border-border bg-sidebar flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs">Filter files</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">Search changes</Button>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-muted-foreground">Lines updated</span>
              <span className="ml-auto text-status-added">+{lineStats.added}</span>
              <span className="text-status-removed">-{lineStats.removed}</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2">
            <FileTree
              path=""
              filterQuery={searchQuery}
              viewedFiles={viewedFiles}
              onToggleViewed={toggleViewed}
              onFileClick={(node) => {
                const anchor = document.getElementById(fileAnchorId(node.path));
                anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveTab("files");
              }}
            />
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-auto p-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="border border-border bg-card p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">Files changed</div>
                  <div className="text-xl font-semibold mt-1">{prStats.files}</div>
                </div>
                <div className="border border-border bg-card p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">Commits</div>
                  <div className="text-xl font-semibold mt-1">{prData.commits.length}</div>
                </div>
                <div className="border border-border bg-card p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">Comments</div>
                  <div className="text-xl font-semibold mt-1">{threads.length}</div>
                </div>
                <div className="border border-border bg-card p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">Unresolved</div>
                  <div className="text-xl font-semibold mt-1">{unresolvedThreads.length}</div>
                </div>
              </div>

              <div className="border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[12px] uppercase tracking-wider text-muted-foreground">
                  Pull request metadata
                </div>
                <div className="p-3 text-[13px] space-y-2">
                  <div>Author: {prData.pr.author?.display_name ?? "Unknown"}</div>
                  <div>Source branch: {prData.pr.source?.branch?.name ?? "Unknown"}</div>
                  <div>Destination branch: {prData.pr.destination?.branch?.name ?? "Unknown"}</div>
                  <div>Description: {prData.pr.description?.trim() || "No description"}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-4">
              {filteredDiffs.map((fileDiff, index) => {
                const filePath = fileDiff.name ?? fileDiff.prevName ?? String(index);
                const anchorId = fileAnchorId(filePath);
                const fileThreads = (threadsByPath.get(filePath) ?? []).sort(commentThreadSort);
                const draft = commentDrafts[filePath] ?? { content: "", line: "" };

                return (
                  <div key={`${filePath}-${index}`} id={anchorId} className="border border-border bg-card">
                    <div className="border-b border-border px-3 py-2 flex items-center gap-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-mono text-[12px]">{filePath}</span>
                      <label className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={viewedFiles.has(filePath)}
                          onChange={() => toggleViewed(filePath)}
                        />
                        Viewed
                      </label>
                    </div>

                    <div className="border-b border-border bg-background/50 px-3 py-2 flex items-center gap-2">
                      <Input
                        placeholder="line"
                        className="h-7 w-20"
                        value={draft.line}
                        onChange={(e) => setDraft(filePath, { line: e.target.value })}
                      />
                      <Input
                        placeholder="Add a file or line comment"
                        className="h-7"
                        value={draft.content}
                        onChange={(e) => setDraft(filePath, { content: e.target.value })}
                      />
                      <Button
                        size="sm"
                        className="h-7"
                        disabled={createCommentMutation.isPending}
                        onClick={() => submitComment(filePath)}
                      >
                        Comment
                      </Button>
                    </div>

                    <div className="p-3">
                      <FileDiff fileDiff={fileDiff} options={libOptions} />
                    </div>

                    {fileThreads.length > 0 && (
                      <div className="border-t border-border px-3 py-2 space-y-2">
                        {fileThreads.map((thread) => (
                          <div key={thread.id} className="border border-border bg-background p-2 text-[12px]">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <MessageSquare className="size-3.5" />
                              <span>{thread.root.user?.display_name ?? "Unknown"}</span>
                              <span>{formatDate(thread.root.created_on)}</span>
                              <span className="ml-auto">
                                {thread.root.resolution ? "Resolved" : "Unresolved"}
                              </span>
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
                );
              })}

              {filteredDiffs.length === 0 && (
                <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">
                  No files match the current search.
                </div>
              )}
            </div>
          )}

          {activeTab === "commits" && (
            <div className="h-full min-h-[500px] flex border border-border bg-card">
              <div className="w-80 border-r border-border overflow-auto">
                {prData.commits.map((commit) => {
                  const selected = selectedCommitHash === commit.hash;
                  return (
                    <button
                      key={commit.hash}
                      onClick={() => setSelectedCommitHash(commit.hash)}
                      className={`w-full text-left border-b border-border px-3 py-3 ${selected ? "bg-accent" : "bg-card hover:bg-accent/40"}`}
                    >
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <GitCommit className="size-3.5" />
                        <span className="font-mono">{shortHash(commit.hash)}</span>
                        <span className="ml-auto">{formatDate(commit.date)}</span>
                      </div>
                      <div className="text-[13px] mt-1 line-clamp-2">{commit.message ?? commit.summary?.raw ?? "No message"}</div>
                      <div className="text-[12px] text-muted-foreground mt-1">
                        {commit.author?.user?.display_name ?? commit.author?.raw ?? "Unknown"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-auto p-3">
                {commitDiffQuery.isLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading commit diff...
                  </div>
                ) : commitDiffQuery.error ? (
                  <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-[13px]">
                    {commitDiffQuery.error instanceof Error
                      ? commitDiffQuery.error.message
                      : "Failed to load commit diff"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDiffs.map((fileDiff, index) => {
                      const filePath = fileDiff.name ?? fileDiff.prevName ?? String(index);
                      return (
                        <div key={`${filePath}-${index}`} className="border border-border bg-background">
                          <div className="border-b border-border px-3 py-2 font-mono text-[12px]">{filePath}</div>
                          <div className="p-3">
                            <FileDiff fileDiff={fileDiff} options={libOptions} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
