import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { CommentEditor } from "../src/components/comment-editor";
import { useInlineCommentDrafts } from "../src/features/review/hooks/use-inline-comment-drafts";
import { ensureStorageReady, readActiveInlineDraft, readInlineDraftContent, writeInlineDraftContent } from "../src/lib/storage";

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
        const { inlineDraft, openInlineDraft, setInlineDraftContent, discardInlineDraft } = useInlineCommentDrafts({ scopeId: scope, onRestore: noop });
        if (!inlineDraft) {
            return (
                <button type="button" onClick={() => openInlineDraft(draft)}>
                    Comment on line
                </button>
            );
        }
        return (
            <CommentEditor
                value={inlineDraft.content}
                placeholder="Add a line comment"
                onChange={setInlineDraftContent}
                onSubmit={() => discardInlineDraft(inlineDraft.location)}
            />
        );
    }

    try {
        await act(async () => root.render(<Editor />));
        const openDraft = async () => {
            await act(async () => container.querySelector("button")?.click());
            const textarea = container.querySelector("textarea");
            if (!textarea) throw new Error("Comment editor did not render");
            return textarea;
        };
        let textarea = await openDraft();
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

        // Submitting closes the draft and forgets its persisted text.
        await act(async () => {
            textarea.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
        });
        expect(container.querySelector("textarea")).toBeNull();
        expect(readInlineDraftContent(scope, draft)).toBe("");
        expect(readActiveInlineDraft(scope)).toBeNull();

        // Reopening starts empty, and deleting typed text must also clear storage.
        textarea = await openDraft();
        expect(textarea.value).toBe("");
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
        writeInlineDraftContent(scope, draft, "");
        Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: false });
        await window.happyDOM.close();
    }
});
