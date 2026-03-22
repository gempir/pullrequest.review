import { Loader2, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";

function initials(value?: string) {
    if (!value) return "??";
    const trimmed = value.trim();
    if (!trimmed) return "??";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || "??";
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "??";
}

function CommentAvatar({ name, url }: { name?: string; url?: string }) {
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className="size-10 rounded-full object-cover shrink-0" />;
    }
    return (
        <span
            className="size-10 rounded-full shrink-0 border border-border-muted bg-surface-2 text-[11px] text-muted-foreground flex items-center justify-center"
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

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
    onSubmit: (content: string) => boolean;
}) {
    const [value, setValue] = useState("");
    const hasContent = value.trim().length > 0;
    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (onSubmit(trimmed)) {
            setValue("");
        }
    };

    return (
        <div className="flex gap-3">
            <CommentAvatar name={currentUserDisplayName ?? "You"} url={currentUserAvatarUrl} />
            <div className="min-w-0 flex-1 space-y-2">
                <div className="text-[12px] font-medium text-foreground">Add a comment</div>
                <CommentEditor
                    value={value}
                    placeholder="Add your comment here..."
                    disabled={isSubmitting || !canComment}
                    onChange={setValue}
                    onSubmit={handleSubmit}
                />
                <div className="flex items-center gap-2 pt-1">
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 rounded-md gap-1.5 px-3"
                        disabled={!hasContent || isSubmitting || !canComment}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                        Comment
                    </Button>
                </div>
            </div>
        </div>
    );
}
