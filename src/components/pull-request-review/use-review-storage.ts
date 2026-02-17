import { useMemo } from "react";
import type { GitHost } from "@/lib/git-host/types";
import { makeVersionedStorageKey, readStorageValue, removeStorageValue, writeLocalStorageValue } from "@/lib/storage/versioned-local-storage";

const VIEWED_STORAGE_PREFIX_BASE = "pr_review_viewed";
const VIEWED_STORAGE_PREFIX = makeVersionedStorageKey(VIEWED_STORAGE_PREFIX_BASE, 2);
const FILE_HISTORY_SUFFIX = ":history";
const VIEWED_VERSIONS_SUFFIX = ":viewed_versions";
const MAX_HISTORY_VERSIONS_PER_FILE = 10;

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

type LegacyViewedFilesPayload = {
    version: 3;
    entries: Record<string, string>;
};

export type StoredFileDiffSnapshot = {
    type: string;
    name: string;
    prevName?: string;
    hunks: unknown[];
};

export type StoredFileVersion = {
    id: string;
    fingerprint: string;
    observedAt: number;
    lastObservedAt: number;
    sourceCommitHash?: string;
    destinationCommitHash?: string;
    snapshot: StoredFileDiffSnapshot;
};

export type StoredFileHistory = {
    order: string[];
    versions: Record<string, StoredFileVersion>;
};

type FileHistoryPayload = {
    version: 1;
    paths: Record<string, StoredFileHistory>;
};

type ViewedVersionPayload = {
    version: 1;
    viewedVersionIds: string[];
};

export type CurrentFileVersionInput = {
    fingerprint: string;
    snapshot: StoredFileDiffSnapshot;
    sourceCommitHash?: string;
    destinationCommitHash?: string;
};

function isLegacyViewedFilesPayload(value: unknown): value is LegacyViewedFilesPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as LegacyViewedFilesPayload;
    return payload.version === 3 && payload.entries !== undefined && typeof payload.entries === "object";
}

function isFileHistoryPayload(value: unknown): value is FileHistoryPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as FileHistoryPayload;
    return payload.version === 1 && payload.paths !== undefined && typeof payload.paths === "object";
}

function isViewedVersionPayload(value: unknown): value is ViewedVersionPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as ViewedVersionPayload;
    return payload.version === 1 && Array.isArray(payload.viewedVersionIds);
}

function historyStorageKey(storageKey: string) {
    return `${storageKey}${FILE_HISTORY_SUFFIX}`;
}

function viewedVersionsStorageKey(storageKey: string) {
    return `${storageKey}${VIEWED_VERSIONS_SUFFIX}`;
}

function buildFileVersionId(path: string, fingerprint: string) {
    return `${path}::${fingerprint}`;
}

export function readFileVersionHistory(storageKey: string) {
    if (!storageKey) return {} as Record<string, StoredFileHistory>;
    const key = historyStorageKey(storageKey);
    try {
        const raw = readStorageValue(key);
        if (!raw) return {} as Record<string, StoredFileHistory>;
        const parsed = JSON.parse(raw) as unknown;
        if (!isFileHistoryPayload(parsed)) return {} as Record<string, StoredFileHistory>;
        return parsed.paths;
    } catch {
        removeStorageValue(key);
        return {} as Record<string, StoredFileHistory>;
    }
}

export function writeFileVersionHistory(storageKey: string, historyByPath: Record<string, StoredFileHistory>) {
    if (!storageKey) return;
    const key = historyStorageKey(storageKey);
    if (Object.keys(historyByPath).length === 0) {
        removeStorageValue(key);
        return;
    }
    const payload: FileHistoryPayload = {
        version: 1,
        paths: historyByPath,
    };
    writeLocalStorageValue(key, JSON.stringify(payload));
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

function toHistoryOrder(versions: Record<string, StoredFileVersion>) {
    return Object.values(versions)
        .sort((a, b) => b.lastObservedAt - a.lastObservedAt)
        .map((version) => version.id);
}

export function mergeCurrentFileVersionsIntoHistory(
    historyByPath: Record<string, StoredFileHistory>,
    currentByPath: ReadonlyMap<string, CurrentFileVersionInput>,
    limit = MAX_HISTORY_VERSIONS_PER_FILE,
) {
    let changed = false;
    const nextHistoryByPath: Record<string, StoredFileHistory> = { ...historyByPath };

    for (const [path, current] of currentByPath.entries()) {
        const currentVersionId = buildFileVersionId(path, current.fingerprint);
        const existingPathHistory = nextHistoryByPath[path] ?? { order: [], versions: {} };
        const existingVersion = existingPathHistory.versions[currentVersionId];

        const nextVersions: Record<string, StoredFileVersion> = { ...existingPathHistory.versions };
        const now = Date.now();

        if (existingVersion) {
            nextVersions[currentVersionId] = {
                ...existingVersion,
                lastObservedAt: now,
                sourceCommitHash: current.sourceCommitHash ?? existingVersion.sourceCommitHash,
                destinationCommitHash: current.destinationCommitHash ?? existingVersion.destinationCommitHash,
                snapshot: current.snapshot,
            };
        } else {
            nextVersions[currentVersionId] = {
                id: currentVersionId,
                fingerprint: current.fingerprint,
                observedAt: now,
                lastObservedAt: now,
                sourceCommitHash: current.sourceCommitHash,
                destinationCommitHash: current.destinationCommitHash,
                snapshot: current.snapshot,
            };
        }

        const ordered = toHistoryOrder(nextVersions).slice(0, limit);
        const trimmedVersions: Record<string, StoredFileVersion> = {};
        for (const versionId of ordered) {
            const version = nextVersions[versionId];
            if (version) trimmedVersions[versionId] = version;
        }

        const nextPathHistory: StoredFileHistory = {
            order: ordered,
            versions: trimmedVersions,
        };

        const prevPathHistory = nextHistoryByPath[path];
        const sameOrder =
            prevPathHistory &&
            prevPathHistory.order.length === nextPathHistory.order.length &&
            prevPathHistory.order.every((id, index) => id === nextPathHistory.order[index]);

        let sameVersions = true;
        if (prevPathHistory && sameOrder) {
            for (const versionId of nextPathHistory.order) {
                const prevVersion = prevPathHistory.versions[versionId];
                const nextVersion = nextPathHistory.versions[versionId];
                if (
                    !prevVersion ||
                    !nextVersion ||
                    prevVersion.lastObservedAt !== nextVersion.lastObservedAt ||
                    prevVersion.sourceCommitHash !== nextVersion.sourceCommitHash ||
                    prevVersion.destinationCommitHash !== nextVersion.destinationCommitHash ||
                    prevVersion.snapshot !== nextVersion.snapshot
                ) {
                    sameVersions = false;
                    break;
                }
            }
        } else {
            sameVersions = false;
        }

        if (!sameVersions) {
            changed = true;
            nextHistoryByPath[path] = nextPathHistory;
        }
    }

    return changed ? nextHistoryByPath : historyByPath;
}

export function collectKnownVersionIds(historyByPath: Record<string, StoredFileHistory>) {
    const ids = new Set<string>();
    for (const pathHistory of Object.values(historyByPath)) {
        for (const versionId of pathHistory.order) {
            ids.add(versionId);
        }
    }
    return ids;
}

export function buildLatestVersionIdByPath(historyByPath: Record<string, StoredFileHistory>) {
    const map = new Map<string, string>();
    for (const [path, pathHistory] of Object.entries(historyByPath)) {
        const latest = pathHistory.order[0];
        if (!latest) continue;
        map.set(path, latest);
    }
    return map;
}

export function cleanupViewedVersionIds(viewedVersionIds: Set<string>, knownVersionIds: ReadonlySet<string>) {
    let changed = false;
    const next = new Set<string>();
    for (const versionId of viewedVersionIds) {
        if (!knownVersionIds.has(versionId)) {
            changed = true;
            continue;
        }
        next.add(versionId);
    }
    return changed ? next : viewedVersionIds;
}

export function getVersionLabel(version: StoredFileVersion, isLatest: boolean, index: number) {
    if (isLatest) return "Latest";
    const sourceCommit = version.sourceCommitHash?.slice(0, 8);
    if (sourceCommit) return sourceCommit;
    return `v${index + 1}`;
}
