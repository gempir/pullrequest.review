import type { FileDiffOptions, OnDiffLineClickProps, OnDiffLineEnterLeaveProps } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { Check, CheckCheck, ChevronDown, ChevronRight, Copy, ScrollText } from "lucide-react";
import type { CSSProperties } from "react";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { DiffContextButton, type DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { InlineDiffAnnotation } from "@/components/pull-request-review/inline-diff-annotation";
import { ReviewDiffSettingsMenu } from "@/components/pull-request-review/review-diff-settings-menu";
import type { SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Button } from "@/components/ui/button";
import { fileAnchorId } from "@/lib/file-anchors";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { cn } from "@/lib/utils";
import type { CommentThread } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type ReviewAllModeViewProps = {
    viewMode: "single" | "all";
    onWorkspaceModeChange: (mode: "single" | "all") => void;
    pullRequestTitle: string;
    prData: PullRequestBundle | null;
    lineStats: { added: number; removed: number };
    currentUserDisplayName?: string;
    isSummaryCollapsedInAllMode: boolean;
    onToggleSummaryCollapsed: () => void;
    allModeDiffEntries: Array<{ filePath: string; fileDiff: FileDiffMetadata }>;
    threadsByPath: Map<string, CommentThread[]>;
    fileLineStats: Map<string, { added: number; removed: number }>;
    collapsedAllModeFiles: Record<string, boolean>;
    collapseViewedFilesByDefault: boolean;
    viewedFiles: Set<string>;
    copiedPath: string | null;
    areAllFilesViewed: boolean;
    onToggleCollapsedFile: (path: string, next: boolean) => void;
    onToggleAllFilesViewed: () => void;
    onCopyPath: (path: string) => void;
    onToggleViewed: (path: string) => void;
    workspace: string;
    repo: string;
    pullRequestId: string;
    diffHighlighterReady: boolean;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    toRenderableFileDiff: (fileDiff: FileDiffMetadata) => FileDiffMetadata;
    compactDiffOptions: FileDiffOptions<undefined>;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onOpenInlineDraftForPath: (path: string, props: OnDiffLineClickProps) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onHistoryCommentNavigate: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    onReplyToThread: (commentId: number, content: string) => void;
    onDiffLineEnter: (props: OnDiffLineEnterLeaveProps) => void;
    onDiffLineLeave: (props: OnDiffLineEnterLeaveProps) => void;
    diffTypographyStyle: CSSProperties;
    buildFileAnnotations: (filePath: string) => SingleFileAnnotation[];
    onOpenDiffSettings: () => void;
    onLoadFullFileContext: (path: string, fileDiff: FileDiffMetadata) => void;
    fileContextState: Record<string, DiffContextState>;
};

export function ReviewAllModeView({
    viewMode,
    onWorkspaceModeChange,
    pullRequestTitle,
    prData,
    lineStats,
    currentUserDisplayName,
    isSummaryCollapsedInAllMode,
    onToggleSummaryCollapsed,
    allModeDiffEntries,
    threadsByPath,
    fileLineStats,
    collapsedAllModeFiles,
    collapseViewedFilesByDefault,
    viewedFiles,
    copiedPath,
    areAllFilesViewed,
    onToggleCollapsedFile,
    onToggleAllFilesViewed,
    onCopyPath,
    onToggleViewed,
    workspace,
    repo,
    pullRequestId,
    diffHighlighterReady,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    toRenderableFileDiff,
    compactDiffOptions,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    onOpenInlineDraftForPath,
    onDeleteComment,
    onResolveThread,
    onHistoryCommentNavigate,
    onReplyToThread,
    onDiffLineEnter,
    onDiffLineLeave,
    diffTypographyStyle,
    buildFileAnnotations,
    onOpenDiffSettings,
    onLoadFullFileContext,
    fileContextState,
}: ReviewAllModeViewProps) {
    const diffListBottomPadding = "max(420px, 90vh)";
    return (
        <div className="w-full max-w-full" data-component="diff-list-view" style={{ paddingBottom: diffListBottomPadding }}>
            {prData ? (
                <div
                    id={fileAnchorId(PR_SUMMARY_PATH)}
                    className={cn("w-full max-w-full border border-l-0 border-t-0 border-border", isSummaryCollapsedInAllMode && "border-b-0")}
                    style={{ borderTopWidth: 0 }}
                >
                    <div
                        className={cn(
                            "group sticky top-0 z-20 h-10 min-w-0 border-b border-border bg-chrome px-2.5 flex items-center gap-2 overflow-hidden text-[12px]",
                        )}
                    >
                        <button type="button" className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden text-left" onClick={onToggleSummaryCollapsed}>
                            <span className="size-4 flex items-center justify-center shrink-0">
                                <ScrollText className="size-3.5" />
                            </span>
                            <span className="min-w-0 max-w-full truncate font-mono">{pullRequestTitle || PR_SUMMARY_NAME}</span>
                        </button>
                        <div className="shrink-0 font-mono text-[11px]">
                            <span className="text-status-added">+{lineStats.added}</span>
                            <span className="ml-2 text-status-removed">-{lineStats.removed}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                            <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={onWorkspaceModeChange} onOpenDiffSettings={onOpenDiffSettings} />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 shrink-0"
                                onClick={onToggleAllFilesViewed}
                                aria-label={areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed"}
                                title={areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed"}
                            >
                                <span
                                    className={
                                        areAllFilesViewed
                                            ? "size-4 bg-muted/40 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                            : "size-4 bg-muted/40 border border-border/70 text-muted-foreground flex items-center justify-center"
                                    }
                                >
                                    <CheckCheck className="size-3" />
                                </span>
                            </Button>
                        </div>
                        <span
                            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                        >
                            {isSummaryCollapsedInAllMode ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </span>
                    </div>
                    {!isSummaryCollapsedInAllMode && (
                        <PullRequestSummaryPanel bundle={prData} diffStats={lineStats} onSelectComment={onHistoryCommentNavigate} />
                    )}
                </div>
            ) : null}

            {allModeDiffEntries.map(({ fileDiff, filePath }, index) => {
                const fileUnresolvedCount = (threadsByPath.get(filePath) ?? []).filter((thread) => !thread.root.resolution && !thread.root.deleted).length;
                const fileStats = fileLineStats.get(filePath) ?? { added: 0, removed: 0 };
                const fileName = filePath.split("/").pop() || filePath;
                const isCollapsed = collapsedAllModeFiles[filePath] ?? (collapseViewedFilesByDefault && viewedFiles.has(filePath));
                const hasFullContext = fileContextState[filePath]?.status === "ready";
                const fileDiffOptions =
                    hasFullContext && typeof compactDiffOptions.hunkSeparators !== "function"
                        ? compactDiffOptions.hunkSeparators === "line-info"
                            ? compactDiffOptions
                            : { ...compactDiffOptions, hunkSeparators: "line-info" as const }
                        : compactDiffOptions;

                return (
                    <div
                        key={filePath}
                        id={fileAnchorId(filePath)}
                        className={cn("w-full max-w-full border border-l-0 border-t-0 border-border bg-card", isCollapsed && "border-b-0")}
                        style={index === 0 && !prData ? { borderTopWidth: 0 } : undefined}
                    >
                        <div
                            className={cn(
                                "group sticky top-0 z-20 h-10 min-w-0 border-b border-border bg-chrome px-2.5 flex items-center gap-2 overflow-hidden text-[12px]",
                            )}
                        >
                            <div className="min-w-0 flex flex-1 items-center gap-2">
                                <button
                                    type="button"
                                    className="h-full min-w-0 flex items-center gap-2 overflow-hidden text-left"
                                    onClick={() => onToggleCollapsedFile(filePath, !isCollapsed)}
                                >
                                    <span className="size-4 flex items-center justify-center shrink-0">
                                        <RepositoryFileIcon fileName={fileName} className="size-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-mono">{filePath}</span>
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 shrink-0"
                                    onClick={() => onCopyPath(filePath)}
                                    aria-label="Copy file path"
                                >
                                    {copiedPath === filePath ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                                </Button>
                                <DiffContextButton state={fileContextState[filePath]} onClick={() => onLoadFullFileContext(filePath, fileDiff)} />
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-2 text-[12px]">
                                <span className="select-none text-status-added">+{fileStats.added}</span>
                                <span className="select-none text-status-removed">-{fileStats.removed}</span>
                                {fileUnresolvedCount > 0 ? <span className="text-muted-foreground">{fileUnresolvedCount} unresolved</span> : null}
                                <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={onWorkspaceModeChange} onOpenDiffSettings={onOpenDiffSettings} />
                                <button type="button" className="flex items-center text-muted-foreground" onClick={() => onToggleViewed(filePath)}>
                                    <span
                                        className={
                                            viewedFiles.has(filePath)
                                                ? "size-4 bg-muted/40 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                                : "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                                        }
                                    >
                                        <Check className="size-3" />
                                    </span>
                                </button>
                            </div>
                            <span
                                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden
                            >
                                {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </span>
                        </div>
                        {!isCollapsed ? (
                            <div className="diff-content-scroll min-w-0 w-full max-w-full overflow-x-auto">
                                {diffHighlighterReady ? (
                                    <FileDiff
                                        fileDiff={toRenderableFileDiff(fileDiff)}
                                        options={{
                                            ...fileDiffOptions,
                                            onLineClick: (props) => onOpenInlineDraftForPath(filePath, props),
                                            onLineNumberClick: (props) => onOpenInlineDraftForPath(filePath, props),
                                            onLineEnter: onDiffLineEnter,
                                            onLineLeave: onDiffLineLeave,
                                        }}
                                        className="compact-diff commentable-diff pr-diff-font"
                                        style={diffTypographyStyle}
                                        lineAnnotations={buildFileAnnotations(filePath)}
                                        renderAnnotation={(annotation) => (
                                            <InlineDiffAnnotation
                                                annotation={annotation as SingleFileAnnotation}
                                                workspace={workspace}
                                                repo={repo}
                                                pullRequestId={pullRequestId}
                                                createCommentPending={createCommentPending}
                                                canCommentInline={canCommentInline}
                                                canResolveThread={canResolveThread}
                                                resolveCommentPending={resolveCommentPending}
                                                getInlineDraftContent={getInlineDraftContent}
                                                setInlineDraftContent={setInlineDraftContent}
                                                onSubmitInlineComment={onSubmitInlineComment}
                                                onInlineDraftReady={onInlineDraftReady}
                                                onCancelInlineDraft={onCancelInlineDraft}
                                                currentUserDisplayName={currentUserDisplayName}
                                                onDeleteComment={onDeleteComment}
                                                onResolveThread={onResolveThread}
                                                onReplyToThread={onReplyToThread}
                                            />
                                        )}
                                    />
                                ) : (
                                    <div className="w-full border border-border bg-card p-3 text-[12px] text-muted-foreground">
                                        Loading syntax highlighting...
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                );
            })}

            {allModeDiffEntries.length === 0 ? (
                <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No files match the current search.</div>
            ) : null}
        </div>
    );
}
