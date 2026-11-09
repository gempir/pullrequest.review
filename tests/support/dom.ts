import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { act } from "react";

/** Renders into a fresh happy-dom window and restores globals afterwards. */
export async function withDom(run: (dom: { window: Window; container: HTMLElement; render: (node: ReactNode) => Promise<void> }) => Promise<void>) {
    const window = new Window({ url: "https://pullrequest.review/" });
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const element = window.document.createElement("div");
    window.document.body.append(element);
    const container = element as unknown as HTMLElement;
    const root = createRoot(container);
    try {
        await run({ window, container, render: (node) => act(async () => root.render(node)) });
    } finally {
        await act(async () => root.unmount());
        Object.assign(globalThis, { ...previous, IS_REACT_ACT_ENVIRONMENT: false });
        await window.happyDOM.close();
    }
}

export function buttonByText(container: HTMLElement, text: string) {
    const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === text);
    if (!button) throw new Error(`No "${text}" button`);
    return button;
}

/** Sets a textarea's value the way React's input tracking expects. */
export async function typeInto(window: Window, textarea: HTMLTextAreaElement, value: string) {
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
        setValue?.call(textarea, value);
        textarea.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event);
    });
}
