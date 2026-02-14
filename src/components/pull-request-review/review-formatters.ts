import type {
  DiffStatEntry,
  PullRequestBuildStatus,
  PullRequestDetails,
} from "@/lib/git-host/types";

const RELATIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export function formatDate(value?: string) {
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

function formatRelative(value: Date, now: Date) {
  const diffMs = value.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (absMs < 60_000) {
    return rtf.format(Math.round(diffMs / 1_000), "second");
  }
  if (absMs < 3_600_000) {
    return rtf.format(Math.round(diffMs / 60_000), "minute");
  }
  return rtf.format(Math.round(diffMs / 3_600_000), "hour");
}

export function formatNavbarDate(value?: string) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const now = new Date();
  const ageMs = Math.abs(now.getTime() - parsed.getTime());
  if (ageMs < RELATIVE_THRESHOLD_MS) {
    return formatRelative(parsed, now);
  }
  return formatDate(value);
}

export function navbarStateClass(state?: string) {
  const normalized = state?.toLowerCase() ?? "";
  if (normalized === "merged") {
    return "border-status-added/50 bg-status-added/15 text-status-added";
  }
  if (normalized === "closed" || normalized === "declined") {
    return "border-status-removed/50 bg-status-removed/15 text-status-removed";
  }
  if (normalized === "open") {
    return "border-[#93c5fd]/50 bg-[#93c5fd]/15 text-[#93c5fd]";
  }
  return "border-border bg-secondary text-foreground";
}

export function normalizeNavbarState(pr?: {
  state?: string;
  mergedAt?: string;
  closedAt?: string;
}) {
  if (pr?.mergedAt) return "merged";
  if (pr?.closedAt) return "closed";
  return (pr?.state ?? "open").toLowerCase();
}

export function buildStatusLabel(state?: string) {
  const normalized = state?.toLowerCase() ?? "";
  if (normalized === "success") return "success";
  if (normalized === "failed") return "failed";
  if (normalized === "pending") return "pending";
  if (normalized === "skipped") return "skipped";
  if (normalized === "neutral") return "neutral";
  return "unknown";
}

export function buildStatusBubbleClass(state?: string) {
  const normalized = state?.toLowerCase() ?? "";
  if (normalized === "success") {
    return "border-status-added/50 bg-status-added/15 text-status-added";
  }
  if (normalized === "failed") {
    return "border-status-removed/50 bg-status-removed/15 text-status-removed";
  }
  if (normalized === "pending") {
    return "border-[#eab308]/50 bg-[#eab308]/15 text-[#eab308]";
  }
  return "border-border text-muted-foreground";
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function buildRunningTime(build: PullRequestBuildStatus) {
  const started = build.startedAt ? new Date(build.startedAt) : null;
  const completed = build.completedAt ? new Date(build.completedAt) : null;
  const hasStarted = Boolean(started && !Number.isNaN(started.getTime()));
  const hasCompleted = Boolean(completed && !Number.isNaN(completed.getTime()));

  if (hasStarted && hasCompleted && started && completed) {
    return formatDuration(completed.getTime() - started.getTime());
  }
  if (build.state === "pending" && hasStarted && started) {
    return `${formatDuration(Date.now() - started.getTime())} running`;
  }
  if (hasCompleted) {
    return formatNavbarDate(build.completedAt);
  }
  return "n/a";
}

export function aggregateBuildState(builds: PullRequestBuildStatus[]) {
  if (builds.some((build) => build.state === "failed")) return "failed";
  if (builds.some((build) => build.state === "pending")) return "pending";
  return "success";
}

export function linesUpdated(diffstat: DiffStatEntry[]) {
  let added = 0;
  let removed = 0;
  for (const entry of diffstat) {
    added += Number(entry.linesAdded ?? 0);
    removed += Number(entry.linesRemoved ?? 0);
  }
  return { added, removed };
}

export function getNavbarStatusDate(prData?: { pr: PullRequestDetails }) {
  if (!prData) return "Unknown";
  return formatNavbarDate(
    prData.pr.mergedAt ?? prData.pr.closedAt ?? prData.pr.updatedAt,
  );
}
