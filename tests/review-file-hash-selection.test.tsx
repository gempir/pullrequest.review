import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, useCallback, useRef, useState } from "react";
import { useReviewFileHashSelection, useReviewFileHashSync } from "../src/features/review/hooks/use-review-page-effects";
import type { PullRequestBundle } from "../src/lib/git-host/types";

const selectableFilePaths = new Set(["src/first.ts", "src/second.ts"]);
const settingsPathSet = new Set<string>();
const comment: PullRequestBundle["comments"][number] = {
    id: 1,
    content: { raw: "Review this" },
    inline: { path: "src/second.ts", to: 1 },
};

type SelectionProps = {
    comments: PullRequestBundle["comments"];
    commentsLoading: boolean;
    selectableFilePaths: Set<string>;
};

async function withSelection(
    hash: string,
    run: (harness: { window: Window; container: HTMLDivElement; render: (props?: Partial<SelectionProps>) => Promise<void> }) => Promise<void>,
) {
    const window = new Window({ url: `https://pullrequest.review/acme/repo/pull/1${hash}` });
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const container = window.document.createElement("div");
    window.document.body.append(container);
    const root = createRoot(container as unknown as HTMLElement);

    function Selection({ comments, commentsLoading, selectableFilePaths }: SelectionProps) {
        const [activeFile, setActiveFile] = useState<string>();
        const suppressHashSyncRef = useRef(false);
        const onHashPathResolved = useCallback(({ path }: { path: string }) => {
            suppressHashSyncRef.current = true;
            setActiveFile(path);
        }, []);
        useReviewFileHashSelection({ selectableFilePaths, comments, commentsLoading, onHashPathResolved });
        useReviewFileHashSync({
            activeFile,
            showSettingsPanel: false,
            settingsPathSet,
            selectableFilePaths,
            isFileSelectionReady: selectableFilePaths.size > 0,
            suppressHashSyncRef,
        });
        return (
            <button
                type="button"
                onClick={() => {
                    // All-mode scroll selection deliberately leaves the URL hash alone.
                    suppressHashSyncRef.current = true;
                    setActiveFile("src/second.ts");
                }}
            >
                {activeFile}
            </button>
        );
    }

    try {
        await run({
            window,
            container: container as unknown as HTMLDivElement,
            render: async (props = {}) => {
                await act(async () =>
                    root.render(<Selection comments={[comment]} commentsLoading={false} selectableFilePaths={selectableFilePaths} {...props} />),
                );
            },
        });
    } finally {
        await act(async () => root.unmount());
        Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: false });
        await window.happyDOM.close();
    }
}

test("refreshing comments preserves the file selected by scrolling in all mode", async () => {
    await withSelection("#/src/first.ts", async ({ window, container, render }) => {
        await render();
        expect(container.textContent).toBe("src/first.ts");
        const button = container.querySelector("button");
        if (!button) throw new Error("File selection did not render");
        await act(async () => button.click());
        expect(container.textContent).toBe("src/second.ts");
        expect(window.location.hash).toBe("#/src/first.ts");

        const refreshes = [
            [{ ...comment, resolution: { user: { displayName: "Reviewer" } } }],
            [comment, { id: 2, content: { raw: "Reply" }, parent: { id: 1 } }],
            [comment, { id: 3, content: { raw: "New comment" }, inline: { path: "src/second.ts", to: 2 } }],
        ];
        for (const comments of refreshes) {
            await render({ comments, selectableFilePaths: new Set(selectableFilePaths) });
            expect(container.textContent).toBe("src/second.ts");
        }

        // An explicit hash navigation can still select the original file.
        await act(async () => {
            window.history.replaceState(null, "", "#/src/first.ts");
            window.dispatchEvent(new window.HashChangeEvent("hashchange"));
        });
        expect(container.textContent).toBe("src/first.ts");
    });
});

test("file deep links wait for selectable paths", async () => {
    await withSelection("#/src/first.ts", async ({ container, render }) => {
        await render({ selectableFilePaths: new Set() });
        expect(container.textContent).toBe("");
        await render();
        expect(container.textContent).toBe("src/first.ts");
    });
});

test("comment deep links wait for comments and resolve replies through their parent", async () => {
    await withSelection("#comment-2", async ({ window, container, render }) => {
        await render({ comments: [], commentsLoading: true });
        expect(container.textContent).toBe("");
        await render({ comments: [comment, { id: 2, parent: { id: 1 }, content: { raw: "Reply" } }] });
        expect(container.textContent).toBe("src/second.ts");
        expect(window.location.hash).toBe("#/src/second.ts?comment=2");
    });
});
