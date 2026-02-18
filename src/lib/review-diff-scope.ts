import type { Commit } from "@/lib/git-host/types";

export type ReviewDiffScopeMode = "full" | "range" | "since";

export type ReviewDiffScopeSearch = {
    scope: ReviewDiffScopeMode;
    includeMerge: "0" | "1";
    from?: string;
    to?: string;
    baseline?: string;
};

type ResolveReviewDiffScopeArgs = {
    search: ReviewDiffScopeSearch;
    commits: Commit[];
    destinationCommitHash?: string;
};

export type ResolvedReviewDiffScope =
    | {
          mode: "full";
          includeMerge: boolean;
          visibleCommits: Commit[];
          allCommits: Commit[];
          selectedCommits: Commit[];
          selectedCommitHashes: string[];
          baseCommitHash?: undefined;
          headCommitHash?: undefined;
          normalizedSearch: ReviewDiffScopeSearch;
          fallbackReason?: "invalid_range" | "invalid_baseline" | "missing_base_or_head";
      }
    | {
          mode: "range" | "since";
          includeMerge: boolean;
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

function isMergeLikeCommit(commit: Commit) {
    const message = commitMessage(commit);
    return /^merge(d)?\b/i.test(message) || /^merged develop\b/i.test(message);
}

function orderCommitsOldestFirst(commits: Commit[]) {
    const uniqueByHash = new Map<string, Commit>();
    for (const commit of commits) {
        const hash = commit.hash?.trim();
        if (!hash || uniqueByHash.has(hash)) continue;
        uniqueByHash.set(hash, commit);
    }
    return Array.from(uniqueByHash.values()).reverse();
}

export function validateReviewDiffScopeSearch(search: unknown): ReviewDiffScopeSearch {
    const raw = typeof search === "object" && search ? (search as Record<string, unknown>) : {};
    const includeMerge = raw.includeMerge === "1" || raw.includeMerge === 1 || raw.includeMerge === true ? "1" : "0";
    const scopeRaw = typeof raw.scope === "string" ? raw.scope : "full";
    const scope: ReviewDiffScopeMode = scopeRaw === "range" || scopeRaw === "since" ? scopeRaw : "full";
    if (scope === "range") {
        const from = normalizeCommitHash(raw.from);
        const to = normalizeCommitHash(raw.to);
        if (from && to) {
            return { scope: "range", from, to, includeMerge };
        }
        return { scope: "full", includeMerge };
    }
    if (scope === "since") {
        const baseline = normalizeCommitHash(raw.baseline);
        if (baseline) {
            return { scope: "since", baseline, includeMerge };
        }
        return { scope: "full", includeMerge };
    }
    return { scope: "full", includeMerge };
}

export function resolveReviewDiffScope({ search, commits, destinationCommitHash }: ResolveReviewDiffScopeArgs): ResolvedReviewDiffScope {
    const allCommits = orderCommitsOldestFirst(commits);
    const includeMerge = search.includeMerge === "1";
    const nonMergeCommits = allCommits.filter((commit) => !isMergeLikeCommit(commit));
    const visibleCommits = includeMerge || nonMergeCommits.length === 0 ? allCommits : nonMergeCommits;
    const visibleIndex = new Map(visibleCommits.map((commit, index) => [commit.hash, index] as const));
    if (search.scope === "full") {
        return {
            mode: "full",
            includeMerge,
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: { scope: "full", includeMerge: search.includeMerge },
        };
    }

    if (search.scope === "range") {
        const fromHash = search.from;
        const toHash = search.to;
        const fromIndex = fromHash ? visibleIndex.get(fromHash) : undefined;
        const toIndex = toHash ? visibleIndex.get(toHash) : undefined;
        if (fromIndex === undefined || toIndex === undefined) {
            return {
                mode: "full",
                includeMerge,
                allCommits,
                visibleCommits,
                selectedCommits: visibleCommits,
                selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
                normalizedSearch: { scope: "full", includeMerge: search.includeMerge },
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
                includeMerge,
                allCommits,
                visibleCommits,
                selectedCommits: visibleCommits,
                selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
                normalizedSearch: { scope: "full", includeMerge: search.includeMerge },
                fallbackReason: "missing_base_or_head",
            };
        }
        return {
            mode: "range",
            includeMerge,
            allCommits,
            visibleCommits,
            selectedCommits,
            selectedCommitHashes,
            baseCommitHash,
            headCommitHash,
            normalizedSearch: {
                scope: "range",
                from: visibleCommits[startIndex]?.hash,
                to: visibleCommits[endIndex]?.hash,
                includeMerge: search.includeMerge,
            },
        };
    }

    const baselineHash = search.baseline;
    const baselineIndex = baselineHash ? visibleIndex.get(baselineHash) : undefined;
    if (baselineIndex === undefined) {
        return {
            mode: "full",
            includeMerge,
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: { scope: "full", includeMerge: search.includeMerge },
            fallbackReason: "invalid_baseline",
        };
    }
    const selectedCommits = visibleCommits.slice(baselineIndex + 1);
    const selectedCommitHashes = selectedCommits.map((commit) => commit.hash);
    const headCommitHash = visibleCommits[visibleCommits.length - 1]?.hash;
    const baseCommitHash = visibleCommits[baselineIndex]?.hash;
    if (!baseCommitHash || !headCommitHash) {
        return {
            mode: "full",
            includeMerge,
            allCommits,
            visibleCommits,
            selectedCommits: visibleCommits,
            selectedCommitHashes: visibleCommits.map((commit) => commit.hash),
            normalizedSearch: { scope: "full", includeMerge: search.includeMerge },
            fallbackReason: "missing_base_or_head",
        };
    }

    return {
        mode: "since",
        includeMerge,
        allCommits,
        visibleCommits,
        selectedCommits,
        selectedCommitHashes,
        baseCommitHash,
        headCommitHash,
        normalizedSearch: {
            scope: "since",
            baseline: baseCommitHash,
            includeMerge: search.includeMerge,
        },
    };
}

export function diffScopeStorageSegment(scope: ResolvedReviewDiffScope) {
    if (scope.mode === "full") return "full";
    if (!scope.baseCommitHash || !scope.headCommitHash) return "full";
    return `${scope.baseCommitHash}..${scope.headCommitHash}`;
}
