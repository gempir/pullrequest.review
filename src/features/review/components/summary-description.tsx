import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Button } from "@/components/ui/button";
import { COMMENT_PRIMARY_BUTTON_CLASS, MarkdownBlock } from "@/features/review/components/summary-shared";
import { cn } from "@/lib/utils";

export function SummaryDescription({
    description,
    canEdit,
    isUpdating,
    onEditDescription,
}: {
    description?: string;
    canEdit: boolean;
    isUpdating: boolean;
    onEditDescription?: (description: string) => Promise<unknown> | undefined;
}) {
    const currentDescription = description ?? "";
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(currentDescription);
    const [localSaving, setLocalSaving] = useState(false);
    const isSaving = isUpdating || localSaving;
    const hasChanges = draft !== currentDescription;

    useEffect(() => {
        if (isEditing || localSaving) return;
        setDraft(currentDescription);
    }, [currentDescription, isEditing, localSaving]);

    const startEditing = () => {
        if (!canEdit || isSaving) return;
        setDraft(currentDescription);
        setIsEditing(true);
    };
    const handleSave = async () => {
        if (!hasChanges || isSaving) return;
        setLocalSaving(true);
        try {
            await onEditDescription?.(draft);
            setIsEditing(false);
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalSaving(false);
        }
    };
    const handleCancel = () => {
        if (isSaving) return;
        setDraft(currentDescription);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <section className="min-w-0 rounded-sm border border-surface-hover px-2 pb-2" data-component="summary-description">
                <CommentEditor
                    value={draft}
                    placeholder="Add a pull request description..."
                    disabled={isSaving}
                    onChange={setDraft}
                    onSubmit={handleSave}
                    onReady={(focus) => {
                        focus();
                    }}
                    chrome="toolbar"
                    toolbarClassName="-mx-2 px-0.5"
                    contentStyle={{ minHeight: "9rem" }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={!hasChanges || isSaving} onClick={handleSave}>
                        {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={isSaving}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                </div>
            </section>
        );
    }

    return (
        <section
            className={cn(
                "min-w-0 px-2 py-1",
                canEdit &&
                    "cursor-text rounded-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            data-component="summary-description"
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : undefined}
            aria-label={canEdit ? "Edit pull request description" : undefined}
            onClick={(event) => {
                if ((event.target as Element).closest("a,button")) return;
                startEditing();
            }}
            onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                startEditing();
            }}
        >
            {description?.trim() ? <MarkdownBlock text={description} /> : <div className="text-[13px] text-muted-foreground">No description.</div>}
        </section>
    );
}
