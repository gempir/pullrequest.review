import { refreshBitbucketOAuthToken } from "@/lib/bitbucket-oauth";
import { throwIfNotOk } from "@/lib/git-host/shared/http";
import { HostApiError, type PullRequestRef } from "@/lib/git-host/types";
import { type BitbucketAuthCredential, readBitbucketAuthCredential, writeBitbucketOAuthCredential } from "@/lib/storage";

export const API_BASE = "https://api.bitbucket.org/2.0";

type BitbucketOAuthCredential = Extract<BitbucketAuthCredential, { method: "oauth" }>;

export function repoUrl(ref: { workspace: string; repo: string }, suffix = "") {
    return `${API_BASE}/repositories/${ref.workspace}/${ref.repo}${suffix}`;
}

export function pullRequestUrl(prRef: PullRequestRef, suffix = "") {
    return repoUrl(prRef, `/pullrequests/${prRef.pullRequestId}${suffix}`);
}

export function readCredentials(): BitbucketAuthCredential | null {
    const stored = readBitbucketAuthCredential();
    if (!stored) return null;
    if (stored.method === "oauth") {
        const accessToken = stored.accessToken.trim();
        if (!accessToken) return null;
        return { ...stored, accessToken, refreshToken: stored.refreshToken?.trim() || undefined };
    }
    const email = stored.email.trim();
    const apiToken = stored.apiToken.trim();
    if (!email || !apiToken) return null;
    return { ...stored, email, apiToken };
}

export function basicAuthorization(email: string, apiToken: string) {
    let binary = "";
    for (const byte of new TextEncoder().encode(`${email}:${apiToken}`)) binary += String.fromCharCode(byte);
    return `Basic ${btoa(binary)}`;
}

const OAUTH_REFRESH_SKEW_MS = 30_000;

let oauthRefreshPromise: Promise<BitbucketOAuthCredential> | null = null;

function refreshOAuthCredentials(credentials: BitbucketOAuthCredential) {
    const { refreshToken } = credentials;
    if (!refreshToken) throw new Error("Bitbucket OAuth session expired. Sign in again to continue.");
    oauthRefreshPromise ??= refreshBitbucketOAuthToken(refreshToken)
        .then(async (tokens) => {
            const next = {
                host: "bitbucket",
                method: "oauth",
                ...tokens,
                refreshToken: tokens.refreshToken ?? refreshToken,
            } satisfies BitbucketOAuthCredential;
            await writeBitbucketOAuthCredential(next);
            return next;
        })
        .finally(() => {
            oauthRefreshPromise = null;
        });
    return oauthRefreshPromise;
}

async function authorization(forceOAuthRefresh: boolean) {
    const credentials = readCredentials();
    if (!credentials) throw new Error("Not authenticated");
    if (credentials.method === "apiToken") return basicAuthorization(credentials.email, credentials.apiToken);
    const expiring = typeof credentials.expiresAt === "number" && credentials.expiresAt <= Date.now() + OAUTH_REFRESH_SKEW_MS;
    const active = forceOAuthRefresh || expiring ? await refreshOAuthCredentials(credentials) : credentials;
    return `Bearer ${active.accessToken}`;
}

/** Fetches with an explicit Authorization header, used to verify credentials before storing them. */
export async function requestWith(url: string, authorizationHeader: string, init: RequestInit = {}, label = "Bitbucket API request") {
    const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { Accept: "application/json", ...(init.headers as Record<string, string>), Authorization: authorizationHeader },
    });
    return throwIfNotOk(response, label);
}

export async function request(url: string, init: RequestInit = {}) {
    try {
        return await requestWith(url, await authorization(false), init);
    } catch (error) {
        const credentials = readCredentials();
        const unauthorized = error instanceof HostApiError && error.status === 401;
        if (!unauthorized || credentials?.method !== "oauth" || !credentials.refreshToken) throw error;
        return requestWith(url, await authorization(true), init);
    }
}

export async function requestJson<T>(url: string, init?: RequestInit) {
    return (await (await request(url, init)).json()) as T;
}

export function sendJson(url: string, method: string, body?: unknown) {
    return request(url, {
        method,
        ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
}

/** Follows Bitbucket's `next` links until the last page or `limit` values. */
export async function fetchAllPages<T>(url: string, limit = Number.POSITIVE_INFINITY) {
    const values: T[] = [];
    let nextUrl: string | undefined = url;
    while (nextUrl && values.length < limit) {
        const page: { values?: T[]; next?: string } = await requestJson(nextUrl);
        values.push(...(page.values ?? []));
        nextUrl = page.next;
    }
    return values.slice(0, limit);
}
