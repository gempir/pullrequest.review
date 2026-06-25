import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PullRequestSummaryPanel } from "../src/components/pr-summary-panel";
import type { PullRequestBundle } from "../src/lib/git-host/types";

const bundle: PullRequestBundle = {
    prRef: {
        host: "bitbucket",
        workspace: "workspace",
        repo: "repo",
        pullRequestId: "1",
    },
    pr: {
        id: 1,
        title: "Test pull request",
        description: "",
        state: "OPEN",
        createdAt: "2026-01-01T00:00:00Z",
    },
    diff: "",
    diffstat: [],
    commits: [],
    comments: [
        {
            id: 42,
            createdAt: "2026-01-01T00:01:00Z",
            content: { raw: "Inline comment" },
            user: { displayName: "Reviewer" },
            inline: { path: "src/example.ts", to: 12 },
        },
    ],
    history: [],
};

describe("pull request summary comment header", () => {
    test("renders the file path as a link separate from the copy button", () => {
        const html = renderToStaticMarkup(<PullRequestSummaryPanel bundle={bundle} onSelectComment={() => {}} />);

        expect(html).toContain('href="#/src/example.ts?comment=42"');
        expect(html).toContain('aria-label="Open comment on src/example.ts"');
        expect(html).toContain("cursor-pointer");
        expect(html).toContain('aria-label="Copy comment link"');
        expect(html.split('aria-label="Copy comment link"').length - 1).toBe(1);
        expect(html.indexOf("<a") >= 0).toBe(true);
        expect(html.indexOf("</a>") < html.indexOf('aria-label="Copy comment link"')).toBe(true);
    });
});
