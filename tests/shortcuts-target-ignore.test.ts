import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { isEditableShortcutEvent, isEditableShortcutTarget } from "../src/lib/shortcuts-target";

const { document } = new Window();

function element(html: string, selector: string) {
    const root = document.createElement("div");
    root.innerHTML = html;
    const found = root.querySelector(selector);
    if (!found) throw new Error(`No ${selector} in ${html}`);
    return found as unknown as EventTarget;
}

describe("shortcut editable target checks", () => {
    test("treats form fields as editable", () => {
        for (const html of ["<input />", "<textarea></textarea>", "<select></select>"]) {
            expect(isEditableShortcutTarget(element(html, "input, textarea, select"))).toBe(true);
        }
    });

    test("treats text inside a contenteditable region as editable", () => {
        expect(isEditableShortcutTarget(element('<div contenteditable="true"><span>text</span></div>', "span"))).toBe(true);
    });

    test("leaves ordinary elements and missing targets alone", () => {
        expect(isEditableShortcutTarget(element("<div><span>text</span></div>", "span"))).toBe(false);
        expect(isEditableShortcutTarget(element("<button>go</button>", "button"))).toBe(false);
        expect(isEditableShortcutTarget(null)).toBe(false);
    });

    test("finds an editable control inside a shadow DOM event path", () => {
        const host = element("<pierre-file-tree></pierre-file-tree>", "pierre-file-tree");
        const input = element("<input />", "input");
        expect(isEditableShortcutEvent({ target: host, composedPath: () => [input, host] } as unknown as KeyboardEvent)).toBe(true);
    });
});
