import { describe, expect, test } from "bun:test";
import {
    clearBitbucketAuthCredential,
    ensureDataCollectionsReady,
    readBitbucketAuthCredential,
    writeBitbucketAuthCredential,
    writeBitbucketOAuthCredential,
} from "../src/lib/data/query-collections";
import { bitbucketClient } from "../src/lib/git-host/providers/bitbucket";

const originalFetch = globalThis.fetch;

describe("Bitbucket client authentication methods", () => {
    test("preserves API-token authentication", async () => {
        await ensureDataCollectionsReady();
        clearBitbucketAuthCredential();
        await writeBitbucketAuthCredential({ email: "user@example.com", apiToken: "api-token" });

        expect(readBitbucketAuthCredential()).toEqual({
            host: "bitbucket",
            method: "apiToken",
            email: "user@example.com",
            apiToken: "api-token",
        });
        expect(await bitbucketClient.getAuthState()).toEqual({ authenticated: true });
        clearBitbucketAuthCredential();
    });

    test("uses an OAuth access token directly for Bitbucket API traffic", async () => {
        await ensureDataCollectionsReady();
        clearBitbucketAuthCredential();
        await writeBitbucketOAuthCredential({ accessToken: "oauth-access", refreshToken: "oauth-refresh", expiresAt: Date.now() + 60_000 });
        let authorization = "";
        globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
            authorization = new Headers(init?.headers).get("Authorization") ?? "";
            return Response.json({ values: [] });
        }) as typeof fetch;

        try {
            expect(await bitbucketClient.listRepositories()).toEqual([]);
            expect(authorization).toBe("Bearer oauth-access");
        } finally {
            globalThis.fetch = originalFetch;
            clearBitbucketAuthCredential();
        }
    });

    test("refreshes an expired OAuth token and stores the rotated refresh token", async () => {
        await ensureDataCollectionsReady();
        clearBitbucketAuthCredential();
        await writeBitbucketOAuthCredential({ accessToken: "expired-access", refreshToken: "old-refresh", expiresAt: Date.now() - 1 });
        const requestedUrls: string[] = [];
        let apiAuthorization = "";

        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            requestedUrls.push(url);
            if (url === "/api/auth/bitbucket/refresh") {
                return Response.json({ accessToken: "fresh-access", refreshToken: "rotated-refresh", expiresAt: Date.now() + 3_600_000 });
            }
            apiAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
            return Response.json({ values: [] });
        }) as typeof fetch;

        try {
            expect(await bitbucketClient.listRepositories()).toEqual([]);
            expect(requestedUrls[0]).toBe("/api/auth/bitbucket/refresh");
            expect(apiAuthorization).toBe("Bearer fresh-access");
            const stored = readBitbucketAuthCredential();
            expect(stored?.method).toBe("oauth");
            expect(stored && "accessToken" in stored ? stored.accessToken : undefined).toBe("fresh-access");
            expect(stored && "refreshToken" in stored ? stored.refreshToken : undefined).toBe("rotated-refresh");
        } finally {
            globalThis.fetch = originalFetch;
            clearBitbucketAuthCredential();
        }
    });
});
