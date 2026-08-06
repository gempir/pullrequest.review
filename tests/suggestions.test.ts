import { describe, expect, test } from "bun:test";
import { parsePatchFiles } from "@pierre/diffs";
import { bitbucketNormalization } from "../src/lib/git-host/providers/bitbucket/client";
import { buildSuggestions, formatSuggestion, getSuggestionKey, getSuggestionOriginalContents, parseSuggestionMarkdown } from "../src/lib/git-host/suggestions";

describe("pull request suggestions", () => {
    test("formats the known-good Bitbucket one-line suggestion payload", () => {
        const suggestions = buildSuggestions({
            host: "bitbucket",
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

    test("formats GitHub suggestions without the Bitbucket compatibility trailer", () => {
        expect(formatSuggestion("replacement\n", "github")).toBe("```suggestion\nreplacement\n```");
    });

    test("creates a range suggestion for a multi-line replacement", () => {
        const suggestions = buildSuggestions({
            host: "github",
            path: "src/example.ts",
            originalContents: "one\ntwo\nthree\nfour\n",
            editedContents: "one\nTWO\nTHREE\nfour\n",
        });

        expect(suggestions).toEqual([
            {
                content: "```suggestion\nTWO\nTHREE\n```",
                inline: {
                    path: "src/example.ts",
                    startTo: 2,
                    to: 3,
                },
            },
        ]);
    });

    test("splits a distant replacement and insertion into separate suggestions", () => {
        const suggestions = buildSuggestions({
            host: "github",
            path: "src/example.ts",
            originalContents: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n",
            editedContents: "ONE\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\n",
        });

        expect(suggestions).toEqual([
            {
                content: "```suggestion\nONE\n```",
                inline: { path: "src/example.ts", to: 1 },
            },
            {
                content: "```suggestion\nten\neleven\n```",
                inline: { path: "src/example.ts", to: 10 },
            },
        ]);
    });

    test("anchors file-start and middle insertions to neighboring source lines", () => {
        expect(
            buildSuggestions({
                host: "github",
                path: "src/example.ts",
                originalContents: "one\ntwo\n",
                editedContents: "zero\none\ntwo\n",
            }),
        ).toEqual([
            {
                content: "```suggestion\nzero\none\n```",
                inline: { path: "src/example.ts", to: 1 },
            },
        ]);

        expect(
            buildSuggestions({
                host: "github",
                path: "src/example.ts",
                originalContents: "one\ntwo\n",
                editedContents: "one\ninserted\ntwo\n",
            }),
        ).toEqual([
            {
                content: "```suggestion\none\ninserted\n```",
                inline: { path: "src/example.ts", to: 1 },
            },
        ]);
    });

    test("preserves source whitespace and uses a safe fence for code containing backticks", () => {
        expect(formatSuggestion("    const markdown = ` ``` `;\n", "bitbucket")).toBe("````suggestion\n    const markdown = ` ``` `;\n````\n\n‌");
    });

    test("creates an empty replacement suggestion when several lines are deleted", () => {
        expect(
            buildSuggestions({
                host: "github",
                path: "src/example.ts",
                originalContents: "one\ntwo\nthree\nfour\n",
                editedContents: "one\nfour\n",
            }),
        ).toEqual([
            {
                content: "```suggestion\n```",
                inline: { path: "src/example.ts", startTo: 2, to: 3 },
            },
        ]);
    });

    test("formats an empty Bitbucket replacement with its compatibility trailer", () => {
        const suggestion = formatSuggestion("", "bitbucket");
        expect(suggestion).toBe("```suggestion\n```\n\n‌");
        expect(parseSuggestionMarkdown(suggestion)).toBe("");
    });

    test("does not create a suggestion for an insertion into an empty file", () => {
        expect(
            buildSuggestions({
                host: "github",
                path: "src/example.ts",
                originalContents: "",
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
        const [suggestion] = buildSuggestions({
            host: "bitbucket",
            path: "src/example.ts",
            originalContents: "one\ntwo\n",
            editedContents: "one\nTWO\n",
        });

        expect(getSuggestionKey(suggestion)).toBe(JSON.stringify(["src/example.ts", 2, 2, "```suggestion\nTWO\n```\n\n‌"]));
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
