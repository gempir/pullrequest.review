import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  PullRequestBundle,
  PullRequestHistoryEvent,
} from "@/lib/git-host/types";
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
    case "changes_requested":
      return "Changes Requested";
    case "review_requested":
      return "Review Requested";
    case "review_dismissed":
      return "Review Dismissed";
    case "reviewer_added":
      return "Reviewer Added";
    case "reviewer_removed":
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
    <div className="space-y-2 text-[12px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="underline text-foreground"
            />
          ),
          p: ({ node: _node, ...props }) => (
            <p {...props} className="whitespace-pre-wrap break-words" />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul {...props} className="list-disc pl-5 space-y-1" />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 space-y-1" />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              {...props}
              className="border-l border-border pl-3 text-muted-foreground"
            />
          ),
          code: ({ node: _node, ...props }) => (
            <code
              {...props}
              className="rounded bg-secondary px-1 py-0.5 text-[11px]"
            />
          ),
          pre: ({ node: _node, ...props }) => (
            <pre
              {...props}
              className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px]"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Section({
  title,
  children,
  headerRight,
}: {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
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

function Avatar({
  name,
  url,
  sizeClass = "size-5",
}: {
  name?: string;
  url?: string;
  sizeClass?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "avatar"}
        className={cn(sizeClass, "rounded-full object-cover shrink-0")}
      />
    );
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

export function PullRequestSummaryPanel({
  bundle,
  headerTitle,
  diffStats,
}: {
  bundle: PullRequestBundle;
  headerTitle?: string;
  diffStats?: { added: number; removed: number };
}) {
  const { pr, commits, history } = bundle;
  const resolvedHistory: PullRequestHistoryEvent[] =
    history && history.length > 0
      ? history
      : bundle.comments
          .filter((comment) => !comment.inline?.path)
          .map(
            (comment): PullRequestHistoryEvent => ({
              id: `fallback-comment-${comment.id}`,
              type: "comment",
              created_on: comment.created_on,
              actor: {
                display_name: comment.user?.display_name,
                avatar_url: comment.user?.avatar_url,
              },
              content: comment.content?.raw,
            }),
          );
  const visibleHistory = resolvedHistory.filter(
    (event) => event.type !== "reopened",
  );
  const orderedHistory = [...visibleHistory].sort(
    (a, b) =>
      new Date(b.created_on ?? 0).getTime() -
      new Date(a.created_on ?? 0).getTime(),
  );

  return (
    <div
      className="pr-diff-font"
      style={{ fontFamily: "var(--comment-font-family)" }}
    >
      {headerTitle ? (
        <div
          className="h-10 border-b border-border bg-card px-2.5 flex items-center gap-2 overflow-hidden"
          data-component="summary-header"
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            #{pr.id}
          </span>
          <span className="min-w-0 flex-1 text-[12px] text-foreground truncate">
            {headerTitle}
          </span>
          {diffStats ? (
            <div className="ml-auto shrink-0 font-mono text-[11px]">
              <span className="text-status-added">+{diffStats.added}</span>
              <span className="ml-2 text-status-removed">
                -{diffStats.removed}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="p-2.5 space-y-2.5">
        <section>
          <div className="p-2.5">
            {pr.description?.trim() ? (
              <MarkdownBlock text={pr.description} />
            ) : (
              <div className="text-[12px] text-muted-foreground">
                No description.
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Section title="History">
            {orderedHistory.length > 0 ? (
              <div className="space-y-2">
                {orderedHistory.map((event) => (
                  <div key={event.id} className="px-2.5 py-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <Avatar
                        name={event.actor?.display_name}
                        url={event.actor?.avatar_url}
                        sizeClass="size-4"
                      />
                      <span className="text-foreground">
                        {eventLabel(event.type)}
                      </span>
                      <span className="text-muted-foreground">
                        {event.actor?.display_name ?? "Unknown"}
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {formatDate(event.created_on)}
                      </span>
                    </div>
                    {event.details ? (
                      <div className="mt-1 text-[12px] text-muted-foreground break-words">
                        {event.details}
                      </div>
                    ) : null}
                    {event.content ? (
                      <div className="mt-1">
                        <MarkdownBlock text={event.content} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground">
                No history yet.
              </div>
            )}
          </Section>

          <Section title="Commits">
            {commits.length > 0 ? (
              <div>
                <div className="grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,3fr)_88px] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/70">
                  <span>Author</span>
                  <span>Commit</span>
                  <span>Message</span>
                  <span className="text-right">Date</span>
                </div>
                {commits.map((commit) => {
                  const message = commit.summary?.raw ?? commit.message;
                  const mergedDevelop = isMergedDevelopCommit(message);
                  return (
                    <div
                      key={commit.hash}
                      className={cn(
                        "grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,3fr)_88px] gap-2 px-2 py-1.5 text-[11px] border-b border-border/50 last:border-b-0",
                        mergedDevelop
                          ? "bg-status-added/5 text-muted-foreground opacity-70"
                          : "",
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <Avatar
                          name={
                            commit.author?.user?.display_name ??
                            commit.author?.raw
                          }
                          url={commit.author?.user?.avatar_url}
                          sizeClass="size-4"
                        />
                        <span className="truncate text-foreground">
                          {commit.author?.user?.display_name ??
                            commit.author?.raw ??
                            "Unknown"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "font-mono",
                          mergedDevelop
                            ? "text-status-added/80"
                            : "text-[#93c5fd]",
                        )}
                      >
                        {shortHash(commit.hash)}
                      </span>
                      <span
                        className={cn(
                          "truncate",
                          mergedDevelop
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {message ?? "(no message)"}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {formatDate(commit.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground">
                No commits found.
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
