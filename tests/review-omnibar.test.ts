import { describe, expect, test } from "bun:test";
import { getPullRequestOmnibarKeywords } from "../src/components/omnibar/pull-request-omnibar";
import { getOmnibarFileName } from "../src/components/pull-request-review/review-omnibar";
import { createOmnibarFilePaths } from "../src/components/pull-request-review/review-page-model";

describe("review omnibar helpers", () => {
    test("uses the complete diff catalog instead of the sidebar-filtered fallback", () => {
        expect(createOmnibarFilePaths(["src/app.tsx", "README.md", "src/app.tsx"], ["only-in-fallback.ts"])).toEqual(["src/app.tsx", "README.md"]);
    });

    test("uses diffstat paths when a diff payload has no parsable files", () => {
        expect(createOmnibarFilePaths([], ["docs/guide.md", "src/main.ts", "docs/guide.md"])).toEqual(["docs/guide.md", "src/main.ts"]);
    });

    test("renders a concise file name while preserving directories for search", () => {
        expect(getOmnibarFileName("src/components/review-omnibar.tsx")).toBe("review-omnibar.tsx");
        expect(getOmnibarFileName("README.md")).toBe("README.md");
    });

    test("indexes pull requests by id, title, and branches", () => {
        const keywords = getPullRequestOmnibarKeywords({
            host: "github",
            repo: {
                host: "github",
                workspace: "acme",
                repo: "app",
                fullName: "acme/app",
                displayName: "app",
            },
            repoKey: "github:acme/app",
            pullRequest: {
                id: 42,
                title: "Fix cache race",
                state: "OPEN",
                source: { branch: { name: "fix/cache" } },
                destination: { branch: { name: "main" } },
                author: { displayName: "Ada" },
            },
            updatedDateLabel: null,
            updatedAtTimestamp: 0,
        });
        expect(keywords).toContain("42");
        expect(keywords).toContain("#42");
        expect(keywords).toContain("Fix cache race");
        expect(keywords).toContain("fix/cache");
        expect(keywords).toContain("main");
        expect(keywords).toContain("acme/app");
    });
});
