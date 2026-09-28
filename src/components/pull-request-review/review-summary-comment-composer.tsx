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
        return <img src={url} alt="" className="avatar-outline size-8 rounded-full object-cover shrink-0" />;
    }
    return (
        <span
            className="size-8 rounded-full shrink-0 border border-comment-border bg-comment-muted text-[11px] text-muted-foreground flex items-center justify-center"
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
        <div className="flex gap-2.5">
            <CommentAvatar name={currentUserDisplayName ?? "You"} url={currentUserAvatarUrl} />
            <div className="min-w-0 flex-1 space-y-2">
                <CommentEditor
                    value={value}
                    ariaLabel="Pull request comment"
                    placeholder="Add a comment…"
                    disabled={saving || !canComment}
                    onChange={setValue}
                    onSubmit={handleSubmit}
                    contentStyle={{ minHeight: "5rem" }}
                />
                <div className="flex items-center gap-3 pt-1">
                    <Button type="button" size="sm" className="h-8" disabled={!hasContent || saving || !canComment} onClick={handleSubmit}>
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                        Post comment
                    </Button>
                    <span className="text-[11px] text-faint-foreground">Ctrl/⌘ Enter to post</span>
                </div>
            </div>
        </div>
    );
}
