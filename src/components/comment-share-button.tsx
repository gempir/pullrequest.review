import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { buildPrCommentUrl } from "@/lib/pr-file-hash";
import { cn } from "@/lib/utils";

export function CommentShareButton({ path, commentId, className }: { path: string; commentId: number; className?: string }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timeoutId = window.setTimeout(() => setCopied(false), 1200);
        return () => window.clearTimeout(timeoutId);
    }, [copied]);

    const handleShare = async () => {
        if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(buildPrCommentUrl(window.location, path, commentId));
        setCopied(true);
    };

    return (
        <button
            type="button"
            className={cn("inline-flex h-5 w-3 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground", className)}
            aria-label="Copy comment link"
            title={copied ? "Comment link copied" : "Copy comment link"}
            onClick={() => {
                void handleShare();
            }}
        >
            {copied ? <Check className="size-3" /> : <Share2 className="size-3" />}
        </button>
    );
}
