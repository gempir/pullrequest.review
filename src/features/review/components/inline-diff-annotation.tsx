import { Loader2, SendHorizontal, X } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";
import { COMMENT_PRIMARY_BUTTON_CLASS } from "@/features/review/components/comment-ui";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { draftLocationKey, type SingleFileAnnotation } from "@/features/review/model/review-page-model";
import type { InlineDraftLocation } from "@/lib/storage";

type InlineDiffAnnotationProps = {
    annotation: SingleFileAnnotation;
    actions: CommentActions;
    linkedCommentId?: number;
    draftContent: string;
    draftAutoFocus: boolean;
    onDraftFocused: () => void;
    onDraftChange: (content: string) => void;
    onSubmitDraft: () => Promise<unknown> | undefined;
    onCancelDraft: (draft: InlineDraftLocation) => void;
};

export function InlineDiffAnnotation({
    annotation,
    actions,
    linkedCommentId,
    draftContent,
    draftAutoFocus,
    onDraftFocused,
    onDraftChange,
    onSubmitDraft,
    onCancelDraft,
}: InlineDiffAnnotationProps) {
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const metadata = annotation.metadata;
    if (!metadata) return null;

    const isDraft = metadata.kind === "draft";
    const isSavingDraft = actions.pending.create || localSubmitting;
    const handleSubmitInlineComment = async () => {
        if (isSavingDraft || !actions.canReply) return;
        const result = onSubmitDraft();
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
                        key={draftLocationKey(metadata.draft)}
                        value={draftContent}
                        placeholder="Add a line comment"
                        disabled={isSavingDraft || !actions.canReply}
                        autoFocus={draftAutoFocus}
                        onFocus={onDraftFocused}
                        onChange={onDraftChange}
                        onSubmit={handleSubmitInlineComment}
                    />
                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 ${COMMENT_PRIMARY_BUTTON_CLASS}`}
                            disabled={isSavingDraft || !actions.canReply}
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
                            onClick={() => onCancelDraft(metadata.draft)}
                        >
                            <X className="size-3.5" />
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <ThreadCard
                    thread={metadata.thread}
                    actions={actions}
                    linkedCommentId={linkedCommentId}
                    suggestionSourceFileDiff={metadata.suggestionSourceFileDiff}
                    showBorder={false}
                />
            )}
        </div>
    );
}
