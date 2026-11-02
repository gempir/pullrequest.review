import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { CommentEditor } from "../src/components/comment-editor";
import { useInlineCommentDrafts } from "../src/features/review/hooks/use-inline-comment-drafts";
import { clearInlineDraftContent, ensureStorageReady, readActiveInlineDraft, readInlineDraftContent } from "../src/lib/storage";

test("inline comment typing updates the controlled editor and persists the complete draft", async () => {
    await ensureStorageReady();
    const window = new Window();
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const container = window.document.createElement("div");
    window.document.body.append(container);
    const root = createRoot(container as unknown as HTMLElement);
    const workspace = `test-input-${crypto.randomUUID()}`;
    const scope = `${workspace}/repo/1`;
    const draft = { path: "src/example.ts", line: 3, side: "additions" } as const;
    const noop = () => {};

    function Editor() {
        const { getInlineDraftContent, setInlineDraftContent, clearInlineDraftContent } = useInlineCommentDrafts({
            workspace,
            repo: "repo",
            pullRequestId: "1",
            setActiveFile: noop,
            setViewMode: noop,
        });
        return (
            <CommentEditor
                value={getInlineDraftContent(draft)}
                placeholder="Add a line comment"
                onChange={(value) => setInlineDraftContent(draft, value)}
                onSubmit={() => clearInlineDraftContent(draft)}
            />
        );
    }

    try {
        await act(async () => root.render(<Editor />));
        const textarea = container.querySelector("textarea");
        if (!textarea) throw new Error("Comment editor did not render");
        const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (!setValue) throw new Error("Textarea has no value setter");
        textarea.focus();
        const type = async (text: string) => {
            for (const character of text) {
                await act(async () => {
                    setValue.call(textarea, textarea.value + character);
                    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
                });
            }
        };
        await type("  ");
        expect(textarea.value).toBe("  ");
        await type("hello world");
        expect(textarea.value).toBe("  hello world");
        expect(readInlineDraftContent(scope, draft)).toBe("  hello world");
        expect(readActiveInlineDraft(scope)).toEqual(draft);

        // Submitting clears both the rendered value and the persisted draft.
        await act(async () => {
            textarea.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
        });
        expect(textarea.value).toBe("");
        expect(readInlineDraftContent(scope, draft)).toBe("");
        expect(readActiveInlineDraft(scope)).toBeNull();

        // Starting another comment and deleting its text must also clear storage.
        await type("next comment");
        await act(async () => {
            setValue.call(textarea, "");
            textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
        expect(textarea.value).toBe("");
        expect(readInlineDraftContent(scope, draft)).toBe("");
        expect(readActiveInlineDraft(scope)).toBeNull();
    } finally {
        await act(async () => root.unmount());
        clearInlineDraftContent(scope, draft);
        Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: false });
        await window.happyDOM.close();
    }
});
