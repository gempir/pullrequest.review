import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { isRateLimitedError } from "../src/features/review/hooks/use-review-query";
import { pullRequestCriticalQuery, pullRequestDeferredQuery, repoPullRequestsQuery } from "../src/lib/git-host/queries";
import { HostApiError } from "../src/lib/git-host/types";

const prRef = { host: "github", workspace: "acme", repo: "ui", pullRequestId: "1" } as const;
const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("host queries", () => {
    test("scopes pull request queries by reference and stage", () => {
        expect(pullRequestCriticalQuery(prRef).queryKey).not.toEqual(pullRequestDeferredQuery(prRef).queryKey);
        expect(pullRequestCriticalQuery(prRef).queryKey).not.toEqual(pullRequestCriticalQuery({ ...prRef, pullRequestId: "2" }).queryKey);
    });

    test("keys repository pull requests independently of selection order", () => {
        const repo = (name: string) => ({ host: "github" as const, workspace: "acme", repo: name, fullName: `acme/${name}`, displayName: name });
        expect(repoPullRequestsQuery("github", [repo("a"), repo("b")]).queryKey).toEqual(repoPullRequestsQuery("github", [repo("b"), repo("a")]).queryKey);
    });

    test("surfaces a failed critical load as a rate limit error", async () => {
        globalThis.fetch = (async () => new Response("slow down", { status: 429, statusText: "Too Many Requests" })) as unknown as typeof fetch;
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const error = await client.fetchQuery(pullRequestCriticalQuery(prRef)).catch((caught) => caught);
        expect(error).toBeInstanceOf(HostApiError);
        expect(isRateLimitedError(error)).toBe(true);
    });

    test("does not treat other failures as rate limits", () => {
        expect(isRateLimitedError(new Error("network down"))).toBe(false);
        expect(isRateLimitedError(undefined)).toBe(false);
    });
});
