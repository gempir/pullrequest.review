import { describe, expect, test } from "bun:test";
import { parsePatchFiles } from "@pierre/diffs";
import {
    buildBitbucketSuggestions,
    formatBitbucketSuggestion,
    getBitbucketSuggestionKey,
    getBitbucketSuggestionOriginalContents,
    parseBitbucketSuggestion,
} from "../src/lib/git-host/bitbucket-suggestions";
import { bitbucketNormalization } from "../src/lib/git-host/providers/bitbucket/client";

describe("Bitbucket suggestions", () => {
    test("formats the known-good one-line suggestion payload", () => {
        const suggestions = buildBitbucketSuggestions({
            path: "OpenData/census/Makefile",
            originalContents: "all: $(DATABASE)\n",
            editedContents: "all: $NEW_SUGGESTION_HERE\n",
        });

        expect(suggestions).toEqual([
            {
                content: "```suggestion\nall: $NEW_SUGGESTION_HERE\n```\n\n‌",
                inline: {
                    path: "OpenData/census/Makefile",
                    to: 1,
                },
            },
        ]);
    });

    test("creates a range suggestion for a multi-line replacement", () => {
        const suggestions = buildBitbucketSuggestions({
            path: "src/example.ts",
            originalContents: "one\ntwo\nthree\nfour\n",
            editedContents: "one\nTWO\nTHREE\nfour\n",
        });

        expect(suggestions).toEqual([
            {
                content: "```suggestion\nTWO\nTHREE\n```\n\n‌",
                inline: {
                    path: "src/example.ts",
                    startTo: 2,
                    to: 3,
                },
            },
        ]);
    });

    test("preserves source whitespace and uses a safe fence for code containing backticks", () => {
        expect(formatBitbucketSuggestion("    const markdown = ` ``` `;\n")).toBe("````suggestion\n    const markdown = ` ``` `;\n````\n\n‌");
    });

    test("does not create unsafe insertion-only or deletion-only suggestions", () => {
        expect(
            buildBitbucketSuggestions({
                path: "src/example.ts",
                originalContents: "one\ntwo\n",
                editedContents: "one\ninserted\ntwo\n",
            }),
        ).toEqual([]);
        expect(
            buildBitbucketSuggestions({
                path: "src/example.ts",
                originalContents: "one\ntwo\n",
                editedContents: "one\n",
            }),
        ).toEqual([]);
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

    test("keys each suggestion by its anchor and exact replacement payload", () => {
        const [suggestion] = buildBitbucketSuggestions({
            path: "src/example.ts",
            originalContents: "one\ntwo\n",
            editedContents: "one\nTWO\n",
        });

        expect(getBitbucketSuggestionKey(suggestion)).toBe(JSON.stringify(["src/example.ts", 2, 2, "```suggestion\nTWO\n```\n\n‌"]));
    });

    test("parses only a standalone suggestion fence while preserving its replacement newline", () => {
        expect(parseBitbucketSuggestion("````suggestion\n    const markdown = ` ``` `;\n````\n\n‌")).toBe("    const markdown = ` ``` `;\n");
        expect(parseBitbucketSuggestion("A comment before\n\n```suggestion\nnext\n```\n")).toBeNull();
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

        expect(getBitbucketSuggestionOriginalContents({ path: "src/example.ts", to: 11 }, fileDiff)).toBe("current value\n");
        expect(getBitbucketSuggestionOriginalContents({ path: "src/example.ts", to: 11, outdated: true }, fileDiff)).toBeNull();
        expect(getBitbucketSuggestionOriginalContents({ path: "src/example.ts", to: 11 }, { ...fileDiff, isPartial: false })).toBeNull();
    });
});
