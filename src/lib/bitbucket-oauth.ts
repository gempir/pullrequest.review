import { BITBUCKET_OAUTH_PATHS } from "@/lib/bitbucket-oauth-paths";
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

/** Defense in depth: never follow a worker-supplied return path off this origin. */
function safeReturnTo(value: unknown) {
    if (typeof value !== "string") return "/";
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname.startsWith(BITBUCKET_OAUTH_PATHS.callback)) return "/";
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

/** Sends the browser through Bitbucket's consent screen; the worker brings it back to the current page. */
export function startBitbucketOAuth() {
    const url = new URL(BITBUCKET_OAUTH_PATHS.start, window.location.origin);
    url.searchParams.set("return_to", `${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.location.assign(url);
}

export async function exchangeBitbucketOAuthCode(data: { code: string; state: string }): Promise<BitbucketOAuthExchangeResult> {
    const response = await fetch(BITBUCKET_OAUTH_PATHS.exchange, {
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
    const response = await fetch(BITBUCKET_OAUTH_PATHS.refresh, {
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
