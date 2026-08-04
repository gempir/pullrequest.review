export interface BitbucketOAuthEnv {
    BITBUCKET_OAUTH_CLIENT_ID?: string;
    BITBUCKET_OAUTH_CLIENT_SECRET?: string;
}

interface WorkerEnv extends BitbucketOAuthEnv {
    ASSETS: {
        fetch(request: Request): Promise<Response>;
    };
}

interface BitbucketTokenResponse {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
}

interface OAuthStateCookie {
    state: string;
    returnTo: string;
}

const AUTHORIZE_URL = "https://bitbucket.org/site/oauth2/authorize";
const ACCESS_TOKEN_URL = "https://bitbucket.org/site/oauth2/access_token";
const OAUTH_CALLBACK_PATH = "/oauth/callback";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
    return Response.json(body, {
        status,
        headers: {
            "Cache-Control": "no-store",
            ...headers,
        },
    });
}

function getStateCookieName(url: URL) {
    return url.protocol === "https:" ? "__Host-pr_bitbucket_oauth_state" : "pr_bitbucket_oauth_state";
}

function bytesToBase64Url(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function stringToBase64Url(value: string) {
    return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string) {
    const base64 = value
        .replaceAll("-", "+")
        .replaceAll("_", "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function createState() {
    return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function sanitizeReturnTo(value: string | null) {
    if (!value || value.length > 2048) return "/";
    const validationOrigin = "https://return-to.invalid";
    const parsed = new URL(value, validationOrigin);
    if (parsed.origin !== validationOrigin || parsed.pathname.startsWith(OAUTH_CALLBACK_PATH)) {
        return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function encodeStateCookie(data: OAuthStateCookie) {
    return stringToBase64Url(JSON.stringify(data));
}

function parseCookieHeader(cookieHeader: string | null, name: string) {
    if (!cookieHeader) return null;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`, "u"))?.[1]?.trim() ?? null;
}

function decodeStateCookie(rawValue: string | null): OAuthStateCookie | null {
    if (!rawValue) return null;
    try {
        const parsed = JSON.parse(base64UrlToString(rawValue)) as Record<string, unknown>;
        if (typeof parsed.state !== "string" || typeof parsed.returnTo !== "string") return null;
        return { state: parsed.state, returnTo: sanitizeReturnTo(parsed.returnTo) };
    } catch {
        return null;
    }
}

function stateCookieHeader(url: URL, value: string, maxAge: number) {
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return `${getStateCookieName(url)}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function requireOAuthConfiguration(env: BitbucketOAuthEnv) {
    const clientId = env.BITBUCKET_OAUTH_CLIENT_ID?.trim();
    const clientSecret = env.BITBUCKET_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

function encodeBasicAuth(clientId: string, clientSecret: string) {
    return btoa(`${clientId}:${clientSecret}`);
}

async function readJsonObject(request: Request) {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) return null;
    try {
        const value = (await request.json()) as unknown;
        return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function isSameOriginRequest(request: Request, url: URL) {
    return request.headers.get("Origin") === url.origin;
}

async function requestBitbucketToken(config: { clientId: string; clientSecret: string }, body: URLSearchParams) {
    const response = await fetch(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body,
    });
    const payload = (await response.json().catch(() => ({}))) as BitbucketTokenResponse;
    if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token.trim()) {
        throw new Error(`Bitbucket rejected the OAuth token request (${response.status})`);
    }

    const expiresIn = typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in) ? payload.expires_in : undefined;
    return {
        accessToken: payload.access_token,
        refreshToken: typeof payload.refresh_token === "string" && payload.refresh_token.trim() ? payload.refresh_token : undefined,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
}

function handleOAuthStart(request: Request, env: BitbucketOAuthEnv, url: URL) {
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "GET" });
    const config = requireOAuthConfiguration(env);
    if (!config) {
        const callbackUrl = new URL(OAUTH_CALLBACK_PATH, url.origin);
        callbackUrl.searchParams.set("error", "Bitbucket OAuth is not configured for this environment");
        return new Response(null, {
            status: 302,
            headers: {
                Location: callbackUrl.toString(),
                "Cache-Control": "no-store",
            },
        });
    }

    const stateData = {
        state: createState(),
        returnTo: sanitizeReturnTo(url.searchParams.get("return_to")),
    } satisfies OAuthStateCookie;
    const callbackUrl = new URL(OAUTH_CALLBACK_PATH, url.origin);
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
    authorizeUrl.searchParams.set("state", stateData.state);

    return new Response(null, {
        status: 302,
        headers: {
            Location: authorizeUrl.toString(),
            "Cache-Control": "no-store",
            "Set-Cookie": stateCookieHeader(url, encodeStateCookie(stateData), STATE_COOKIE_MAX_AGE_SECONDS),
        },
    });
}

async function handleOAuthExchange(request: Request, env: BitbucketOAuthEnv, url: URL) {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
    if (!isSameOriginRequest(request, url)) return jsonResponse({ error: "Invalid request origin" }, 403);
    const config = requireOAuthConfiguration(env);
    if (!config) return jsonResponse({ error: "Bitbucket OAuth is not configured for this environment" }, 503);

    const cookieName = getStateCookieName(url);
    const stateCookie = decodeStateCookie(parseCookieHeader(request.headers.get("Cookie"), cookieName));
    const clearStateCookie = stateCookieHeader(url, "", 0);
    const body = await readJsonObject(request);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const state = typeof body?.state === "string" ? body.state.trim() : "";
    if (!stateCookie || !code || code.length > 4096 || !state || state.length > 256 || stateCookie.state !== state) {
        return jsonResponse({ error: "Bitbucket OAuth state is invalid or expired. Please try again." }, 400, { "Set-Cookie": clearStateCookie });
    }

    try {
        const callbackUrl = new URL(OAUTH_CALLBACK_PATH, url.origin);
        const tokens = await requestBitbucketToken(
            config,
            new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: callbackUrl.toString(),
            }),
        );
        return jsonResponse({ ...tokens, returnTo: stateCookie.returnTo }, 200, { "Set-Cookie": clearStateCookie });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Bitbucket OAuth code exchange failed";
        return jsonResponse({ error: message }, 502, { "Set-Cookie": clearStateCookie });
    }
}

async function handleOAuthRefresh(request: Request, env: BitbucketOAuthEnv, url: URL) {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
    if (!isSameOriginRequest(request, url)) return jsonResponse({ error: "Invalid request origin" }, 403);
    const config = requireOAuthConfiguration(env);
    if (!config) return jsonResponse({ error: "Bitbucket OAuth is not configured for this environment" }, 503);

    const body = await readJsonObject(request);
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
    if (!refreshToken || refreshToken.length > 8192) return jsonResponse({ error: "A valid Bitbucket refresh token is required" }, 400);

    try {
        const tokens = await requestBitbucketToken(config, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
        return jsonResponse(tokens);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Bitbucket OAuth token refresh failed";
        return jsonResponse({ error: message }, 502);
    }
}

export async function handleBitbucketOAuthRequest(request: Request, env: BitbucketOAuthEnv) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/bitbucket/start") return handleOAuthStart(request, env, url);
    if (url.pathname === "/api/auth/bitbucket/exchange") return handleOAuthExchange(request, env, url);
    if (url.pathname === "/api/auth/bitbucket/refresh") return handleOAuthRefresh(request, env, url);
    return null;
}

export const worker = {
    async fetch(request: Request, env: WorkerEnv) {
        const oauthResponse = await handleBitbucketOAuthRequest(request, env);
        if (oauthResponse) return oauthResponse;
        if (new URL(request.url).pathname.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
        return env.ASSETS.fetch(request);
    },
};

export default worker;
