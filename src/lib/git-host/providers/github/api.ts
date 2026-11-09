import { throwIfNotOk } from "@/lib/git-host/shared/http";
import type { PullRequestRef } from "@/lib/git-host/types";
import { readGithubAuthCredential } from "@/lib/storage";

const API_BASE = "https://api.github.com";
const API_HEADERS = { Accept: "application/vnd.github.full+json", "X-GitHub-Api-Version": "2022-11-28" };

export function repoPath(ref: { workspace: string; repo: string }, suffix = "") {
    return `/repos/${ref.workspace}/${ref.repo}${suffix}`;
}

export function pullPath(prRef: PullRequestRef, suffix = "") {
    return repoPath(prRef, `/pulls/${prRef.pullRequestId}${suffix}`);
}

export function issuePath(prRef: PullRequestRef, suffix = "") {
    return repoPath(prRef, `/issues/${prRef.pullRequestId}${suffix}`);
}

export function readToken() {
    return readGithubAuthCredential()?.token.trim() || null;
}

/** Fetches with an explicit token, used to verify a token before storing it. */
export async function requestWith(path: string, token: string | null, init: RequestInit = {}, label = "GitHub API request") {
    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        cache: "no-store",
        headers: { ...API_HEADERS, ...(init.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return throwIfNotOk(response, label);
}

export function request(path: string, init?: RequestInit) {
    return requestWith(path, readToken(), init);
}

/** For writes: fails before the request when there is no token. */
export function authedRequest(path: string, init?: RequestInit) {
    const token = readToken();
    if (!token) throw new Error("Not authenticated");
    return requestWith(path, token, init);
}

export async function requestJson<T>(path: string, init?: RequestInit) {
    return (await (await request(path, init)).json()) as T;
}

export async function sendJson(path: string, method: string, body: unknown) {
    await authedRequest(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function graphql<T>(query: string, variables: Record<string, unknown>) {
    const response = await authedRequest("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
    const firstError = payload.errors?.[0]?.message;
    if (firstError) throw new Error(firstError);
    return payload.data;
}

/** Follows page numbers until a short page or `limit` values. */
export async function fetchAllPages<T>(path: string, limit = Number.POSITIVE_INFINITY) {
    const connector = path.includes("?") ? "&" : "?";
    const values: T[] = [];
    for (let page = 1; values.length < limit; page += 1) {
        const current = await requestJson<T[]>(`${path}${connector}per_page=100&page=${page}`);
        values.push(...current);
        if (current.length < 100) break;
    }
    return values.slice(0, limit);
}
