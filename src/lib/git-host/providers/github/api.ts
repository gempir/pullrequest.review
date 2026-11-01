import { parseFailureBody } from "@/lib/git-host/shared/http";
import { collectPaginated } from "@/lib/git-host/shared/pagination";
import { HostApiError } from "@/lib/git-host/types";
import { clearGithubAuthCredential, readGithubAuthCredential, writeGithubAuthCredential } from "@/lib/storage";

export const API_BASE = "https://api.github.com";

export interface GithubAuth {
    token: string;
}

export function readAuth() {
    const token = readGithubAuthCredential()?.token.trim();
    return token ? { token } : null;
}

export async function writeAuth(auth: GithubAuth) {
    await writeGithubAuthCredential(auth);
}

export function clearAuth() {
    clearGithubAuthCredential();
}

export function authHeader() {
    const auth = readAuth();
    if (!auth?.token) return null;
    return `Bearer ${auth.token}`;
}

export async function request(path: string, init: RequestInit = {}, options: { requireAuth?: boolean } = {}) {
    const authorization = authHeader();
    if (options.requireAuth && !authorization) {
        throw new Error("Not authenticated");
    }

    const headers: Record<string, string> = {
        Accept: "application/vnd.github.full+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers as Record<string, string>),
    };
    if (authorization) {
        headers.Authorization = authorization;
    }

    const response = await fetch(path.startsWith("http") ? path : `${API_BASE}${path}`, {
        ...init,
        cache: "no-store",
        headers,
    });

    if (!response.ok) {
        const body = await parseFailureBody(response);
        throw new HostApiError(`GitHub API request failed (${response.status} ${response.statusText})`, {
            status: response.status,
            statusText: response.statusText,
            body,
        });
    }

    return response;
}

export async function listPaginated<T>(path: string) {
    return collectPaginated(async (page) => {
        const connector = path.includes("?") ? "&" : "?";
        const res = await request(`${path}${connector}per_page=100&page=${page}`);
        return (await res.json()) as T[];
    });
}
