import { FileCode2, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewViewModeToggleProps = {
    mode: "single" | "all";
    onModeChange: (mode: "single" | "all") => void;
};

export function ReviewViewModeToggle({ mode, onModeChange }: ReviewViewModeToggleProps) {
    return (
        <div className="flex items-center rounded-sm bg-secondary/30 p-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-6 w-6 p-0", mode === "single" ? "bg-background text-foreground" : "text-muted-foreground")}
                onClick={() => onModeChange("single")}
                aria-label="Switch to single file mode"
                title="Single file mode"
            >
                <FileCode2 className="size-3.5" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-6 w-6 p-0", mode === "all" ? "bg-background text-foreground" : "text-muted-foreground")}
                onClick={() => onModeChange("all")}
                aria-label="Switch to all files mode"
                title="All files mode"
            >
                <Files className="size-3.5" />
            </Button>
        </div>
    );
}
