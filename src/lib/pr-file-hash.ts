import { PR_SUMMARY_PATH } from "@/lib/pr-summary";

export const PR_FILE_HASH_PREFIX = "/";

export function buildPrFileHash(path: string): string {
    return `${PR_FILE_HASH_PREFIX}${path}`;
}

export function parsePrFileHash(rawHash: string): string | null {
    const normalized = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
    if (!normalized.startsWith(PR_FILE_HASH_PREFIX)) return null;
    const path = normalized.slice(PR_FILE_HASH_PREFIX.length);
    if (!path) return null;
    return path;
}

export function clearableHashFromPath(path: string | undefined, options?: { isSettingsPath?: boolean }): string | undefined {
    if (!path) return undefined;
    if (path === PR_SUMMARY_PATH) return undefined;
    if (options?.isSettingsPath) return undefined;
    return buildPrFileHash(path);
}
