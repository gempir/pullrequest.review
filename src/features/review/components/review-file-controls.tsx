import { Check, CheckCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReview } from "@/features/review/components/review-context";
import { cn } from "@/lib/utils";

const VIEWED_BOX = "size-4 bg-surface-1 border flex items-center justify-center";

export function CopyPathButton({ path }: { path: string }) {
    const { copiedPath, onCopyPath } = useReview();
    return (
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onCopyPath(path)} aria-label="Copy file path">
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
            className="flex items-center text-muted-foreground"
            onClick={() => toggleViewed(path)}
            aria-label={viewed ? `Mark ${path} as not viewed` : `Mark ${path} as viewed`}
            title={viewed ? "Mark as not viewed" : "Mark as viewed"}
        >
            <span className={cn(VIEWED_BOX, viewed ? "border-status-renamed/60 text-status-renamed" : "border-border text-transparent")}>
                <Check className="size-3" />
            </span>
        </button>
    );
}

export function AllViewedToggle() {
    const { areAllFilesViewed, toggleAllFilesViewed } = useReview();
    const label = areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed";
    return (
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={toggleAllFilesViewed} aria-label={label} title={label}>
            <span className={cn(VIEWED_BOX, areAllFilesViewed ? "border-status-renamed/60 text-status-renamed" : "border-border text-muted-foreground")}>
                <CheckCheck className="size-3" />
            </span>
        </Button>
    );
}
