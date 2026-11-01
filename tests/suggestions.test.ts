import { describe, expect, test } from "bun:test";
import { parsePatchFiles } from "@pierre/diffs";
import { bitbucketNormalization } from "../src/lib/git-host/providers/bitbucket";
import { getSuggestionOriginalContents, parseSuggestionMarkdown, withBitbucketSuggestionTrailer } from "../src/lib/git-host/suggestions";

describe("pull request suggestions", () => {
    test("adds the Bitbucket trailer only to standalone suggestion comments", () => {
        const suggestion = "```suggestion\nnext()\n```";
        expect(withBitbucketSuggestionTrailer(suggestion)).toBe(`${suggestion}\n\n\u200c`);
        expect(withBitbucketSuggestionTrailer(withBitbucketSuggestionTrailer(suggestion))).toBe(`${suggestion}\n\n\u200c`);
        expect(withBitbucketSuggestionTrailer("plain comment")).toBe("plain comment");
    });

    test("maps app-facing range anchors to Bitbucket's snake_case payload", () => {
        expect(
            bitbucketNormalization.mapBitbucketInlineComment({
                path: "src/example.ts",
                startTo: 4,
                to: 7,
            }),
        ).toEqual({
            path: "src/example.ts",
            to: 7,
            from: undefined,
            start_to: 4,
            start_from: undefined,
        });
    });

    test("parses only a standalone suggestion fence while preserving its replacement newline", () => {
        expect(parseSuggestionMarkdown("````suggestion\n    const markdown = ` ``` `;\n````\n\n‌")).toBe("    const markdown = ` ``` `;\n");
        expect(parseSuggestionMarkdown("```suggestion\n```")).toBe("");
        expect(parseSuggestionMarkdown("A comment before\n\n```suggestion\nnext\n```\n")).toBeNull();
    });

    test("recovers source lines from the current partial patch and rejects stale contexts", () => {
        const [parsedPatch] = parsePatchFiles(
            [
                "diff --git a/src/example.ts b/src/example.ts",
                "index 1111111..2222222 100644",
                "--- a/src/example.ts",
                "+++ b/src/example.ts",
                "@@ -10,3 +10,3 @@",
                " alpha",
                "-old value",
                "+current value",
                " omega",
                "",
            ].join("\n"),
        );
        const fileDiff = parsedPatch?.files[0];
        if (!fileDiff) throw new Error("Expected a parsed file diff");

        expect(getSuggestionOriginalContents({ to: 11 }, fileDiff)).toBe("current value\n");
        expect(getSuggestionOriginalContents({ to: 11, outdated: true }, fileDiff)).toBeNull();
        expect(getSuggestionOriginalContents({ to: 11 }, { ...fileDiff, isPartial: false })).toBeNull();
    });
});
