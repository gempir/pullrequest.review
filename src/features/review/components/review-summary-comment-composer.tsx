import { Loader2, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";
import { Avatar, COMMENT_PRIMARY_BUTTON_CLASS } from "@/features/review/components/comment-ui";

export function ReviewSummaryCommentComposer({
    currentUserDisplayName,
    currentUserAvatarUrl,
    canComment,
    isSubmitting,
    onSubmit,
}: {
    currentUserDisplayName?: string;
    currentUserAvatarUrl?: string;
    canComment: boolean;
    isSubmitting: boolean;
    onSubmit: (content: string) => Promise<boolean> | false;
}) {
    const [value, setValue] = useState("");
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const saving = isSubmitting || localSubmitting;
    const hasContent = value.trim().length > 0;
    const handleSubmit = async () => {
        const trimmed = value.trim();
        if (!trimmed || saving) return;
        const result = onSubmit(trimmed);
        if (!result) return;
        setLocalSubmitting(true);
        try {
            if (await result) {
                setValue("");
            }
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalSubmitting(false);
        }
    };

    return (
        <div className="flex gap-3">
            <Avatar name={currentUserDisplayName ?? "You"} url={currentUserAvatarUrl} sizeClass="size-6 mt-1.5" />
            <div className="min-w-0 flex-1 space-y-2">
                <CommentEditor
                    value={value}
                    placeholder="Add your comment here..."
                    disabled={saving || !canComment}
                    onChange={setValue}
                    onSubmit={handleSubmit}
                    contentStyle={{ minHeight: "5rem" }}
                />
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`}
                        disabled={!hasContent || saving || !canComment}
                        onClick={handleSubmit}
                    >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                        Comment
                    </Button>
                </div>
            </div>
        </div>
    );
}
