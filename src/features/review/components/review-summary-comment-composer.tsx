import { Loader2, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";

const COMMENT_PRIMARY_BUTTON_CLASS =
    "rounded-md border border-accent/45 bg-accent/10 text-accent gap-1.5 px-3 hover:bg-accent/12 hover:border-accent/70 hover:text-accent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none";

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
            className="size-10 rounded-full shrink-0 border border-comment-border bg-comment-muted text-[11px] text-muted-foreground flex items-center justify-center"
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
            <CommentAvatar name={currentUserDisplayName ?? "You"} url={currentUserAvatarUrl} />
            <div className="min-w-0 flex-1 space-y-2">
                <CommentEditor
                    value={value}
                    placeholder="Add your comment here..."
                    disabled={saving || !canComment}
                    onChange={setValue}
                    onSubmit={handleSubmit}
                    contentStyle={{ minHeight: "5rem" }}
                />
                <div className="flex items-center gap-2 pt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 ${COMMENT_PRIMARY_BUTTON_CLASS}`}
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
