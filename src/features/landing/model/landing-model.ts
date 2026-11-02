import type { GitHost, PullRequestSummary, RepoRef } from "@/lib/git-host/types";

export const HOSTS: GitHost[] = ["bitbucket", "github"];
export const DEFAULT_REVIEW_SCOPE_SEARCH = {} as const;

export type DiffPanel = "pull-requests" | "repositories";

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
            authoredByViewer: pullRequestSource.authoredByViewer === true,
            reviewRequested: pullRequestSource.reviewRequested === true,
        },
    };
}

const rootListDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
});

function formatRootListDate(value?: string) {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return rootListDateFormatter.format(parsed);
}

function getDateSortTimestamp(value?: string) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
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
            pullRequests: entry.pullRequests.toSorted((a, b) => b.id - a.id),
        }))
        .sort((a, b) => {
            if (a.host !== b.host) return a.host.localeCompare(b.host);
            return a.repo.fullName.localeCompare(b.repo.fullName);
        });
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

export type InboxSection = {
    id: "review" | "mine" | "open" | "closed";
    title: string;
    rows: SortedRootPullRequest[];
};

export type InboxFilters = {
    query: string;
    state: "open" | "closed" | "all";
    author: string;
    repository: string;
    updatedWithinMs: number | null;
};

const CLOSED_STATES = new Set(["MERGED", "DECLINED", "SUPERSEDED", "CLOSED"]);

function isClosedPullRequest(pullRequest: PullRequestSummary) {
    return CLOSED_STATES.has(pullRequest.state.trim().toUpperCase());
}

/** Groups rows by what they ask of the reader. Rows keep their incoming (most recent first) order. */
export function buildInboxSections(rows: readonly SortedRootPullRequest[]): InboxSection[] {
    const sections: InboxSection[] = [
        { id: "review", title: "Needs your review", rows: [] },
        { id: "mine", title: "Your pull requests", rows: [] },
        { id: "open", title: "Open", rows: [] },
        { id: "closed", title: "Closed", rows: [] },
    ];
    const [review, mine, open, closed] = sections as [InboxSection, InboxSection, InboxSection, InboxSection];
    for (const row of rows) {
        if (isClosedPullRequest(row.pullRequest)) closed.rows.push(row);
        else if (row.pullRequest.reviewRequested) review.rows.push(row);
        else if (row.pullRequest.authoredByViewer) mine.rows.push(row);
        else open.rows.push(row);
    }
    return sections.filter((section) => section.rows.length > 0);
}

export function filterInboxRows(rows: readonly SortedRootPullRequest[], filters: InboxFilters, now = Date.now()) {
    const term = filters.query.trim().toLowerCase();
    return rows.filter((row) => {
        const { pullRequest, repo } = row;
        const closed = isClosedPullRequest(pullRequest);
        if (filters.state === "open" && closed) return false;
        if (filters.state === "closed" && !closed) return false;
        if (filters.author && pullRequest.author?.displayName !== filters.author) return false;
        if (filters.repository && repo.fullName !== filters.repository) return false;
        if (filters.updatedWithinMs !== null) {
            if (row.updatedAtTimestamp === Number.NEGATIVE_INFINITY || now - row.updatedAtTimestamp > filters.updatedWithinMs) return false;
        }
        if (!term) return true;
        const haystack = [
            `#${pullRequest.id}`,
            pullRequest.title,
            repo.fullName,
            pullRequest.author?.displayName ?? "",
            pullRequest.source?.branch?.name ?? "",
            pullRequest.destination?.branch?.name ?? "",
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(term);
    });
}

export type PullRequestTarget = { host: GitHost; workspace: string; repo: string; pullRequestId: string };

const PULL_REQUEST_URL_PATTERNS: ReadonlyArray<{ host: GitHost; pattern: RegExp }> = [
    { host: "github", pattern: /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i },
    { host: "bitbucket", pattern: /^(?:https?:\/\/)?(?:www\.)?bitbucket\.org\/([^/\s]+)\/([^/\s]+)\/pull-requests\/(\d+)/i },
];

/** Recognizes a pasted pull request URL. Route shape selects the host, never workspace memory. */
export function parsePullRequestUrl(value: string): PullRequestTarget | null {
    const trimmed = value.trim();
    for (const { host, pattern } of PULL_REQUEST_URL_PATTERNS) {
        const match = pattern.exec(trimmed);
        if (match?.[1] && match[2] && match[3]) {
            return { host, workspace: match[1], repo: match[2], pullRequestId: match[3] };
        }
    }
    return null;
}
