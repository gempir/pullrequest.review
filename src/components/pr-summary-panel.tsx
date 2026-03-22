import { Check, GitCommitHorizontal, GitMerge, MessageSquare, PenSquare, ScrollText, UserMinus, UserPlus, X } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Commit, PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
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

function timestamp(value?: string) {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
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
            return "commented";
        case "approved":
            return "approved this pull request";
        case "changesRequested":
            return "requested changes";
        case "reviewRequested":
            return "requested a review";
        case "reviewDismissed":
            return "dismissed a review";
        case "reviewerAdded":
            return "added a reviewer";
        case "reviewerRemoved":
            return "removed a reviewer";
        case "opened":
            return "opened this pull request";
        case "updated":
            return "updated this pull request";
        case "closed":
            return "closed this pull request";
        case "merged":
            return "merged this pull request";
        case "reopened":
            return "reopened this pull request";
    }
}

function historyIcon(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "comment":
            return MessageSquare;
        case "approved":
            return Check;
        case "changesRequested":
        case "reviewDismissed":
        case "closed":
            return X;
        case "reviewRequested":
        case "reviewerAdded":
            return UserPlus;
        case "reviewerRemoved":
            return UserMinus;
        case "merged":
            return GitMerge;
        case "updated":
            return PenSquare;
        case "opened":
        case "reopened":
            return ScrollText;
    }
}

function timelineIconClass(kind: "description" | "history" | "commitGroup", type?: PullRequestHistoryEvent["type"]) {
    if (kind === "description") {
        return "border-border-muted bg-surface-2 text-foreground";
    }
    if (kind === "commitGroup") {
        return "border-border-muted bg-surface-2 text-status-renamed";
    }
    switch (type) {
        case "approved":
        case "merged":
            return "border-status-added/40 bg-status-added/15 text-status-added";
        case "changesRequested":
        case "reviewDismissed":
        case "closed":
            return "border-status-removed/40 bg-status-removed/15 text-status-removed";
        case "reviewRequested":
        case "reviewerAdded":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        case "comment":
            return "border-border-muted bg-surface-2 text-foreground";
        default:
            return "border-border-muted bg-surface-2 text-muted-foreground";
    }
}

function MarkdownBlock({ text }: { text: string }) {
    return (
        <div className="space-y-2 text-[13px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="underline text-accent hover:text-accent-muted" />
                    ),
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-surface-2 px-1 py-0.5 text-[11px]" />,
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

function Avatar({ name, url, sizeClass = "size-5" }: { name?: string; url?: string; sizeClass?: string }) {
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className={cn(sizeClass, "rounded-full object-cover shrink-0")} />;
    }
    return (
        <span
            className={cn(
                sizeClass,
                "rounded-full shrink-0 border border-border-muted bg-surface-2 text-[10px] text-muted-foreground flex items-center justify-center",
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

type DescriptionTimelineEntry = {
    id: string;
    kind: "description";
};

type HistoryTimelineEntry = {
    id: string;
    kind: "history";
    event: PullRequestHistoryEvent;
};

type CommitGroupTimelineEntry = {
    id: string;
    kind: "commitGroup";
    commits: Commit[];
};

type TimelineEntry = DescriptionTimelineEntry | HistoryTimelineEntry | CommitGroupTimelineEntry;

function formatHistoryDetails(event: PullRequestHistoryEvent) {
    if (event.type === "reviewRequested" && event.details) {
        return `requested review from ${event.details}`;
    }
    if (event.type === "reviewerAdded" && event.details) {
        return `added ${event.details} as reviewer`;
    }
    if (event.type === "reviewerRemoved" && event.details) {
        return `removed ${event.details} from reviewers`;
    }
    if (event.type === "updated" && event.details) {
        return `${eventLabel(event.type)} (${event.details})`;
    }
    return eventLabel(event.type);
}

function buildTimelineEntries({ prCreatedAt, history, commits }: { prCreatedAt?: string; history: PullRequestHistoryEvent[]; commits: Commit[] }) {
    const timelineSources: Array<
        | { id: string; kind: "history"; timestamp: number; order: number; event: PullRequestHistoryEvent }
        | { id: string; kind: "commit"; timestamp: number; order: number; commit: Commit }
    > = [];

    history.forEach((event, index) => {
        timelineSources.push({
            id: event.id,
            kind: "history",
            timestamp: timestamp(event.createdAt),
            order: index,
            event,
        });
    });

    commits.forEach((commit, index) => {
        timelineSources.push({
            id: commit.hash,
            kind: "commit",
            timestamp: timestamp(commit.date),
            order: history.length + index,
            commit,
        });
    });

    timelineSources.sort((a, b) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
        return a.order - b.order;
    });

    const groupedEntries: TimelineEntry[] = [{ id: `pr-description-${prCreatedAt ?? "unknown"}`, kind: "description" }];
    let pendingCommitGroup: Commit[] = [];

    const flushPendingCommitGroup = () => {
        if (pendingCommitGroup.length === 0) return;
        groupedEntries.push({
            id: `commit-group-${pendingCommitGroup[0]?.hash ?? "unknown"}`,
            kind: "commitGroup",
            commits: pendingCommitGroup,
        });
        pendingCommitGroup = [];
    };

    for (const item of timelineSources) {
        if (item.kind === "commit") {
            pendingCommitGroup.push(item.commit);
            continue;
        }
        flushPendingCommitGroup();
        groupedEntries.push({
            id: item.id,
            kind: "history",
            event: item.event,
        });
    }

    flushPendingCommitGroup();

    return groupedEntries;
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
        if (event.type === "opened") return false;
        if (event.type === "reopened") return false;
        if (event.type === "comment" && !event.content && !event.contentHtml && !event.comment?.path) {
            return false;
        }
        return true;
    });
    const orderedHistory = [...visibleHistory].sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
    const orderedCommits = [...commits].sort((a, b) => timestamp(a.date) - timestamp(b.date));
    const timelineEntries = buildTimelineEntries({
        prCreatedAt: pr.createdAt,
        history: orderedHistory,
        commits: orderedCommits,
    });

    return (
        <div className="pr-diff-font" style={{ fontFamily: "var(--comment-font-family)" }}>
            {headerTitle ? (
                <div
                    className="h-10 bg-chrome border-b border-border-muted px-2.5 flex items-center gap-2 overflow-hidden text-[12px]"
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
            <div className="p-2.5">
                <div className="space-y-0">
                    {timelineEntries.map((entry, index) => {
                        const isLast = index === timelineEntries.length - 1;

                        if (entry.kind === "description") {
                            return (
                                <div key={entry.id} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
                                    {!isLast ? <div className="absolute bottom-0 left-[17px] top-9 w-px bg-border-muted" /> : null}
                                    <div className="relative z-10 pt-1">
                                        <div className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("description"))}>
                                            <ScrollText className="size-4" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 rounded-md border border-border-muted bg-surface-1 p-3">
                                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-5">
                                            <Avatar name={pr.author?.displayName} url={pr.author?.avatarUrl} />
                                            <span className="font-medium text-foreground">{pr.author?.displayName ?? "Unknown"}</span>
                                            <span className="text-muted-foreground">opened this pull request</span>
                                            <span className="text-muted-foreground">{formatDate(pr.createdAt)}</span>
                                        </div>
                                        {pr.description?.trim() ? (
                                            <MarkdownBlock text={pr.description} />
                                        ) : (
                                            <div className="text-[13px] text-muted-foreground">No description.</div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (entry.kind === "commitGroup") {
                            return (
                                <div key={entry.id} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
                                    {!isLast ? <div className="absolute bottom-0 left-[17px] top-9 w-px bg-border-muted" /> : null}
                                    <div className="relative z-10 pt-1">
                                        <div className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("commitGroup"))}>
                                            <GitCommitHorizontal className="size-4" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 overflow-hidden rounded-md border border-border-muted bg-surface-1">
                                        {entry.commits.map((commit, commitIndex) => {
                                            const message = commit.summary?.raw ?? commit.message;
                                            const mergedDevelop = isMergedDevelopCommit(message);
                                            const authorName = commit.author?.user?.displayName ?? commit.author?.raw ?? "Unknown";

                                            return (
                                                <div
                                                    key={commit.hash}
                                                    className={cn(
                                                        "px-3 py-2",
                                                        commitIndex > 0 ? "border-t border-border-muted" : "",
                                                        mergedDevelop ? "bg-status-added/10 text-muted-foreground opacity-70" : "",
                                                    )}
                                                >
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-5">
                                                        <Avatar name={authorName} url={commit.author?.user?.avatarUrl} />
                                                        <span className="font-medium text-foreground">{authorName}</span>
                                                        <span className={cn("font-mono", mergedDevelop ? "text-status-added/80" : "text-status-renamed")}>
                                                            {shortHash(commit.hash)}
                                                        </span>
                                                        <span className="text-muted-foreground">{formatDate(commit.date)}</span>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "pl-7 pt-1 text-[13px] break-words",
                                                            mergedDevelop ? "text-muted-foreground" : "text-foreground",
                                                        )}
                                                    >
                                                        {message ?? "(no message)"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }

                        const { event } = entry;
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
                        const HistoryIcon = historyIcon(event.type);

                        return (
                            <div key={entry.id} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
                                {!isLast ? <div className="absolute bottom-0 left-[17px] top-9 w-px bg-border-muted" /> : null}
                                <div className="relative z-10 pt-1">
                                    <div
                                        className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("history", event.type))}
                                    >
                                        <HistoryIcon className="size-4" />
                                    </div>
                                </div>
                                <div className="min-w-0 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleClick}
                                        disabled={!canNavigateToComment}
                                        className={cn(
                                            "w-full rounded-md px-2 py-1.5 text-left",
                                            canNavigateToComment
                                                ? "transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                : "cursor-default",
                                        )}
                                    >
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                                            <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} />
                                            <span className="font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                                            <span className="text-muted-foreground">{formatHistoryDetails(event)}</span>
                                            <span className="text-muted-foreground">{formatDate(event.createdAt)}</span>
                                        </div>
                                        {event.comment?.path ? (
                                            <div className="pl-7 pt-1">
                                                <span className="inline-flex rounded border border-border-muted bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                                                    {event.comment.path}
                                                    {event.comment.line ? `:${event.comment.line}` : ""}
                                                </span>
                                            </div>
                                        ) : null}
                                        {event.details && !["reviewRequested", "reviewerAdded", "reviewerRemoved", "updated"].includes(event.type) ? (
                                            <div className="pl-7 pt-1 text-[13px] text-muted-foreground break-words">{event.details}</div>
                                        ) : null}
                                        {event.content || event.contentHtml ? (
                                            <div className="pl-7 pt-2">
                                                <div className="rounded-md border border-border-muted bg-surface-1 p-3">
                                                    <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />
                                                </div>
                                            </div>
                                        ) : null}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
