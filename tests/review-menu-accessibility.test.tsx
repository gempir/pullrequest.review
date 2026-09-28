import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewCommitScopeControl } from "../src/components/pull-request-review/review-commit-scope-control";

describe("review menu accessibility", () => {
    test("keeps the commit-scope trigger focused and announces loading notices politely", () => {
        const html = renderToStaticMarkup(
            <ReviewCommitScopeControl
                mode="range"
                commitOptions={[]}
                selectedCommitHashes={[]}
                isFetching
                notice="Expanded to a contiguous commit range."
                onSetFullScope={() => {}}
                onToggleCommitSelection={() => {}}
            />,
        );

        expect(html).toContain("focus-visible:ring-2");
        expect(html).not.toContain("focus-visible:ring-0");
        expect(html).toContain('role="status"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('aria-atomic="true"');
        expect(html).toContain("Loading commits. Expanded to a contiguous commit range.");
    });
});
