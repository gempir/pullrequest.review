import { describe, expect, test } from "bun:test";
import { isEditableShortcutTarget } from "../src/lib/shortcuts-context";

describe("shortcut editable target checks", () => {
  test("ignores input-like controls", () => {
    expect(isEditableShortcutTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableShortcutTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableShortcutTarget({ tagName: "SELECT" })).toBe(true);
  });

  test("ignores contentEditable targets", () => {
    expect(isEditableShortcutTarget({ isContentEditable: true })).toBe(true);
    expect(
      isEditableShortcutTarget({
        tagName: "SPAN",
        closest: (selector) =>
          selector === '[contenteditable="true"]' ? {} : null,
      }),
    ).toBe(true);
  });

  test("allows non-editable elements", () => {
    expect(
      isEditableShortcutTarget({
        tagName: "DIV",
        isContentEditable: false,
        closest: () => null,
      }),
    ).toBe(false);
    expect(isEditableShortcutTarget(null)).toBe(false);
  });
});
