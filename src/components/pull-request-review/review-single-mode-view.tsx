import type { FileDiffOptions } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { Check, CheckCheck, Copy } from "lucide-react";
import type { CSSProperties } from "react";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { DiffContextButton, type DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { InlineDiffAnnotation } from "@/components/pull-request-review/inline-diff-annotation";
import { ReviewDiffSettingsMenu } from "@/components/pull-request-review/review-diff-settings-menu";
import { ThreadCard } from "@/components/pull-request-review/review-thread-card";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Button } from "@/components/ui/button";
import { fileAnchorId } from "@/lib/file-anchors";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import type { SingleFileAnnotation } from "./review-page-model";
import type { CommentThread } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type ReviewSingleModeViewProps = {
    viewMode: "single" | "all";
    onWorkspaceModeChange: (mode: "single" | "all") => void;
    prData: PullRequestBundle;
    pullRequestTitle?: string;
    currentUserDisplayName?: string;
    lineStats: { added: number; removed: number };
    isSummarySelected: boolean;
    selectedFilePath?: string;
    selectedFileDiff?: FileDiffMetadata;
    copiedPath: string | null;
    fileLineStats: Map<string, { added: number; removed: number }>;
    viewedFiles: Set<string>;
    diffHighlighterReady: boolean;
    diffTypographyStyle: CSSProperties;
    singleFileDiffOptions: FileDiffOptions<undefined>;
    singleFileAnnotations: SingleFileAnnotation[];
    selectedFileLevelThreads: CommentThread[];
    workspace: string;
    repo: string;
    pullRequestId: string;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    toRenderableFileDiff: (fileDiff: FileDiffMetadata) => FileDiffMetadata;
    onCopyPath: (path: string) => void;
    areAllFilesViewed: boolean;
    onToggleAllFilesViewed: () => void;
    onToggleViewed: (path: string) => void;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => void;
    onOpenDiffSettings: () => void;
    onLoadFullFileContext: (path: string, fileDiff: FileDiffMetadata) => void;
    fileContextState: Record<string, DiffContextState>;
    onHistoryCommentNavigate: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
};

export function ReviewSingleModeView({
    viewMode,
    onWorkspaceModeChange,
    prData,
    pullRequestTitle,
    currentUserDisplayName,
    lineStats,
    isSummarySelected,
    selectedFilePath,
    selectedFileDiff,
    copiedPath,
    fileLineStats,
    viewedFiles,
    diffHighlighterReady,
    diffTypographyStyle,
    singleFileDiffOptions,
    singleFileAnnotations,
    selectedFileLevelThreads,
    workspace,
    repo,
    pullRequestId,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    toRenderableFileDiff,
    onCopyPath,
    areAllFilesViewed,
    onToggleAllFilesViewed,
    onToggleViewed,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onOpenDiffSettings,
    onLoadFullFileContext,
    fileContextState,
    onHistoryCommentNavigate,
}: ReviewSingleModeViewProps) {
    const hasFullContext = selectedFilePath ? fileContextState[selectedFilePath]?.status === "ready" : false;
    const resolvedFileDiffOptions =
        hasFullContext && typeof singleFileDiffOptions.hunkSeparators !== "function"
            ? singleFileDiffOptions.hunkSeparators === "line-info"
                ? singleFileDiffOptions
                : { ...singleFileDiffOptions, hunkSeparators: "line-info" as const }
            : singleFileDiffOptions;
    if (isSummarySelected) {
        return (
            <div id={fileAnchorId(PR_SUMMARY_PATH)} className="h-full w-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
                <PullRequestSummaryPanel
                    bundle={prData}
                    headerTitle={pullRequestTitle || PR_SUMMARY_NAME}
                    diffStats={lineStats}
                    onSelectComment={onHistoryCommentNavigate}
                    headerRight={
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
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
                    }
                />
            </div>
        );
    }

    if (!selectedFileDiff || !selectedFilePath) {
        return <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No file selected for the current filter.</div>;
    }

    return (
        <div id={fileAnchorId(selectedFilePath)} data-component="diff-file-view" className="h-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
            <div className="h-10 min-w-0 border-b border-border bg-chrome px-3 flex items-center gap-2 overflow-hidden">
                <span className="size-4 flex items-center justify-center shrink-0">
                    <RepositoryFileIcon fileName={selectedFilePath.split("/").pop() || selectedFilePath} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-[12px]">{selectedFilePath}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => onCopyPath(selectedFilePath)}
                        aria-label="Copy file path"
                    >
                        {copiedPath === selectedFilePath ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                    <DiffContextButton state={fileContextState[selectedFilePath]} onClick={() => onLoadFullFileContext(selectedFilePath, selectedFileDiff)} />
                </div>
                <div className="ml-auto flex items-center gap-2 text-[12px]">
                    <span className="select-none text-status-added">+{fileLineStats.get(selectedFilePath)?.added ?? 0}</span>
                    <span className="select-none text-status-removed">-{fileLineStats.get(selectedFilePath)?.removed ?? 0}</span>
                    <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={onWorkspaceModeChange} onOpenDiffSettings={onOpenDiffSettings} />
                    <button type="button" className="flex items-center text-muted-foreground" onClick={() => onToggleViewed(selectedFilePath)}>
                        <span
                            className={
                                viewedFiles.has(selectedFilePath)
                                    ? "size-4 bg-muted/40 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                    : "size-4 bg-muted/40 border border-border/70 text-transparent flex items-center justify-center"
                            }
                        >
                            <Check className="size-3" />
                        </span>
                    </button>
                </div>
            </div>

            <div className="diff-content-scroll min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto">
                {diffHighlighterReady ? (
                    <FileDiff
                        fileDiff={toRenderableFileDiff(selectedFileDiff)}
                        options={resolvedFileDiffOptions}
                        className="compact-diff commentable-diff pr-diff-font"
                        style={diffTypographyStyle}
                        lineAnnotations={singleFileAnnotations}
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
                    <div className="w-full border border-border bg-card p-3 text-[12px] text-muted-foreground">Loading syntax highlighting...</div>
                )}
            </div>

            {selectedFileLevelThreads.length > 0 ? (
                <div className="border-t border-border px-3 py-2 space-y-2">
                    {selectedFileLevelThreads.map((thread) => (
                        <ThreadCard
                            key={thread.id}
                            thread={thread}
                            canResolveThread={canResolveThread}
                            canCommentInline={canCommentInline}
                            createCommentPending={createCommentPending}
                            resolveCommentPending={resolveCommentPending}
                            currentUserDisplayName={currentUserDisplayName}
                            onDeleteComment={onDeleteComment}
                            onResolveThread={onResolveThread}
                            onReplyToThread={onReplyToThread}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
