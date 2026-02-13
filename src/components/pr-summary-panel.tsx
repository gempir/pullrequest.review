import type {
  PullRequestBuildStatus,
  PullRequestBundle,
  PullRequestHistoryEvent,
  PullRequestReviewer,
} from "@/lib/git-host/types";
import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
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

function reviewerLabel(status: PullRequestReviewer["status"]) {
  if (status === "approved") return "approved";
  if (status === "changes_requested") return "changes requested";
  if (status === "commented") return "commented";
  return "pending";
}

function buildLabel(status: PullRequestBuildStatus["state"]) {
  if (status === "success") return "success";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  if (status === "skipped") return "skipped";
  if (status === "neutral") return "neutral";
  return "unknown";
}

function buildBadgeClass(status: PullRequestBuildStatus["state"]) {
  if (status === "success")
    return "border-status-added/40 bg-status-added/10 text-status-added";
  if (status === "failed")
    return "border-status-removed/40 bg-status-removed/10 text-status-removed";
  if (status === "pending")
    return "border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]";
  return "border-border bg-secondary text-muted-foreground";
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
    <section className="border border-border bg-card">
      <div className="h-8 border-b border-border px-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        {headerRight ? <span className="ml-auto">{headerRight}</span> : null}
      </div>
      <div className="p-3">{children}</div>
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
  onRefreshBuildStatus,
  refreshingBuildStatus,
}: {
  bundle: PullRequestBundle;
  onRefreshBuildStatus?: () => void;
  refreshingBuildStatus?: boolean;
}) {
  const { pr, commits, history, reviewers, buildStatuses } = bundle;
  const resolvedHistory: PullRequestHistoryEvent[] =
    history && history.length > 0
      ? history
      : bundle.comments
          .filter((comment) => !comment.inline?.path)
          .map((comment): PullRequestHistoryEvent => ({
            id: `fallback-comment-${comment.id}`,
            type: "comment",
            created_on: comment.created_on,
            actor: {
              display_name: comment.user?.display_name,
              avatar_url: comment.user?.avatar_url,
            },
            content: comment.content?.raw,
          }));
  const visibleHistory = resolvedHistory.filter(
    (event) => event.type !== "reopened",
  );
  const orderedHistory = [...visibleHistory].sort(
    (a, b) =>
      new Date(b.created_on ?? 0).getTime() -
      new Date(a.created_on ?? 0).getTime(),
  );
  const resolvedReviewers =
    reviewers && reviewers.length > 0
      ? reviewers
      : (pr.participants ?? []).map((participant, index) => ({
          id: `fallback-reviewer-${index}`,
          display_name: participant.user?.display_name,
          avatar_url: participant.user?.avatar_url,
          status: participant.approved ? ("approved" as const) : ("pending" as const),
          approved: Boolean(participant.approved),
        }));

  return (
    <div className="p-3 space-y-3 pr-diff-font">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Section title="Meta">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <div className="text-muted-foreground">Author</div>
            <div className="text-foreground">{pr.author?.display_name ?? "Unknown"}</div>
            <div className="text-muted-foreground">Branches</div>
            <div className="text-foreground">
              {pr.source?.branch?.name ?? "source"} -&gt;{" "}
              {pr.destination?.branch?.name ?? "target"}
            </div>
            <div className="text-muted-foreground">PR Number</div>
            <div className="text-foreground">#{pr.id}</div>
            <div className="text-muted-foreground">Status</div>
            <div className="text-foreground">
              {pr.draft ? "DRAFT " : ""}
              {pr.state}
            </div>
            <div className="text-muted-foreground">Created</div>
            <div className="text-foreground">{formatDate(pr.created_on)}</div>
            <div className="text-muted-foreground">Updated</div>
            <div className="text-foreground">{formatDate(pr.updated_on)}</div>
            <div className="text-muted-foreground">Merged</div>
            <div className="text-foreground">{formatDate(pr.merged_on)}</div>
            <div className="text-muted-foreground">Closed</div>
            <div className="text-foreground">{formatDate(pr.closed_on)}</div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Reviewers
            </div>
            {resolvedReviewers.length > 0 ? (
              resolvedReviewers.map((reviewer) => (
                <div
                  key={reviewer.id}
                  className="border border-border/70 bg-background px-2.5 py-2 flex items-center gap-2 text-[12px]"
                >
                  <Avatar
                    name={reviewer.display_name}
                    url={reviewer.avatar_url}
                    sizeClass="size-4"
                  />
                  <span className="text-foreground">
                    {reviewer.display_name ?? "Unknown"}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {reviewerLabel(reviewer.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-muted-foreground">No reviewers found.</div>
            )}
          </div>
        </Section>

        <Section
          title="Build Status"
          headerRight={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onRefreshBuildStatus}
              disabled={!onRefreshBuildStatus || Boolean(refreshingBuildStatus)}
              aria-label="Refresh build status"
            >
              <RotateCw
                className={cn(
                  "size-3.5",
                  refreshingBuildStatus ? "animate-spin" : "",
                )}
              />
            </Button>
          }
        >
          {buildStatuses && buildStatuses.length > 0 ? (
            <div className="space-y-2">
              {buildStatuses.map((build) => (
                <div key={build.id} className="border border-border/70 bg-background px-2.5 py-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-foreground truncate">{build.name}</span>
                    <span
                      className={cn(
                        "ml-auto px-1.5 py-0.5 border text-[10px] uppercase tracking-wide",
                        buildBadgeClass(build.state),
                      )}
                    >
                      {buildLabel(build.state)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{build.provider ?? "provider"}</span>
                    <span className="ml-auto">{formatDate(build.completed_on)}</span>
                  </div>
                  {build.url ? (
                    <a
                      href={build.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-[11px] underline text-foreground"
                    >
                      Open build
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">
              No build status found for latest commit.
            </div>
          )}
        </Section>
      </div>

      <Section title="PR Description">
        {pr.description?.trim() ? (
          <MarkdownBlock text={pr.description} />
        ) : (
          <div className="text-[12px] text-muted-foreground">No description.</div>
        )}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Section title="History">
          {orderedHistory.length > 0 ? (
            <div className="space-y-2">
              {orderedHistory.map((event) => (
                <div key={event.id} className="border border-border/70 bg-background px-2.5 py-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <Avatar
                      name={event.actor?.display_name}
                      url={event.actor?.avatar_url}
                      sizeClass="size-4"
                    />
                    <span className="text-foreground">{eventLabel(event.type)}</span>
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
            <div className="text-[12px] text-muted-foreground">No history yet.</div>
          )}
        </Section>

        <Section title="Commits">
          {commits.length > 0 ? (
            <div className="border border-border/70 bg-background">
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
                        name={commit.author?.user?.display_name ?? commit.author?.raw}
                        url={commit.author?.user?.avatar_url}
                        sizeClass="size-4"
                      />
                      <span className="truncate text-foreground">
                        {commit.author?.user?.display_name ??
                          commit.author?.raw ??
                          "Unknown"}
                      </span>
                    </div>
                    <span className={cn(mergedDevelop ? "text-status-added/80" : "text-[#93c5fd]")}>
                      {shortHash(commit.hash)}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        mergedDevelop ? "text-muted-foreground" : "text-foreground",
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
            <div className="text-[12px] text-muted-foreground">No commits found.</div>
          )}
        </Section>
      </div>
    </div>
  );
}
