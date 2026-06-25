import { describe, expect, test } from "bun:test";
import { buildPrCommentUrl, buildPrFileHash, clearableHashFromPath, parsePrFileHash, parsePrFileHashTarget } from "../src/lib/pr-file-hash";

describe("pull request file hashes", () => {
    test("round trips a file and comment target", () => {
        const hash = buildPrFileHash("src/example file.ts", 42);

        expect(hash).toBe("/src/example%20file.ts?comment=42");
        expect(parsePrFileHashTarget(`#${hash}`)).toEqual({
            path: "src/example file.ts",
            commentId: 42,
        });
        expect(parsePrFileHash(`#${hash}`)).toBe("src/example file.ts");
    });

    test("keeps existing file-only hashes compatible", () => {
        expect(parsePrFileHashTarget("#/src/example.ts")).toEqual({ path: "src/example.ts" });
        expect(clearableHashFromPath("src/example.ts")).toBe("/src/example.ts");
    });

    test("ignores invalid comment identifiers", () => {
        expect(parsePrFileHashTarget("#/src/example.ts?comment=invalid")).toEqual({ path: "src/example.ts" });
    });

    test("builds an absolute share URL without dropping route search params", () => {
        expect(
            buildPrCommentUrl(
                {
                    origin: "https://pullrequest.review",
                    pathname: "/workspace/repo/pull-requests/1",
                    search: "?from=abc&to=def",
                } as Location,
                "src/example.ts",
                42,
            ),
        ).toBe("https://pullrequest.review/workspace/repo/pull-requests/1?from=abc&to=def#/src/example.ts?comment=42");
    });
});
