import { describe, expect, test } from "bun:test";
import { inlineDraftStorageKey } from "../src/components/pull-request-review/use-inline-drafts";

describe("inline draft storage keys", () => {
    test("builds stable keys with escaped file paths", () => {
        const key = inlineDraftStorageKey("workspace", "repo", "42", {
            side: "additions",
            line: 17,
            path: "src/file with spaces.ts",
        });

        expect(key).toBe("inline_comment_draft:v1:workspace/repo/42:additions:17:src%2Ffile%20with%20spaces.ts");
    });
});
