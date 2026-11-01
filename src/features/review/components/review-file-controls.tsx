import { Check, CheckCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReview } from "@/features/review/components/review-context";
import { cn } from "@/lib/utils";

export function CopyPathButton({ path }: { path: string }) {
    const { copiedPath, onCopyPath } = useReview();
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onCopyPath(path)}
            aria-label="Copy file path"
        >
            {copiedPath === path ? <Check className="size-3.5 text-status-added" /> : <Copy className="size-3.5" />}
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
                "pressable flex size-5 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring",
                viewed
                    ? "border-transparent bg-status-added text-white"
                    : "border-input text-transparent hover:border-faint-foreground hover:text-faint-foreground",
            )}
            onClick={() => toggleViewed(path)}
            aria-label={viewed ? `Mark ${path} as not viewed` : `Mark ${path} as viewed`}
            aria-pressed={viewed}
            title={viewed ? "Mark as not viewed" : "Mark as viewed"}
        >
            <Check className="size-3" strokeWidth={3} />
        </button>
    );
}

export function AllViewedToggle() {
    const { areAllFilesViewed, toggleAllFilesViewed } = useReview();
    const label = areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed";
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
                "size-7 shrink-0 p-0",
                areAllFilesViewed ? "text-status-added hover:text-status-added" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={toggleAllFilesViewed}
            aria-label={label}
            title={label}
        >
            <CheckCheck className="size-3.5" />
        </Button>
    );
}
