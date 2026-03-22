import type { DiffStatEntry, PullRequestBuildStatus } from "@/lib/git-host/types";
import { formatTimestampLabel } from "@/lib/timestamp";

export function navbarStateClass(state?: string) {
    const normalized = state?.toLowerCase() ?? "";
    if (normalized === "merged") {
        return "border-status-added/50 bg-status-added/15 text-status-added";
    }
    if (normalized === "closed" || normalized === "declined") {
        return "border-status-removed/50 bg-status-removed/15 text-status-removed";
    }
    if (normalized === "open") {
        return "border-status-renamed/50 bg-status-renamed/15 text-status-renamed";
    }
    return "border-border bg-secondary text-foreground";
}

export function normalizeNavbarState(pr?: { state?: string; draft?: boolean; mergedAt?: string; closedAt?: string }) {
    if (pr?.mergedAt) return "merged";
    if (pr?.closedAt) return "closed";
    if (pr?.draft) return "draft";
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
        return "border-status-modified/50 bg-status-modified/15 text-status-modified";
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
        return formatTimestampLabel(build.completedAt);
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
