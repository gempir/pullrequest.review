import { useMemo } from "react";
import type { GitHost } from "@/lib/git-host/types";
import { makeVersionedStorageKey, readStorageValue, removeStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

const VIEWED_STORAGE_PREFIX_BASE = "pr_review_viewed";
const VIEWED_STORAGE_PREFIX = makeVersionedStorageKey(VIEWED_STORAGE_PREFIX_BASE, 2);
const VIEWED_VERSIONS_SUFFIX = ":viewed_versions";

type LegacyViewedFilesPayload = {
    version: 3;
    entries: Record<string, string>;
};

type ViewedVersionPayload = {
    version: 1;
    viewedVersionIds: string[];
};

function buildFileVersionId(path: string, fingerprint: string) {
    return `${path}::${fingerprint}`;
}

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

function viewedVersionsStorageKey(storageKey: string) {
    return `${storageKey}${VIEWED_VERSIONS_SUFFIX}`;
}

function isLegacyViewedFilesPayload(value: unknown): value is LegacyViewedFilesPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as LegacyViewedFilesPayload;
    return payload.version === 3 && payload.entries !== undefined && typeof payload.entries === "object";
}

function isViewedVersionPayload(value: unknown): value is ViewedVersionPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as ViewedVersionPayload;
    return payload.version === 1 && Array.isArray(payload.viewedVersionIds);
}

function parseLegacyViewedIds(legacyRaw: string | null, fileDiffFingerprints?: ReadonlyMap<string, string>, knownVersionIds?: ReadonlySet<string>) {
    if (!legacyRaw) return new Set<string>();

    const next = new Set<string>();
    const collectFromPath = (path: string, fingerprint?: string) => {
        if (!fingerprint) return;
        const versionId = buildFileVersionId(path, fingerprint);
        if (!knownVersionIds || knownVersionIds.has(versionId)) {
            next.add(versionId);
        }
    };

    try {
        const parsed = JSON.parse(legacyRaw) as unknown;
        if (Array.isArray(parsed)) {
            for (const path of parsed) {
                if (typeof path !== "string") continue;
                collectFromPath(path, fileDiffFingerprints?.get(path));
            }
            return next;
        }

        const entries = isLegacyViewedFilesPayload(parsed) ? parsed.entries : parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        if (!entries) return next;

        for (const [path, fingerprint] of Object.entries(entries)) {
            if (typeof fingerprint !== "string") continue;
            if (fileDiffFingerprints && fileDiffFingerprints.get(path) !== fingerprint) continue;
            collectFromPath(path, fingerprint);
        }

        return next;
    } catch {
        return new Set<string>();
    }
}

export function readViewedVersionIds(
    storageKey: string,
    {
        fileDiffFingerprints,
        knownVersionIds,
    }: {
        fileDiffFingerprints?: ReadonlyMap<string, string>;
        knownVersionIds?: ReadonlySet<string>;
    } = {},
) {
    if (!storageKey) return new Set<string>();

    const key = viewedVersionsStorageKey(storageKey);
    try {
        const raw = readStorageValue(key);
        if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (isViewedVersionPayload(parsed)) {
                const filtered = parsed.viewedVersionIds.filter((versionId) => !knownVersionIds || knownVersionIds.has(versionId));
                return new Set(filtered);
            }
        }
    } catch {
        removeStorageValue(key);
    }

    return parseLegacyViewedIds(readStorageValue(storageKey), fileDiffFingerprints, knownVersionIds);
}

export function writeViewedVersionIds(storageKey: string, viewedVersionIds: Set<string>) {
    if (!storageKey) return;
    const key = viewedVersionsStorageKey(storageKey);
    if (viewedVersionIds.size === 0) {
        removeStorageValue(key);
        return;
    }
    const payload: ViewedVersionPayload = {
        version: 1,
        viewedVersionIds: Array.from(viewedVersionIds),
    };
    writeLocalStorageValue(key, JSON.stringify(payload));
}
