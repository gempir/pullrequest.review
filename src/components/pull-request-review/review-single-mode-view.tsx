import type { FileDiffOptions } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { Check, Copy, MessageSquare } from "lucide-react";
import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentEditor } from "@/components/comment-editor";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Button } from "@/components/ui/button";
import { fileAnchorId } from "@/lib/file-anchors";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { formatDate } from "./review-formatters";
import type { SingleFileAnnotation } from "./review-page-model";
import type { CommentThread } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";
import { inlineDraftStorageKey } from "./use-inline-drafts";

type ReviewSingleModeViewProps = {
    prData: PullRequestBundle;
    pullRequestTitle?: string;
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
    onToggleViewed: (path: string) => void;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

function CommentMarkdown({ text }: { text: string }) {
    return (
        <div className="text-[13px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="underline text-foreground" />,
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <img {...props} className="inline align-middle" alt={props.alt ?? ""} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

export function ReviewSingleModeView({
    prData,
    pullRequestTitle,
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
    onToggleViewed,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    onResolveThread,
}: ReviewSingleModeViewProps) {
    if (isSummarySelected) {
        return (
            <div id={fileAnchorId(PR_SUMMARY_PATH)} className="h-full w-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
                <PullRequestSummaryPanel bundle={prData} headerTitle={pullRequestTitle || PR_SUMMARY_NAME} diffStats={lineStats} />
            </div>
        );
    }

    if (!selectedFileDiff || !selectedFilePath) {
        return <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No file selected for the current filter.</div>;
    }

    return (
        <div id={fileAnchorId(selectedFilePath)} data-component="diff-file-view" className="h-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
            <div className="h-10 min-w-0 border-b border-border px-3 flex items-center gap-2 overflow-hidden">
                <span className="size-4 flex items-center justify-center shrink-0">
                    <RepositoryFileIcon fileName={selectedFilePath.split("/").pop() || selectedFilePath} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 font-mono text-[12px] truncate">{selectedFilePath}</span>
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
                <span className="select-none text-[12px] text-status-added">+{fileLineStats.get(selectedFilePath)?.added ?? 0}</span>
                <span className="select-none text-[12px] text-status-removed">-{fileLineStats.get(selectedFilePath)?.removed ?? 0}</span>
                <button
                    type="button"
                    className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground"
                    onClick={() => onToggleViewed(selectedFilePath)}
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
                                                key={inlineDraftStorageKey(workspace, repo, pullRequestId, metadata.draft)}
                                                value={getInlineDraftContent(metadata.draft)}
                                                placeholder="Add a line comment"
                                                disabled={createCommentPending || !canCommentInline}
                                                onReady={onInlineDraftReady}
                                                onChange={(nextValue) => setInlineDraftContent(metadata.draft, nextValue)}
                                                onSubmit={onSubmitInlineComment}
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7"
                                                    disabled={createCommentPending || !canCommentInline}
                                                    onClick={onSubmitInlineComment}
                                                >
                                                    Comment
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-7" onClick={() => onCancelInlineDraft(metadata.draft)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <ThreadCard
                                            thread={metadata.thread}
                                            canResolveThread={canResolveThread}
                                            resolveCommentPending={resolveCommentPending}
                                            onResolveThread={onResolveThread}
                                        />
                                    )}
                                </div>
                            );
                        }}
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
                            resolveCommentPending={resolveCommentPending}
                            onResolveThread={onResolveThread}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function ThreadCard({
    thread,
    canResolveThread,
    resolveCommentPending,
    onResolveThread,
}: {
    thread: CommentThread;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onResolveThread: (commentId: number, resolve: boolean) => void;
}) {
    return (
        <div className="border border-border bg-background p-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="size-3.5" />
                <span>{thread.root.user?.displayName ?? "Unknown"}</span>
                <span>{formatDate(thread.root.createdAt)}</span>
                <span className="ml-auto">{thread.root.resolution ? "Resolved" : "Unresolved"}</span>
            </div>
            <CommentMarkdown text={thread.root.content?.html ?? thread.root.content?.raw ?? ""} />
            {thread.replies.length > 0 ? (
                <div className="mt-2 pl-3 border-l border-border space-y-1">
                    {thread.replies.map((reply) => (
                        <div key={reply.id} className="text-[12px]">
                            <span className="text-muted-foreground">{reply.user?.displayName ?? "Unknown"}:</span>
                            <CommentMarkdown text={reply.content?.html ?? reply.content?.raw ?? ""} />
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="mt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={resolveCommentPending || !canResolveThread}
                    onClick={() => onResolveThread(thread.root.id, !thread.root.resolution)}
                >
                    {thread.root.resolution ? "Unresolve" : "Resolve"}
                </Button>
            </div>
        </div>
    );
}
