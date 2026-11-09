import { afterEach, expect, test } from "bun:test";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { useReviewFileContexts } from "../src/features/review/hooks/use-review-file-contexts";
import { buttonByText, withDom } from "./support/dom";
import { mockFetch } from "./support/fetch-mock";

const prRef = { host: "github" as const, workspace: "acme", repo: "repo", pullRequestId: "1" };
const fileDiff = { name: "src/a.ts", type: "change" } as FileDiffMetadata;

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function Contexts() {
    const { fileContextStatus, readyFileContexts, loadFullFileContext } = useReviewFileContexts({ prRef, baseCommitHash: "base", headCommitHash: "head" });
    return (
        <>
            <button type="button" onClick={() => loadFullFileContext("src/a.ts", fileDiff)}>
                load
            </button>
            <output>{fileContextStatus["src/a.ts"]?.status ?? "idle"}</output>
            <pre>{readyFileContexts["src/a.ts"]?.newLines.join("")}</pre>
        </>
    );
}

test("retrying a failed full-file load fetches again", async () => {
    let failing = true;
    const mock = mockFetch({
        "/repos/acme/repo/contents/src/a.ts": ({ url }: { url: URL }) =>
            failing ? new Response("boom", { status: 500 }) : new Response(`${url.searchParams.get("ref")}\n`),
    });
    restore = mock.restore;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await withDom(async ({ container, render }) => {
        await render(
            <QueryClientProvider client={queryClient}>
                <Contexts />
            </QueryClientProvider>,
        );
        const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

        await act(async () => buttonByText(container, "load").click());
        await settle();
        expect(container.querySelector("output")?.textContent).toBe("error");

        failing = false;
        await act(async () => buttonByText(container, "load").click());
        await settle();
        expect(container.querySelector("output")?.textContent).toBe("ready");
        expect(container.querySelector("pre")?.textContent).toBe("head\n");
    });
});
