import type { FileNode } from "@/lib/file-tree-context";
import type { GitHost, PullRequestSummary, RepoRef } from "@/lib/git-host/types";

export const HOSTS: GitHost[] = ["bitbucket", "github"];
export const HOST_PATH_PREFIX = "host:";
const WORKSPACE_PATH_PREFIX = "workspace:";
export const DEFAULT_REVIEW_SCOPE_SEARCH = {} as const;

export type DiffPanel = "pull-requests" | "repositories";

export type PullRequestTreeMeta = {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
};

export type GroupedPullRequestEntry = {
    host: GitHost;
    repo: RepoRef;
    pullRequests: PullRequestSummary[];
};

export type SortedRootPullRequest = {
    host: GitHost;
    repo: RepoRef;
    repoKey: string;
    pullRequest: PullRequestSummary;
    updatedDateLabel: string | null;
    updatedAtTimestamp: number;
};

function normalizePullRequestRecord(record: unknown): {
    repoKey: string;
    host: GitHost;
    repo: RepoRef;
    pullRequest: PullRequestSummary;
} | null {
    if (!record || typeof record !== "object") return null;
    const value = record as {
        repoKey?: unknown;
        host?: unknown;
        repo?: Partial<RepoRef>;
        pullRequest?: Partial<PullRequestSummary>;
    };
    if (value.host !== "bitbucket" && value.host !== "github") return null;
    const pullRequestSource = value.pullRequest;
    const repoSource = value.repo;
    if (!repoSource || !pullRequestSource) return null;

    const workspace = repoSource.workspace?.trim();
    const repositorySlug = repoSource.repo?.trim();
    if (!workspace || !repositorySlug) return null;

    const pullRequestId = Number(pullRequestSource.id);
    if (!Number.isFinite(pullRequestId)) return null;

    const fullName =
        typeof repoSource.fullName === "string" && repoSource.fullName.trim().length > 0 ? repoSource.fullName.trim() : `${workspace}/${repositorySlug}`;
    const displayName = typeof repoSource.displayName === "string" && repoSource.displayName.trim().length > 0 ? repoSource.displayName.trim() : repositorySlug;
    const title =
        typeof pullRequestSource.title === "string" && pullRequestSource.title.trim().length > 0 ? pullRequestSource.title.trim() : `#${pullRequestId}`;

    return {
        repoKey: typeof value.repoKey === "string" && value.repoKey.trim().length > 0 ? value.repoKey : `${value.host}:${fullName}`,
        host: value.host,
        repo: {
            host: value.host,
            workspace,
            repo: repositorySlug,
            fullName,
            displayName,
        },
        pullRequest: {
            id: pullRequestId,
            title,
            state: typeof pullRequestSource.state === "string" ? pullRequestSource.state : "OPEN",
            createdAt: typeof pullRequestSource.createdAt === "string" ? pullRequestSource.createdAt : undefined,
            updatedAt: typeof pullRequestSource.updatedAt === "string" ? pullRequestSource.updatedAt : undefined,
            source:
                typeof pullRequestSource.source === "object" && pullRequestSource.source
                    ? {
                          branch:
                              typeof pullRequestSource.source.branch === "object" && pullRequestSource.source.branch
                                  ? { name: pullRequestSource.source.branch.name }
                                  : undefined,
                      }
                    : undefined,
            destination:
                typeof pullRequestSource.destination === "object" && pullRequestSource.destination
                    ? {
                          branch:
                              typeof pullRequestSource.destination.branch === "object" && pullRequestSource.destination.branch
                                  ? { name: pullRequestSource.destination.branch.name }
                                  : undefined,
                      }
                    : undefined,
            links: typeof pullRequestSource.links === "object" ? pullRequestSource.links : undefined,
            author: typeof pullRequestSource.author === "object" ? pullRequestSource.author : undefined,
        },
    };
}

export function formatRootListDate(value?: string) {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(parsed);
}

function getDateSortTimestamp(value?: string) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function normalizeWorkspaceLabel(workspace: string, hostDomain: string) {
    const normalized = workspace
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, "");
    const hostVariants = new Set([hostDomain.toLowerCase(), `www.${hostDomain.toLowerCase()}`]);
    const segments = normalized
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    while (segments.length > 0 && hostVariants.has(segments[0].toLowerCase())) {
        segments.shift();
    }
    return segments.join("/");
}

export function hostFromLandingTreePath(path: string): GitHost | null {
    if (!path.startsWith(HOST_PATH_PREFIX) && !path.startsWith(WORKSPACE_PATH_PREFIX)) {
        return null;
    }
    const [, host] = path.split(":");
    return host === "bitbucket" || host === "github" ? host : null;
}

export function buildGroupedPullRequests(repoPullRequestRecords: unknown[], reposByHost: Record<GitHost, RepoRef[]>): GroupedPullRequestEntry[] {
    const selectedRepoKeys = new Set<string>();
    for (const host of HOSTS) {
        for (const repo of reposByHost[host]) {
            selectedRepoKeys.add(`${host}:${repo.fullName}`);
        }
    }

    const groupedByRepo = new Map<string, GroupedPullRequestEntry>();

    for (const record of repoPullRequestRecords) {
        const normalizedRecord = normalizePullRequestRecord(record);
        if (!normalizedRecord || !selectedRepoKeys.has(normalizedRecord.repoKey)) continue;
        const existing = groupedByRepo.get(normalizedRecord.repoKey);
        if (existing) {
            existing.pullRequests.push(normalizedRecord.pullRequest);
            continue;
        }

        groupedByRepo.set(normalizedRecord.repoKey, {
            host: normalizedRecord.host,
            repo: normalizedRecord.repo,
            pullRequests: [normalizedRecord.pullRequest],
        });
    }

    return Array.from(groupedByRepo.values())
        .map((entry) => ({
            ...entry,
            pullRequests: [...entry.pullRequests].sort((a, b) => b.id - a.id),
        }))
        .sort((a, b) => {
            if (a.host !== b.host) return a.host.localeCompare(b.host);
            return a.repo.fullName.localeCompare(b.repo.fullName);
        });
}

export function buildPullRequestsByRepo(groupedPullRequests: GroupedPullRequestEntry[]) {
    const map = new Map<string, PullRequestSummary[]>();
    for (const item of groupedPullRequests) {
        const fullName = item.repo.fullName?.trim() || `${item.repo.workspace.trim()}/${item.repo.repo.trim()}`;
        if (!fullName) continue;
        map.set(`${item.host}:${fullName}`, item.pullRequests);
    }
    return map;
}

export function buildSortedRootPullRequests(groupedPullRequests: GroupedPullRequestEntry[]): SortedRootPullRequest[] {
    const rows = groupedPullRequests.flatMap(({ host, repo, pullRequests }) => {
        const repoKey = `${host}:${repo.fullName}`;
        return pullRequests.map((pullRequest) => ({
            host,
            repo,
            repoKey,
            pullRequest,
            updatedDateLabel: formatRootListDate(pullRequest.updatedAt),
            updatedAtTimestamp: getDateSortTimestamp(pullRequest.updatedAt),
        }));
    });

    rows.sort((a, b) => {
        if (a.updatedAtTimestamp !== b.updatedAtTimestamp) return b.updatedAtTimestamp - a.updatedAtTimestamp;
        if (a.pullRequest.id !== b.pullRequest.id) return b.pullRequest.id - a.pullRequest.id;
        if (a.host !== b.host) return a.host.localeCompare(b.host);
        return a.repo.fullName.localeCompare(b.repo.fullName);
    });

    return rows;
}

export function buildPullRequestTree(reposByHost: Record<GitHost, RepoRef[]>, pullRequestsByRepo: Map<string, PullRequestSummary[]>, query: string) {
    const term = query.trim().toLowerCase();
    const pullRequestMeta = new Map<string, PullRequestTreeMeta>();
    const root: FileNode[] = [];

    for (const host of HOSTS) {
        const hostDomain = host === "github" ? "github.com" : "bitbucket.org";
        const hostNode: FileNode = {
            name: hostDomain,
            path: `host:${host}`,
            type: "directory",
            children: [],
        };
        const workspaceNodes = new Map<string, FileNode>();

        for (const repo of reposByHost[host]) {
            const key = `${host}:${repo.fullName}`;
            const prs = pullRequestsByRepo.get(key) ?? [];
            const repoMatches = !term || repo.fullName.toLowerCase().includes(term) || repo.displayName.toLowerCase().includes(term);
            const filteredPrs = repoMatches
                ? prs
                : prs.filter((pr) => {
                      const author = pr.author?.displayName ?? "";
                      return pr.title.toLowerCase().includes(term) || String(pr.id).includes(term) || author.toLowerCase().includes(term);
                  });

            if (!repoMatches && filteredPrs.length === 0) continue;

            const workspaceLabel = normalizeWorkspaceLabel(repo.workspace, hostDomain);
            const workspacePath = `workspace:${host}:${repo.workspace}`;
            let workspaceNode = workspaceNodes.get(workspacePath);
            if (!workspaceNode) {
                workspaceNode = {
                    name: workspaceLabel || repo.workspace,
                    path: workspacePath,
                    type: "directory",
                    children: [],
                };
                workspaceNodes.set(workspacePath, workspaceNode);
                hostNode.children?.push(workspaceNode);
            }

            const repoNode: FileNode = {
                name: repo.repo,
                path: `repo:${host}:${repo.workspace}:${repo.repo}`,
                type: "directory",
                children: filteredPrs.map((pr) => {
                    const path = `pr:${host}:${repo.workspace}:${repo.repo}:${pr.id}`;
                    pullRequestMeta.set(path, {
                        host: repo.host,
                        workspace: repo.workspace,
                        repo: repo.repo,
                        pullRequestId: String(pr.id),
                    });
                    return {
                        name: `#${pr.id} ${pr.title}`,
                        path,
                        type: "file",
                    };
                }),
            };

            workspaceNode.children?.push(repoNode);
        }

        root.push(hostNode);
    }

    return { root, pullRequestMeta };
}
