import { refreshBitbucketOAuthToken } from "@/lib/bitbucket-oauth";
import { parseFailureBody } from "@/lib/git-host/shared/http";
import { HostApiError } from "@/lib/git-host/types";
import {
    type BitbucketAuthCredential,
    clearBitbucketAuthCredential,
    readBitbucketAuthCredential,
    writeBitbucketAuthCredential,
    writeBitbucketOAuthCredential,
} from "@/lib/storage";

export type BitbucketOAuthCredential = Extract<BitbucketAuthCredential, { method: "oauth" }>;

export function readCredentials(): BitbucketAuthCredential | null {
    const stored = readBitbucketAuthCredential();
    if (!stored) return null;
    if (stored.method === "oauth") {
        const accessToken = stored.accessToken.trim();
        if (!accessToken) return null;
        return {
            ...stored,
            accessToken,
            refreshToken: stored.refreshToken?.trim() || undefined,
        };
    }

    const email = stored.email.trim();
    const apiToken = stored.apiToken.trim();
    if (!email || !apiToken) return null;
    return { ...stored, email, apiToken };
}

export async function writeApiTokenCredentials(credentials: { email: string; apiToken: string }) {
    await writeBitbucketAuthCredential(credentials);
}

export function clearCredentials() {
    clearBitbucketAuthCredential();
}

export function encodeBasicAuth(email: string, apiToken: string) {
    const raw = `${email}:${apiToken}`;
    const bytes = new TextEncoder().encode(raw);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

const OAUTH_REFRESH_SKEW_MS = 30_000;

let oauthRefreshPromise: Promise<BitbucketOAuthCredential> | null = null;

async function refreshOAuthCredentials(credentials: BitbucketOAuthCredential) {
    if (!credentials.refreshToken) {
        throw new Error("Bitbucket OAuth session expired. Sign in again to continue.");
    }
    if (oauthRefreshPromise) return oauthRefreshPromise;

    const refreshPromise = refreshBitbucketOAuthToken(credentials.refreshToken)
        .then(async (tokens) => {
            const nextCredentials = {
                host: "bitbucket",
                method: "oauth",
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken ?? credentials.refreshToken,
                ...(typeof tokens.expiresAt === "number" ? { expiresAt: tokens.expiresAt } : {}),
            } satisfies BitbucketOAuthCredential;
            await writeBitbucketOAuthCredential(nextCredentials);
            return nextCredentials;
        })
        .finally(() => {
            oauthRefreshPromise = null;
        });
    oauthRefreshPromise = refreshPromise;
    return refreshPromise;
}

async function authHeaderOrThrow(forceOAuthRefresh = false) {
    const credentials = readCredentials();
    if (!credentials) throw new Error("Not authenticated");
    if (credentials.method === "apiToken") {
        return `Basic ${encodeBasicAuth(credentials.email, credentials.apiToken)}`;
    }

    const shouldRefresh = forceOAuthRefresh || (typeof credentials.expiresAt === "number" && credentials.expiresAt <= Date.now() + OAUTH_REFRESH_SKEW_MS);
    const activeCredentials = shouldRefresh ? await refreshOAuthCredentials(credentials) : credentials;
    return `Bearer ${activeCredentials.accessToken}`;
}

export async function request(url: string, init: RequestInit = {}) {
    const requestWithAuth = async (forceOAuthRefresh = false) => {
        const headers: Record<string, string> = {
            Authorization: await authHeaderOrThrow(forceOAuthRefresh),
            ...(init.headers as Record<string, string>),
        };
        return fetch(url, { ...init, cache: "no-store", headers });
    };

    let response = await requestWithAuth();
    const credentials = readCredentials();
    if (response.status === 401 && credentials?.method === "oauth" && credentials.refreshToken) {
        response = await requestWithAuth(true);
    }
    if (!response.ok) {
        const body = await parseFailureBody(response);
        throw new HostApiError(`Bitbucket API request failed (${response.status} ${response.statusText})`, {
            status: response.status,
            statusText: response.statusText,
            body,
        });
    }
    return response;
}
