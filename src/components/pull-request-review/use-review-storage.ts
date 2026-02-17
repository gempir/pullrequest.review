import { useMemo } from "react";
import type { GitHost } from "@/lib/git-host/types";
import { makeVersionedStorageKey, readStorageValue, removeStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

const VIEWED_STORAGE_PREFIX_BASE = "pr_review_viewed";
const VIEWED_STORAGE_PREFIX = makeVersionedStorageKey(VIEWED_STORAGE_PREFIX_BASE, 2);

export function useViewedStorageKey(data?: { host: GitHost; workspace: string; repo: string; pullRequestId: string }) {
    const host = data?.host;
    const workspace = data?.workspace;
    const repo = data?.repo;
    const pullRequestId = data?.pullRequestId;

    return useMemo(() => {
        if (!host || !workspace || !repo || !pullRequestId) return "";
        return `${VIEWED_STORAGE_PREFIX}:${host}:${workspace}/${repo}/${pullRequestId}`;
    }, [host, pullRequestId, repo, workspace]);
}

type ViewedFilesPayload = {
    version: 3;
    entries: Record<string, string>;
};

function isViewedFilesPayload(value: unknown): value is ViewedFilesPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as ViewedFilesPayload;
    if (payload.version !== 3) return false;
    return payload.entries !== undefined && typeof payload.entries === "object";
}

function restoreViewedSet(entries: Record<string, unknown>, fingerprints?: ReadonlyMap<string, string>) {
    const next = new Set<string>();
    for (const [path, fingerprint] of Object.entries(entries)) {
        if (typeof fingerprint !== "string") continue;
        if (!fingerprints || fingerprints.get(path) === fingerprint) {
            next.add(path);
        }
    }
    return next;
}

export function readViewedFiles(storageKey: string, fileDiffFingerprints?: ReadonlyMap<string, string>) {
    if (!storageKey) return new Set<string>();
    try {
        const raw = readStorageValue(storageKey);
        if (!raw) return new Set<string>();

        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
            return new Set(parsed.filter((path): path is string => typeof path === "string"));
        }
        if (isViewedFilesPayload(parsed)) {
            return restoreViewedSet(parsed.entries, fileDiffFingerprints);
        }
        if (parsed && typeof parsed === "object") {
            return restoreViewedSet(parsed as Record<string, unknown>, fileDiffFingerprints);
        }
        return new Set<string>();
    } catch {
        removeStorageValue(storageKey);
        return new Set<string>();
    }
}

export function writeViewedFiles(storageKey: string, viewedFiles: Set<string>, fileDiffFingerprints?: ReadonlyMap<string, string>) {
    if (!storageKey) return;
    if (fileDiffFingerprints && fileDiffFingerprints.size > 0) {
        const entries: Record<string, string> = {};
        let hasEntry = false;
        for (const path of viewedFiles) {
            const fingerprint = fileDiffFingerprints.get(path);
            if (!fingerprint) continue;
            entries[path] = fingerprint;
            hasEntry = true;
        }
        if (!hasEntry) {
            removeStorageValue(storageKey);
            return;
        }
        const payload: ViewedFilesPayload = {
            version: 3,
            entries,
        };
        writeLocalStorageValue(storageKey, JSON.stringify(payload));
        return;
    }
    writeLocalStorageValue(storageKey, JSON.stringify(Array.from(viewedFiles)));
}
