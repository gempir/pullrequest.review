import { describe, expect, test } from "bun:test";
import { resolveReviewDiffScope, validateReviewDiffScopeSearch } from "../src/lib/review-diff-scope";

const commitsNewestFirst = [
    { hash: "cccccccc", message: "feat: third" },
    { hash: "bbbbbbbb", message: "feat: second" },
    { hash: "aaaaaaaa", message: "feat: first" },
];
const commitsWithMergeNewestFirst = [
    { hash: "dddddddd", message: "feat: fourth" },
    { hash: "cccccccc", message: "Merge branch 'develop'" },
    { hash: "bbbbbbbb", message: "feat: second" },
];

describe("review diff scope parsing", () => {
    test("canonicalizes invalid search params to full mode", () => {
        expect(validateReviewDiffScopeSearch({ scope: "range", from: "bad", to: "bbbbbbbb" })).toEqual({
            scope: "full",
            includeMerge: "0",
        });
    });
});

describe("review diff scope resolution", () => {
    test("resolves single-commit range", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "range", from: "bbbbbbbb", to: "bbbbbbbb", includeMerge: "0" },
            commits: commitsNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.mode).toBe("range");
        if (resolved.mode !== "range") return;
        expect(resolved.baseCommitHash).toBe("aaaaaaaa");
        expect(resolved.headCommitHash).toBe("bbbbbbbb");
        expect(resolved.selectedCommitHashes).toEqual(["bbbbbbbb"]);
    });

    test("resolves contiguous multi-commit range", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "range", from: "bbbbbbbb", to: "cccccccc", includeMerge: "0" },
            commits: commitsNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.mode).toBe("range");
        if (resolved.mode !== "range") return;
        expect(resolved.baseCommitHash).toBe("aaaaaaaa");
        expect(resolved.headCommitHash).toBe("cccccccc");
        expect(resolved.selectedCommitHashes).toEqual(["bbbbbbbb", "cccccccc"]);
    });

    test("resolves baseline-to-head incremental scope", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "since", baseline: "bbbbbbbb", includeMerge: "0" },
            commits: commitsNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.mode).toBe("since");
        if (resolved.mode !== "since") return;
        expect(resolved.baseCommitHash).toBe("bbbbbbbb");
        expect(resolved.headCommitHash).toBe("cccccccc");
        expect(resolved.selectedCommitHashes).toEqual(["cccccccc"]);
    });

    test("falls back to full mode when baseline commit is missing", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "since", baseline: "dddddddd", includeMerge: "0" },
            commits: commitsNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.mode).toBe("full");
        expect(resolved.fallbackReason).toBe("invalid_baseline");
    });

    test("hides merge commits by default", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "full", includeMerge: "0" },
            commits: commitsWithMergeNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.visibleCommits.map((commit) => commit.hash)).toEqual(["bbbbbbbb", "dddddddd"]);
    });
});
