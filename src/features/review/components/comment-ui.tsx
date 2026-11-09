import type { CommentDiffSnippet, CommentDiffSnippetRow } from "@/features/review/model/summary-timeline";
import { cn } from "@/lib/utils";

export const TIMELINE_META_TEXT_CLASS = "text-[11px] leading-4";

export const TIMELINE_TIMESTAMP_CLASS = "pt-px text-right";

export const TIMELINE_CONNECTOR_CENTER_CLASS = "left-[7.5px]";

export const COMMENT_PRIMARY_BUTTON_CLASS =
    "rounded-md border border-accent/45 bg-accent/10 text-accent gap-1.5 px-3 hover:bg-accent/12 hover:border-accent/70 hover:text-accent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none";

function diffRowMarker(type: CommentDiffSnippetRow["type"]) {
    if (type === "addition") return "+";
    if (type === "deletion") return "-";
    return " ";
}

function diffRowClassName(row: CommentDiffSnippetRow) {
    if (row.type === "addition") {
        return row.isTarget ? "bg-status-added/18 text-foreground" : "bg-status-added/8 text-foreground";
    }
    if (row.type === "deletion") {
        return row.isTarget ? "bg-status-removed/18 text-foreground" : "bg-status-removed/8 text-foreground";
    }
    return row.isTarget ? "bg-accent/12 text-foreground" : "text-muted-foreground";
}

export function CommentDiffSnippetBlock({ snippet, className }: { snippet: CommentDiffSnippet; className?: string }) {
    return (
        <div className={cn("overflow-hidden bg-background", className)}>
            <div className="font-mono text-[11px] leading-5">
                {snippet.rows.map((row) => (
                    <div
                        key={`${row.type}:${row.oldLine ?? "na"}:${row.newLine ?? "na"}:${row.content}`}
                        className={cn("grid grid-cols-[52px_52px_18px_minmax(0,1fr)] gap-x-2 px-3", diffRowClassName(row))}
                    >
                        <span className="select-none text-right text-muted-foreground">{row.oldLine ?? ""}</span>
                        <span className="select-none text-right text-muted-foreground">{row.newLine ?? ""}</span>
                        <span
                            className={cn(
                                "select-none text-center",
                                row.type === "addition" ? "text-status-added" : row.type === "deletion" ? "text-status-removed" : "text-muted-foreground",
                            )}
                        >
                            {diffRowMarker(row.type)}
                        </span>
                        <span className="min-w-0 overflow-x-auto whitespace-pre">{row.content || " "}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function initials(value?: string) {
    const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ name, url, sizeClass = "size-4" }: { name?: string; url?: string; sizeClass?: string }) {
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className={cn(sizeClass, "rounded-full object-cover shrink-0")} />;
    }
    return (
        <span
            className={cn(
                sizeClass,
                "rounded-full shrink-0 border border-comment-border bg-comment-muted text-[10px] text-muted-foreground flex items-center justify-center",
            )}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}
