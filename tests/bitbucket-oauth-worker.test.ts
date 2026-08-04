import { describe, expect, test } from "bun:test";
import { worker } from "../src/worker";

const workerEnv = {
    ASSETS: {
        fetch: async () => new Response("asset"),
    },
    BITBUCKET_OAUTH_CLIENT_ID: "test-client-id",
    BITBUCKET_OAUTH_CLIENT_SECRET: "test-client-secret",
};

function oauthStartRequest(returnTo = "/acme/repo/pull-requests/42") {
    return new Request(`https://pullrequest.review/api/auth/bitbucket/start?return_to=${encodeURIComponent(returnTo)}`);
}

describe("Bitbucket OAuth worker", () => {
    test("starts authorization with a protected state cookie and safe return path", async () => {
        const response = await worker.fetch(oauthStartRequest(), workerEnv);
        const location = new URL(response.headers.get("location") ?? "");
        const cookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(302);
        expect(location.origin).toBe("https://bitbucket.org");
        expect(location.pathname).toBe("/site/oauth2/authorize");
        expect(location.searchParams.get("client_id")).toBe("test-client-id");
        expect(location.searchParams.get("response_type")).toBe("code");
        expect(location.searchParams.get("redirect_uri")).toBe("https://pullrequest.review/oauth/callback");
        expect((location.searchParams.get("state")?.length ?? 0) > 30).toBe(true);
        expect(cookie).toContain("__Host-pr_bitbucket_oauth_state=");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Lax");
        expect(cookie).toContain("Secure");
    });

    test("exchanges a valid callback code and returns the original app path", async () => {
        const startResponse = await worker.fetch(oauthStartRequest(), workerEnv);
        const authorizeUrl = new URL(startResponse.headers.get("location") ?? "");
        const state = authorizeUrl.searchParams.get("state") ?? "";
        const cookie = (startResponse.headers.get("set-cookie") ?? "").split(";", 1)[0];
        const originalFetch = globalThis.fetch;
        let tokenRequestBody = "";

        globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
            tokenRequestBody = String(init?.body ?? "");
            return Response.json({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });
        }) as typeof fetch;

        try {
            const response = await worker.fetch(
                new Request("https://pullrequest.review/api/auth/bitbucket/exchange", {
                    method: "POST",
                    headers: {
                        Origin: "https://pullrequest.review",
                        Cookie: cookie,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ code: "authorization-code", state }),
                }),
                workerEnv,
            );
            const payload = (await response.json()) as Record<string, unknown>;

            expect(response.status).toBe(200);
            expect(payload.accessToken).toBe("access-token");
            expect(payload.refreshToken).toBe("refresh-token");
            expect(payload.returnTo).toBe("/acme/repo/pull-requests/42");
            expect(tokenRequestBody).toContain("grant_type=authorization_code");
            expect(tokenRequestBody).toContain("code=authorization-code");
            expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects callback exchange from another origin", async () => {
        const response = await worker.fetch(
            new Request("https://pullrequest.review/api/auth/bitbucket/exchange", {
                method: "POST",
                headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
                body: JSON.stringify({ code: "code", state: "state" }),
            }),
            workerEnv,
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "Invalid request origin" });
    });

    test("does not allow an external return URL", async () => {
        const response = await worker.fetch(oauthStartRequest("//attacker.example/path"), workerEnv);
        const cookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(302);
        expect(cookie.includes("attacker.example")).toBe(false);
    });

    test("does not allow a backslash-normalized external return URL", async () => {
        const response = await worker.fetch(oauthStartRequest("/\\attacker.example/path"), workerEnv);
        const cookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(302);
        expect(cookie.includes("attacker.example")).toBe(false);
    });
});
