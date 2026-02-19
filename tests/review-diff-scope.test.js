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
        expect(validateReviewDiffScopeSearch({ scope: "range", from: "bad", to: "bbbbbbbb" })).toEqual({ scope: "full" });
    });

    test("canonicalizes unsupported scope mode to full mode", () => {
        expect(validateReviewDiffScopeSearch({ scope: "since", baseline: "bbbbbbbb", includeMerge: "1" })).toEqual({ scope: "full" });
    });
});

describe("review diff scope resolution", () => {
    test("resolves single-commit range", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "range", from: "bbbbbbbb", to: "bbbbbbbb" },
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
            search: { scope: "range", from: "bbbbbbbb", to: "cccccccc" },
            commits: commitsNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.mode).toBe("range");
        if (resolved.mode !== "range") return;
        expect(resolved.baseCommitHash).toBe("aaaaaaaa");
        expect(resolved.headCommitHash).toBe("cccccccc");
        expect(resolved.selectedCommitHashes).toEqual(["bbbbbbbb", "cccccccc"]);
    });

    test("keeps merge commits in visible commit list", () => {
        const resolved = resolveReviewDiffScope({
            search: { scope: "full" },
            commits: commitsWithMergeNewestFirst,
            destinationCommitHash: "basebase1",
        });

        expect(resolved.visibleCommits.map((commit) => commit.hash)).toEqual(["bbbbbbbb", "cccccccc", "dddddddd"]);
    });
});
