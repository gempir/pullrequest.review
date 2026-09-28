import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OmnibarMenubarInput } from "../src/components/omnibar/omnibar-menubar-input";
import { getPullRequestOmnibarKeywords } from "../src/components/omnibar/pull-request-omnibar";
import { getOmnibarFileName, ReviewOmnibarShortcutHint } from "../src/components/pull-request-review/review-omnibar";
import { createOmnibarFilePaths } from "../src/components/pull-request-review/review-page-model";
import { ShortcutsProvider } from "../src/lib/shortcuts-context";

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

    test("uses consistent search copy and a semantic configured shortcut hint", () => {
        const triggerHtml = renderToStaticMarkup(createElement(ShortcutsProvider, null, createElement(OmnibarMenubarInput, { onOpen: () => {} })));
        const hintHtml = renderToStaticMarkup(createElement(ReviewOmnibarShortcutHint, { shortcutLabel: "Ctrl+Shift+P" }));

        expect(triggerHtml).toContain("Search files, actions, and pull requests");
        expect(triggerHtml).toContain("<kbd");
        expect(triggerHtml).toContain("Cmd+K</kbd>");
        expect(hintHtml).toContain("<kbd");
        expect(hintHtml).toContain("Ctrl+Shift+P</kbd>");
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
