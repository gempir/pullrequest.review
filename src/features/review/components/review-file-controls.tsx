import { Check, CheckCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReview } from "@/features/review/components/review-context";
import { cn } from "@/lib/utils";

const VIEWED_BOX = "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors";

export function CopyPathButton({ path }: { path: string }) {
    const { copiedPath, onCopyPath } = useReview();
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onCopyPath(path)}
            aria-label="Copy file path"
        >
            {copiedPath === path ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
    );
}

export function ViewedToggle({ path }: { path: string }) {
    const { viewedFiles, toggleViewed } = useReview();
    const viewed = viewedFiles.has(path);
    return (
        <button
            type="button"
            className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-sm border px-2 text-[12px] font-medium transition-colors",
                viewed
                    ? "border-accent-solid/40 bg-selection-subtle text-foreground"
                    : "border-border text-muted-foreground hover:border-input hover:bg-surface-hover hover:text-foreground",
            )}
            aria-pressed={viewed}
            onClick={() => toggleViewed(path)}
            aria-label={viewed ? `Mark ${path} as not viewed` : `Mark ${path} as viewed`}
            title={viewed ? "Mark as not viewed" : "Mark as viewed"}
        >
            <span className={cn(VIEWED_BOX, viewed ? "border-accent-solid bg-accent-solid text-accent-foreground" : "border-input text-transparent")}>
                <Check className="size-2.5" strokeWidth={3} />
            </span>
            Viewed
        </button>
    );
}

export function AllViewedToggle() {
    const { areAllFilesViewed, toggleAllFilesViewed } = useReview();
    const label = areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed";
    return (
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={toggleAllFilesViewed} aria-label={label} title={label}>
            <CheckCheck className={cn("size-4", areAllFilesViewed ? "text-accent" : "text-muted-foreground")} />
        </Button>
    );
}
