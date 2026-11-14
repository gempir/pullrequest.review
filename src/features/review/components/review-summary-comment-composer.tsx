import { Loader2, MessageSquarePlus, SendHorizontal } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";
import { Avatar, COMMENT_PRIMARY_BUTTON_CLASS } from "@/features/review/components/comment-ui";

const COMPOSER_ROW_CLASS = "grid grid-cols-[24px_minmax(0,1fr)] gap-3";

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
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const restoreFocusRef = useRef(false);
    const saving = isSubmitting || localSubmitting;
    const hasContent = value.trim().length > 0;

    const collapse = () => {
        restoreFocusRef.current = true;
        setValue("");
        setOpen(false);
    };

    const attachOpenButton = (node: HTMLButtonElement | null) => {
        if (!node || !restoreFocusRef.current) return;
        restoreFocusRef.current = false;
        node.focus();
    };

    const handleSubmit = async () => {
        const trimmed = value.trim();
        if (!trimmed || saving) return;
        const result = onSubmit(trimmed);
        if (!result) return;
        setLocalSubmitting(true);
        try {
            if (await result) {
                collapse();
            }
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalSubmitting(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Escape" || hasContent || saving) return;
        event.preventDefault();
        event.stopPropagation();
        collapse();
    };

    const avatar = (
        <div className="relative z-10 flex h-7 items-center">
            <Avatar name={currentUserDisplayName ?? "You"} url={currentUserAvatarUrl} sizeClass="size-6" />
        </div>
    );

    if (!open) {
        return (
            <div className={COMPOSER_ROW_CLASS}>
                {avatar}
                <div className="min-w-0">
                    <Button
                        ref={attachOpenButton}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[13px] font-normal text-muted-foreground hover:text-foreground"
                        disabled={!canComment}
                        title={canComment ? undefined : "Sign in with write access to comment"}
                        onClick={() => setOpen(true)}
                    >
                        <MessageSquarePlus className="size-3.5" />
                        Add comment
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={COMPOSER_ROW_CLASS}>
            {avatar}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: captures Escape bubbling from the editor textarea */}
            <div className="min-w-0 space-y-2" onKeyDown={handleKeyDown}>
                <CommentEditor
                    value={value}
                    placeholder="Add your comment here..."
                    disabled={saving || !canComment}
                    autoFocus
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
                    <Button type="button" variant="outline" size="sm" className="h-7" disabled={saving} onClick={collapse}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}
