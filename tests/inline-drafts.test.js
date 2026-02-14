import { describe, expect, test } from "bun:test";
import {
  inlineDraftStorageKey,
  parseInlineDraftStorageKey,
} from "../src/components/pull-request-review/use-inline-drafts";

describe("inline draft storage keys", () => {
  test("parses valid keys", () => {
    const key = inlineDraftStorageKey("workspace", "repo", "42", {
      side: "additions",
      line: 17,
      path: "src/file.ts",
    });

    expect(parseInlineDraftStorageKey(key, "workspace", "repo", "42")).toEqual({
      side: "additions",
      line: 17,
      path: "src/file.ts",
    });
  });

  test("guards malformed URI sequences", () => {
    const malformedKey =
      "pr_review_inline_comment_draft:v2:workspace/repo/42:additions:17:%E0%A4%A";

    expect(
      parseInlineDraftStorageKey(malformedKey, "workspace", "repo", "42"),
    ).toBeNull();
  });
});
