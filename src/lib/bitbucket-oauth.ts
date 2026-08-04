import type { BitbucketOAuthTokens } from "@/lib/git-host/types";

interface OAuthTokenPayload {
    accessToken?: unknown;
    refreshToken?: unknown;
    expiresAt?: unknown;
    returnTo?: unknown;
    error?: unknown;
}

export interface BitbucketOAuthExchangeResult extends BitbucketOAuthTokens {
    returnTo: string;
}

function oauthErrorMessage(payload: OAuthTokenPayload, fallback: string) {
    return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

function safeReturnTo(value: unknown) {
    if (typeof value !== "string") return "/";
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname.startsWith("/oauth/callback")) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
}

async function readOAuthResponse(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => ({}))) as OAuthTokenPayload;
    if (!response.ok) {
        throw new Error(oauthErrorMessage(payload, fallback));
    }
    if (typeof payload.accessToken !== "string" || !payload.accessToken.trim()) {
        throw new Error("Bitbucket OAuth returned an invalid access token");
    }
    return payload;
}

export function startBitbucketOAuth(returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    const url = new URL("/api/auth/bitbucket/start", window.location.origin);
    url.searchParams.set("return_to", returnTo.startsWith("/api/auth/bitbucket/") ? "/" : returnTo);
    window.location.assign(url);
}

export async function exchangeBitbucketOAuthCode(data: { code: string; state: string }): Promise<BitbucketOAuthExchangeResult> {
    const response = await fetch("/api/auth/bitbucket/exchange", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const payload = await readOAuthResponse(response, "Bitbucket OAuth code exchange failed");

    return {
        accessToken: payload.accessToken as string,
        refreshToken: typeof payload.refreshToken === "string" ? payload.refreshToken : undefined,
        expiresAt: typeof payload.expiresAt === "number" ? payload.expiresAt : undefined,
        returnTo: safeReturnTo(payload.returnTo),
    };
}

export async function refreshBitbucketOAuthToken(refreshToken: string): Promise<BitbucketOAuthTokens> {
    const response = await fetch("/api/auth/bitbucket/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    });
    const payload = await readOAuthResponse(response, "Bitbucket OAuth token refresh failed");

    return {
        accessToken: payload.accessToken as string,
        refreshToken: typeof payload.refreshToken === "string" ? payload.refreshToken : refreshToken,
        expiresAt: typeof payload.expiresAt === "number" ? payload.expiresAt : undefined,
    };
}
