import { ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

function formatDate(value?: string) {
    if (!value) return "Unknown";
    try {
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function shortHash(value: string) {
    return value.slice(0, 8);
}

function isMergedDevelopCommit(message?: string) {
    return /^merged develop\b/i.test((message ?? "").trim());
}

function initials(value?: string) {
    const text = value?.trim();
    if (!text) return "?";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function eventLabel(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "comment":
            return "Comment";
        case "approved":
            return "Approved";
        case "changesRequested":
            return "Changes Requested";
        case "reviewRequested":
            return "Review Requested";
        case "reviewDismissed":
            return "Review Dismissed";
        case "reviewerAdded":
            return "Reviewer Added";
        case "reviewerRemoved":
            return "Reviewer Removed";
        case "opened":
            return "Opened";
        case "updated":
            return "Updated";
        case "closed":
            return "Closed";
        case "merged":
            return "Merged";
        case "reopened":
            return "Reopened";
    }
}

function MarkdownBlock({ text }: { text: string }) {
    return (
        <div className="space-y-2 text-[13px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="underline text-foreground" />,
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <img {...props} className="inline align-middle" alt={props.alt ?? ""} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

function Section({ title, children, headerRight }: { title: string; children: ReactNode; headerRight?: ReactNode }) {
    return (
        <section>
            <div className="h-8 px-2.5 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{title}</span>
                {headerRight ? <span className="ml-auto">{headerRight}</span> : null}
            </div>
            <div className="p-2.5">{children}</div>
        </section>
    );
}

function Avatar({ name, url, sizeClass = "size-5" }: { name?: string; url?: string; sizeClass?: string }) {
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className={cn(sizeClass, "rounded-full object-cover shrink-0")} />;
    }
    return (
        <span
            className={cn(
                sizeClass,
                "rounded-full shrink-0 border border-border bg-secondary text-[10px] text-muted-foreground flex items-center justify-center",
            )}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

function extractHistoryCommentId(event: PullRequestHistoryEvent) {
    if (event.comment?.id !== undefined) return event.comment.id;
    if (event.type !== "comment") return null;
    const match = event.id.match(/comment-(\d+)$/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isNaN(parsed) ? null : parsed;
}

export function PullRequestSummaryPanel({
    bundle,
    headerTitle,
    diffStats,
    headerRight,
    onSelectComment,
}: {
    bundle: PullRequestBundle;
    headerTitle?: string;
    diffStats?: { added: number; removed: number };
    headerRight?: ReactNode;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
}) {
    const { pr, commits, history } = bundle;
    const baseHistory: PullRequestHistoryEvent[] = history ?? [];
    const commentHistoryById = new Map<number, PullRequestHistoryEvent>();
    for (const event of baseHistory) {
        const commentId = extractHistoryCommentId(event);
        if (typeof commentId === "number") {
            commentHistoryById.set(commentId, event);
        }
    }
    const fallbackCommentEvents: PullRequestHistoryEvent[] = bundle.comments
        .filter((comment) => Boolean(comment.inline?.path))
        .map((comment) => {
            const line = comment.inline?.to ?? comment.inline?.from;
            const side = comment.inline?.from ? "deletions" : "additions";
            return {
                id: `fallback-comment-${comment.id}`,
                type: "comment",
                createdAt: comment.createdAt,
                actor: {
                    displayName: comment.user?.displayName,
                    avatarUrl: comment.user?.avatarUrl,
                },
                content: comment.content?.raw,
                contentHtml: comment.content?.html,
                comment: {
                    id: comment.id,
                    path: comment.inline?.path,
                    line,
                    side,
                    isInline: Boolean(comment.inline?.path),
                },
            };
        });
    const resolvedHistory: PullRequestHistoryEvent[] = [...baseHistory];
    for (const fallbackEvent of fallbackCommentEvents) {
        const commentId = fallbackEvent.comment?.id;
        if (typeof commentId === "number") {
            const existing = commentHistoryById.get(commentId);
            if (existing) {
                if (!existing.comment?.path && fallbackEvent.comment?.path) {
                    existing.comment = { ...existing.comment, ...fallbackEvent.comment };
                }
                continue;
            }
            commentHistoryById.set(commentId, fallbackEvent);
        }
        resolvedHistory.push(fallbackEvent);
    }
    const visibleHistory = resolvedHistory.filter((event) => {
        if (event.type === "reopened") return false;
        if (event.type === "comment" && !event.content && !event.contentHtml && !event.comment?.path) {
            return false;
        }
        return true;
    });
    const orderedHistory = [...visibleHistory].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    const orderedCommits = [...commits].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    return (
        <div className="pr-diff-font" style={{ fontFamily: "var(--comment-font-family)" }}>
            {headerTitle ? (
                <div
                    className="h-10 border-b border-border bg-chrome px-2.5 flex items-center gap-2 overflow-hidden text-[12px]"
                    data-component="summary-header"
                >
                    <span className="size-4 flex items-center justify-center shrink-0">
                        <ScrollText className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-foreground truncate">{headerTitle}</span>
                    {diffStats ? (
                        <div className="ml-auto shrink-0 font-mono text-[11px]">
                            <span className="text-status-added">+{diffStats.added}</span>
                            <span className="ml-2 text-status-removed">-{diffStats.removed}</span>
                        </div>
                    ) : null}
                    {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                </div>
            ) : null}
            <div className="p-2.5 space-y-2.5">
                <section>
                    <div className="p-2.5">
                        {pr.description?.trim() ? (
                            <MarkdownBlock text={pr.description} />
                        ) : (
                            <div className="text-[13px] text-muted-foreground">No description.</div>
                        )}
                    </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <Section title="History">
                        {orderedHistory.length > 0 ? (
                            <div className="space-y-2">
                                {orderedHistory.map((event) => {
                                    const canNavigateToComment = Boolean(event.comment?.path && onSelectComment);
                                    const handleClick = () => {
                                        if (!canNavigateToComment || !event.comment?.path) return;
                                        onSelectComment?.({
                                            path: event.comment.path,
                                            line: event.comment.line,
                                            side: event.comment.side,
                                            commentId: event.comment.id,
                                        });
                                    };
                                    return (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={handleClick}
                                            disabled={!canNavigateToComment}
                                            className={cn(
                                                "w-full rounded-md px-2.5 py-2 text-left",
                                                canNavigateToComment
                                                    ? "bg-secondary/40 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                                                    : "bg-secondary/30 cursor-default",
                                            )}
                                        >
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[11px]">
                                                    <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} sizeClass="size-4" />
                                                    <span className="text-foreground">{eventLabel(event.type)}</span>
                                                    <span className="text-muted-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                                                    {event.comment?.path ? <span className="text-primary font-mono truncate">{event.comment.path}</span> : null}
                                                    <span className="ml-auto text-muted-foreground">{formatDate(event.createdAt)}</span>
                                                </div>
                                                {event.details ? <div className="text-[13px] text-muted-foreground break-words">{event.details}</div> : null}
                                                {event.content || event.contentHtml ? (
                                                    <div>
                                                        <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />
                                                    </div>
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-[13px] text-muted-foreground">No history yet.</div>
                        )}
                    </Section>

                    <Section title="Commits">
                        {orderedCommits.length > 0 ? (
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,3fr)_88px] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    <span>Author</span>
                                    <span>Commit</span>
                                    <span>Message</span>
                                    <span className="text-right">Date</span>
                                </div>
                                {orderedCommits.map((commit) => {
                                    const message = commit.summary?.raw ?? commit.message;
                                    const mergedDevelop = isMergedDevelopCommit(message);
                                    return (
                                        <div
                                            key={commit.hash}
                                            className={cn(
                                                "grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,3fr)_88px] gap-2 rounded-md bg-secondary/40 px-2 py-1.5 text-[11px]",
                                                mergedDevelop ? "bg-status-added/10 text-muted-foreground opacity-70" : "",
                                            )}
                                        >
                                            <div className="min-w-0 flex items-center gap-2">
                                                <Avatar
                                                    name={commit.author?.user?.displayName ?? commit.author?.raw}
                                                    url={commit.author?.user?.avatarUrl}
                                                    sizeClass="size-4"
                                                />
                                                <span className="truncate text-foreground">
                                                    {commit.author?.user?.displayName ?? commit.author?.raw ?? "Unknown"}
                                                </span>
                                            </div>
                                            <span className={cn("font-mono", mergedDevelop ? "text-status-added/80" : "text-status-renamed")}>
                                                {shortHash(commit.hash)}
                                            </span>
                                            <span className={cn("truncate", mergedDevelop ? "text-muted-foreground" : "text-foreground")}>
                                                {message ?? "(no message)"}
                                            </span>
                                            <span className="text-right text-muted-foreground">{formatDate(commit.date)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-[13px] text-muted-foreground">No commits found.</div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
}
