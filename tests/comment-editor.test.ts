import { describe, expect, test } from "bun:test";
import { COMMENT_MARKDOWN_ACTIONS } from "../src/lib/comment-markdown-actions";

describe("comment editor markdown actions", () => {
    test("wraps the selection so formatting reaches the submitted comment", () => {
        expect(COMMENT_MARKDOWN_ACTIONS.bold({ value: "make this bold", start: 5, end: 9 }).text).toBe("make **this** bold");
        expect(COMMENT_MARKDOWN_ACTIONS.italic({ value: "word", start: 0, end: 4 }).text).toBe("_word_");
        expect(COMMENT_MARKDOWN_ACTIONS.code({ value: "run foo", start: 4, end: 7 }).text).toBe("run `foo`");
    });

    test("uses a placeholder and selects it when nothing is selected", () => {
        const edit = COMMENT_MARKDOWN_ACTIONS.link({ value: "", start: 0, end: 0 });
        expect(edit.text).toBe("[link text](https://)");
        expect(edit.text.slice(edit.cursorStart, edit.cursorEnd)).toBe("link text");
    });

    test("prefixes every selected line", () => {
        expect(COMMENT_MARKDOWN_ACTIONS.list({ value: "a\nb", start: 0, end: 3 }).text).toBe("- a\n- b");
        expect(COMMENT_MARKDOWN_ACTIONS.quote({ value: "keep\nquote me", start: 8, end: 10 }).text).toBe("keep\n> quote me");
    });

    test("wraps a selection in a suggestion block", () => {
        expect(COMMENT_MARKDOWN_ACTIONS.suggestion({ value: "next()", start: 0, end: 6 }).text).toBe("```suggestion\nnext()\n```");
    });
});
