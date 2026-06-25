import { PR_SUMMARY_PATH } from "@/lib/pr-summary";

const PR_FILE_HASH_PREFIX = "/";

export type PrFileHashTarget = {
    path: string;
    commentId?: number;
};

function parseCommentId(value: string | null) {
    if (!value || !/^\d+$/.test(value)) return undefined;
    const commentId = Number(value);
    return Number.isSafeInteger(commentId) && commentId > 0 ? commentId : undefined;
}

export function buildPrFileHash(path: string, commentId?: number): string {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const hash = `${PR_FILE_HASH_PREFIX}${encodedPath}`;
    return typeof commentId === "number" ? `${hash}?comment=${commentId}` : hash;
}

export function buildPrCommentUrl(location: Pick<Location, "origin" | "pathname" | "search">, path: string, commentId: number) {
    return `${location.origin}${location.pathname}${location.search}#${buildPrFileHash(path, commentId)}`;
}

export function parsePrFileHashTarget(rawHash: string): PrFileHashTarget | null {
    const normalized = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
    if (!normalized.startsWith(PR_FILE_HASH_PREFIX)) return null;
    const queryIndex = normalized.indexOf("?");
    const encodedPath = normalized.slice(PR_FILE_HASH_PREFIX.length, queryIndex >= 0 ? queryIndex : undefined);
    if (!encodedPath) return null;
    let path: string;
    try {
        path = encodedPath.split("/").map(decodeURIComponent).join("/");
    } catch {
        return null;
    }
    const searchParams = queryIndex >= 0 ? new URLSearchParams(normalized.slice(queryIndex + 1)) : null;
    const commentId = parseCommentId(searchParams?.get("comment") ?? null);
    return commentId ? { path, commentId } : { path };
}

export function parsePrFileHash(rawHash: string): string | null {
    return parsePrFileHashTarget(rawHash)?.path ?? null;
}

export function clearableHashFromPath(path: string | undefined, options?: { isSettingsPath?: boolean; commentId?: number }): string | undefined {
    if (!path) return undefined;
    if (path === PR_SUMMARY_PATH) return undefined;
    if (options?.isSettingsPath) return undefined;
    return buildPrFileHash(path, options?.commentId);
}
