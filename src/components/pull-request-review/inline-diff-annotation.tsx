import { Loader2, SendHorizontal, X } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import type { SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
import { ThreadCard } from "@/components/pull-request-review/review-thread-card";
import type { InlineCommentDraft } from "@/components/pull-request-review/use-inline-comment-drafts";
import { inlineDraftStorageKey } from "@/components/pull-request-review/use-inline-drafts";
import { Button } from "@/components/ui/button";

const COMMENT_PRIMARY_BUTTON_CLASS =
    "rounded-md border border-accent/45 bg-accent/10 text-accent gap-1.5 px-3 hover:bg-accent/12 hover:border-accent/70 hover:text-accent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none";

type InlineDiffAnnotationProps = {
    annotation: SingleFileAnnotation;
    allowNestedReplies: boolean;
    workspace: string;
    repo: string;
    pullRequestId: string;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    deleteCommentPending: boolean;
    updateCommentPending: boolean;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => Promise<unknown> | undefined;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    currentUserDisplayName?: string;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => Promise<unknown> | undefined;
    onEditComment: (commentId: number, content: string, hasInlineContext: boolean) => Promise<unknown> | undefined;
};

export function InlineDiffAnnotation({
    annotation,
    allowNestedReplies,
    workspace,
    repo,
    pullRequestId,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    currentUserDisplayName,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
}: InlineDiffAnnotationProps) {
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const metadata = annotation.metadata;
    if (!metadata) return null;

    const isDraft = metadata.kind === "draft";
    const isSavingDraft = createCommentPending || localSubmitting;
    const handleSubmitInlineComment = async () => {
        if (isSavingDraft || !canCommentInline) return;
        const result = onSubmitInlineComment();
        if (!result) return;
        setLocalSubmitting(true);
        try {
            await result;
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalSubmitting(false);
        }
    };

    return (
        <div className={isDraft ? "px-2 py-1.5 bg-comment" : "-ml-px bg-comment"}>
            {isDraft ? (
                <div className="space-y-2">
                    <CommentEditor
                        key={inlineDraftStorageKey(workspace, repo, pullRequestId, metadata.draft)}
                        value={getInlineDraftContent(metadata.draft)}
                        placeholder="Add a line comment"
                        disabled={isSavingDraft || !canCommentInline}
                        onReady={onInlineDraftReady}
                        onChange={(nextValue) => setInlineDraftContent(metadata.draft, nextValue)}
                        onSubmit={handleSubmitInlineComment}
                    />
                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 ${COMMENT_PRIMARY_BUTTON_CLASS}`}
                            disabled={isSavingDraft || !canCommentInline}
                            onClick={handleSubmitInlineComment}
                        >
                            {isSavingDraft ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                            Comment
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md gap-1.5 px-3"
                            disabled={isSavingDraft}
                            onClick={() => onCancelInlineDraft(metadata.draft)}
                        >
                            <X className="size-3.5" />
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <ThreadCard
                    thread={metadata.thread}
                    allowNestedReplies={allowNestedReplies}
                    showBorder={false}
                    canResolveThread={canResolveThread}
                    canCommentInline={canCommentInline}
                    createCommentPending={createCommentPending}
                    resolveCommentPending={resolveCommentPending}
                    deleteCommentPending={deleteCommentPending}
                    updateCommentPending={updateCommentPending}
                    currentUserDisplayName={currentUserDisplayName}
                    onDeleteComment={onDeleteComment}
                    onResolveThread={onResolveThread}
                    onReplyToThread={onReplyToThread}
                    onEditComment={onEditComment}
                />
            )}
        </div>
    );
}
