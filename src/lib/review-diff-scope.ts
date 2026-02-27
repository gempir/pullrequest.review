import type { Commit } from "@/lib/git-host/types";

export type ReviewDiffScopeMode = "full" | "range";

export type ReviewDiffScopeSearch = {
    from?: string;
    to?: string;
};

type ResolveReviewDiffScopeArgs = {
    search: ReviewDiffScopeSearch;
    commits: Commit[];
    destinationCommitHash?: string;
};

type ResolvedReviewDiffScope =
    | {
          mode: "full";
          visibleCommits: Commit[];
          allCommits: Commit[];
          selectedCommits: Commit[];
          selectedCommitHashes: string[];
          baseCommitHash?: undefined;
          headCommitHash?: undefined;
          normalizedSearch: ReviewDiffScopeSearch;
          fallbackReason?: "invalid_range" | "missing_base_or_head";
      }
    | {
          mode: "range";
          visibleCommits: Commit[];
          allCommits: Commit[];
          selectedCommits: Commit[];
          selectedCommitHashes: string[];
          baseCommitHash: string;
          headCommitHash: string;
          normalizedSearch: ReviewDiffScopeSearch;
          fallbackReason?: undefined;
      };

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;

function normalizeCommitHash(value: unknown) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!COMMIT_HASH_PATTERN.test(trimmed)) return undefined;
    return trimmed;
}

function commitMessage(commit: Commit) {
    return (commit.summary?.raw ?? commit.message ?? "").trim();
}

function commitTimestamp(commit: Commit) {
    if (!commit.date) return null;
    const parsed = Date.parse(commit.date);
    return Number.isNaN(parsed) ? null : parsed;
}

function mergeCommitRecords(primary: Commit, candidate: Commit): Commit {
    const primaryMessage = commitMessage(primary);
    const candidateMessage = commitMessage(candidate);
    const primaryTime = commitTimestamp(primary);
    const candidateTime = commitTimestamp(candidate);

    if (!primaryMessage && candidateMessage) return candidate;
    if (primaryMessage && !candidateMessage) return primary;
    if (primaryTime === null && candidateTime !== null) return candidate;
    if (primaryTime !== null && candidateTime === null) return primary;
    if (primaryTime !== null && candidateTime !== null && candidateTime < primaryTime) return candidate;
    return primary;
}

function orderCommitsOldestFirst(commits: Commit[]) {
    const uniqueByHash = new Map<string, { commit: Commit; firstIndex: number; timestamp: number | null }>();
    for (const [index, commit] of commits.entries()) {
        const hash = commit.hash?.trim();
        if (!hash) continue;
        const existing = uniqueByHash.get(hash);
        const timestamp = commitTimestamp(commit);
        if (!existing) {
            uniqueByHash.set(hash, { commit, firstIndex: index, timestamp });
            continue;
        }
        const merged = mergeCommitRecords(existing.commit, commit);
        uniqueByHash.set(hash, {
            commit: merged,
            firstIndex: existing.firstIndex,
            timestamp: commitTimestamp(merged),
        });
    }
    return Array.from(uniqueByHash.values())
        .sort((a, b) => {
            if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
            }
            if (a.timestamp !== null && b.timestamp === null) return -1;
            if (a.timestamp === null && b.timestamp !== null) return 1;
            // Fallback: preserve historical behavior where provider commits were usually newest->oldest.
            return b.firstIndex - a.firstIndex;
        })
        .map((entry) => entry.commit);
}

export function validateReviewDiffScopeSearch(search: unknown): ReviewDiffScopeSearch {
    const raw = typeof search === "object" && search ? (search as Record<string, unknown>) : {};
    const from = normalizeCommitHash(raw.from);
    const to = normalizeCommitHash(raw.to);
    if (from && to) {
        return { from, to };
    }
    return {};
}

export function resolveReviewDiffScope({ search, commits, destinationCommitHash }: ResolveReviewDiffScopeArgs): ResolvedReviewDiffScope {
    const allCommits = orderCommitsOldestFirst(commits);
    const visibleCommits = allCommits;
    const visibleIndex = new Map(visibleCommits.map((commit, index) => [commit.hash, index] as const));
    const hasRangeSelection = Boolean(search.from && search.to);
    if (!hasRangeSelection) {
        return {
            mode: "full",
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: {},
        };
    }

    const fromHash = search.from;
    const toHash = search.to;
    const fromIndex = fromHash ? visibleIndex.get(fromHash) : undefined;
    const toIndex = toHash ? visibleIndex.get(toHash) : undefined;
    if (fromIndex === undefined || toIndex === undefined) {
        return {
            mode: "full",
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: {},
            fallbackReason: "invalid_range",
        };
    }
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    const selectedCommits = visibleCommits.slice(startIndex, endIndex + 1);
    const selectedCommitHashes = selectedCommits.map((commit) => commit.hash);
    const headCommitHash = selectedCommits[selectedCommits.length - 1]?.hash;
    const baseCommitHash = startIndex > 0 ? visibleCommits[startIndex - 1]?.hash : destinationCommitHash?.trim();
    if (!baseCommitHash || !headCommitHash) {
        return {
            mode: "full",
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: {},
            fallbackReason: "missing_base_or_head",
        };
    }
    return {
        mode: "range",
        allCommits,
        visibleCommits,
        selectedCommits,
        selectedCommitHashes,
        baseCommitHash,
        headCommitHash,
        normalizedSearch: {
            from: visibleCommits[startIndex]?.hash,
            to: visibleCommits[endIndex]?.hash,
        },
    };
}

export function diffScopeStorageSegment(scope: ResolvedReviewDiffScope) {
    if (scope.mode === "full") return "full";
    if (!scope.baseCommitHash || !scope.headCommitHash) return "full";
    return `${scope.baseCommitHash}..${scope.headCommitHash}`;
}
