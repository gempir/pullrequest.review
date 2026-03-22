import {
    Check,
    Circle,
    GitCommitHorizontal,
    GitMerge,
    GitPullRequestClosed,
    MessageSquare,
    PenSquare,
    ScrollText,
    Trash2,
    UserMinus,
    UserPlus,
    X,
} from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Commit, PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

const TIMELINE_META_TEXT_CLASS = "text-[11px] leading-4";
const TIMELINE_TIMESTAMP_CLASS = "pt-px text-right text-[11px] leading-4 text-muted-foreground";
const TIMELINE_CONNECTOR_CENTER_CLASS = "left-[15.5px]";

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

function parseAuthorIdentity(raw?: string) {
    const text = raw?.trim();
    if (!text) return { label: undefined, email: undefined };
    const match = text.match(/^(.*?)\s*<([^>]+)>$/);
    if (!match) return { label: text, email: undefined };
    const label = match[1]?.trim() || match[2]?.trim();
    const email = match[2]?.trim();
    return { label: label || undefined, email: email || undefined };
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

function historyIcon(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "comment":
            return MessageSquare;
        case "approved":
            return Check;
        case "changesRequested":
        case "reviewDismissed":
            return X;
        case "closed":
            return GitPullRequestClosed;
        case "reviewRequested":
        case "reviewerAdded":
            return UserPlus;
        case "reviewerRemoved":
            return UserMinus;
        case "merged":
            return GitMerge;
        case "deletedBranch":
            return Trash2;
        case "updated":
            return PenSquare;
        case "opened":
        case "reopened":
            return ScrollText;
    }
}

function historyEventTitle(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "deletedBranch":
            return "deleted branch";
        default:
            return null;
    }
}

function shouldRenderHistoryDetails(type: PullRequestHistoryEvent["type"]) {
    return !["reviewRequested", "reviewerAdded", "reviewerRemoved", "updated", "closed", "merged", "reopened", "opened"].includes(type);
}

function timelineIconClass(kind: "description" | "history" | "commitGroup", type?: PullRequestHistoryEvent["type"]) {
    if (kind === "description") {
        return "border-border-muted bg-surface-2 text-foreground";
    }
    if (kind === "commitGroup") {
        return "border-border-muted bg-surface-2 text-foreground";
    }
    switch (type) {
        case "approved":
            return "border-status-added/40 bg-status-added/15 text-status-added";
        case "merged":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        case "changesRequested":
        case "reviewDismissed":
        case "closed":
            return "border-status-removed/40 bg-status-removed/15 text-status-removed";
        case "deletedBranch":
            return "border-border-muted bg-surface-2 text-muted-foreground";
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

function Avatar({ name, url, sizeClass = "size-4" }: { name?: string; url?: string; sizeClass?: string }) {
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

function ResolveCircleButton({ isResolved, disabled, onToggle }: { isResolved: boolean; disabled: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            className="group/status relative inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
            disabled={disabled}
            aria-label={isResolved ? "Unresolve" : "Resolve"}
            title={isResolved ? "Unresolve" : "Resolve"}
        >
            <Circle className="size-4" />
            <Check
                className={cn(
                    "absolute size-2.5 transition-opacity",
                    isResolved ? "opacity-100" : "opacity-0",
                    !isResolved && !disabled ? "group-hover/status:opacity-50" : "",
                )}
            />
        </button>
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

type CommitAuthorGroup = {
    id: string;
    authorName: string;
    avatarUrl?: string;
    commits: Commit[];
};

function TimelineConnector({ showAbove, showBelow }: { showAbove: boolean; showBelow: boolean }) {
    return (
        <>
            {showAbove ? <div className={cn("absolute top-0 h-1 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
            {showBelow ? <div className={cn("absolute top-9 bottom-0 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
        </>
    );
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

function commitAuthorName(commit: Commit) {
    const parsed = parseAuthorIdentity(commit.author?.raw);
    return commit.author?.user?.displayName ?? parsed.label ?? commit.author?.raw ?? "Unknown";
}

function commitAuthorAvatarUrl(commit: Commit) {
    return commit.author?.user?.avatarUrl;
}

function commitAuthorEmail(commit: Commit) {
    return parseAuthorIdentity(commit.author?.raw).email;
}

function commitAuthorKey(commit: Commit) {
    return `${commitAuthorName(commit)}::${commitAuthorAvatarUrl(commit) ?? ""}`;
}

function groupCommitsByAuthor(commits: Commit[]) {
    const groups: CommitAuthorGroup[] = [];

    for (const commit of commits) {
        const key = commitAuthorKey(commit);
        const previousGroup = groups[groups.length - 1];
        if (previousGroup && previousGroup.id === key) {
            previousGroup.commits.push(commit);
            continue;
        }
        groups.push({
            id: key,
            authorName: commitAuthorName(commit),
            avatarUrl: commitAuthorAvatarUrl(commit),
            commits: [commit],
        });
    }

    return groups;
}

function DescriptionTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    authorName,
    authorAvatarUrl,
    createdAt,
    description,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    authorName?: string;
    authorAvatarUrl?: string;
    createdAt?: string;
    description?: string;
}) {
    return (
        <div className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("description"))}>
                    <ScrollText className="size-4" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
                    <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                        <Avatar name={authorName} url={authorAvatarUrl} />
                        <span className="font-medium text-foreground">{authorName ?? "Unknown"}</span>
                    </div>
                    <span className={TIMELINE_TIMESTAMP_CLASS}>{formatDate(createdAt)}</span>
                </div>
                <div className="px-2">
                    <div className="rounded-md border border-border-muted bg-surface-1 p-3">
                        {description?.trim() ? <MarkdownBlock text={description} /> : <div className="text-[13px] text-muted-foreground">No description.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommitGroupTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    entry,
    host,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    entry: CommitGroupTimelineEntry;
    host: PullRequestBundle["prRef"]["host"];
}) {
    const commitGroups = groupCommitsByAuthor(entry.commits);

    return (
        <div className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("commitGroup"))}>
                    <GitCommitHorizontal className="size-4" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <div className="space-y-3">
                    {commitGroups.map((group) => (
                        <div key={`${entry.id}-${group.id}`} className="min-w-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
                                <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                                    <CommitAuthorIdentity host={host} group={group} />
                                </div>
                                <span className={cn(TIMELINE_TIMESTAMP_CLASS, "text-transparent select-none")}>{formatDate(group.commits[0]?.date)}</span>
                            </div>
                            <div className="px-2">
                                <div className="space-y-1">
                                    {group.commits.map((commit) => {
                                        const message = commit.summary?.raw ?? commit.message;
                                        const mergedDevelop = isMergedDevelopCommit(message);

                                        return (
                                            <div key={commit.hash} className={cn("py-0.5", mergedDevelop ? "text-muted-foreground opacity-70" : "")}>
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-[13px] leading-5">
                                                    <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                                                        <span
                                                            className={cn("shrink-0 font-mono", mergedDevelop ? "text-status-added/80" : "text-status-renamed")}
                                                        >
                                                            {shortHash(commit.hash)}
                                                        </span>
                                                        <span className={cn("truncate", mergedDevelop ? "text-muted-foreground" : "text-foreground")}>
                                                            {message ?? "(no message)"}
                                                        </span>
                                                    </div>
                                                    <span className={TIMELINE_TIMESTAMP_CLASS}>{formatDate(commit.date)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CommitAuthorIdentity({ host, group }: { host: PullRequestBundle["prRef"]["host"]; group: CommitAuthorGroup }) {
    const email = host === "bitbucket" ? commitAuthorEmail(group.commits[0]) : undefined;
    const content = (
        <div className="min-w-0 inline-flex items-center gap-2">
            <Avatar name={group.authorName} url={group.avatarUrl} />
            <span className="truncate font-medium text-foreground">{group.authorName}</span>
        </div>
    );

    if (!email) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="min-w-0">{content}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{email}</TooltipContent>
        </Tooltip>
    );
}

function HistoryTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    event,
    resolvedComment,
    onSelectComment,
    canResolveThread,
    resolveCommentPending,
    onResolveThread,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    event: PullRequestHistoryEvent;
    resolvedComment?: PullRequestBundle["comments"][number];
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    canResolveThread?: boolean;
    resolveCommentPending?: boolean;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
}) {
    const canNavigateToComment = Boolean(event.comment?.path && onSelectComment);
    const commentId = typeof event.comment?.id === "number" ? event.comment.id : undefined;
    const isResolved = Boolean(resolvedComment?.resolution);
    const canToggleResolve = Boolean(event.comment?.path) && typeof commentId === "number" && Boolean(onResolveThread) && Boolean(canResolveThread);
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
    const eventTitle = historyEventTitle(event.type);

    return (
        <div className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-8 items-center justify-center rounded-full border", timelineIconClass("history", event.type))}>
                    <HistoryIcon className="size-4" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <div className="w-full rounded-md text-left">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
                        <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                            <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} />
                            <span className="font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                            {eventTitle ? <span className="text-muted-foreground">{eventTitle}</span> : null}
                        </div>
                        <span className={TIMELINE_TIMESTAMP_CLASS}>{formatDate(event.createdAt)}</span>
                    </div>
                    {event.comment?.path ? (
                        <div className="flex items-center gap-2 px-2 pt-1">
                            {canNavigateToComment ? (
                                <button
                                    type="button"
                                    onClick={handleClick}
                                    className="inline-flex rounded border border-border-muted bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-accent transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    {event.comment.path}
                                    {event.comment.line ? `:${event.comment.line}` : ""}
                                </button>
                            ) : (
                                <span className="inline-flex rounded border border-border-muted bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                                    {event.comment.path}
                                    {event.comment.line ? `:${event.comment.line}` : ""}
                                </span>
                            )}
                            {canToggleResolve && typeof commentId === "number" ? (
                                <span className="ml-auto">
                                    <ResolveCircleButton
                                        isResolved={isResolved}
                                        disabled={Boolean(resolveCommentPending)}
                                        onToggle={() => onResolveThread?.(commentId, !isResolved)}
                                    />
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                    {event.details && shouldRenderHistoryDetails(event.type) ? (
                        <div className="px-2 pt-1 text-[13px] text-muted-foreground break-words">{event.details}</div>
                    ) : null}
                    {event.content || event.contentHtml ? (
                        canNavigateToComment ? (
                            <button
                                type="button"
                                onClick={handleClick}
                                className="block w-full rounded-md px-2 pb-2 pt-2 text-left transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <div className="rounded-md border border-border-muted bg-surface-1 p-3">
                                    <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />
                                </div>
                            </button>
                        ) : (
                            <div className="px-2 pb-2 pt-2">
                                <div className="rounded-md border border-border-muted bg-surface-1 p-3">
                                    <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />
                                </div>
                            </div>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function PullRequestSummaryPanel({
    bundle,
    headerTitle,
    diffStats,
    headerRight,
    onSelectComment,
    canResolveThread,
    resolveCommentPending,
    onResolveThread,
}: {
    bundle: PullRequestBundle;
    headerTitle?: string;
    diffStats?: { added: number; removed: number };
    headerRight?: ReactNode;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    canResolveThread?: boolean;
    resolveCommentPending?: boolean;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
}) {
    const { pr, commits, history, prRef } = bundle;
    const baseHistory: PullRequestHistoryEvent[] = history ?? [];
    const commentById = new Map(bundle.comments.map((comment) => [comment.id, comment] as const));
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
                        const isFirst = index === 0;
                        const isLast = index === timelineEntries.length - 1;
                        const showConnectorAbove = !isFirst;
                        const showConnectorBelow = !isLast;

                        if (entry.kind === "description") {
                            return (
                                <DescriptionTimelineItem
                                    key={entry.id}
                                    showConnectorAbove={showConnectorAbove}
                                    showConnectorBelow={showConnectorBelow}
                                    authorName={pr.author?.displayName}
                                    authorAvatarUrl={pr.author?.avatarUrl}
                                    createdAt={pr.createdAt}
                                    description={pr.description}
                                />
                            );
                        }

                        if (entry.kind === "commitGroup") {
                            return (
                                <CommitGroupTimelineItem
                                    key={entry.id}
                                    showConnectorAbove={showConnectorAbove}
                                    showConnectorBelow={showConnectorBelow}
                                    entry={entry}
                                    host={prRef.host}
                                />
                            );
                        }

                        return (
                            <HistoryTimelineItem
                                key={entry.id}
                                showConnectorAbove={showConnectorAbove}
                                showConnectorBelow={showConnectorBelow}
                                event={entry.event}
                                resolvedComment={typeof entry.event.comment?.id === "number" ? commentById.get(entry.event.comment.id) : undefined}
                                onSelectComment={onSelectComment}
                                canResolveThread={canResolveThread}
                                resolveCommentPending={resolveCommentPending}
                                onResolveThread={onResolveThread}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
