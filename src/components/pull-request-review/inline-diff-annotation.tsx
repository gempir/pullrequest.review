import { CommentEditor } from "@/components/comment-editor";
import type { SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
import { ThreadCard } from "@/components/pull-request-review/review-thread-card";
import type { InlineCommentDraft } from "@/components/pull-request-review/use-inline-comment-drafts";
import { inlineDraftStorageKey } from "@/components/pull-request-review/use-inline-drafts";
import { Button } from "@/components/ui/button";

type InlineDiffAnnotationProps = {
    annotation: SingleFileAnnotation;
    workspace: string;
    repo: string;
    pullRequestId: string;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

export function InlineDiffAnnotation({
    annotation,
    workspace,
    repo,
    pullRequestId,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    onResolveThread,
}: InlineDiffAnnotationProps) {
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
                        <Button size="sm" className="h-7" disabled={createCommentPending || !canCommentInline} onClick={onSubmitInlineComment}>
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
}
