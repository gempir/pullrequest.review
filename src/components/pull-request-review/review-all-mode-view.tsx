import type { FileDiffOptions, OnDiffLineEnterLeaveProps } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, CheckCheck, Copy, ScrollText } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo } from "react";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { DiffContextButton, type DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { FileVersionSelect, type FileVersionSelectOption } from "@/components/pull-request-review/file-version-select";
import { InlineDiffAnnotation } from "@/components/pull-request-review/inline-diff-annotation";
import { ReviewDiffSettingsMenu } from "@/components/pull-request-review/review-diff-settings-menu";
import type { InlineCommentLineTarget, SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
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
    getSelectedVersionIdForPath: (path: string) => string | undefined;
    getVersionOptionsForPath: (path: string) => FileVersionSelectOption[];
    onSelectVersionForPath: (path: string, versionId: string) => void;
    onOpenVersionMenuForPath: (path: string) => void;
    resolveDisplayedDiffForPath: (
        path: string,
        latestFileDiff: FileDiffMetadata | undefined,
    ) => { fileDiff: FileDiffMetadata | undefined; readOnlyHistorical: boolean; selectedVersionId: string | undefined };
    isVersionViewed: (versionId: string) => boolean;
    compactDiffOptions: FileDiffOptions<undefined>;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onOpenInlineDraftForPath: (path: string, target: InlineCommentLineTarget) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onHistoryCommentNavigate: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    onReplyToThread: (commentId: number, content: string) => void;
    onDiffLineEnter: (props: OnDiffLineEnterLeaveProps, onOpenInlineDraft?: (target: InlineCommentLineTarget) => void) => void;
    onDiffLineLeave: (props: OnDiffLineEnterLeaveProps) => void;
    diffTypographyStyle: CSSProperties;
    buildFileAnnotations: (filePath: string) => SingleFileAnnotation[];
    onOpenDiffSettings: () => void;
    onLoadFullFileContext: (path: string, fileDiff: FileDiffMetadata) => void;
    fileContextState: Record<string, DiffContextState>;
    scrollElementRef: RefObject<HTMLDivElement | null>;
    pendingScrollPath: string | null;
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
    getSelectedVersionIdForPath,
    getVersionOptionsForPath,
    onSelectVersionForPath,
    onOpenVersionMenuForPath,
    resolveDisplayedDiffForPath,
    isVersionViewed,
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
    scrollElementRef,
    pendingScrollPath,
}: ReviewAllModeViewProps) {
    const diffListBottomPadding = "max(420px, 90vh)";
    const filePathsInOrder = useMemo(() => allModeDiffEntries.map((entry) => entry.filePath), [allModeDiffEntries]);
    const rowVirtualizer = useVirtualizer({
        count: allModeDiffEntries.length,
        getScrollElement: () => scrollElementRef.current,
        estimateSize: () => 420,
        overscan: 4,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
    const paddingBottom =
        virtualRows.length > 0 ? Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)) : rowVirtualizer.getTotalSize();

    useEffect(() => {
        if (!pendingScrollPath) return;
        const index = filePathsInOrder.indexOf(pendingScrollPath);
        if (index < 0) return;
        rowVirtualizer.scrollToIndex(index, { align: "start" });
    }, [filePathsInOrder, pendingScrollPath, rowVirtualizer]);
    return (
        <div className="w-full max-w-full" data-component="diff-list-view" style={{ paddingBottom: diffListBottomPadding }}>
            {prData ? (
                <div id={fileAnchorId(PR_SUMMARY_PATH)} className={cn("w-full max-w-full border-b border-border", isSummaryCollapsedInAllMode && "border-b-0")}>
                    <div className={cn("group sticky top-0 z-20 h-10 min-w-0 bg-chrome px-2.5 flex items-center gap-2 overflow-hidden text-[12px]")}>
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
                    </div>
                    {!isSummaryCollapsedInAllMode && (
                        <PullRequestSummaryPanel bundle={prData} diffStats={lineStats} onSelectComment={onHistoryCommentNavigate} />
                    )}
                </div>
            ) : null}

            {paddingTop > 0 ? <div style={{ height: paddingTop }} /> : null}
            {virtualRows.map((virtualRow) => {
                const entry = allModeDiffEntries[virtualRow.index];
                if (!entry) return null;
                const { fileDiff, filePath } = entry;
                const fileUnresolvedCount = (threadsByPath.get(filePath) ?? []).filter(
                    (thread) => !thread.root.comment.resolution && !thread.root.comment.deleted,
                ).length;
                const fileStats = fileLineStats.get(filePath) ?? { added: 0, removed: 0 };
                const fileName = filePath.split("/").pop() || filePath;
                const isCollapsed = collapsedAllModeFiles[filePath] ?? (collapseViewedFilesByDefault && viewedFiles.has(filePath));
                const hasFullContext = fileContextState[filePath]?.status === "ready";
                const fileVersionOptions = getVersionOptionsForPath(filePath);
                const selectedVersionId = getSelectedVersionIdForPath(filePath) ?? fileVersionOptions[0]?.id;
                const selectedVersionUnread = selectedVersionId ? !isVersionViewed(selectedVersionId) : false;
                const isSelectedVersionViewed = selectedVersionId ? isVersionViewed(selectedVersionId) : false;
                const displayed = resolveDisplayedDiffForPath(filePath, fileDiff);
                const displayedFileDiff = displayed.fileDiff;
                const readOnlyHistorical = displayed.readOnlyHistorical;
                const fileDiffOptions =
                    hasFullContext && typeof compactDiffOptions.hunkSeparators !== "function"
                        ? compactDiffOptions.hunkSeparators === "line-info"
                            ? compactDiffOptions
                            : { ...compactDiffOptions, hunkSeparators: "line-info" as const }
                        : compactDiffOptions;

                return (
                    <div key={filePath} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                        <div id={fileAnchorId(filePath)} className={cn("w-full max-w-full bg-card", isCollapsed && "border-b-0")}>
                            <div className={cn("group sticky top-0 z-20 h-10 min-w-0 bg-chrome px-2.5 flex items-center gap-2 overflow-hidden text-[12px]")}>
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
                                    <FileVersionSelect
                                        value={selectedVersionId ?? ""}
                                        options={fileVersionOptions}
                                        onValueChange={(versionId) => onSelectVersionForPath(filePath, versionId)}
                                        onOpenChange={(open) => {
                                            if (!open) return;
                                            onOpenVersionMenuForPath(filePath);
                                        }}
                                    />
                                    <DiffContextButton
                                        state={fileContextState[filePath]}
                                        onClick={() => onLoadFullFileContext(filePath, fileDiff)}
                                        disabled={readOnlyHistorical}
                                    />
                                </div>
                                <div className="ml-auto flex shrink-0 items-center gap-2 text-[12px]">
                                    <span className="select-none text-status-added">+{fileStats.added}</span>
                                    <span className="select-none text-status-removed">-{fileStats.removed}</span>
                                    {fileUnresolvedCount > 0 ? <span className="text-muted-foreground">{fileUnresolvedCount} unresolved</span> : null}
                                    <ReviewDiffSettingsMenu
                                        viewMode={viewMode}
                                        onViewModeChange={onWorkspaceModeChange}
                                        onOpenDiffSettings={onOpenDiffSettings}
                                    />
                                    <button type="button" className="flex items-center text-muted-foreground" onClick={() => onToggleViewed(filePath)}>
                                        <span
                                            className={
                                                selectedVersionUnread
                                                    ? "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                                                    : isSelectedVersionViewed
                                                        ? "size-4 bg-muted/40 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                                        : "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                                            }
                                        >
                                            <Check className="size-3" />
                                        </span>
                                    </button>
                                </div>
                            </div>
                            {!isCollapsed ? (
                                <div className="diff-content-scroll min-w-0 w-full max-w-full overflow-x-auto">
                                    {diffHighlighterReady && displayedFileDiff ? (
                                        <FileDiff
                                            fileDiff={toRenderableFileDiff(displayedFileDiff)}
                                            options={{
                                                ...fileDiffOptions,
                                                onLineClick: undefined,
                                                onLineNumberClick: undefined,
                                                onLineEnter: (props) =>
                                                    onDiffLineEnter(
                                                        props,
                                                        readOnlyHistorical || !canCommentInline
                                                            ? undefined
                                                            : (target) => onOpenInlineDraftForPath(filePath, target),
                                                    ),
                                                onLineLeave: onDiffLineLeave,
                                            }}
                                            className="compact-diff commentable-diff pr-diff-font"
                                            style={diffTypographyStyle}
                                            lineAnnotations={readOnlyHistorical ? [] : buildFileAnnotations(filePath)}
                                            renderAnnotation={(annotation) => (
                                                <InlineDiffAnnotation
                                                    annotation={annotation as SingleFileAnnotation}
                                                    workspace={workspace}
                                                    repo={repo}
                                                    pullRequestId={pullRequestId}
                                                    createCommentPending={createCommentPending}
                                                    canCommentInline={canCommentInline && !readOnlyHistorical}
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
                    </div>
                );
            })}
            {paddingBottom > 0 ? <div style={{ height: paddingBottom }} /> : null}

            {allModeDiffEntries.length === 0 ? (
                <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No files match the current search.</div>
            ) : null}
        </div>
    );
}
