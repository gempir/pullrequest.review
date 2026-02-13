import {
  type FileDiffOptions,
  type OnDiffLineClickProps,
  type OnDiffLineEnterLeaveProps,
  getFiletypeFromFileName,
  parsePatchFiles,
  preloadHighlighter,
} from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderMinus,
  FolderPlus,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileIcon } from "react-files-icons";
import { CommentEditor } from "@/components/comment-editor";
import { FileTree } from "@/components/file-tree";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { SettingsMenu } from "@/components/settings-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toLibraryOptions, useDiffOptions } from "@/lib/diff-options-context";
import { fileAnchorId } from "@/lib/file-anchors";
import {
  buildKindMapForTree,
  buildTreeFromPaths,
  type ChangeKind,
  type FileNode,
  useFileTree,
} from "@/lib/file-tree-context";
import {
  approvePullRequest,
  createPullRequestComment,
  fetchPullRequestBundleByRef,
  getCapabilitiesForHost,
  mergePullRequest,
  requestChangesOnPullRequest,
  resolvePullRequestComment,
} from "@/lib/git-host/service";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { useKeyboardNavigation } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

type ViewMode = "single" | "all";

type CommentLineSide = "additions" | "deletions";

type InlineCommentDraft = {
  path: string;
  line: number;
  side: CommentLineSide;
};

type ExistingThreadAnnotation = {
  kind: "thread";
  thread: CommentThread;
};

type DraftThreadAnnotation = {
  kind: "draft";
  draft: InlineCommentDraft;
};

type SingleFileAnnotationMetadata =
  | ExistingThreadAnnotation
  | DraftThreadAnnotation;

interface CommentThread {
  id: number;
  root: PullRequestComment;
  replies: PullRequestComment[];
}

const TREE_WIDTH_KEY = "pr_review_tree_width";
const TREE_COLLAPSED_KEY = "pr_review_tree_collapsed";
const VIEW_MODE_KEY = "pr_review_diff_view_mode";
const DIRECTORY_STATE_KEY_PREFIX = "pr_review_directory_state";
const INLINE_DRAFT_STORAGE_KEY_PREFIX = "pr_review_inline_comment_draft";
const INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY = "bitbucket_inline_comment_draft";
const INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX =
  "pr_review_inline_comment_active";
const INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX_LEGACY =
  "bitbucket_inline_comment_active";
const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 520;
const DEFAULT_DOCUMENT_TITLE = "pullrequest.review";

function commentThreadSort(a: CommentThread, b: CommentThread) {
  const left = new Date(a.root.created_on ?? 0).getTime();
  const right = new Date(b.root.created_on ?? 0).getTime();
  return left - right;
}

function buildThreads(comments: PullRequestComment[]): CommentThread[] {
  const roots = comments.filter((comment) => !comment.parent?.id);
  const repliesByParent = new Map<number, PullRequestComment[]>();

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
        (a, b) =>
          new Date(a.created_on ?? 0).getTime() -
          new Date(b.created_on ?? 0).getTime(),
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

function linesUpdated(
  diffstat: Array<{ lines_added?: number; lines_removed?: number }>,
) {
  let added = 0;
  let removed = 0;
  for (const entry of diffstat) {
    added += Number(entry.lines_added ?? 0);
    removed += Number(entry.lines_removed ?? 0);
  }
  return { added, removed };
}

function getCommentPath(comment: PullRequestComment) {
  return comment.inline?.path ?? "";
}

function getCommentInlinePosition(comment: PullRequestComment) {
  const from = comment.inline?.from;
  const to = comment.inline?.to;
  const lineNumber = to ?? from;
  if (!lineNumber) return null;
  const side: CommentLineSide = to ? "additions" : "deletions";
  return { side, lineNumber };
}

function inlineDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
  draft: Pick<InlineCommentDraft, "path" | "line" | "side">,
) {
  return `${INLINE_DRAFT_STORAGE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

function inlineDraftStorageKeyLegacy(
  workspace: string,
  repo: string,
  pullRequestId: string,
  draft: Pick<InlineCommentDraft, "path" | "line" | "side">,
) {
  return `${INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${workspace}/${repo}/${pullRequestId}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

function inlineActiveDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}`;
}

function inlineActiveDraftStorageKeyLegacy(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${workspace}/${repo}/${pullRequestId}`;
}

function parseInlineDraftStorageKey(
  key: string,
  workspace: string,
  repo: string,
  pullRequestId: string,
): InlineCommentDraft | null {
  const prefixes = [
    `${INLINE_DRAFT_STORAGE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}:`,
    `${INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${workspace}/${repo}/${pullRequestId}:`,
  ];
  const prefix = prefixes.find((item) => key.startsWith(item));
  if (!prefix) return null;
  const rest = key.slice(prefix.length);
  const firstColon = rest.indexOf(":");
  const secondColon = rest.indexOf(":", firstColon + 1);
  if (firstColon < 0 || secondColon < 0) return null;
  const side = rest.slice(0, firstColon);
  const lineRaw = rest.slice(firstColon + 1, secondColon);
  const encodedPath = rest.slice(secondColon + 1);
  if (side !== "additions" && side !== "deletions") return null;
  const line = Number(lineRaw);
  if (!Number.isFinite(line) || line <= 0) return null;
  return {
    side,
    line,
    path: decodeURIComponent(encodedPath),
  };
}

function getFilePath(fileDiff: FileDiffMetadata, index: number) {
  return fileDiff.name ?? fileDiff.prevName ?? String(index);
}

function collectDirectoryPaths(nodes: FileNode[]) {
  const paths: string[] = [];
  const walk = (items: FileNode[]) => {
    for (const node of items) {
      if (node.type !== "directory") continue;
      paths.push(node.path);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return paths;
}

export const Route = createFileRoute(
  "/$workspace/$repo/pull-requests/$pullRequestId",
)({
  component: PullRequestReviewPage,
});

function PullRequestReviewPage() {
  const navigate = useNavigate();
  const { workspace, repo, pullRequestId } = Route.useParams();
  const { clearAllRepos, isAuthenticated, logout } = usePrContext();
  const { options } = useDiffOptions();
  const diffTypographyStyle = useMemo(
    () =>
      ({
        "--diff-font-family": `var(--font-${options.diffFontFamily})`,
        "--diff-font-size": `${options.diffFontSize}px`,
        "--diff-line-height": String(options.diffLineHeight),
      }) as CSSProperties,
    [options.diffFontFamily, options.diffFontSize, options.diffLineHeight],
  );
  const libOptions = toLibraryOptions(options);
  const compactDiffOptions = useMemo<FileDiffOptions<undefined>>(
    () => ({
      ...libOptions,
      hunkSeparators: options.hunkSeparators,
      disableFileHeader: true,
    }),
    [libOptions, options.hunkSeparators],
  );
  const {
    root,
    dirState,
    setTree,
    setKinds,
    allFiles,
    activeFile,
    setActiveFile,
    setDirectoryExpandedMap,
  } = useFileTree();
  const queryClient = useQueryClient();

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const diffScrollRef = useRef<HTMLDivElement | null>(null);
  const inlineDraftFocusRef = useRef<(() => void) | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [viewModeHydrated, setViewModeHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnviewedOnly, setShowUnviewedOnly] = useState(false);
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const [collapsedAllModeFiles, setCollapsedAllModeFiles] = useState<
    Record<string, boolean>
  >({});
  const [inlineComment, setInlineComment] = useState<InlineCommentDraft | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMessage, setMergeMessage] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState("merge_commit");
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [dirStateHydrated, setDirStateHydrated] = useState(false);
  const [diffHighlighterReady, setDiffHighlighterReady] = useState(false);
  const [diffPlainTextFallback, setDiffPlainTextFallback] = useState(false);
  const autoMarkedViewedFilesRef = useRef<Set<string>>(new Set());
  const copyResetTimeoutRef = useRef<number | null>(null);
  const prQueryKey = useMemo(
    () => ["pr-bundle", "bitbucket", workspace, repo, pullRequestId] as const,
    [pullRequestId, repo, workspace],
  );

  const prQuery = useQuery({
    queryKey: prQueryKey,
    queryFn: () =>
      fetchPullRequestBundleByRef({
        prRef: {
          host: "bitbucket",
          workspace,
          repo,
          pullRequestId,
        },
      }),
    enabled: isAuthenticated,
  });

  const prData = prQuery.data;
  const isPrQueryFetching = prQuery.isFetching;
  const refetchPrQuery = prQuery.refetch;
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (prQuery.isLoading) {
      document.title = DEFAULT_DOCUMENT_TITLE;
      return;
    }
    const nextTitle = prData?.pr.title?.trim();
    document.title =
      nextTitle && nextTitle.length > 0 ? nextTitle : DEFAULT_DOCUMENT_TITLE;
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [prData?.pr.title, prQuery.isLoading]);
  const hasPendingBuildStatuses = useMemo(
    () =>
      prData?.buildStatuses?.some((status) => status.state === "pending") ??
      false,
    [prData?.buildStatuses],
  );

  useEffect(() => {
    if (!hasPendingBuildStatuses) return;
    const intervalId = window.setInterval(() => {
      if (isPrQueryFetching) return;
      void refetchPrQuery();
    }, 10_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPendingBuildStatuses, isPrQueryFetching, refetchPrQuery]);

  const viewedStorageKey = useMemo(() => {
    if (!prData) return "";
    return `pr_review_viewed:${prData.prRef.host}:${prData.prRef.workspace}/${prData.prRef.repo}/${prData.prRef.pullRequestId}`;
  }, [prData]);

  const directoryStateStorageKey = useMemo(
    () => `${DIRECTORY_STATE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}`,
    [pullRequestId, repo, workspace],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedWidth = Number(window.localStorage.getItem(TREE_WIDTH_KEY));
    if (
      Number.isFinite(storedWidth) &&
      storedWidth >= MIN_TREE_WIDTH &&
      storedWidth <= MAX_TREE_WIDTH
    ) {
      setTreeWidth(storedWidth);
    }

    const storedCollapsed = window.localStorage.getItem(TREE_COLLAPSED_KEY);
    if (storedCollapsed === "true") setTreeCollapsed(true);

    const storedMode = window.localStorage.getItem(VIEW_MODE_KEY);
    if (storedMode === "single" || storedMode === "all") {
      setViewMode(storedMode);
    }
    setViewModeHydrated(true);
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
    if (typeof window === "undefined" || !viewModeHydrated) return;
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode, viewModeHydrated]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!viewedStorageKey || typeof window === "undefined") return;
    autoMarkedViewedFilesRef.current = new Set();
    const legacyKey = `bitbucket_viewed:${workspace}/${repo}/${pullRequestId}`;
    try {
      const raw =
        window.localStorage.getItem(viewedStorageKey) ??
        window.localStorage.getItem(legacyKey);
      if (!raw) {
        setViewedFiles(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setViewedFiles(new Set(parsed));
      if (!window.localStorage.getItem(viewedStorageKey)) {
        window.localStorage.setItem(viewedStorageKey, raw);
      }
    } catch {
      setViewedFiles(new Set());
    }
  }, [pullRequestId, repo, viewedStorageKey, workspace]);

  useEffect(() => {
    if (!viewedStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      viewedStorageKey,
      JSON.stringify(Array.from(viewedFiles)),
    );
  }, [viewedStorageKey, viewedFiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDirStateHydrated(false);
    try {
      const raw = window.localStorage.getItem(directoryStateStorageKey);
      if (!raw) {
        setDirectoryExpandedMap({});
        setDirStateHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, boolean> = {};
      for (const [path, expanded] of Object.entries(parsed)) {
        if (!path) continue;
        next[path] = expanded === true;
      }
      setDirectoryExpandedMap(next);
    } catch {
      setDirectoryExpandedMap({});
    } finally {
      setDirStateHydrated(true);
    }
  }, [directoryStateStorageKey, setDirectoryExpandedMap]);

  useEffect(() => {
    if (!dirStateHydrated || typeof window === "undefined") return;
    const toStore: Record<string, boolean> = {};
    for (const [path, state] of Object.entries(dirState)) {
      if (!path) continue;
      toStore[path] = state.expanded;
    }
    window.localStorage.setItem(
      directoryStateStorageKey,
      JSON.stringify(toStore),
    );
  }, [dirState, dirStateHydrated, directoryStateStorageKey]);

  const diffText = prData?.diff ?? "";

  const fileDiffs = useMemo(() => {
    if (!diffText) return [] as FileDiffMetadata[];
    const patches = parsePatchFiles(diffText);
    return patches.flatMap((patch) => patch.files);
  }, [diffText]);

  const preloadLanguages = useMemo(() => {
    const langs = new Set<string>(["text", "javascript"]);
    fileDiffs.forEach((fileDiff) => {
      if (fileDiff.lang) langs.add(fileDiff.lang);
      langs.add(getFiletypeFromFileName(fileDiff.name));
      if (fileDiff.prevName) {
        langs.add(getFiletypeFromFileName(fileDiff.prevName));
      }
    });
    return [...langs];
  }, [fileDiffs]);

  useEffect(() => {
    if (fileDiffs.length === 0) {
      setDiffHighlighterReady(true);
      setDiffPlainTextFallback(false);
      return;
    }
    let cancelled = false;
    setDiffHighlighterReady(false);
    setDiffPlainTextFallback(false);
    void preloadHighlighter({
      themes: [options.theme],
      langs: preloadLanguages as Parameters<typeof preloadHighlighter>[0]["langs"],
    })
      .then(() => {
        if (cancelled) return;
        setDiffHighlighterReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDiffPlainTextFallback(true);
        setDiffHighlighterReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileDiffs.length, options.theme, preloadLanguages]);

  const toRenderableFileDiff = useCallback(
    (fileDiff: FileDiffMetadata): FileDiffMetadata =>
      diffPlainTextFallback ? { ...fileDiff, lang: "text" } : fileDiff,
    [diffPlainTextFallback],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDiffs = useMemo(() => {
    return fileDiffs.filter((fileDiff, index) => {
      const filePath = getFilePath(fileDiff, index);
      const path = filePath.toLowerCase();
      const matchesSearch =
        !normalizedSearch || path.includes(normalizedSearch);
      const matchesViewedFilter =
        !showUnviewedOnly || !viewedFiles.has(filePath);
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

  const visiblePathSet = useMemo(
    () => new Set([PR_SUMMARY_PATH, ...visibleFilePaths]),
    [visibleFilePaths],
  );
  const viewedVisibleCount = useMemo(
    () => visibleFilePaths.filter((path) => viewedFiles.has(path)).length,
    [visibleFilePaths, viewedFiles],
  );
  const treeFilePaths = useMemo(
    () => allFiles().map((file) => file.path),
    [allFiles],
  );
  const directoryPaths = useMemo(() => collectDirectoryPaths(root), [root]);
  const treeOrderedVisiblePaths = useMemo(() => {
    if (treeFilePaths.length === 0) return [];
    return treeFilePaths.filter((path) => visiblePathSet.has(path));
  }, [treeFilePaths, visiblePathSet]);
  const allModeDiffEntries = useMemo(() => {
    const byPath = new Map<string, FileDiffMetadata>();
    const ordered: Array<{ filePath: string; fileDiff: FileDiffMetadata }> = [];

    filteredDiffs.forEach((fileDiff, index) => {
      const path = getFilePath(fileDiff, index);
      if (!byPath.has(path)) {
        byPath.set(path, fileDiff);
      }
    });

    for (const path of treeOrderedVisiblePaths) {
      const fileDiff = byPath.get(path);
      if (!fileDiff) continue;
      ordered.push({ filePath: path, fileDiff });
      byPath.delete(path);
    }

    filteredDiffs.forEach((fileDiff, index) => {
      const path = getFilePath(fileDiff, index);
      if (!byPath.has(path)) return;
      ordered.push({ filePath: path, fileDiff });
      byPath.delete(path);
    });

    return ordered;
  }, [filteredDiffs, treeOrderedVisiblePaths]);

  useEffect(() => {
    if (!prData) return;
    const paths = prData.diffstat
      .map((entry) => entry.new?.path ?? entry.old?.path)
      .filter((path): path is string => Boolean(path));

    const tree = buildTreeFromPaths(paths);
    const summaryNode: FileNode = {
      name: PR_SUMMARY_NAME,
      path: PR_SUMMARY_PATH,
      type: "summary",
    };
    const treeWithSummary = [summaryNode, ...tree];
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

    setTree(treeWithSummary);
    setKinds(buildKindMapForTree(treeWithSummary, fileKinds));
  }, [prData, setKinds, setTree]);

  useEffect(() => {
    setTree([]);
    setKinds(new Map());
    setActiveFile(undefined);
    setSearchQuery("");
  }, [setActiveFile, setKinds, setTree]);

  useEffect(() => {
    if (treeOrderedVisiblePaths.length === 0) {
      return;
    }

    if (!activeFile) {
      setActiveFile(PR_SUMMARY_PATH);
      return;
    }

    if (!visiblePathSet.has(activeFile)) {
      const firstUnviewed =
        treeOrderedVisiblePaths.find(
          (path) => path !== PR_SUMMARY_PATH && !viewedFiles.has(path),
        ) ?? treeOrderedVisiblePaths[0];
      setActiveFile(firstUnviewed);
    }
  }, [
    activeFile,
    setActiveFile,
    treeOrderedVisiblePaths,
    viewedFiles,
    visiblePathSet,
  ]);

  useEffect(() => {
    if (showUnviewedOnly) return;
    if (!activeFile || !visiblePathSet.has(activeFile)) return;
    if (activeFile === PR_SUMMARY_PATH) return;
    if (autoMarkedViewedFilesRef.current.has(activeFile)) return;
    autoMarkedViewedFilesRef.current.add(activeFile);
    setViewedFiles((prev) => {
      if (prev.has(activeFile)) return prev;
      const next = new Set(prev);
      next.add(activeFile);
      return next;
    });
  }, [activeFile, showUnviewedOnly, visiblePathSet]);

  const selectAndRevealFile = useCallback(
    (path: string) => {
      setActiveFile(path);
      if (viewMode === "all") {
        if (path === PR_SUMMARY_PATH) return;
        setCollapsedAllModeFiles((prev) => ({ ...prev, [path]: false }));
        requestAnimationFrame(() => {
          const anchor = document.getElementById(fileAnchorId(path));
          anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }
      diffScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setActiveFile, viewMode],
  );

  const selectFromPaths = useCallback(
    (paths: string[], direction: "next" | "previous") => {
      if (paths.length === 0) return;
      if (!activeFile) {
        const fallback =
          direction === "next" ? paths[0] : paths[paths.length - 1];
        selectAndRevealFile(fallback);
        return;
      }
      const currentIndex = paths.indexOf(activeFile);
      if (currentIndex === -1) {
        const fallback =
          direction === "next" ? paths[0] : paths[paths.length - 1];
        selectAndRevealFile(fallback);
        return;
      }
      const nextIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= paths.length) return;
      selectAndRevealFile(paths[nextIndex]);
    },
    [activeFile, selectAndRevealFile],
  );

  const selectedFilePath = useMemo(() => {
    if (!activeFile) return undefined;
    if (!diffByPath.has(activeFile)) return undefined;
    return activeFile;
  }, [activeFile, diffByPath]);

  const selectedFileDiff = useMemo(() => {
    if (!selectedFilePath) return undefined;
    return diffByPath.get(selectedFilePath);
  }, [diffByPath, selectedFilePath]);
  const isSummarySelected = activeFile === PR_SUMMARY_PATH;

  const comments = prData?.comments ?? [];
  const threads = useMemo(() => buildThreads(comments), [comments]);
  const unresolvedThreads = threads.filter(
    (thread) => !thread.root.resolution && !thread.root.deleted,
  );

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

  const selectedFileLevelThreads = useMemo(
    () =>
      selectedThreads.filter(
        (thread) =>
          !thread.root.deleted && !getCommentInlinePosition(thread.root),
      ),
    [selectedThreads],
  );

  const _prStats = useMemo(() => {
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

  const lineStats = useMemo(
    () => linesUpdated(prData?.diffstat ?? []),
    [prData?.diffstat],
  );
  const fileLineStats = useMemo(() => {
    const map = new Map<string, { added: number; removed: number }>();
    for (const entry of prData?.diffstat ?? []) {
      const path = entry.new?.path ?? entry.old?.path;
      if (!path) continue;
      map.set(path, {
        added: Number(entry.lines_added ?? 0),
        removed: Number(entry.lines_removed ?? 0),
      });
    }
    return map;
  }, [prData?.diffstat]);
  const hostCapabilities = useMemo(
    () => getCapabilitiesForHost("bitbucket"),
    [],
  );
  useEffect(() => {
    if (!prData) return;
    if (prData.prRef.host === "github") {
      if (!hostCapabilities.mergeStrategies?.includes(mergeStrategy)) {
        setMergeStrategy(hostCapabilities.mergeStrategies?.[0] ?? "merge");
      }
      return;
    }
    if (mergeStrategy === "merge") {
      setMergeStrategy("merge_commit");
    }
  }, [hostCapabilities.mergeStrategies, mergeStrategy, prData]);

  const isApproved = Boolean(
    prData?.pr.participants?.some((participant) => participant.approved),
  );

  const ensurePrRef = useCallback(() => {
    if (!prData) {
      throw new Error("Pull request data is not loaded");
    }
    return prData.prRef;
  }, [prData]);

  const approveMutation = useMutation({
    mutationFn: () => {
      const prRef = ensurePrRef();
      return approvePullRequest({ prRef });
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: prQueryKey });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to approve pull request",
      );
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: () => {
      const prRef = ensurePrRef();
      return requestChangesOnPullRequest({ prRef });
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: prQueryKey });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Failed to remove approval",
      );
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => {
      const prRef = ensurePrRef();
      return mergePullRequest({
        prRef,
        message: mergeMessage,
        mergeStrategy,
        closeSourceBranch,
      });
    },
    onSuccess: async () => {
      setMergeOpen(false);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: prQueryKey });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Failed to merge pull request",
      );
    },
  });

  const handleApprovePullRequest = useCallback(() => {
    if (isApproved) return;
    if (approveMutation.isPending || requestChangesMutation.isPending) return;
    if (!window.confirm("Approve this pull request?")) return;
    approveMutation.mutate();
  }, [approveMutation, isApproved, requestChangesMutation]);

  const handleRequestChangesPullRequest = useCallback(() => {
    if (!hostCapabilities.requestChangesAvailable) return;
    if (prData?.prRef.host === "bitbucket" && !isApproved) return;
    if (approveMutation.isPending || requestChangesMutation.isPending) return;
    if (!window.confirm("Request changes on this pull request?")) return;
    requestChangesMutation.mutate();
  }, [
    approveMutation,
    hostCapabilities.requestChangesAvailable,
    isApproved,
    prData?.prRef.host,
    requestChangesMutation,
  ]);

  useKeyboardNavigation({
    onNextUnviewedFile: () =>
      selectFromPaths(
        treeOrderedVisiblePaths.filter((path) => !viewedFiles.has(path)),
        "next",
      ),
    onPreviousUnviewedFile: () =>
      selectFromPaths(
        treeOrderedVisiblePaths.filter((path) => !viewedFiles.has(path)),
        "previous",
      ),
    onNextFile: () => selectFromPaths(treeOrderedVisiblePaths, "next"),
    onPreviousFile: () => selectFromPaths(treeOrderedVisiblePaths, "previous"),
    onApprovePullRequest: handleApprovePullRequest,
    onRequestChangesPullRequest: handleRequestChangesPullRequest,
    onScrollDown: () =>
      diffScrollRef.current?.scrollBy({ top: 120, behavior: "smooth" }),
    onScrollUp: () =>
      diffScrollRef.current?.scrollBy({ top: -120, behavior: "smooth" }),
  });

  const createCommentMutation = useMutation({
    mutationFn: (payload: {
      path: string;
      content: string;
      line?: number;
      side?: CommentLineSide;
    }) => {
      const prRef = ensurePrRef();
      return createPullRequestComment({
        prRef,
        content: payload.content,
        inline: payload.line
          ? {
              path: payload.path,
              to: payload.side === "deletions" ? undefined : payload.line,
              from: payload.side === "deletions" ? payload.line : undefined,
            }
          : { path: payload.path },
      });
    },
    onSuccess: async (_, vars) => {
      if (vars.line && vars.side) {
        clearInlineDraftContent({
          path: vars.path,
          line: vars.line,
          side: vars.side,
        });
      }
      setInlineComment((prev) => {
        if (!prev) return prev;
        if (prev.path !== vars.path) return prev;
        if (vars.line && prev.line !== vars.line) return prev;
        if (vars.side && prev.side !== vars.side) return prev;
        return null;
      });
      await queryClient.invalidateQueries({ queryKey: prQueryKey });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Failed to create comment",
      );
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (payload: { commentId: number; resolve: boolean }) => {
      const prRef = ensurePrRef();
      if (!hostCapabilities.supportsThreadResolution) {
        throw new Error("Comment resolution is not supported for this host");
      }
      return resolvePullRequestComment({
        prRef,
        commentId: payload.commentId,
        resolve: payload.resolve,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: prQueryKey });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to update comment resolution",
      );
    },
  });

  const getInlineDraftContent = useCallback(
    (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
      if (typeof window === "undefined") return "";
      const nextKey = inlineDraftStorageKey(
        workspace,
        repo,
        pullRequestId,
        draft,
      );
      const legacyKey = inlineDraftStorageKeyLegacy(
        workspace,
        repo,
        pullRequestId,
        draft,
      );
      return (
        window.localStorage.getItem(nextKey) ??
        window.localStorage.getItem(legacyKey) ??
        ""
      );
    },
    [pullRequestId, repo, workspace],
  );

  const setInlineDraftContent = useCallback(
    (
      draft: Pick<InlineCommentDraft, "path" | "line" | "side">,
      content: string,
    ) => {
      if (typeof window === "undefined") return;
      const key = inlineDraftStorageKey(workspace, repo, pullRequestId, draft);
      const activeKey = inlineActiveDraftStorageKey(
        workspace,
        repo,
        pullRequestId,
      );
      if (content.length > 0) {
        window.localStorage.setItem(key, content);
        window.localStorage.removeItem(
          inlineDraftStorageKeyLegacy(workspace, repo, pullRequestId, draft),
        );
        window.localStorage.setItem(activeKey, JSON.stringify(draft));
        window.localStorage.removeItem(
          inlineActiveDraftStorageKeyLegacy(workspace, repo, pullRequestId),
        );
      } else {
        window.localStorage.removeItem(key);
        const activeRaw = window.localStorage.getItem(activeKey);
        if (!activeRaw) return;
        try {
          const activeDraft = JSON.parse(activeRaw) as InlineCommentDraft;
          if (
            activeDraft.path === draft.path &&
            activeDraft.line === draft.line &&
            activeDraft.side === draft.side
          ) {
            window.localStorage.removeItem(activeKey);
          }
        } catch {
          window.localStorage.removeItem(activeKey);
        }
      }
    },
    [pullRequestId, repo, workspace],
  );

  const clearInlineDraftContent = useCallback(
    (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => {
      if (typeof window === "undefined") return;
      const activeKey = inlineActiveDraftStorageKey(
        workspace,
        repo,
        pullRequestId,
      );
      const activeRaw = window.localStorage.getItem(activeKey);
      if (activeRaw) {
        try {
          const activeDraft = JSON.parse(activeRaw) as InlineCommentDraft;
          if (
            activeDraft.path === draft.path &&
            activeDraft.line === draft.line &&
            activeDraft.side === draft.side
          ) {
            window.localStorage.removeItem(activeKey);
          }
        } catch {
          window.localStorage.removeItem(activeKey);
        }
      }
      window.localStorage.removeItem(
        inlineDraftStorageKey(workspace, repo, pullRequestId, draft),
      );
      window.localStorage.removeItem(
        inlineDraftStorageKeyLegacy(workspace, repo, pullRequestId, draft),
      );
    },
    [pullRequestId, repo, workspace],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const activeKey = inlineActiveDraftStorageKey(
      workspace,
      repo,
      pullRequestId,
    );
    const legacyActiveKey = inlineActiveDraftStorageKeyLegacy(
      workspace,
      repo,
      pullRequestId,
    );
    const raw =
      window.localStorage.getItem(activeKey) ??
      window.localStorage.getItem(legacyActiveKey);
    const restoreDraft = (draft: InlineCommentDraft) => {
      const content = getInlineDraftContent(draft);
      if (!content.trim()) return false;
      setInlineComment(draft);
      setActiveFile(draft.path);
      setViewMode("single");
      return true;
    };

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as InlineCommentDraft;
        if (parsed.path && parsed.line && parsed.side && restoreDraft(parsed)) {
          return;
        }
      } catch {
        window.localStorage.removeItem(activeKey);
        window.localStorage.removeItem(legacyActiveKey);
      }
    }

    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const parsed = parseInlineDraftStorageKey(
        key,
        workspace,
        repo,
        pullRequestId,
      );
      if (!parsed) continue;
      if (restoreDraft(parsed)) {
        window.localStorage.setItem(activeKey, JSON.stringify(parsed));
        return;
      }
    }
  }, [getInlineDraftContent, pullRequestId, repo, setActiveFile, workspace]);

  const toggleViewed = (path: string) => {
    setViewedFiles((prev) => {
      const wasViewed = prev.has(path);
      const next = new Set(prev);
      if (wasViewed) {
        next.delete(path);
      } else {
        next.add(path);
        setCollapsedAllModeFiles((collapsed) => ({
          ...collapsed,
          [path]: true,
        }));
      }
      return next;
    });
  };

  const collapseAllDirectories = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const path of directoryPaths) {
      next[path] = false;
    }
    setDirectoryExpandedMap(next);
  }, [directoryPaths, setDirectoryExpandedMap]);

  const expandAllDirectories = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const path of directoryPaths) {
      next[path] = true;
    }
    setDirectoryExpandedMap(next);
  }, [directoryPaths, setDirectoryExpandedMap]);

  const submitInlineComment = useCallback(() => {
    if (!inlineComment) return;
    const content = getInlineDraftContent(inlineComment).trim();
    if (!content) return;
    createCommentMutation.mutate({
      path: inlineComment.path,
      content,
      line: inlineComment.line,
      side: inlineComment.side,
    });
  }, [createCommentMutation, getInlineDraftContent, inlineComment]);

  const handleCopyPath = useCallback(async (path: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setActionError("Clipboard is not available");
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      setActionError(null);
      setCopiedPath(path);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedPath((current) => (current === path ? null : current));
      }, 1400);
    } catch {
      setActionError("Failed to copy file path");
    }
  }, []);

  const handleDiffLineEnter = useCallback(
    (props: OnDiffLineEnterLeaveProps) => {
      props.lineElement.style.cursor = "copy";
      if (props.numberElement) {
        props.numberElement.style.cursor = "copy";
      }
    },
    [],
  );

  const handleDiffLineLeave = useCallback(
    (props: OnDiffLineEnterLeaveProps) => {
      props.lineElement.style.cursor = "";
      if (props.numberElement) {
        props.numberElement.style.cursor = "";
      }
    },
    [],
  );

  const openInlineCommentDraft = useCallback(
    (path: string, props: OnDiffLineClickProps) => {
      setInlineComment((prev) => {
        const side = props.annotationSide ?? "additions";
        if (
          prev &&
          prev.path === path &&
          prev.line === props.lineNumber &&
          prev.side === side
        ) {
          return prev;
        }
        if (prev && getInlineDraftContent(prev).trim().length > 0) {
          return prev;
        }
        return {
          path,
          line: props.lineNumber,
          side,
        };
      });
    },
    [getInlineDraftContent],
  );

  const handleSingleDiffLineClick = useCallback(
    (props: OnDiffLineClickProps) => {
      if (!selectedFilePath) return;
      openInlineCommentDraft(selectedFilePath, props);
    },
    [openInlineCommentDraft, selectedFilePath],
  );

  useEffect(() => {
    if (!inlineComment) return;
    const timeoutId = window.setTimeout(() => {
      inlineDraftFocusRef.current?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    inlineComment?.line,
    inlineComment?.path,
    inlineComment?.side,
    inlineComment,
  ]);

  const buildFileAnnotations = useCallback(
    (filePath: string) => {
      const fileThreads = (threadsByPath.get(filePath) ?? []).filter(
        (thread) =>
          !thread.root.deleted &&
          Boolean(getCommentInlinePosition(thread.root)),
      );
      const annotations: Array<{
        side: CommentLineSide;
        lineNumber: number;
        metadata: SingleFileAnnotationMetadata;
      }> = [];

      for (const thread of fileThreads) {
        const position = getCommentInlinePosition(thread.root);
        if (!position) continue;
        annotations.push({
          side: position.side,
          lineNumber: position.lineNumber,
          metadata: {
            kind: "thread",
            thread,
          },
        });
      }

      if (inlineComment && inlineComment.path === filePath) {
        annotations.push({
          side: inlineComment.side,
          lineNumber: inlineComment.line,
          metadata: {
            kind: "draft",
            draft: inlineComment,
          },
        });
      }

      return annotations;
    },
    [inlineComment, threadsByPath],
  );

  const singleFileAnnotations = useMemo(() => {
    if (!selectedFilePath)
      return [] as Array<{
        side: CommentLineSide;
        lineNumber: number;
        metadata: SingleFileAnnotationMetadata;
      }>;
    return buildFileAnnotations(selectedFilePath);
  }, [buildFileAnnotations, selectedFilePath]);

  const singleFileDiffOptions = useMemo<FileDiffOptions<undefined>>(
    () => ({
      ...compactDiffOptions,
      onLineClick: handleSingleDiffLineClick,
      onLineNumberClick: handleSingleDiffLineClick,
      onLineEnter: handleDiffLineEnter,
      onLineLeave: handleDiffLineLeave,
    }),
    [
      compactDiffOptions,
      handleSingleDiffLineClick,
      handleDiffLineEnter,
      handleDiffLineLeave,
    ],
  );

  const startTreeResize = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!workspaceRef.current) return;

      const initialWidth = treeWidth;
      const startX = event.clientX;
      document.body.style.userSelect = "none";

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.min(
          MAX_TREE_WIDTH,
          Math.max(MIN_TREE_WIDTH, initialWidth + delta),
        );
        setTreeWidth(next);
      };

      const onMouseUp = () => {
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [treeWidth],
  );

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
            {prQuery.error instanceof Error
              ? prQuery.error.message
              : "Failed to load pull request"}
          </p>
        </div>
      </div>
    );
  }

  if (!prData) return null;

  return (
    <div ref={workspaceRef} className="h-full min-h-0 flex bg-background">
      <aside
        className="relative shrink-0 border-r border-border bg-sidebar flex flex-col"
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
            <div className="h-11 px-2 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                {viewedVisibleCount}/{visibleFilePaths.length} viewed
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[10px] gap-1.5"
                onClick={() => setShowUnviewedOnly((prev) => !prev)}
              >
                <span
                  className={
                    showUnviewedOnly
                      ? "size-3.5 bg-accent text-foreground flex items-center justify-center"
                      : "size-3.5 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                  }
                >
                  <Check className="size-2.5" />
                </span>
                Unviewed
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 ml-auto"
                onClick={() => setTreeCollapsed(true)}
                aria-label="Collapse file tree"
              >
                <PanelLeftClose className="size-3.5" />
              </Button>
            </div>
            <div className="h-10 px-2 border-b border-border flex items-center gap-1">
              <Input
                className="h-7 text-[12px] flex-1 min-w-0"
                placeholder="search files"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={collapseAllDirectories}
                    aria-label="Collapse all directories"
                  >
                    <FolderMinus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse all directories</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={expandAllDirectories}
                    aria-label="Expand all directories"
                  >
                    <FolderPlus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Expand all directories</TooltipContent>
              </Tooltip>
            </div>
            <ScrollArea
              className="flex-1 min-h-0"
              viewportClassName="tree-font-scope py-2"
            >
              <FileTree
                path=""
                filterQuery={searchQuery}
                allowedFiles={visiblePathSet}
                viewedFiles={viewedFiles}
                onToggleViewed={toggleViewed}
                onFileClick={(node) => selectAndRevealFile(node.path)}
              />
            </ScrollArea>
            <button
              type="button"
              className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-border/30"
              onMouseDown={startTreeResize}
              aria-label="Resize file tree"
            />
          </>
        )}
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="h-11 border-b border-border bg-card px-3 flex items-center gap-3">
          <div className="min-w-0 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate text-foreground font-medium">
              {prData.pr.source?.repository?.full_name ?? "repo"}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="truncate">
              {prData.pr.destination?.branch?.name ?? "branch"}
            </span>
            <span className="px-1.5 py-0.5 border border-border bg-secondary uppercase text-[10px] text-foreground">
              {prData.pr.state}
            </span>
            <span className="text-[10px]">#{prData.pr.id}</span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">
              unresolved {unresolvedThreads.length}
            </span>
            <span className="text-status-added">+{lineStats.added}</span>
            <span className="text-status-removed">-{lineStats.removed}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={
                isApproved ||
                approveMutation.isPending ||
                requestChangesMutation.isPending
              }
              onClick={handleApprovePullRequest}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={
                !hostCapabilities.requestChangesAvailable ||
                (prData.prRef.host === "bitbucket" && !isApproved) ||
                approveMutation.isPending ||
                requestChangesMutation.isPending
              }
              onClick={handleRequestChangesPullRequest}
            >
              Request Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setMergeOpen(true)}
            >
              Merge
            </Button>
            <SettingsMenu
              workspaceMode={viewMode}
              onWorkspaceModeChange={setViewMode}
              onDisconnect={() => {
                void (async () => {
                  setTreeCollapsed(false);
                  setSearchQuery("");
                  setInlineComment(null);
                  setViewedFiles(new Set());
                  clearAllRepos();
                  await logout();
                  navigate({ to: "/" });
                })();
              }}
            />
          </div>
        </div>

        {actionError && (
          <div className="border-b border-destructive bg-destructive/10 text-destructive px-3 py-1.5 text-[12px]">
            {actionError}
          </div>
        )}

        <div
          ref={diffScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        >
          {isSummarySelected && prData ? (
            <PullRequestSummaryPanel
              bundle={prData}
              onRefreshBuildStatus={() => {
                void refetchPrQuery();
              }}
              refreshingBuildStatus={isPrQueryFetching}
            />
          ) : viewMode === "single" ? (
            selectedFileDiff && selectedFilePath ? (
              <div
                id={fileAnchorId(selectedFilePath)}
                className="h-full min-w-0 max-w-full flex flex-col overflow-x-hidden"
              >
                <div className="h-10 min-w-0 border-b border-border px-3 flex items-center gap-2 overflow-hidden">
                  <span className="size-4 flex items-center justify-center shrink-0">
                    <FileIcon
                      name={
                        selectedFilePath.split("/").pop() || selectedFilePath
                      }
                      className="size-3.5"
                    />
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-[12px] truncate">
                    {selectedFilePath}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => handleCopyPath(selectedFilePath)}
                    aria-label="Copy file path"
                  >
                    {copiedPath === selectedFilePath ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                  <span className="select-none text-[12px] text-status-added">
                    +{fileLineStats.get(selectedFilePath)?.added ?? 0}
                  </span>
                  <span className="select-none text-[12px] text-status-removed">
                    -{fileLineStats.get(selectedFilePath)?.removed ?? 0}
                  </span>
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground"
                    onClick={() => toggleViewed(selectedFilePath)}
                  >
                    <span
                      className={
                        viewedFiles.has(selectedFilePath)
                          ? "size-4 bg-accent text-foreground flex items-center justify-center"
                          : "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                      }
                    >
                      <Check className="size-3" />
                    </span>
                  </button>
                </div>

                <div className="diff-content-scroll min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto">
                  {diffHighlighterReady ? (
                    <FileDiff
                      fileDiff={toRenderableFileDiff(selectedFileDiff)}
                      options={singleFileDiffOptions}
                      className="compact-diff commentable-diff pr-diff-font"
                      style={diffTypographyStyle}
                      lineAnnotations={singleFileAnnotations}
                      renderAnnotation={(annotation) => {
                        const metadata = annotation.metadata;
                        if (!metadata) return null;

                        return (
                          <div className="px-2 py-1.5 border-y border-border bg-background/70">
                            {metadata.kind === "draft" ? (
                              <div className="space-y-2">
                                <CommentEditor
                                  key={inlineDraftStorageKey(
                                    workspace,
                                    repo,
                                    pullRequestId,
                                    metadata.draft,
                                  )}
                                  value={getInlineDraftContent(metadata.draft)}
                                  placeholder="Add a line comment"
                                  disabled={createCommentMutation.isPending}
                                  onReady={(focus) => {
                                    inlineDraftFocusRef.current = focus;
                                  }}
                                  onChange={(nextValue) =>
                                    setInlineDraftContent(
                                      metadata.draft,
                                      nextValue,
                                    )
                                  }
                                  onSubmit={submitInlineComment}
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7"
                                    disabled={createCommentMutation.isPending}
                                    onClick={submitInlineComment}
                                  >
                                    Comment
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => {
                                      clearInlineDraftContent(metadata.draft);
                                      setInlineComment(null);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="border border-border bg-background p-2 text-[12px]">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                  <MessageSquare className="size-3.5" />
                                  <span>
                                    {metadata.thread.root.user?.display_name ??
                                      "Unknown"}
                                  </span>
                                  <span>
                                    {formatDate(metadata.thread.root.created_on)}
                                  </span>
                                  <span className="ml-auto">
                                    {metadata.thread.root.resolution
                                      ? "Resolved"
                                      : "Unresolved"}
                                  </span>
                                </div>
                                <div className="text-[13px] whitespace-pre-wrap">
                                  {metadata.thread.root.content?.raw ?? ""}
                                </div>
                                {metadata.thread.replies.length > 0 && (
                                  <div className="mt-2 pl-3 border-l border-border space-y-1">
                                    {metadata.thread.replies.map((reply) => (
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
                                    disabled={
                                      resolveCommentMutation.isPending ||
                                      !hostCapabilities.supportsThreadResolution
                                    }
                                    onClick={() =>
                                      resolveCommentMutation.mutate({
                                        commentId: metadata.thread.root.id,
                                        resolve:
                                          !metadata.thread.root.resolution,
                                      })
                                    }
                                  >
                                    {metadata.thread.root.resolution
                                      ? "Unresolve"
                                      : "Resolve"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                  ) : (
                    <div className="w-full border border-border bg-card p-3 text-[12px] text-muted-foreground">
                      Loading syntax highlighting...
                    </div>
                  )}
                </div>

                {selectedFileLevelThreads.length > 0 && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {selectedFileLevelThreads.map((thread) => (
                      <div
                        key={thread.id}
                        className="border border-border bg-background p-2 text-[12px]"
                      >
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <MessageSquare className="size-3.5" />
                          <span>
                            {thread.root.user?.display_name ?? "Unknown"}
                          </span>
                          <span>{formatDate(thread.root.created_on)}</span>
                          <span className="ml-auto">
                            {thread.root.resolution ? "Resolved" : "Unresolved"}
                          </span>
                        </div>
                        <div className="text-[13px] whitespace-pre-wrap">
                          {thread.root.content?.raw ?? ""}
                        </div>
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
                            disabled={
                              resolveCommentMutation.isPending ||
                              !hostCapabilities.supportsThreadResolution
                            }
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
            <div className="w-full max-w-full">
              {allModeDiffEntries.map(({ fileDiff, filePath }, index) => {
                const fileUnresolvedCount = (
                  threadsByPath.get(filePath) ?? []
                ).filter(
                  (thread) => !thread.root.resolution && !thread.root.deleted,
                ).length;
                const fileStats = fileLineStats.get(filePath) ?? {
                  added: 0,
                  removed: 0,
                };
                const fileName = filePath.split("/").pop() || filePath;
                const isCollapsed =
                  collapsedAllModeFiles[filePath] ??
                  (options.collapseViewedFilesByDefault &&
                    viewedFiles.has(filePath));

                return (
                  <div
                    key={filePath}
                    id={fileAnchorId(filePath)}
                    className={cn(
                      "w-full max-w-full border border-l-0 border-t-0 border-border bg-card",
                      isCollapsed && "border-b-0",
                    )}
                    style={index === 0 ? { borderTopWidth: 0 } : undefined}
                  >
                  <div
                    className={cn(
                      "group sticky top-0 z-20 h-10 min-w-0 cursor-pointer border-b border-border bg-card px-2 flex items-center gap-2 overflow-hidden text-[12px]",
                    )}
                    onClick={() =>
                      setCollapsedAllModeFiles((prev) => ({
                        ...prev,
                        [filePath]: !isCollapsed,
                      }))
                    }
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                      <span className="size-4 flex items-center justify-center shrink-0">
                        <FileIcon name={fileName} className="size-3.5" />
                      </span>
                      <span className="min-w-0 max-w-full truncate font-mono">
                        {filePath}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCopyPath(filePath);
                          }}
                          aria-label="Copy file path"
                        >
                          {copiedPath === filePath ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                        <span className="shrink-0 select-none text-status-added">+{fileStats.added}</span>
                        <span className="shrink-0 select-none text-status-removed">-{fileStats.removed}</span>
                        {fileUnresolvedCount > 0 ? (
                          <span className="shrink-0 text-muted-foreground">
                            {fileUnresolvedCount} unresolved
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center text-[12px] text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleViewed(filePath);
                        }}
                      >
                        <span
                          className={
                            viewedFiles.has(filePath)
                              ? "size-4 bg-accent text-foreground flex items-center justify-center"
                              : "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                          }
                        >
                          <Check className="size-3" />
                        </span>
                      </button>
                    </div>
                  </div>
                    {!isCollapsed && (
                      <div className="diff-content-scroll min-w-0 w-full max-w-full overflow-x-auto">
                        {diffHighlighterReady ? (
                          <FileDiff
                            fileDiff={toRenderableFileDiff(fileDiff)}
                            options={{
                              ...compactDiffOptions,
                              onLineClick: (props) =>
                                openInlineCommentDraft(filePath, props),
                              onLineNumberClick: (props) =>
                                openInlineCommentDraft(filePath, props),
                              onLineEnter: handleDiffLineEnter,
                              onLineLeave: handleDiffLineLeave,
                            }}
                            className="compact-diff commentable-diff pr-diff-font"
                            style={diffTypographyStyle}
                            lineAnnotations={buildFileAnnotations(filePath)}
                          />
                        ) : (
                          <div className="w-full border border-border bg-card p-3 text-[12px] text-muted-foreground">
                            Loading syntax highlighting...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {allModeDiffEntries.length === 0 && (
                <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">
                  No files match the current search.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge pull request</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="merge-strategy">Merge strategy</Label>
              {hostCapabilities.mergeStrategies?.length ? (
                <select
                  id="merge-strategy"
                  value={mergeStrategy}
                  onChange={(e) => setMergeStrategy(e.target.value)}
                  className="h-9 w-full border border-input bg-background px-3 text-[13px]"
                >
                  {hostCapabilities.mergeStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="merge-strategy"
                  value={mergeStrategy}
                  onChange={(e) => setMergeStrategy(e.target.value)}
                  placeholder="merge_commit"
                />
              )}
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
              <Switch
                checked={closeSourceBranch}
                onCheckedChange={setCloseSourceBranch}
                id="close-branch"
              />
              <Label htmlFor="close-branch">Close source branch</Label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMergeOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
              >
                {mergeMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}{" "}
                Merge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
